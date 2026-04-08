# Testing Strategy

## Testing Goals

- Detect regressions quickly.
- Keep tests easy to understand and maintain.
- Cover behavior and contracts, not implementation details.

## Test Layers

### Unit tests

- Validate pure business rules in isolation.
- Use lightweight fakes for collaborators.
- Run fast and in high volume.

### Integration tests

- Validate boundaries with DB, filesystem, queues, or external APIs.
- Use realistic fixtures and explicit setup/teardown.
- Keep deterministic and environment-aware.

### End-to-end tests

- Validate critical user journeys only.
- Keep low in count but high in confidence value.

## pytest Conventions

- Name files as `test_<feature>.py`.
- Use arrange-act-assert structure.
- Keep one primary behavior assertion per test where possible.
- Prefer fixtures for setup reuse and clarity.

```python
def test_calculate_total_applies_discount():
    cart = Cart(items=[Item("A", 100)], discount_rate=0.2)

    total = calculate_total(cart)

    assert total == 80
```

## Fixture Design

- Keep fixture scope minimal (`function` by default).
- Avoid complex fixture chains that hide intent.
- Use factory fixtures when scenarios vary.

## Mocking Rules

- Mock only external boundaries (network, filesystem, time, random, third-party APIs).
- Avoid mocking pure domain logic.
- Assert outcomes and observable behavior more than internal calls.

## Coverage Policy

- Treat coverage as a signal, not a goal by itself.
- Require coverage for changed critical paths.
- Add targeted tests for bug fixes before code changes when feasible.
- Track branch coverage for decision-heavy modules.

## Flaky Test Prevention

- Control time and randomness via injectable providers.
- Avoid sleep-based synchronization.
- Isolate shared mutable state between tests.
- Run tests in random order occasionally to detect hidden coupling.

## Failure Triage Flow

1. Reproduce failure locally with a focused test command.
2. Confirm whether failure is logic regression, test bug, or environment issue.
3. Add/adjust tests that pin expected behavior.
4. Fix implementation with smallest safe change.
5. Re-run impacted and broader suites.

## Primary References

- [pytest Documentation](https://docs.pytest.org/)
- [unittest.mock Documentation](https://docs.python.org/3/library/unittest.mock.html)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
