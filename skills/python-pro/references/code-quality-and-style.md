# Code Quality And Style

## Readability Contract

- Prefer clear names over short names.
- Keep function signatures explicit and typed.
- Keep functions focused and short unless complexity is inherent.
- Prefer expression clarity over one-liner cleverness.

## Typing Patterns

- Type all public callables and class attributes.
- Use modern built-in generics (`list[str]`, `dict[str, int]`).
- Use `TypeAlias` for repeated complex types.
- Use `Protocol` for behavioral contracts.
- Use `TypedDict` for lightweight structured dictionaries.

```python
from typing import Protocol, TypeAlias, TypedDict

JSONScalar: TypeAlias = str | int | float | bool | None
JSONValue: TypeAlias = JSONScalar | list["JSONValue"] | dict[str, "JSONValue"]

class Writer(Protocol):
    def write(self, payload: bytes) -> None: ...

class UserPayload(TypedDict):
    id: str
    email: str
```

## Error Modeling

- Define domain-level exception hierarchy.
- Catch specific low-level exceptions and re-raise with context.
- Preserve tracebacks using `raise ... from ...`.
- Never swallow exceptions unless behavior explicitly requires best-effort semantics.

## API Design

- Keep APIs explicit and unsurprising.
- Prefer keyword arguments for multi-parameter public functions.
- Avoid boolean flag arguments when an enum or dedicated function is clearer.
- Document non-obvious side effects in docstrings.

## Data Modeling

- Use `dataclass(frozen=True)` for immutable value objects.
- Use mutable models only when lifecycle requires mutation.
- Use validation at boundaries (request parsing, config loading, persistence adapters).

## Import Hygiene

- Group imports: stdlib, third-party, local.
- Avoid wildcard imports.
- Avoid side-effect imports at module import time.

## Common Anti-patterns

- Mutable default arguments.
- Large "god modules" mixing domain, I/O, and orchestration.
- Untyped public APIs in new code.
- Hidden global state for caches or shared clients.
- Catch-all exception blocks with silent fallback.

## Quick Quality Checklist

- Are naming and module boundaries clear?
- Are all public paths typed?
- Are errors explicit and actionable?
- Is there duplication that should be extracted?
- Would a new engineer understand the intent in one read?

## Primary References

- [PEP 8](https://peps.python.org/pep-0008/)
- [PEP 20](https://peps.python.org/pep-0020/)
- [PEP 257 - Docstrings](https://peps.python.org/pep-0257/)
- [Typing Documentation](https://docs.python.org/3/library/typing.html)
