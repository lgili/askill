---
name: test-discipline
description: Testing habits specialist for writing reliable, maintainable tests that verify behavior (not implementation), cover edge cases systematically, and give fast, actionable feedback on failures. Use when adding new features, fixing bugs, refactoring existing code, reviewing test coverage, or building a test strategy from scratch. Trigger for asks like "write tests for this", "add unit tests", "refactor safely", "improve test coverage", "what should I test", "add integration tests", or when reviewing code that has no tests, fragile tests, or tests that only cover the happy path.
---

# Test Discipline

## Overview

Use this skill to build test suites that catch real bugs, survive refactoring, and run fast
enough to be used continuously during development.

## Core Workflow

1. Identify what to test.
   - List the **public behaviors** the component must exhibit — not internal implementation.
   - Identify: happy path, known edge cases, and expected failure modes.
   - For existing code without tests: write **characterization tests** first to capture current behavior before refactoring.

2. Structure each test with Arrange–Act–Assert (AAA).
   - **Arrange**: set up the minimum state needed to exercise the behavior.
   - **Act**: call exactly one behavior under test.
   - **Assert**: verify the observable outcome — not intermediate state or side effects.

3. Cover the full behavior surface.
   - **Happy path**: the most common valid usage.
   - **Edge cases**: empty input, zero, boundary values (min, max, max+1), null, undefined.
   - **Failure paths**: invalid input, missing resource, network error, permission denied.

4. Apply the right test scope.
   - **Unit tests**: pure functions, transformations, domain logic — no real I/O.
   - **Integration tests**: database queries, API calls, file system — use real dependencies.
   - **End-to-end tests**: critical user journeys only — keep this suite small and fast.

5. Run, maintain, and clean up.
   - Run the full test suite before suggesting any commit.
   - Keep each test focused on one behavior; split tests that assert multiple unrelated things.
   - Delete tests that break on unrelated internal refactors — they test implementation, not behavior.
   - Use `scripts/scaffold_test.js` to generate consistent test file templates.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Testing patterns | `references/testing-patterns.md` | AAA structure, parametrized tests, fixtures, snapshot tests |
| Mocking guide | `references/mocking-guide.md` | When to mock, how to mock well, avoiding over-mocking |
| Coverage policy | `references/coverage-policy.md` | What coverage metrics mean, what to measure, what to ignore |

## Bundled Scripts

- `scripts/scaffold_test.js`
  - Generate a consistent test file template (unit or integration) for a given source file.
  - Use when adding tests to an existing module or starting a new feature with TDD.
  - Run: `node skills/test-discipline/scripts/scaffold_test.js --file src/my-module.ts`
  - Or: `node skills/test-discipline/scripts/scaffold_test.js --file src/my-module.ts --type integration`

## Constraints

### MUST DO

- Test observable **behavior** (inputs → outputs, side effects) not internal implementation.
- Cover the happy path, at least two edge cases, and the primary failure path per module.
- Run the full test suite before suggesting a commit or PR.
- Write characterization tests before refactoring legacy code without tests.
- Keep tests independent — no shared mutable state between test cases.

### MUST NOT DO

- Test private methods or internal implementation details directly.
- Write tests so tightly coupled to implementation that any refactor breaks them.
- Mock every dependency by default — prefer real in-process implementations for unit tests.
- Skip tests for "simple" functions — edge cases and bugs hide in simple code.
- Leave failing or commented-out tests in the codebase — fix or delete them.
- Assert on exact error message strings — assert on error type and key structured fields instead.

## Output Template

For testing tasks, provide:

1. **Behavior inventory** — public behaviors the test suite covers.
2. **Test structure** — file layout, test scope (unit/integration/e2e), and runner.
3. **Edge cases covered** — null, empty, boundary, and failure scenarios included.
4. **Mocking rationale** — what was mocked and why (or why nothing was mocked).
5. **Coverage gaps** — known untested behaviors and reason (deferred or out of scope).

## References

- [Kent C. Dodds — The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Martin Fowler — Test Doubles](https://martinfowler.com/bliki/TestDouble.html)
- [Vitest Documentation](https://vitest.dev/)
- [pytest Documentation](https://docs.pytest.org/)
- [Node.js built-in test runner](https://nodejs.org/api/test.html)
- [Jest Documentation](https://jestjs.io/)
