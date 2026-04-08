---
name: error-handling
description: Error-first patterns specialist for writing robust, predictable code that fails loudly with actionable messages and recovers gracefully where appropriate. Use when writing functions that call external APIs, parse user input, access the filesystem, perform database operations, or any logic where failure is possible. Trigger for asks like "add error handling", "handle failures", "what if this fails", "make this more robust", "add validation", "improve error messages", or when reviewing code that uses bare try/catch, ignores error returns, or has deeply nested conditionals.
---

# Error Handling

## Overview

Use this skill to write code that fails loudly, recovers predictably, and produces
error messages that tell users and operators exactly what went wrong and what to do.

## Core Workflow

1. Enumerate all failure modes.
   - List every way the function or operation can fail.
   - Classify: **expected** (invalid input, not found, timeout) vs **unexpected** (bug, infra failure).
   - Decide which failures are **recoverable** (retry, fallback, user correction) vs **fatal** (abort).

2. Apply guard clauses at function entry.
   - Validate inputs at the top of the function before any logic runs.
   - Return or throw immediately on invalid input — don't let bad data propagate deep.
   - Keep the happy path at the lowest nesting level (flipped conditionals pattern).

3. Design typed error classes.
   - Use named error classes for each expected failure domain.
   - Include structured context in the error: field name, received value, expected format.
   - Distinguish domain errors (`ValidationError`, `NotFoundError`) from infrastructure errors (`DatabaseError`, `NetworkError`).

4. Handle edge cases explicitly.
   - Cover: null, undefined, empty string, empty array, zero, negative numbers, NaN, max boundary.
   - Handle partial failures in bulk operations: track which items succeeded and which failed.
   - Test every error path — error paths are where bugs hide.

5. Write actionable error messages.
   - State: what happened, what was expected, and what the user can do next.
   - Include relevant context (field name, received value, allowed range).
   - Never expose raw stack traces, internal IDs, or file system paths to end users.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Error patterns | `references/error-patterns.md` | Guard clauses, early returns, result types, error classification |
| Error messages | `references/error-messages.md` | Writing clear, actionable, non-leaking error messages |
| Language-specific | `references/error-by-language.md` | TypeScript, Python, Go, Rust — idiomatic error handling per language |

## Constraints

### MUST DO

- Validate all inputs at function entry with guard clauses before any domain logic.
- Use named, typed error classes for expected failure modes (not generic `Error`).
- Include context in error messages: what was received and what was expected.
- Cover null, empty, boundary, and partial-failure cases in tests.
- Use early returns to keep nesting shallow and the happy path unindented.

### MUST NOT DO

- Use bare `catch (e) {}` or `except: pass` that silently swallows errors.
- Return `null` or `-1` to signal failure without clear documentation.
- Expose raw stack traces, internal system paths, or database error details to end users.
- Nest error handling conditionals more than two levels deep.
- Leave `// TODO: handle errors` and ship it.
- Use a single `AppError` class for all failure modes with no distinction.

## Output Template

For error-handling tasks, provide:

1. **Failure mode inventory** — all identified ways the operation can fail.
2. **Guard clause strategy** — what is validated at entry and how.
3. **Error type design** — custom classes or discriminated unions used and their fields.
4. **Edge case coverage** — null, empty, boundary, and partial-failure scenarios addressed.
5. **Error message samples** — one per failure type showing format and context included.

## References

- [Railway Oriented Programming — Scott Wlaschin](https://fsharpforfunandprofit.com/rop/)
- [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Python — Exceptions](https://docs.python.org/3/tutorial/errors.html)
- [Go — Error Handling](https://go.dev/blog/error-handling-and-go)
- [Rust — Result and the ? Operator](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)
