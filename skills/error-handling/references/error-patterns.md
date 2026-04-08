# Error Patterns

> Reference for: error-handling
> Load when: Applying guard clauses, early returns, result types, or classifying errors

## Guard Clauses (Early Return)

Replace deeply nested conditionals with early exits. Put error cases first, happy path last.

```typescript
// ❌ Deeply nested — hard to follow
function processOrder(order: Order | null): Result {
  if (order) {
    if (order.status === "pending") {
      if (order.items.length > 0) {
        // actual logic deep inside
        return doProcess(order);
      } else {
        throw new Error("No items");
      }
    } else {
      throw new Error("Wrong status");
    }
  } else {
    throw new Error("Order required");
  }
}

// ✅ Guard clauses — flat, readable
function processOrder(order: Order | null): Result {
  if (!order)                        throw new ValidationError("order", "Order is required.");
  if (order.status !== "pending")    throw new StateError(`Order must be pending, got: ${order.status}`);
  if (order.items.length === 0)      throw new ValidationError("items", "Order must have at least one item.");

  // happy path — unindented, clear
  return doProcess(order);
}
```

---

## Typed Error Classes

Define named error classes for each expected failure domain:

```typescript
// Base class
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Domain-specific subclasses
export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(message, "VALIDATION_ERROR", { field });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", { resource, id });
  }
}

export class UnauthorizedError extends AppError {
  constructor(action: string) {
    super(`Not authorized to perform: ${action}`, "UNAUTHORIZED", { action });
  }
}

export class NetworkError extends AppError {
  constructor(url: string, status: number) {
    super(`HTTP ${status} from ${url}`, "NETWORK_ERROR", { url, status });
  }
}
```

**At the API layer**, map error classes to HTTP status codes:

```typescript
function errorToResponse(err: unknown): { status: number; body: object } {
  if (err instanceof ValidationError) return { status: 400, body: { error: err.message, field: err.context?.field } };
  if (err instanceof NotFoundError)   return { status: 404, body: { error: err.message } };
  if (err instanceof UnauthorizedError) return { status: 403, body: { error: err.message } };
  if (err instanceof AppError)        return { status: 500, body: { error: "An error occurred." } };
  return { status: 500, body: { error: "An unexpected error occurred." } };
}
```

---

## Result Type (no-throw style)

Useful when callers must handle errors explicitly — common in TypeScript and inspired by Rust:

```typescript
type Result<T, E = Error> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: "Division by zero" };
  return { ok: true, value: a / b };
}

const result = divide(10, 0);
if (!result.ok) {
  console.error(result.error);
} else {
  console.log(result.value);
}
```

Use the `neverthrow` library for a production-ready Result type with chaining support.

---

## Partial Failure in Bulk Operations

When processing multiple items, track individual results instead of aborting on first failure:

```typescript
interface BulkResult<T> {
  succeeded: T[];
  failed: Array<{ item: unknown; error: string }>;
}

async function installAll(skillIds: string[]): Promise<BulkResult<Skill>> {
  const result: BulkResult<Skill> = { succeeded: [], failed: [] };

  for (const id of skillIds) {
    try {
      const skill = await installSkill(id);
      result.succeeded.push(skill);
    } catch (err) {
      result.failed.push({ item: id, error: String(err) });
    }
  }

  return result;
}
```

---

## Edge Case Checklist

For every function that accepts external input, verify behavior for:

| Input | Example | Expected behavior |
|-------|---------|------------------|
| `null` / `undefined` | `processUser(null)` | Guard clause throws `ValidationError` |
| Empty string | `parseName("")` | Guard clause throws or returns default |
| Empty array | `installAll([])` | Return immediately with empty result |
| Zero | `divide(10, 0)` | Throw or return error Result |
| Negative number | `setPage(-1)` | Throw `ValidationError("page must be ≥ 1")` |
| NaN | `setTimeout(NaN)` | Guard: `if (!Number.isFinite(ms))` |
| Max boundary | `setLimit(10_001)` | Throw if over limit |
| Whitespace-only | `setName("   ")` | Trim and validate, or reject |
