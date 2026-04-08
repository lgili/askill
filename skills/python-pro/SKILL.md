---
name: python-pro
description: Senior Python engineering specialist for designing, implementing, reviewing, and refactoring structured, testable, production-grade Python across libraries, CLIs, APIs, workers, async services, and data pipelines. Use when working with `.py` files, `pyproject.toml`, `requirements*.txt`, `uv.lock`, pytest suites, typing issues, package design, concurrency choices, or Python quality gates. Trigger for asks like "python pro", "melhorar python", "refatorar python", "organizar projeto python", "strict typing python", "pytest", "mypy", "pyright", "fastapi", "cli python", or "pipeline python".
---

# Python Pro

## Overview

Use this skill to deliver Python changes with clear architecture, explicit types,
high-signal tests, reproducible tooling, and measured performance decisions.

Default stance:

- Prefer boring, explicit Python over clever Python.
- Keep domain logic isolated from framework and I/O glue.
- Type public interfaces and boundary payloads.
- Add or update tests for every behavior change.
- Run quality gates before calling the work done.

## Core Workflow

1. Inspect the baseline and constraints.
   - Confirm Python version, runtime style, and deployment target.
   - Read `pyproject.toml`, lockfiles, CI workflow, and test tooling before changing structure.
   - Identify whether the repo is a library, CLI, API/service, worker, or data pipeline.

2. Choose the right shape for the code.
   - Library: stable public API, small modules, explicit exports.
   - CLI: argument parsing and terminal I/O at the edge, business logic in reusable functions.
   - API/service: transport code thin, request/response models explicit, domain rules framework-independent.
   - Worker/pipeline: idempotency, retries, observability, and checkpointing matter more than framework elegance.

3. Design contracts before implementation.
   - Type function signatures, DTOs, config, and error classes.
   - Use `dataclass`, `TypedDict`, `Protocol`, or Pydantic intentionally rather than ad hoc dicts.
   - Keep sync vs async boundaries explicit; do not mix both casually in one subsystem.

4. Implement with maintainability first.
   - Keep modules cohesive and dependency flow one-directional.
   - Use domain exceptions and actionable error messages.
   - Make external effects observable and testable.

5. Validate with the right depth.
   - Unit tests for pure logic, integration tests for boundaries, targeted regression tests for bug fixes.
   - Run `scripts/run_quality_gates.py` before final delivery.
   - For legacy repos, run `scripts/audit_python_project.py` first to map gaps and migration priorities.

6. Deliver safely.
   - Explain architecture changes, type decisions, and test coverage.
   - Call out migration risk for package layout, config, or dependency changes.
   - Prefer incremental refactors over wide rewrites when behavior is already in production.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Architecture and module boundaries | `references/architecture-and-design.md` | Designing package layout, layering, adapters, DTOs, and dependency flow |
| Readability, typing, and API design | `references/code-quality-and-style.md` | Improving Python idioms, type clarity, data modeling, and error modeling |
| Testing strategy | `references/testing-strategy.md` | Adding unit/integration/regression coverage, fixtures, mocks, and failure triage |
| Performance and reliability | `references/performance-and-reliability.md` | Profiling, memory discipline, retries, timeouts, and operational resilience |
| Tooling and delivery | `references/tooling-and-delivery.md` | `pyproject.toml`, Ruff, mypy, pyright, pytest, lockfiles, packaging, and CI |
| Async and concurrency | `references/async-and-concurrency.md` | Choosing asyncio vs threads/processes, cancellation, backpressure, and async tests |
| Audit and migration playbook | `references/project-audit-and-migrations.md` | Modernizing legacy repos, moving to `pyproject.toml`, `src/` layout, or stricter typing |

## Bundled Scripts

- `scripts/bootstrap_python_project.py`
  - Scaffold a stronger Python baseline with `library`, `cli`, `api`, `worker`, or `pipeline` layouts.
  - Supports CI generation, optional pyright config, and cleaner defaults for `pyproject.toml`.
  - Use when starting a new project or standardizing a weak baseline.

- `scripts/run_quality_gates.py`
  - Run formatter, lint, typecheck, tests, optional coverage threshold, and optional security scan.
  - Auto-selects `mypy` or `pyright` when possible.
  - Use before final delivery or to mirror CI locally.

- `scripts/scaffold_test_template.py`
  - Generate `unit`, `integration`, `regression`, `async`, or `api-contract` pytest templates.
  - Use when you need fast, consistent coverage scaffolding without inventing structure every time.

- `scripts/audit_python_project.py`
  - Inspect an existing repository and report packaging, typing, testing, CI, and layout gaps.
  - Use at the start of large refactors or when inheriting a messy Python codebase.

## Constraints

### MUST DO

- Type all new or changed public interfaces.
- Keep domain rules isolated from framework, transport, and persistence code.
- Add or update tests for all behavior changes.
- Use explicit exception hierarchies and actionable failure messages.
- Prefer `pyproject.toml` as the source of truth for tooling and packaging.
- Explain architecture and migration tradeoffs when the change is non-trivial.

### MUST NOT DO

- Ship broad Python refactors without regression coverage.
- Use bare `except` or silent fallbacks to hide failures.
- Introduce global mutable state without lifecycle control.
- Mix sync and async code paths casually in the same service boundary.
- Add dependencies without a concrete operational or developer-productivity reason.
- Micro-optimize performance before measuring the bottleneck.

## Output Template

For non-trivial Python tasks, provide:

1. Architecture summary.
2. Implementation details and typing decisions.
3. Test updates and scenario coverage.
4. Quality gates run or blocked.
5. Risk notes and migration follow-ups.

## Primary References

- [Python Documentation](https://docs.python.org/3/)
- [Typing Documentation](https://docs.python.org/3/library/typing.html)
- [PyPA Packaging Guide](https://packaging.python.org/)
- [pytest Documentation](https://docs.pytest.org/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [mypy Documentation](https://mypy.readthedocs.io/)
- [pyright Documentation](https://microsoft.github.io/pyright/)
