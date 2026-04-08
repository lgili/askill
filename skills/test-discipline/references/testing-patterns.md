# Testing Patterns

> Reference for: test-discipline
> Load when: Structuring tests, writing parametrized tests, using fixtures, snapshot testing

## Arrange–Act–Assert (AAA)

Every test has three parts, separated visually by blank lines:

```typescript
it("returns the discounted price when a valid coupon is applied", () => {
  // Arrange
  const cart = new Cart([{ price: 100, qty: 2 }]);
  const coupon = { code: "HALF", discount: 0.5 };

  // Act
  const total = cart.applyDiscount(coupon);

  // Assert
  expect(total).toBe(100); // 200 * 0.5
});
```

**Rules:**
- One `Act` per test — call exactly one behavior.
- Keep `Arrange` minimal — only set up what the test actually needs.
- `Assert` on the observable outcome, not intermediate state.

---

## Naming Convention

Test names should read as a sentence describing the behavior:

```
"returns X when Y"
"throws ValidationError when email is missing"
"does not sync when auto-sync is disabled"
"emits progress events for each installed skill"
```

```typescript
describe("installSkills", () => {
  describe("when the catalog is empty", () => {
    it("returns an empty result without throwing", async () => { ... });
  });

  describe("when a skill id does not exist in the catalog", () => {
    it("throws NotFoundError with the skill id in the message", async () => { ... });
  });
});
```

---

## Parametrized Tests

Run the same assertion logic across multiple input/output pairs:

```typescript
// Vitest / Jest
const cases: [string, number, boolean][] = [
  ["user@example.com", 25,  true],
  ["",                 25,  false],  // empty email
  ["user@example.com", 12,  false],  // underage
  ["not-an-email",     25,  false],  // invalid format
];

it.each(cases)("isValidUser(%s, %d) → %s", (email, age, expected) => {
  expect(isValidUser(email, age)).toBe(expected);
});
```

```python
# pytest
import pytest

@pytest.mark.parametrize("email,age,expected", [
    ("user@example.com", 25,  True),
    ("",                 25,  False),
    ("user@example.com", 12,  False),
    ("not-an-email",     25,  False),
])
def test_is_valid_user(email, age, expected):
    assert is_valid_user(email, age) == expected
```

---

## Fixtures and Setup

Share reusable setup without coupling tests through mutable state:

```typescript
// Vitest
import { beforeEach, describe, it, expect } from "vitest";

describe("UserService", () => {
  let service: UserService;
  let db: InMemoryDatabase;

  beforeEach(() => {
    db = new InMemoryDatabase();        // fresh db per test
    service = new UserService(db);
  });

  it("creates a user and returns it with an id", async () => {
    const user = await service.create({ email: "a@b.com", name: "Alice" });
    expect(user.id).toBeDefined();
    expect(user.email).toBe("a@b.com");
  });
});
```

```python
# pytest fixtures
import pytest

@pytest.fixture
def db():
    database = InMemoryDatabase()
    yield database
    database.close()

@pytest.fixture
def service(db):
    return UserService(db)

def test_create_user(service):
    user = service.create(email="a@b.com", name="Alice")
    assert user.id is not None
    assert user.email == "a@b.com"
```

---

## Testing Errors

Always assert on the **error type and key properties** — never on the exact message string:

```typescript
// ✅ Assert on type and structured fields
await expect(service.getUser("nonexistent"))
  .rejects.toThrow(NotFoundError);

// Or check structured fields:
try {
  await service.getUser("nonexistent");
  expect.fail("Should have thrown");
} catch (err) {
  expect(err).toBeInstanceOf(NotFoundError);
  expect((err as NotFoundError).code).toBe("NOT_FOUND");
}
```

```python
import pytest

def test_raises_not_found_for_missing_user(service):
    with pytest.raises(NotFoundError) as exc_info:
        service.get_user("nonexistent")
    assert exc_info.value.code == "NOT_FOUND"
```

---

## Snapshot Tests

Use for complex serialized outputs (CLI output, generated files, large JSON):

```typescript
it("renders the skill list table correctly", () => {
  const output = renderSkillTable(mockSkills);
  expect(output).toMatchSnapshot();
});
```

**Rules for snapshots:**
- Review snapshot diffs in every PR — they're part of the test assertion.
- Snapshot intentional output (UI rendering, generated code), not internal data structures.
- Keep snapshots small and human-readable.
- Update with `vitest --update-snapshots` only when the change is intentional.

---

## Characterization Tests (for legacy code)

Before refactoring code without tests, capture current behavior first:

```typescript
// Step 1: Write a test that describes what the code DOES NOW
// (even if it's not what it SHOULD do)
it("currently returns undefined for null input (characterization)", () => {
  expect(legacyProcessData(null)).toBeUndefined();
});

// Step 2: Refactor while keeping this test green
// Step 3: Update the test to describe CORRECT behavior if needed
```
