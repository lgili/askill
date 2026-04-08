# Error Handling by Language

> Reference for: error-handling
> Load when: Applying idiomatic error handling in TypeScript, Python, Go, or Rust

## TypeScript

### Typed error classes + instanceof narrowing

```typescript
class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
class ValidationError extends AppError {}
class NotFoundError extends AppError {}

try {
  await processOrder(id);
} catch (err) {
  if (err instanceof ValidationError) { /* 400 */ }
  if (err instanceof NotFoundError)   { /* 404 */ }
  throw err; // re-throw unknown errors
}
```

### `unknown` in catch (TypeScript 4+)

```typescript
try {
  await riskyOp();
} catch (err: unknown) {
  // err is unknown — must narrow before use
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Operation failed", { message });
}
```

### Async: always await before try/catch

```typescript
// ❌ Promise rejection not caught
try {
  fetchData(); // missing await
} catch (err) { }

// ✅
try {
  await fetchData();
} catch (err: unknown) { }
```

### Result type with `neverthrow`

```typescript
import { ok, err, Result } from "neverthrow";

function parseAge(input: string): Result<number, string> {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0) return err(`Invalid age: ${input}`);
  return ok(n);
}

const result = parseAge("abc");
if (result.isErr()) console.error(result.error);
else console.log(result.value);
```

---

## Python

### Custom exception hierarchy

```python
class AppError(Exception):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code

class ValidationError(AppError): pass
class NotFoundError(AppError): pass
class NetworkError(AppError): pass

# Usage
try:
    process_order(order_id)
except ValidationError as e:
    return JSONResponse(status_code=400, content={"error": str(e)})
except NotFoundError as e:
    return JSONResponse(status_code=404, content={"error": str(e)})
```

### Never use bare `except`

```python
# ❌ Swallows all errors including KeyboardInterrupt, SystemExit
try:
    risky()
except:
    pass

# ✅ Catch specific exceptions
try:
    risky()
except ValueError as e:
    logger.warning("Validation failed: %s", e)
except Exception as e:
    logger.error("Unexpected error: %s", e, exc_info=True)
    raise
```

### Context managers for cleanup

```python
# ✅ Always use context managers for resources
with open(path) as f:
    content = f.read()

# For custom resources
from contextlib import contextmanager

@contextmanager
def managed_connection(url: str):
    conn = connect(url)
    try:
        yield conn
    finally:
        conn.close()
```

---

## Go

Go uses explicit error returns — no exceptions.

```go
// Functions return (value, error)
func processOrder(id string) (*Order, error) {
    order, err := db.GetOrder(id)
    if err != nil {
        return nil, fmt.Errorf("processOrder: %w", err)
    }
    if order.Status != "pending" {
        return nil, fmt.Errorf("order %s must be pending, got: %s", id, order.Status)
    }
    return order, nil
}

// Caller
order, err := processOrder(id)
if err != nil {
    log.Printf("failed to process order: %v", err)
    return
}
```

### Wrapping errors with context (`%w`)

```go
// %w allows errors.Is() and errors.As() on wrapped errors
if err != nil {
    return fmt.Errorf("fetchCatalog %s: %w", url, err)
}

// Checking wrapped errors
var notFound *NotFoundError
if errors.As(err, &notFound) {
    // handle specifically
}
```

### Sentinel errors

```go
var (
    ErrNotFound   = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
)

if errors.Is(err, ErrNotFound) {
    // handle 404
}
```

---

## Rust

Rust uses `Result<T, E>` — no exceptions, no null.

```rust
use std::fmt;

#[derive(Debug)]
enum AppError {
    NotFound(String),
    Validation { field: String, message: String },
    Network(reqwest::Error),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::NotFound(id) => write!(f, "Resource not found: {id}"),
            AppError::Validation { field, message } => write!(f, "Validation error on {field}: {message}"),
            AppError::Network(e) => write!(f, "Network error: {e}"),
        }
    }
}

// The ? operator propagates errors automatically
fn process_order(id: &str) -> Result<Order, AppError> {
    let order = db.get_order(id).ok_or_else(|| AppError::NotFound(id.to_string()))?;
    if order.status != "pending" {
        return Err(AppError::Validation {
            field: "status".to_string(),
            message: format!("must be pending, got: {}", order.status),
        });
    }
    Ok(order)
}
```
