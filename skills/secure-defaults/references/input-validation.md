# Input Validation

> Reference for: secure-defaults
> Load when: Validating or sanitizing user input, API responses, file uploads, or CLI arguments

## Principle

**Validate all input at trust boundaries. Sanitize output for the target context.**

Validate early (at the entry point), validate strictly (reject what you don't expect),
and encode output for the specific sink (HTML, SQL, shell, JSON).

---

## Validation Checklist

For every external input, check:

- [ ] **Type** — is it a string, number, boolean, array, object?
- [ ] **Presence** — is a required field actually present?
- [ ] **Length / Size** — string length, array count, file size within limits?
- [ ] **Format** — regex for email, URL, UUID, ISO date, phone number?
- [ ] **Range** — numeric value within allowed min/max?
- [ ] **Allowlist** — if it must be one of a fixed set of values, check the set.
- [ ] **Encoding** — is it valid UTF-8? No null bytes or control characters?

---

## Validation Libraries

### Node.js / TypeScript

**zod** (recommended — TypeScript-first, zero dependencies):

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(8).max(128),
  role:     z.enum(["admin", "editor", "viewer"]),
  age:      z.number().int().min(13).max(120).optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// At the API boundary
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten() });
}
const user = result.data; // fully typed, safe to use
```

### Python

**pydantic** (recommended):

```python
from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal

class CreateUserInput(BaseModel):
    email: EmailStr
    password: str
    role: Literal["admin", "editor", "viewer"]

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

# At the API boundary (FastAPI does this automatically)
try:
    user = CreateUserInput(**request_data)
except ValidationError as e:
    return JSONResponse(status_code=400, content=e.errors())
```

---

## SQL Injection Prevention

**Always use parameterized queries. Never concatenate user data into SQL strings.**

```typescript
// ❌ NEVER — SQL injection vulnerability
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ Parameterized query (node-postgres)
const result = await pool.query(
  "SELECT * FROM users WHERE email = $1",
  [email],
);

// ✅ ORM (Prisma)
const user = await prisma.user.findUnique({ where: { email } });
```

```python
# ❌ NEVER
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# ✅ Parameterized
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))

# ✅ ORM (SQLAlchemy)
user = session.query(User).filter(User.email == email).first()
```

---

## Path Traversal Prevention

```typescript
import { resolve, join } from "node:path";

function safeFilePath(baseDir: string, userInput: string): string {
  const resolved = resolve(join(baseDir, userInput));
  if (!resolved.startsWith(resolve(baseDir))) {
    throw new Error("Path traversal detected.");
  }
  return resolved;
}

// Usage
const filePath = safeFilePath("/uploads", req.params.filename);
```

---

## File Upload Validation

```typescript
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function validateUpload(file: { mimetype: string; size: number; originalname: string }): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`File type not allowed: ${file.mimetype}`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE_BYTES})`);
  }
  // Sanitize filename — strip path components and dangerous chars
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
}
```

---

## Output Encoding

Encode output for the **target context**, not just once generically:

| Context | Risk | Solution |
|---------|------|---------|
| HTML body | XSS | HTML-escape: `&`, `<`, `>`, `"`, `'` |
| HTML attribute | XSS | Attribute-encode, or use DOM APIs |
| CSS | CSS injection | Use CSP; avoid user data in styles |
| JavaScript | XSS | JSON.stringify; never `innerHTML` |
| SQL | SQL injection | Parameterized queries |
| Shell | Command injection | Use arrays, never shell string concat |
| URL | Open redirect | Allowlist domains; encode with `encodeURIComponent` |

```typescript
// Shell — use arrays, not strings
import { execFile } from "node:child_process";

// ❌ Shell injection risk
exec(`convert ${userFile} output.png`);

// ✅ Array form — no shell interpretation
execFile("convert", [userFile, "output.png"], callback);
```
