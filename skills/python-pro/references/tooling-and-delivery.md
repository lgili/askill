# Tooling And Delivery

## Baseline Toolchain

- Formatter and import ordering: `ruff format` (or `black` + `isort`).
- Linting: `ruff check`.
- Type checking: `mypy` or `pyright`, chosen intentionally and configured explicitly.
- Tests: `pytest`.
- Security/dependency scanning: `pip-audit` (or equivalent).
- Lockfile-aware environment management: `uv` when the team already standardizes on it.

## Suggested Local Command Sequence

```bash
ruff format .
ruff check . --fix
mypy .
pytest -q
```

Adjust commands to project defaults if they already exist.

## Bundled Automation Scripts

Use the skill scripts for consistent execution patterns:

```bash
# Bootstrap a new repository baseline
python /Users/lgili/.codex/skills/python-pro/scripts/bootstrap_python_project.py \
  --repo-root /path/to/repo \
  --package mypkg \
  --app-kind library

# Run local quality gates with one command
python /Users/lgili/.codex/skills/python-pro/scripts/run_quality_gates.py \
  --repo-root /path/to/repo

# Scaffold a new unit test template
python /Users/lgili/.codex/skills/python-pro/scripts/scaffold_test_template.py \
  --repo-root /path/to/repo \
  --name "user creation" \
  --kind unit \
  --package mypkg

# Audit an existing repository before a large refactor
python /Users/lgili/.codex/skills/python-pro/scripts/audit_python_project.py \
  --repo-root /path/to/repo \
  --json
```

## `pyproject.toml` Skeleton

```toml
[project]
name = "my-package"
version = "0.1.0"
requires-python = ">=3.11"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
warn_redundant_casts = true

[tool.pyright]
typeCheckingMode = "strict"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra"
```

## CI Pipeline Minimum

1. Install dependencies with lockfile-aware strategy.
2. Run formatting/lint checks.
3. Run static type checks.
4. Run tests, preferably with coverage for the changed critical paths.
5. Run dependency/security audit for production services or distributable libraries.
6. Publish artifacts only if all gates pass.

## Release Checklist

- Version bump and changelog update.
- Confirm migration notes for breaking changes.
- Regenerate generated artifacts/docs as needed.
- Tag release from a green commit.
- Validate package metadata and installability.

## Dependency Hygiene

- Keep direct dependencies minimal and pinned by policy.
- Remove unused dependencies regularly.
- Track vulnerability alerts and patch quickly.
- Avoid unmaintained packages in critical paths.

## Primary References

- [PyPA Packaging Guide](https://packaging.python.org/en/latest/)
- [Pyproject Specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [mypy Documentation](https://mypy.readthedocs.io/)
- [pyright Documentation](https://microsoft.github.io/pyright/)
- [pip-audit](https://pypi.org/project/pip-audit/)
