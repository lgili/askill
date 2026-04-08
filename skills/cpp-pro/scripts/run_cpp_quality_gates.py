#!/usr/bin/env python3
"""Run standard C++ quality gates with concise reporting."""

from __future__ import annotations

import argparse
import json
import shlex
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class GateResult:
    name: str
    status: str
    command: list[str]
    exit_code: int
    note: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run configure, build, test, and optional C++ tooling gates.")
    parser.add_argument("--repo-root", default=".", help="Repository root where commands run.")
    parser.add_argument("--preset", default="", help="Optional CMake preset used for configure/build/test.")
    parser.add_argument("--build-dir", default="build", help="Build directory when no preset is used.")
    parser.add_argument("--compile-commands-dir", default="", help="Directory containing compile_commands.json.")
    parser.add_argument("--build-type", default="Debug", help="CMAKE_BUILD_TYPE when no preset is used.")
    parser.add_argument("--generator", default="", help="Optional CMake generator when no preset is used.")
    parser.add_argument("--target", default="", help="Optional build target.")
    parser.add_argument("--cxx-standard", choices=["17", "20", "23"], default="20", help="Standard passed to cppcheck.")
    parser.add_argument("--skip-configure", action="store_true", help="Skip cmake configure.")
    parser.add_argument("--skip-build", action="store_true", help="Skip cmake build.")
    parser.add_argument("--skip-tests", action="store_true", help="Skip ctest.")
    parser.add_argument("--skip-format", action="store_true", help="Skip clang-format.")
    parser.add_argument("--skip-clang-tidy", action="store_true", help="Skip clang-tidy.")
    parser.add_argument("--skip-cppcheck", action="store_true", help="Skip cppcheck.")
    parser.add_argument("--format-fix", action="store_true", help="Apply clang-format in place.")
    parser.add_argument("--allow-missing-tools", action="store_true", help="Skip gates when the required tool is missing.")
    parser.add_argument("--stop-on-fail", action="store_true", help="Stop after the first failed gate.")
    parser.add_argument("--json-report", default="", help="Optional path to write a JSON report.")
    parser.add_argument("--configure-arg", action="append", default=[], help="Extra argument passed to cmake configure.")
    parser.add_argument("--build-arg", action="append", default=[], help="Extra argument passed to cmake --build.")
    parser.add_argument("--ctest-arg", action="append", default=[], help="Extra argument passed to ctest.")
    return parser.parse_args()


def check_tool(name: str) -> bool:
    return shutil.which(name) is not None


def run_command(command: list[str], cwd: Path) -> int:
    printable = " ".join(shlex.quote(part) for part in command)
    print(f"\n$ {printable}", flush=True)
    completed = subprocess.run(command, cwd=cwd, check=False)
    return completed.returncode


def execute_gate(
    *,
    name: str,
    command: list[str],
    repo_root: Path,
    required_tool: str | None,
    allow_missing_tools: bool,
    note: str = "",
) -> GateResult:
    if required_tool and not check_tool(required_tool):
        missing_note = f"Required tool not found: {required_tool}"
        if note:
            missing_note = f"{missing_note}; {note}"
        if allow_missing_tools:
            return GateResult(name=name, status="skipped", command=command, exit_code=0, note=missing_note)
        return GateResult(name=name, status="failed", command=command, exit_code=127, note=missing_note)

    exit_code = run_command(command, repo_root)
    status = "passed" if exit_code == 0 else "failed"
    return GateResult(name=name, status=status, command=command, exit_code=exit_code, note=note)


def find_source_files(repo_root: Path) -> list[str]:
    patterns = ("*.h", "*.hh", "*.hpp", "*.c", "*.cc", "*.cpp", "*.cxx")
    files: list[Path] = []
    for directory_name in ("include", "src", "apps", "tests", "benchmarks"):
        directory = repo_root / directory_name
        if not directory.exists():
            continue
        for pattern in patterns:
            files.extend(directory.rglob(pattern))
    return sorted(str(path.relative_to(repo_root)) for path in files if path.is_file())


def read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def resolve_preset_binary_dir(repo_root: Path, preset: str) -> str | None:
    presets_path = repo_root / "CMakePresets.json"
    payload = read_json(presets_path)
    if not payload:
        return None

    presets = {entry["name"]: entry for entry in payload.get("configurePresets", []) if "name" in entry}

    def collect(name: str, trail: set[str]) -> dict:
        if name in trail or name not in presets:
            return {}
        entry = dict(presets[name])
        inherited: list[str]
        raw_inherits = entry.get("inherits", [])
        if isinstance(raw_inherits, str):
            inherited = [raw_inherits]
        else:
            inherited = [candidate for candidate in raw_inherits if isinstance(candidate, str)]
        merged: dict = {}
        for parent in inherited:
            merged.update(collect(parent, trail | {name}))
        merged.update(entry)
        return merged

    resolved = collect(preset, set())
    binary_dir = resolved.get("binaryDir")
    if not isinstance(binary_dir, str):
        return None
    return binary_dir.replace("${sourceDir}", str(repo_root))


def build_commands(args: argparse.Namespace, repo_root: Path) -> tuple[list[str], list[str], list[str], Path]:
    if args.preset:
        configure = ["cmake", "--preset", args.preset, *args.configure_arg]
        build = ["cmake", "--build", "--preset", args.preset]
        if args.target:
            build.extend(["--target", args.target])
        build.extend(args.build_arg)
        tests = ["ctest", "--preset", args.preset, *args.ctest_arg]
        compile_commands_dir = Path(args.compile_commands_dir) if args.compile_commands_dir else Path(resolve_preset_binary_dir(repo_root, args.preset) or args.build_dir)
    else:
        configure = ["cmake", "-S", ".", "-B", args.build_dir, f"-DCMAKE_BUILD_TYPE={args.build_type}"]
        if args.generator:
            configure.extend(["-G", args.generator])
        configure.extend(args.configure_arg)
        build = ["cmake", "--build", args.build_dir]
        if args.target:
            build.extend(["--target", args.target])
        build.extend(args.build_arg)
        tests = ["ctest", "--test-dir", args.build_dir, "--output-on-failure", *args.ctest_arg]
        compile_commands_dir = Path(args.compile_commands_dir or args.build_dir)

    if not compile_commands_dir.is_absolute():
        compile_commands_dir = repo_root / compile_commands_dir
    return configure, build, tests, compile_commands_dir


def print_summary(results: list[GateResult]) -> None:
    print("\nSummary:")
    for result in results:
        printable = " ".join(shlex.quote(part) for part in result.command)
        suffix = f" ({result.note})" if result.note else ""
        print(f"- {result.name}: {result.status.upper()} (exit={result.exit_code}) -> {printable}{suffix}")


def write_report(path: Path, results: list[GateResult]) -> None:
    payload = {
        "results": [asdict(result) for result in results],
        "ok": all(result.status != "failed" for result in results),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote report: {path}")


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    source_files = find_source_files(repo_root)
    results: list[GateResult] = []

    configure_command, build_command, test_command, compile_commands_dir = build_commands(args, repo_root)

    gates: list[tuple[str, list[str], str | None, str]] = []
    if not args.skip_configure:
        gates.append(("configure", configure_command, "cmake", ""))
    if not args.skip_build:
        gates.append(("build", build_command, "cmake", ""))
    if not args.skip_tests:
        gates.append(("tests", test_command, "ctest", ""))

    if not args.skip_format:
        if source_files:
            format_command = ["clang-format"]
            if args.format_fix:
                format_command.append("-i")
            else:
                format_command.extend(["--dry-run", "--Werror"])
            format_command.extend(source_files)
            gates.append(("format", format_command, "clang-format", ""))
        else:
            results.append(GateResult(name="format", status="skipped", command=["clang-format"], exit_code=0, note="No C/C++ source files found."))

    if not args.skip_clang_tidy:
        if source_files:
            tidy_sources = [path for path in source_files if path.endswith((".cc", ".cpp", ".cxx"))]
            if tidy_sources:
                gates.append(
                    (
                        "clang-tidy",
                        ["clang-tidy", *tidy_sources, "-p", str(compile_commands_dir)],
                        "clang-tidy",
                        f"compile_commands expected in {compile_commands_dir}",
                    )
                )
            else:
                results.append(GateResult(name="clang-tidy", status="skipped", command=["clang-tidy"], exit_code=0, note="No translation units found."))
        else:
            results.append(GateResult(name="clang-tidy", status="skipped", command=["clang-tidy"], exit_code=0, note="No C/C++ source files found."))

    if not args.skip_cppcheck:
        cppcheck_targets = [name for name in ("include", "src", "apps", "tests") if (repo_root / name).exists()]
        if cppcheck_targets:
            gates.append(
                (
                    "cppcheck",
                    [
                        "cppcheck",
                        "--enable=all",
                        f"--std=c++{args.cxx_standard}",
                        "--error-exitcode=1",
                        "--suppress=missingIncludeSystem",
                        *cppcheck_targets,
                    ],
                    "cppcheck",
                    "",
                )
            )
        else:
            results.append(GateResult(name="cppcheck", status="skipped", command=["cppcheck"], exit_code=0, note="No include/src/apps/tests directories found."))

    if not gates and not results:
        print("No gates selected.")
        return 0

    for name, command, required_tool, note in gates:
        result = execute_gate(
            name=name,
            command=command,
            repo_root=repo_root,
            required_tool=required_tool,
            allow_missing_tools=args.allow_missing_tools,
            note=note,
        )
        results.append(result)
        if args.stop_on_fail and result.status == "failed":
            break

    print_summary(results)

    if args.json_report:
        write_report(Path(args.json_report).resolve(), results)

    ok = all(result.status != "failed" for result in results)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
