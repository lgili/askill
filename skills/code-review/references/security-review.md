# Security Review Checklist

> Reference for: code-review
> Load when: Reviewing authentication, input handling, secrets, or data exposure in a PR

## Input Handling

- [ ] All user-supplied input is validated: type, length, format, range, encoding.
- [ ] SQL queries use parameterized statements or an ORM — no string concatenation.
- [ ] Shell commands use array form (`execFile`) — no string concatenation with user data.
- [ ] File paths from user input are restricted to an allowed base directory (path traversal check).
- [ ] HTML output is escaped or generated through a framework that escapes by default.
- [ ] `JSON.parse` on external data is wrapped in try/catch and the result is type-narrowed.

**Red flags:**
```typescript
// ❌ SQL injection
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ❌ Shell injection
exec(`convert ${req.body.filename} output.png`);

// ❌ Path traversal
fs.readFile(path.join("/uploads", req.params.file));

// ✅ Safe versions use parameterized queries, execFile arrays, and path validation
```

---

## Authentication and Authorization

- [ ] Every endpoint requiring auth has middleware/guard applied — no "I'll add auth later".
- [ ] Resource ownership is verified: `WHERE id = ? AND user_id = current_user_id`.
- [ ] Privilege checks happen before fetching the resource (fail fast, avoid info leaks).
- [ ] JWTs / session tokens are validated (signature, expiry, audience, issuer).
- [ ] Sensitive operations (delete, admin actions, payment) require re-verification.
- [ ] No "security by obscurity" — hidden endpoints are not secured by being undiscovered.

```typescript
// ❌ Missing ownership check — user A can delete user B's data
const item = await db.item.findById(req.params.id);
await db.item.delete(item.id);

// ✅ Ownership enforced
const item = await db.item.findFirst({
  where: { id: req.params.id, ownerId: req.user.id }
});
if (!item) throw new NotFoundError("item", req.params.id);
await db.item.delete(item.id);
```

---

## Secrets and Sensitive Data

- [ ] No API keys, tokens, passwords, or connection strings as string literals.
- [ ] `.env` files not committed; `.env.example` with placeholders is present.
- [ ] Sensitive data not logged in plain text (passwords, tokens, PII, card numbers).
- [ ] Error responses do not leak stack traces, internal paths, or DB error details to clients.
- [ ] Tokens stored with appropriate security (httpOnly cookie, encrypted storage — never localStorage for sensitive tokens).

```typescript
// ❌ Leaks stack trace to client
app.use((err, req, res) => res.status(500).json({ error: err.stack }));

// ✅ Log internally, return generic message
app.use((err, req, res) => {
  logger.error(err);
  res.status(500).json({ error: "An unexpected error occurred." });
});
```

---

## Cryptography

- [ ] Passwords hashed with bcrypt, scrypt, or Argon2 (NOT MD5, SHA1, SHA256 alone).
- [ ] Cryptographically random values use `crypto.randomBytes` or `secrets.token_bytes` (NOT `Math.random()`).
- [ ] TLS not disabled (`rejectUnauthorized: false` or `verify=False`).
- [ ] Custom crypto algorithms not implemented — use established libraries.

```typescript
import { randomBytes } from "node:crypto";

// ✅ Cryptographically secure random token
const token = randomBytes(32).toString("hex");

// ❌ Math.random() is predictable
const insecureToken = Math.random().toString(36).slice(2);
```

---

## Third-Party Dependencies in the Diff

When a PR adds a new dependency:
- [ ] Package has > 10k weekly downloads and recent maintenance activity.
- [ ] No known CVEs (`npm audit` / `pip audit` clean after adding).
- [ ] The package's scope matches the stated need — not pulling 50 deps for a small utility.
- [ ] Native/built-in alternative does not exist (prefer `node:crypto` over random crypto packages).

---

## New API Endpoints or Routes

For any new HTTP endpoint introduced in the diff:
- [ ] Authentication required (unless explicitly public).
- [ ] Authorization checked (not just "is logged in" but "can this user do this action").
- [ ] Rate limiting applied for sensitive or expensive operations.
- [ ] Input validated with a schema (zod, joi, pydantic).
- [ ] Error responses do not expose internal details.
- [ ] CORS policy appropriate (not `*` for credentialed requests).
