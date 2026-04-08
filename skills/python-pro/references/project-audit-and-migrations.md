# Project Audit And Migrations

## When To Use This Guide

Use this reference when inheriting a Python repository that feels inconsistent,
under-tested, weakly typed, or split across multiple configuration styles.

## Initial Audit Checklist

1. Packaging
   - Is there a single `pyproject.toml` or a fragmented mix of `setup.py`, `setup.cfg`, and requirements files?
   - Is the package layout `src/`-based or flat, and is that choice intentional?

2. Quality tooling
   - Are Ruff/Black/isort, pytest, and mypy/pyright configured centrally?
   - Does CI run the same checks developers run locally?

3. Code organization
   - Are domain rules mixed with frameworks, database calls, or transport code?
   - Are modules small enough to reason about without scrolling through hundreds of lines?

4. Typing
   - Are public APIs typed?
   - Are boundary payloads and config structures explicit?
   - Are `Any`, `dict`, and untyped tuples hiding important contracts?

5. Tests
   - Are there smoke tests only, or are there real unit/integration/regression layers?
   - Are flaky tests masking structural problems?

## Modernization Priorities

- First, stabilize behavior with tests.
- Second, centralize packaging and tooling in `pyproject.toml`.
- Third, isolate domain logic from framework and infrastructure code.
- Fourth, tighten typing at public boundaries.
- Fifth, standardize CI and release checks.

## Safe Migration Sequence

1. Add a focused audit report.
2. Freeze behavior with smoke and regression tests.
3. Move tooling config into `pyproject.toml`.
4. Introduce `src/` layout only if import confusion or packaging errors justify it.
5. Add or raise typing strictness gradually.
6. Remove deprecated configuration files after the replacement is stable.

## Warning Signs

- Multiple competing entrypoints with different runtime assumptions.
- Environment variables read deep in business logic.
- Network/database calls inside modules that should be pure.
- Test suites that require manual setup or sleep-based timing.
- CI that passes while local development cannot reproduce the same commands.

## Useful Tooling

- `scripts/audit_python_project.py` for quick baseline inspection.
- `scripts/run_quality_gates.py` for repeatable local checks.
- `scripts/scaffold_test_template.py` to accelerate missing regression coverage.

## Primary References

- [PyPA Packaging Guide](https://packaging.python.org/)
- [pyproject.toml Specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)
