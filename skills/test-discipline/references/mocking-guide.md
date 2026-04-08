# Mocking Guide

> Reference for: test-discipline
> Load when: Deciding what to mock, how to mock well, or reviewing over-mocked tests

## When to Mock

Mock a dependency when it:
- Makes a **real network call** (HTTP, database, external API).
- Has **non-deterministic behavior** (random, time, UUIDs).
- Is **slow** and would make the test suite impractical.
- Has **unacceptable side effects** in tests (sends email, charges card, writes to production).

**Do NOT mock** when:
- The real implementation is fast, deterministic, and has no side effects.
- You can use an in-memory version (in-memory db, in-memory cache).
- The dependency is a pure function or a stable utility.

**Over-mocking signs:**
- Tests break when you rename a private function.
- Tests mock 5+ dependencies for one small unit.
- Mocks return hardcoded values that don't reflect real system behavior.
- Integration bugs are only caught in production.

---

## Mocking in TypeScript (Vitest)

### Function mock

```typescript
import { vi, expect, it } from "vitest";
import { sendNotification } from "./notify.js";
import { createUser } from "./user-service.js";

vi.mock("./notify.js"); // auto-mock the module

it("calls sendNotification after creating a user", async () => {
  const mockedSend = vi.mocked(sendNotification);

  await createUser({ email: "a@b.com" });

  expect(mockedSend).toHaveBeenCalledOnce();
  expect(mockedSend).toHaveBeenCalledWith(expect.objectContaining({ email: "a@b.com" }));
});
```

### Spy on a method

```typescript
import { vi, expect, it, afterEach } from "vitest";

afterEach(() => vi.restoreAllMocks());

it("logs a warning when the cache is stale", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  loadCatalog({ expiresAt: Date.now() - 1 }); // expired cache

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("cache"));
});
```

### Mock time

```typescript
import { vi, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("expires a token after 15 minutes", () => {
  const token = createToken();

  vi.advanceTimersByTime(15 * 60 * 1000 + 1);

  expect(isTokenExpired(token)).toBe(true);
});
```

---

## Mocking in Python (pytest + unittest.mock)

```python
from unittest.mock import patch, MagicMock

def test_sends_email_after_user_creation():
    with patch("myapp.email.send") as mock_send:
        create_user(email="a@b.com")
        mock_send.assert_called_once_with(to="a@b.com", template="welcome")

# Using pytest-mock (cleaner)
def test_sends_email(mocker):
    mock_send = mocker.patch("myapp.email.send")
    create_user(email="a@b.com")
    mock_send.assert_called_once()
```

### Mock time

```python
from unittest.mock import patch
from datetime import datetime

def test_token_expires():
    future = datetime(2030, 1, 1)
    with patch("myapp.auth.datetime") as mock_dt:
        mock_dt.now.return_value = future
        assert is_token_expired(token_issued_at=datetime(2020, 1, 1))
```

---

## Prefer In-Memory Fakes Over Mocks

A fake is a real implementation that works in-memory and is fast. It is more reliable than a mock
because it exercises the actual interface contract:

```typescript
// Mock — fragile, tests implementation details
const mockRepo = { findById: vi.fn().mockResolvedValue(mockUser) };

// Fake — tests real behavior, survives refactoring
class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async save(user: User) { this.store.set(user.id, user); return user; }
}
```

Use fakes for: repositories, caches, event buses, queues, email senders.

---

## Mock Boundary Rule

**Mock at the boundary of your system** — the point where your code talks to something external.
Do not mock internal functions or classes that you own.

```
Your Code → [MOCK HERE] → External: HTTP, DB, File System, Email, Time
```

```typescript
// ❌ Mocking your own domain function (too deep)
vi.mock("./catalog-parser.js");

// ✅ Mocking the HTTP fetch at the boundary
vi.mock("../http.js", () => ({
  fetchText: vi.fn().mockResolvedValue(mockCatalogJson),
}));
```
