# OWASP Top 10 — Quick Reference

> Reference for: secure-defaults
> Load when: Reviewing code for common vulnerability classes or doing a security audit

## A01 — Broken Access Control

**What:** Users can act outside their intended permissions (view another user's data, escalate to admin).

**Check:**
- Every route/endpoint enforces authorization — not just authentication.
- Resource ownership is verified: `SELECT * FROM orders WHERE id = ? AND user_id = ?`
- Sensitive actions (delete, admin) require re-verification.
- CORS policy does not allow all origins (`*`) for credentialed requests.

```typescript
// ❌ Missing ownership check
const order = await db.order.findById(req.params.id);

// ✅ Verify ownership
const order = await db.order.findFirst({
  where: { id: req.params.id, userId: req.user.id },
});
if (!order) throw new NotFoundError("Order not found");
```

---

## A02 — Cryptographic Failures

**What:** Sensitive data exposed in transit or at rest due to weak or missing encryption.

**Check:**
- HTTPS enforced everywhere — no HTTP fallback for sensitive data.
- Passwords hashed with bcrypt, scrypt, or Argon2 — never MD5, SHA1, or plain text.
- Encryption keys stored securely — not hardcoded or in source.
- No sensitive data in URLs, logs, or error messages.

```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);
const valid = await bcrypt.compare(input, hash);
```

---

## A03 — Injection

**What:** Untrusted data interpreted as code: SQL, OS commands, LDAP, XML, template injection.

**Check:** → See `input-validation.md` for full patterns.
- SQL: parameterized queries only.
- Shell: `execFile` with arrays, not `exec` with string concatenation.
- Template engines: disable raw output (`{{{ }}}` in Handlebars, `| safe` in Jinja2) for user data.

---

## A04 — Insecure Design

**What:** Missing or inadequate security controls in the architecture itself.

**Check:**
- Threat model exists for sensitive flows (auth, payments, data export).
- Rate limiting on authentication, password reset, and sensitive APIs.
- Multi-factor authentication available for privileged accounts.
- Account lockout or CAPTCHA after repeated failed logins.

---

## A05 — Security Misconfiguration

**What:** Default credentials, verbose error messages, unnecessary features enabled, missing headers.

**Check:**
- Default passwords changed; default admin accounts disabled.
- Verbose stack traces not exposed to end users.
- Security headers set: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`.
- Directory listing disabled on web servers.
- Debug mode disabled in production.

```typescript
// Express security headers (use helmet)
import helmet from "helmet";
app.use(helmet());

// Never expose stack traces
app.use((err, req, res, next) => {
  console.error(err); // log internally
  res.status(500).json({ error: "Internal server error" }); // generic to client
});
```

---

## A06 — Vulnerable and Outdated Components

**Check:** → See `dependency-security.md` for full patterns.
- `npm audit` / `pip audit` / `cargo audit` run in CI.
- Dependencies pinned with lockfiles (`package-lock.json`, `poetry.lock`).
- Outdated packages with known CVEs updated promptly.

---

## A07 — Identification and Authentication Failures

**What:** Weak credentials, session fixation, credential stuffing vulnerabilities.

**Check:**
- Password minimum length ≥ 12 characters; allow long passphrases.
- Passwords checked against breach databases (HaveIBeenPwned API).
- Session tokens invalidated on logout.
- Secure, HttpOnly, SameSite cookies for session tokens.
- Rate limiting on login endpoints.

```typescript
// Secure session cookie
res.cookie("session", token, {
  httpOnly: true,          // not accessible via JS
  secure: true,            // HTTPS only
  sameSite: "strict",      // CSRF protection
  maxAge: 15 * 60 * 1000,  // 15 minutes
});
```

---

## A08 — Software and Data Integrity Failures

**What:** Code or data loaded without integrity verification; insecure CI/CD pipelines.

**Check:**
- Subresource Integrity (SRI) hashes for CDN scripts and stylesheets.
- CI/CD pipeline secrets not accessible to forked PRs.
- Package signatures verified where available.
- Critical npm packages pinned to exact versions.

---

## A09 — Security Logging and Monitoring Failures

**What:** Insufficient logging to detect or respond to breaches.

**Log these events:**
- Authentication attempts (success and failure) with IP and user-agent.
- Authorization failures (access denied).
- Input validation failures for suspicious patterns.
- Privilege escalation actions.
- Configuration changes.

**Never log:**
- Passwords, tokens, secrets, or session IDs.
- Full credit card numbers or other PII.
- Full request bodies from login endpoints.

---

## A10 — Server-Side Request Forgery (SSRF)

**What:** Attacker tricks the server into making requests to internal services.

**Check:**
- URLs provided by users are validated against an allowlist of domains.
- Requests to `169.254.x.x` (AWS metadata), `localhost`, `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x` are blocked.
- Redirects followed only within the allowlisted domain.

```typescript
function validateOutboundUrl(url: string, allowedHosts: string[]): URL {
  const parsed = new URL(url); // throws on invalid URL
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }
  return parsed;
}
```
