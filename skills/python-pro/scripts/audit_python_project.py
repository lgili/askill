#!/usr/bin/env python3
"""Audit the baseline quality of a Python repository."""

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
    parser = argparse.ArgumentParser(description="Audit Python project structure and tooling.")
    parser.add_argument("--repo-root", default=".", help="Repository root to inspect.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero when warnings are found.",
    )
    return parser.parse_args()


def has_any(root: Path, *relative_paths: str) -> bool:
    return any((root / relative_path).exists() for relative_path in relative_paths)


def audit(repo_root: Path) -> list[AuditItem]:
    pyproject = repo_root / "pyproject.toml"
    pyproject_text = pyproject.read_text(encoding="utf-8") if pyproject.exists() else ""
    src_dir = repo_root / "src"
    tests_dir = repo_root / "tests"
    ci_dir = repo_root / ".github" / "workflows"

    items = [
        AuditItem(
            name="packaging",
            status="pass" if pyproject.exists() else "warn",
            detail="pyproject.toml found" if pyproject.exists() else "pyproject.toml missing",
            recommendation="Consolidate packaging and tool config in pyproject.toml." if not pyproject.exists() else "",
        ),
        AuditItem(
            name="layout",
            status="pass" if src_dir.exists() else "warn",
            detail="src layout present" if src_dir.exists() else "src layout not detected",
            recommendation="Consider src/ layout for packages that ship artifacts or suffer import confusion." if not src_dir.exists() else "",
        ),
        AuditItem(
            name="tests",
            status="pass" if tests_dir.exists() else "warn",
            detail="tests directory present" if tests_dir.exists() else "tests directory missing",
            recommendation="Add at least smoke and regression tests before large refactors." if not tests_dir.exists() else "",
        ),
        AuditItem(
            name="ruff",
            status="pass" if "[tool.ruff]" in pyproject_text or has_any(repo_root, "ruff.toml", ".ruff.toml") else "warn",
            detail="ruff configured" if "[tool.ruff]" in pyproject_text or has_any(repo_root, "ruff.toml", ".ruff.toml") else "ruff config missing",
            recommendation="Configure Ruff for formatting and linting." if "[tool.ruff]" not in pyproject_text and not has_any(repo_root, "ruff.toml", ".ruff.toml") else "",
        ),
        AuditItem(
            name="typing",
            status="pass" if "[tool.mypy]" in pyproject_text or "[tool.pyright]" in pyproject_text or has_any(repo_root, "mypy.ini", "pyrightconfig.json") else "warn",
            detail="type checker configured" if "[tool.mypy]" in pyproject_text or "[tool.pyright]" in pyproject_text or has_any(repo_root, "mypy.ini", "pyrightconfig.json") else "type checker config missing",
            recommendation="Add mypy or pyright with explicit strictness." if "[tool.mypy]" not in pyproject_text and "[tool.pyright]" not in pyproject_text and not has_any(repo_root, "mypy.ini", "pyrightconfig.json") else "",
        ),
        AuditItem(
            name="pytest",
            status="pass" if "[tool.pytest.ini_options]" in pyproject_text or has_any(repo_root, "pytest.ini", "tox.ini") else "warn",
            detail="pytest configured" if "[tool.pytest.ini_options]" in pyproject_text or has_any(repo_root, "pytest.ini", "tox.ini") else "pytest config missing",
            recommendation="Add pytest config and test paths." if "[tool.pytest.ini_options]" not in pyproject_text and not has_any(repo_root, "pytest.ini", "tox.ini") else "",
        ),
        AuditItem(
            name="ci",
            status="pass" if ci_dir.exists() and any(ci_dir.iterdir()) else "warn",
            detail="CI workflow present" if ci_dir.exists() and any(ci_dir.iterdir()) else "CI workflow missing",
            recommendation="Add CI that mirrors local quality gates." if not (ci_dir.exists() and any(ci_dir.iterdir())) else "",
        ),
        AuditItem(
            name="lockfile",
            status="pass" if has_any(repo_root, "uv.lock", "poetry.lock", "requirements.txt", "requirements-dev.txt") else "warn",
            detail="lockfile or requirements file present" if has_any(repo_root, "uv.lock", "poetry.lock", "requirements.txt", "requirements-dev.txt") else "no obvious dependency pinning file found",
            recommendation="Use a lockfile or explicit requirements management policy." if not has_any(repo_root, "uv.lock", "poetry.lock", "requirements.txt", "requirements-dev.txt") else "",
        ),
    ]

    return items


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
