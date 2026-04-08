#!/usr/bin/env python3
"""Scaffold a production-ready Python project skeleton."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a Python project with strong defaults.")
    parser.add_argument("--repo-root", default=".", help="Repository root to scaffold.")
    parser.add_argument(
        "--package",
        required=True,
        help="Import package path, for example: mypkg or myorg.mypkg",
    )
    parser.add_argument(
        "--project-name",
        default="",
        help="Distribution name used in pyproject.toml (default: derived from package).",
    )
    parser.add_argument(
        "--description",
        default="Production-grade Python package.",
        help="Project description.",
    )
    parser.add_argument(
        "--python-version",
        default="3.11",
        help="Minimum supported Python version (major.minor).",
    )
    parser.add_argument(
        "--app-kind",
        choices=["library", "cli", "api", "worker", "pipeline"],
        default="library",
        help="Project archetype to scaffold.",
    )
    parser.add_argument(
        "--package-manager",
        choices=["pip", "uv"],
        default="pip",
        help="Developer install flow documented in README and CI.",
    )
    parser.add_argument(
        "--with-ci",
        action="store_true",
        help="Generate a GitHub Actions CI workflow.",
    )
    parser.add_argument(
        "--with-pyright",
        action="store_true",
        help="Add pyright configuration alongside mypy.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files.",
    )
    return parser.parse_args()


def validate_package(package: str) -> None:
    pattern = r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$"
    if not re.fullmatch(pattern, package):
        raise SystemExit(f"Invalid package path: {package!r}")


def validate_python_version(version: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)", version)
    if not match:
        raise SystemExit(f"Invalid --python-version value: {version!r}. Expected major.minor")
    return int(match.group(1)), int(match.group(2))


def derive_project_name(package: str, explicit: str) -> str:
    candidate = explicit.strip() if explicit else package.split(".", 1)[0].replace("_", "-")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", candidate):
        raise SystemExit(f"Invalid project name: {candidate!r}")
    return candidate


def to_ruff_target(python_version: tuple[int, int]) -> str:
    major, minor = python_version
    return f"py{major}{minor}"


def write_text(path: Path, content: str, force: bool) -> str:
    if path.exists() and not force:
        return "skipped"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return "written"


def render_pyproject(
    *,
    project_name: str,
    description: str,
    package: str,
    python_version: tuple[int, int],
    app_kind: str,
    with_pyright: bool,
) -> str:
    python_literal = f"{python_version[0]}.{python_version[1]}"
    ruff_target = to_ruff_target(python_version)
    dependencies: list[str] = []
    scripts_section = ""

    if app_kind == "cli":
        scripts_section = (
            "\n[project.scripts]\n"
            f"{project_name.replace('-', '_')} = \"{package}.cli:main\"\n"
        )
    elif app_kind == "worker":
        scripts_section = (
            "\n[project.scripts]\n"
            f"{project_name.replace('-', '_')}_worker = \"{package}.worker:main\"\n"
        )
    elif app_kind == "pipeline":
        scripts_section = (
            "\n[project.scripts]\n"
            f"{project_name.replace('-', '_')}_pipeline = \"{package}.pipeline:main\"\n"
        )
    elif app_kind == "api":
        dependencies.extend([
            '"fastapi>=0.115.0"',
            '"uvicorn[standard]>=0.30.0"',
        ])

    dev_dependencies = [
        '"pytest>=8.0.0"',
        '"pytest-cov>=5.0.0"',
        '"mypy>=1.10.0"',
        '"ruff>=0.6.0"',
    ]
    if with_pyright:
        dev_dependencies.append('"pyright>=1.1.380"')

    dependency_block = ",\n  ".join(dependencies)
    if dependency_block:
        dependency_block = f"[\n  {dependency_block}\n]"
    else:
        dependency_block = "[]"
    dev_dependency_block = ",\n  ".join(dev_dependencies)

    pyright_block = ""
    if with_pyright:
        pyright_block = """
[tool.pyright]
typeCheckingMode = "strict"
venvPath = "."
venv = ".venv"
"""

    return f"""[build-system]
requires = ["hatchling>=1.25.0"]
build-backend = "hatchling.build"

[project]
name = "{project_name}"
version = "0.1.0"
description = "{description}"
readme = "README.md"
requires-python = ">={python_literal}"
dependencies = {dependency_block}{scripts_section}

[project.optional-dependencies]
dev = [
  {dev_dependency_block}
]

[tool.ruff]
line-length = 100
target-version = "{ruff_target}"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "W"]

[tool.mypy]
python_version = "{python_literal}"
strict = true
warn_unused_ignores = true
warn_redundant_casts = true

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs = false
{pyright_block}
[tool.coverage.run]
source = ["src"]

[tool.coverage.report]
show_missing = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra"
"""


def render_gitignore() -> str:
    return """# Python artifacts
__pycache__/
*.py[cod]
*.egg-info/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.pyright/
.coverage
htmlcov/

# Virtual environments
.venv/
venv/

# Editors and OS
.DS_Store
.idea/
.vscode/
"""


def render_readme(project_name: str, package: str, app_kind: str, package_manager: str) -> str:
    if package_manager == "uv":
        quickstart = "uv sync --extra dev\nuv run pytest -q"
    else:
        quickstart = "python -m pip install -e .[dev]\npython -m pytest -q"

    if app_kind == "cli":
        usage_block = f"python -m {package}.cli"
    elif app_kind == "worker":
        usage_block = f"python -m {package}.worker"
    elif app_kind == "pipeline":
        usage_block = f"python -m {package}.pipeline"
    elif app_kind == "api":
        usage_block = f"uvicorn {package}.api:app --reload"
    else:
        usage_block = f"python -c \"from {package}.service import summarize_values; print(summarize_values([1, 2, 3]))\""

    return f"""# {project_name}

Structured, testable Python project scaffolded with python-pro defaults.

## Quickstart

```bash
{quickstart}
```

## Basic usage

```bash
{usage_block}
```
"""


def render_namespace_init(root_part: str, is_leaf: bool) -> str:
    if is_leaf:
        return f'''"""Top-level package for {root_part}."""

from .service import summarize_values

__all__ = ["summarize_values"]
'''
    return f'''"""Namespace package segment: {root_part}."""'''


def render_errors_module() -> str:
    return '''"""Domain-specific exception hierarchy."""


class AppError(Exception):
    """Base exception for this project."""


class ValidationError(AppError):
    """Raised when caller input fails validation."""
'''


def render_service_module() -> str:
    return '''"""Core business logic primitives."""

from __future__ import annotations

from .errors import ValidationError


def summarize_values(values: list[float]) -> float:
    """Return the arithmetic mean for a non-empty sequence."""
    if not values:
        raise ValidationError("values must not be empty")
    return sum(values) / len(values)
'''


def render_cli_module(package: str) -> str:
    return f'''"""CLI entrypoint for {package}."""

from __future__ import annotations

from .service import summarize_values


def main() -> None:
    values = [1.0, 2.0, 3.0]
    print(f"mean={{summarize_values(values):.2f}}")


if __name__ == "__main__":
    main()
'''


def render_worker_module(package: str) -> str:
    return f'''"""Worker entrypoint for {package}."""

from __future__ import annotations

from .service import summarize_values


def run_once() -> None:
    print(f"worker-mean={{summarize_values([3.0, 6.0, 9.0]):.2f}}")


def main() -> None:
    run_once()


if __name__ == "__main__":
    main()
'''


def render_api_module() -> str:
    return '''"""API entrypoint using FastAPI."""

from __future__ import annotations

from fastapi import FastAPI

from .service import summarize_values

app = FastAPI(title="python-pro-api")


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/mean")
def mean() -> dict[str, float]:
    return {"value": summarize_values([1.0, 2.0, 3.0])}
'''


def render_pipeline_module(package: str) -> str:
    return f'''"""Pipeline entrypoint for {package}."""

from __future__ import annotations

from .service import summarize_values


def run_pipeline() -> dict[str, float]:
    values = [10.0, 15.0, 20.0]
    return {{
        "count": float(len(values)),
        "mean": summarize_values(values),
    }}


def main() -> None:
    result = run_pipeline()
    print(f"pipeline-count={{result['count']:.0f}} mean={{result['mean']:.2f}}")


if __name__ == "__main__":
    main()
'''


def render_conftest() -> str:
    return '''"""Shared pytest configuration for local src-layout imports."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
'''


def render_smoke_test(package: str) -> str:
    return f'''from __future__ import annotations

import pytest

from {package}.errors import ValidationError
from {package}.service import summarize_values


def test_summarize_values_returns_mean() -> None:
    assert summarize_values([2.0, 4.0, 6.0]) == pytest.approx(4.0)


def test_summarize_values_rejects_empty_input() -> None:
    with pytest.raises(ValidationError):
        summarize_values([])
'''


def render_api_test(package: str) -> str:
    return f'''from __future__ import annotations

from {package}.api import app


def test_app_has_health_route() -> None:
    paths = {{route.path for route in app.routes}}
    assert "/healthz" in paths
'''


def render_pipeline_test(package: str) -> str:
    return f'''from __future__ import annotations

from {package}.pipeline import run_pipeline


def test_pipeline_returns_summary() -> None:
    result = run_pipeline()

    assert result["count"] == 3
    assert result["mean"] == 15.0
'''


def render_ci_workflow(package_manager: str) -> str:
    if package_manager == "uv":
        install_block = """      - uses: astral-sh/setup-uv@v5
      - name: Install dependencies
        run: uv sync --extra dev
      - name: Run quality gates
        run: uv run python -m pytest -q && uv run ruff format --check . && uv run ruff check . && uv run mypy .
"""
    else:
        install_block = """      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          python -m pip install -e .[dev]
      - name: Run quality gates
        run: |
          ruff format --check .
          ruff check .
          mypy .
          pytest -q
"""

    return f"""name: python-ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
{install_block}"""


def build_file_map(args: argparse.Namespace, project_name: str, python_version: tuple[int, int]) -> dict[Path, str]:
    repo_root = Path(args.repo_root).resolve()
    package_parts = args.package.split(".")
    package_root = repo_root / "src" / Path(*package_parts)

    files: dict[Path, str] = {
        repo_root / "pyproject.toml": render_pyproject(
            project_name=project_name,
            description=args.description,
            package=args.package,
            python_version=python_version,
            app_kind=args.app_kind,
            with_pyright=args.with_pyright,
        ),
        repo_root / ".gitignore": render_gitignore(),
        repo_root / "README.md": render_readme(project_name, args.package, args.app_kind, args.package_manager),
        repo_root / "tests/conftest.py": render_conftest(),
        repo_root / "tests/test_smoke.py": render_smoke_test(args.package),
        package_root / "errors.py": render_errors_module(),
        package_root / "service.py": render_service_module(),
    }

    for index, part in enumerate(package_parts):
        subpath = repo_root / "src" / Path(*package_parts[: index + 1]) / "__init__.py"
        files[subpath] = render_namespace_init(part, index == len(package_parts) - 1)

    if args.app_kind == "cli":
        files[package_root / "cli.py"] = render_cli_module(args.package)
    elif args.app_kind == "worker":
        files[package_root / "worker.py"] = render_worker_module(args.package)
    elif args.app_kind == "pipeline":
        files[package_root / "pipeline.py"] = render_pipeline_module(args.package)
        files[repo_root / "tests/test_pipeline_smoke.py"] = render_pipeline_test(args.package)
    elif args.app_kind == "api":
        files[package_root / "api.py"] = render_api_module()
        files[repo_root / "tests/test_api_smoke.py"] = render_api_test(args.package)

    if args.with_ci:
        files[repo_root / ".github/workflows/python-ci.yml"] = render_ci_workflow(args.package_manager)

    return files


def main() -> int:
    args = parse_args()
    validate_package(args.package)
    python_version = validate_python_version(args.python_version)
    project_name = derive_project_name(args.package, args.project_name)
    files = build_file_map(args, project_name, python_version)

    print(f"Scaffolding in: {Path(args.repo_root).resolve()}")
    created = 0
    skipped = 0
    for file_path, content in files.items():
        status = write_text(file_path, content, args.force)
        print(f"[{status.upper()}] {file_path}")
        if status == "written":
            created += 1
        else:
            skipped += 1

    print(f"\nDone. written={created}, skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
