#!/usr/bin/env python3
"""Run standard Python quality gates with concise reporting."""

from __future__ import annotations

import argparse
import json
import shlex
import shutil
import subprocess
import sys
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
    parser = argparse.ArgumentParser(description="Run formatter, lint, typecheck, and tests.")
    parser.add_argument("--repo-root", default=".", help="Repository root where commands run.")
    parser.add_argument("--fix", action="store_true", help="Apply auto-fixes when supported.")
    parser.add_argument("--skip-format", action="store_true", help="Skip formatting gate.")
    parser.add_argument("--skip-lint", action="store_true", help="Skip lint gate.")
    parser.add_argument("--skip-typecheck", action="store_true", help="Skip static typing gate.")
    parser.add_argument("--skip-tests", action="store_true", help="Skip pytest gate.")
    parser.add_argument("--with-security", action="store_true", help="Run pip-audit when available.")
    parser.add_argument("--coverage", action="store_true", help="Run pytest with coverage output.")
    parser.add_argument(
        "--min-coverage",
        type=int,
        default=0,
        help="Fail if coverage is below this percentage. Implies --coverage.",
    )
    parser.add_argument(
        "--typechecker",
        choices=["auto", "mypy", "pyright", "none"],
        default="auto",
        help="Type checker command to use.",
    )
    parser.add_argument(
        "--allow-missing-tools",
        action="store_true",
        help="Mark missing external tools as skipped instead of failed.",
    )
    parser.add_argument("--stop-on-fail", action="store_true", help="Stop after first failed gate.")
    parser.add_argument("--typecheck-target", default=".", help="Target passed to the selected type checker.")
    parser.add_argument("--pytest-args", default="-q", help="Raw arguments forwarded to pytest.")
    parser.add_argument("--json-report", default="", help="Optional path to write a JSON report.")
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
) -> GateResult:
    if required_tool and not check_tool(required_tool):
        note = f"Required tool not found: {required_tool}"
        if allow_missing_tools:
            return GateResult(name=name, status="skipped", command=command, exit_code=0, note=note)
        return GateResult(name=name, status="failed", command=command, exit_code=127, note=note)

    exit_code = run_command(command, repo_root)
    status = "passed" if exit_code == 0 else "failed"
    return GateResult(name=name, status=status, command=command, exit_code=exit_code)


def detect_typechecker(repo_root: Path, preferred: str) -> tuple[str | None, list[str], str | None]:
    if preferred == "none":
        return None, [], None
    if preferred == "mypy":
        return "mypy", ["mypy"], "mypy"
    if preferred == "pyright":
        return "pyright", ["pyright"], "pyright"

    pyproject = (repo_root / "pyproject.toml").read_text(encoding="utf-8") if (repo_root / "pyproject.toml").exists() else ""
    if (repo_root / "pyrightconfig.json").exists() or "[tool.pyright]" in pyproject:
        return "pyright", ["pyright"], "pyright"
    return "mypy", ["mypy"], "mypy"


def build_pytest_command(args: argparse.Namespace) -> list[str]:
    command = [sys.executable, "-m", "pytest", *shlex.split(args.pytest_args)]
    coverage_enabled = args.coverage or args.min_coverage > 0
    if coverage_enabled:
        command.extend(["--cov=.", "--cov-report=term-missing"])
    if args.min_coverage > 0:
        command.append(f"--cov-fail-under={args.min_coverage}")
    return command


def print_summary(results: list[GateResult]) -> None:
    print("\nSummary:")
    for result in results:
        printable_command = " ".join(shlex.quote(part) for part in result.command)
        suffix = f" ({result.note})" if result.note else ""
        print(
            f"- {result.name}: {result.status.upper()} "
            f"(exit={result.exit_code}) -> {printable_command}{suffix}"
        )


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
    results: list[GateResult] = []
    gates: list[tuple[str, list[str], str | None]] = []

    if not args.skip_format:
        format_command = ["ruff", "format", "."]
        if not args.fix:
            format_command.insert(2, "--check")
        gates.append(("format", format_command, "ruff"))

    if not args.skip_lint:
        lint_command = ["ruff", "check", "."]
        if args.fix:
            lint_command.append("--fix")
        gates.append(("lint", lint_command, "ruff"))

    if not args.skip_typecheck:
        typechecker_name, typechecker_prefix, required_tool = detect_typechecker(repo_root, args.typechecker)
        if typechecker_name == "mypy":
            gates.append(("typecheck", [*typechecker_prefix, *shlex.split(args.typecheck_target)], required_tool))
        elif typechecker_name == "pyright":
            gates.append(("typecheck", [*typechecker_prefix, *shlex.split(args.typecheck_target)], required_tool))

    if not args.skip_tests:
        gates.append(("tests", build_pytest_command(args), None))

    if args.with_security:
        gates.append(("security", ["pip-audit"], "pip-audit"))

    if not gates:
        print("No gates selected.")
        return 0

    for name, command, required_tool in gates:
        result = execute_gate(
            name=name,
            command=command,
            repo_root=repo_root,
            required_tool=required_tool,
            allow_missing_tools=args.allow_missing_tools,
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
