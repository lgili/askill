# Code Review Checklist

> Reference for: code-review
> Load when: Performing a systematic review of any pull request or code change

## 1. Context and Scope

- [ ] The PR description clearly explains **what** changed and **why**.
- [ ] The scope matches the stated purpose — no unrelated changes mixed in.
- [ ] The approach makes sense for the problem (not over-engineered, not under-designed).
- [ ] The change is small enough to review thoroughly (< 400 lines is ideal).

---

## 2. Correctness

- [ ] The happy path logic is correct.
- [ ] Edge cases are handled: null/undefined, empty collections, zero, boundary values.
- [ ] Error paths are handled and do not silently swallow failures.
- [ ] No off-by-one errors in loops, array indexing, or pagination.
- [ ] Async/await used correctly — no forgotten `await`, no fire-and-forget on error-prone paths.
- [ ] No obvious race conditions in concurrent code.
- [ ] Mutations and side effects are intentional and contained.

---

## 3. Security

- [ ] No secrets, API keys, or credentials in source code (even in tests).
- [ ] All user/external input is validated before use.
- [ ] No SQL, shell, or template injection vulnerabilities (parameterized queries, array exec).
- [ ] No sensitive data logged in plain text (passwords, tokens, PII).
- [ ] File paths from user input are validated against a safe base directory.
- [ ] No `eval()` or `Function()` on untrusted data.
- [ ] TLS not disabled (`rejectUnauthorized: false`, `verify=False`).

→ See `security-review.md` for a deeper security checklist.

---

## 4. Tests

- [ ] New behavior has tests covering the happy path.
- [ ] At least two edge cases are covered (null, empty, boundary, invalid input).
- [ ] Error/failure paths have tests.
- [ ] Tests assert on behavior (outputs, observable state), not implementation details.
- [ ] No test relies on execution order or shared mutable state.
- [ ] Existing tests were not silently deleted to make CI pass.

---

## 5. Code Quality

- [ ] Functions are focused on one responsibility (< ~40 lines is a good heuristic).
- [ ] Naming is clear, consistent with the codebase, and follows the project convention.
- [ ] No deep nesting — guard clauses used where appropriate.
- [ ] No dead code, commented-out code, or debug statements.
- [ ] No obvious code duplication that warrants extraction.
- [ ] Complex logic has an explanatory comment (the *why*, not the *what*).
- [ ] No magic numbers or strings — named constants used.

---

## 6. Types and Interfaces (TypeScript / Python typed)

- [ ] No `any` used without justification.
- [ ] New public functions/methods have explicit type signatures.
- [ ] External data (API responses, `JSON.parse`) is narrowed before use.
- [ ] No type assertions (`as SomeType`) without a preceding type guard.
- [ ] Interface/type names are clear and avoid redundant suffixes like `IFoo` or `FooInterface`.

---

## 7. Dependencies and Configuration

- [ ] No new dependencies added without clear justification and version constraints.
- [ ] No dev dependencies added as production dependencies.
- [ ] No hardcoded configuration that should be an environment variable.
- [ ] No files with credentials or secrets committed (`.env`, `*.pem`, `*.key`).
- [ ] `package-lock.json` / `poetry.lock` updated if dependencies changed.

---

## 8. Documentation and Changelog

- [ ] Public API changes are reflected in JSDoc, type signatures, or docs.
- [ ] Breaking changes are documented and highlighted in the PR description.
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if the project maintains one.
- [ ] Migration notes provided if consumers need to change their code.

---

## Quick Severity Guide

| Level | Meaning | Action |
|-------|---------|--------|
| **blocker** | Bug, security issue, missing critical test | Must fix before merge |
| **suggestion** | Better approach exists; worthwhile improvement | Address or acknowledge |
| **nit** | Minor style, cosmetic, purely optional | Easy to skip; label clearly |
| **question** | Genuinely unclear; seeking understanding | Author clarifies |
| **praise** | Something done especially well | Acknowledge it |
