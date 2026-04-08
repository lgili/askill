# Coverage Policy

> Reference for: test-discipline
> Load when: Deciding coverage thresholds, interpreting coverage reports, or setting CI gates

## What Coverage Measures (and What It Doesn't)

**Coverage tells you** which lines, branches, and functions were executed during your test suite.

**Coverage does NOT tell you:**
- Whether the assertions are meaningful.
- Whether edge cases and failure paths are covered.
- Whether the test would catch a real bug.

High coverage with weak assertions gives a false sense of security. Aim for **meaningful behavior coverage**, not just line coverage.

---

## Recommended Thresholds

| Project type | Lines | Branches | Functions |
|-------------|-------|----------|-----------|
| New greenfield code | 85% | 80% | 90% |
| Existing library with public API | 80% | 75% | 85% |
| Legacy codebase (start here) | 60% | 50% | 70% |
| Critical paths (auth, payments, data migration) | 95% | 90% | 100% |

Set thresholds in CI to **fail the build** when coverage drops below the baseline, not to enforce a fixed number across the entire codebase.

---

## What to Prioritize

**Cover these first:**

1. **Core business logic** — the functions that define what your application does.
2. **Error paths** — invalid input, missing resources, network failures, partial failures.
3. **Boundary values** — the min, max, and edge of every accepted range.
4. **Public API surface** — every exported function, method, and class.

**Cover these less strictly:**

- Boilerplate adapters (thin wrappers around external libraries).
- Configuration loading (test by running the app, not unit testing `dotenv`).
- Generated code (migrations, serializers auto-generated from schemas).
- CLI output formatting (snapshot test the output, skip line coverage).

---

## Setting Up Coverage

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 90,
      },
      exclude: [
        "src/generated/**",
        "src/**/*.d.ts",
        "src/cli.ts",          // CLI wiring tested via e2e
      ],
    },
  },
});
```

### pytest

```ini
# pyproject.toml
[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=85"

[tool.coverage.run]
omit = ["src/migrations/*", "src/generated/*", "tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

---

## Interpreting Uncovered Code

When you see uncovered lines, ask:

| Uncovered code | Action |
|----------------|--------|
| Error handler in a deep branch | Add a test that triggers that specific error |
| Early return guard clause | Add a test with the invalid input it guards against |
| Logging statement | Mark `/* v8 ignore next */` or `# pragma: no cover` if trivial |
| Defensive fallback that "can't happen" | Add a comment explaining why; mark to ignore |
| Generated code | Exclude the directory from coverage |
| Dead code | Delete it |

---

## Branch Coverage vs Line Coverage

Line coverage only tells you a line was touched. Branch coverage tells you both paths of an `if` were tested.

```typescript
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;   // branch: true
  if (value > max) return max;   // branch: true + false
  return value;
}

// Line coverage: 100% with just clamp(5, 0, 10)
// Branch coverage: need clamp(-1, 0, 10), clamp(11, 0, 10), and clamp(5, 0, 10)
```

**Prefer branch coverage** thresholds for logic-heavy modules. Branch coverage is a better indicator of thoroughness than line coverage.

---

## Coverage in CI

Add a coverage step that fails the build on regression:

```yaml
# GitHub Actions
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage report
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

**Never merge a PR that reduces coverage below the project baseline** without a documented justification (e.g., deleting a module reduces coverage because the tests for it were deleted too).
