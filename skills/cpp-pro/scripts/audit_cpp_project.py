#!/usr/bin/env python3
"""Audit the baseline quality of a C++ repository."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class AuditItem:
    name: str
    status: str
    detail: str
    recommendation: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit C++ project structure and tooling.")
    parser.add_argument("--repo-root", default=".", help="Repository root to inspect.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when warnings are found.")
    return parser.parse_args()


def has_any(root: Path, *relative_paths: str) -> bool:
    return any((root / relative_path).exists() for relative_path in relative_paths)


def audit(repo_root: Path) -> list[AuditItem]:
    cmake_lists = repo_root / "CMakeLists.txt"
    presets = repo_root / "CMakePresets.json"
    cmake_text = cmake_lists.read_text(encoding="utf-8") if cmake_lists.exists() else ""
    src_dir = repo_root / "src"
    include_dir = repo_root / "include"
    tests_dir = repo_root / "tests"
    workflows_dir = repo_root / ".github" / "workflows"

    has_compile_commands = has_any(
        repo_root,
        "compile_commands.json",
        "build/compile_commands.json",
        "build/dev/compile_commands.json",
        "build/release/compile_commands.json",
    )
    warnings_configured = any(token in cmake_text for token in ("-Wall", "/W4", "PROJECT_WARNINGS_AS_ERRORS", "target_compile_options"))
    sanitizers_configured = "sanitize" in cmake_text.lower() or "PROJECT_ENABLE_ASAN" in cmake_text or "PROJECT_ENABLE_UBSAN" in cmake_text
    test_registration = any(token in cmake_text for token in ("enable_testing", "gtest_discover_tests", "catch_discover_tests", "add_test"))

    return [
        AuditItem(
            name="cmake",
            status="pass" if cmake_lists.exists() else "warn",
            detail="CMakeLists.txt found" if cmake_lists.exists() else "CMakeLists.txt missing",
            recommendation="Adopt modern CMake as the source of truth for targets and tooling." if not cmake_lists.exists() else "",
        ),
        AuditItem(
            name="layout",
            status="pass" if src_dir.exists() and include_dir.exists() else "warn",
            detail="include/ and src/ layout present" if src_dir.exists() and include_dir.exists() else "include/ or src/ layout missing",
            recommendation="Separate public headers from implementation to improve dependency hygiene." if not (src_dir.exists() and include_dir.exists()) else "",
        ),
        AuditItem(
            name="tests",
            status="pass" if tests_dir.exists() and test_registration else "warn",
            detail="tests directory and registration detected" if tests_dir.exists() and test_registration else "tests directory or CTest registration missing",
            recommendation="Add executable tests and register them with CTest." if not (tests_dir.exists() and test_registration) else "",
        ),
        AuditItem(
            name="presets",
            status="pass" if presets.exists() else "warn",
            detail="CMakePresets.json present" if presets.exists() else "CMakePresets.json missing",
            recommendation="Check in presets to align local and CI build flows." if not presets.exists() else "",
        ),
        AuditItem(
            name="compile-commands",
            status="pass" if has_compile_commands or "CMAKE_EXPORT_COMPILE_COMMANDS" in cmake_text else "warn",
            detail="compile commands export detected" if has_compile_commands or "CMAKE_EXPORT_COMPILE_COMMANDS" in cmake_text else "compile_commands export not detected",
            recommendation="Export compile_commands.json for clang-tidy and editor tooling." if not (has_compile_commands or "CMAKE_EXPORT_COMPILE_COMMANDS" in cmake_text) else "",
        ),
        AuditItem(
            name="warnings",
            status="pass" if warnings_configured else "warn",
            detail="warning policy configured" if warnings_configured else "warning policy not obvious",
            recommendation="Enable strict compiler warnings per target." if not warnings_configured else "",
        ),
        AuditItem(
            name="sanitizers",
            status="pass" if sanitizers_configured else "warn",
            detail="sanitizer support configured" if sanitizers_configured else "sanitizer options not detected",
            recommendation="Add ASan/UBSan build options or presets for debugging and CI." if not sanitizers_configured else "",
        ),
        AuditItem(
            name="clang-tools",
            status="pass" if has_any(repo_root, ".clang-tidy", ".clang-format") else "warn",
            detail="clang tooling config present" if has_any(repo_root, ".clang-tidy", ".clang-format") else "clang-tidy / clang-format config missing",
            recommendation="Check in .clang-tidy and .clang-format for consistent review and formatting." if not has_any(repo_root, ".clang-tidy", ".clang-format") else "",
        ),
        AuditItem(
            name="dependencies",
            status="pass" if has_any(repo_root, "vcpkg.json", "conanfile.txt", "conanfile.py") else "warn",
            detail="package manager file present" if has_any(repo_root, "vcpkg.json", "conanfile.txt", "conanfile.py") else "no package manager file detected",
            recommendation="Adopt vcpkg, Conan, or document a clear dependency acquisition policy." if not has_any(repo_root, "vcpkg.json", "conanfile.txt", "conanfile.py") else "",
        ),
        AuditItem(
            name="ci",
            status="pass" if workflows_dir.exists() and any(workflows_dir.iterdir()) else "warn",
            detail="CI workflow present" if workflows_dir.exists() and any(workflows_dir.iterdir()) else "CI workflow missing",
            recommendation="Add CI that builds, tests, and runs at least one tooling gate." if not (workflows_dir.exists() and any(workflows_dir.iterdir())) else "",
        ),
    ]


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    results = audit(repo_root)

    if args.json:
        payload = {
            "repo_root": str(repo_root),
            "ok": all(item.status == "pass" for item in results),
            "results": [asdict(item) for item in results],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(f"Audit: {repo_root}")
        for item in results:
            symbol = "PASS" if item.status == "pass" else "WARN"
            print(f"- {item.name}: {symbol} - {item.detail}")
            if item.recommendation:
                print(f"  recommendation: {item.recommendation}")

    if args.strict and any(item.status != "pass" for item in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
