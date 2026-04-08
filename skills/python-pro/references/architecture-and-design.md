# Architecture And Design

## Goals

- Keep modules cohesive and easy to reason about.
- Keep dependency flow explicit and one-directional.
- Keep domain logic independent from I/O and frameworks.

## Package Structure Patterns

### Application-oriented (`src/` layout)

```text
src/
  app/
    domain/
      entities.py
      services.py
    application/
      use_cases.py
      dto.py
    infrastructure/
      db.py
      repositories.py
      clients.py
    interfaces/
      api.py
      cli.py
tests/
```

Use when shipping services, workers, CLIs, or APIs.

### Library-oriented

```text
src/
  package_name/
    __init__.py
    core.py
    models.py
    errors.py
    adapters/
tests/
docs/
```

Use when shipping reusable packages with stable APIs.

## Dependency Rules

- Allow `interfaces -> application -> domain`.
- Allow `infrastructure -> domain` and `infrastructure -> application` only for adapters.
- Prevent `domain -> infrastructure` and `domain -> framework`.
- Keep framework objects out of domain types.

## Interface Design

- Model inputs/outputs with typed DTOs (`dataclass`, `TypedDict`, or Pydantic models).
- Keep API functions small and explicit.
- Return stable shapes; avoid ad-hoc dictionaries unless strongly typed.
- Raise domain exceptions instead of leaking low-level exceptions.

## Configuration Strategy

- Centralize configuration loading in one module.
- Validate configuration on startup.
- Keep defaults explicit and environment-specific overrides documented.
- Avoid reading environment variables in deep domain layers.

## Refactoring Playbook

1. Snapshot behavior with tests.
2. Extract pure domain functions from side-effect-heavy code.
3. Introduce interfaces/protocols around external dependencies.
4. Move framework code to adapter modules.
5. Remove temporary compatibility shims only after tests pass.

## Design Review Checklist

- Is each module responsible for a single concept?
- Can business rules run without network/database access?
- Are input and output types explicit?
- Is dependency direction consistent across package boundaries?
- Are extension points defined by protocol/interface instead of concrete classes?

## Primary References

- [Python Packaging User Guide](https://packaging.python.org/en/latest/)
- [Python Data Model](https://docs.python.org/3/reference/datamodel.html)
- [Typing - Protocols and structural subtyping](https://docs.python.org/3/library/typing.html#typing.Protocol)
