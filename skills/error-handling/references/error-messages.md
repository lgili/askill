# Error Messages

> Reference for: error-handling
> Load when: Writing error messages for end users, API consumers, or operators

## The Three Questions

Every good error message answers:

1. **What happened?** — describe the specific failure, not a generic "error occurred".
2. **What was expected?** — tell the user what valid input or state looks like.
3. **What should they do?** — give a concrete next step when possible.

---

## Message Quality Examples

```
❌ "Invalid input"
✅ "Email address is required. Provide a valid email like user@example.com."

❌ "Error processing request"
✅ "File size exceeds the 5 MB limit. Received 7.2 MB. Compress the file and try again."

❌ "Not found"
✅ "Skill 'git-master' is not installed. Run: skillex install git-master"

❌ "Something went wrong"
✅ "GitHub API returned 403. Set the GITHUB_TOKEN environment variable to authenticate and raise the rate limit."

❌ "Database error"
✅ "Could not save the user record. The database is temporarily unavailable. Try again in a moment."
```

---

## Field-Level Validation Messages

For form and API validation, include the field name and the constraint violated:

```typescript
// Pattern: "Field <name> <constraint>. <correction>."
throw new ValidationError("email",   "Email is required.");
throw new ValidationError("email",   "Email format is invalid. Expected: user@domain.com");
throw new ValidationError("age",     "Age must be between 13 and 120. Received: -5");
throw new ValidationError("role",    "Role must be one of: admin, editor, viewer. Received: superuser");
throw new ValidationError("tags",    "Tags must be an array of strings. Received: 42");
throw new ValidationError("limit",   "Limit must be a positive integer (max 100). Received: 0");
```

API response shape for field errors:

```json
{
  "error": "Validation failed",
  "fields": [
    { "field": "email", "message": "Email format is invalid." },
    { "field": "age",   "message": "Age must be between 13 and 120. Received: -5" }
  ]
}
```

---

## Operational Error Messages (logs and CLI)

Operational errors (for developers, not end users) should include:

- **What operation failed** — "Failed to fetch catalog"
- **The root cause** — "GitHub returned 404"
- **Actionable hint** — "Check that --repo is correct and the repository is public"
- **Relevant context** — URL, file path, resource ID

```typescript
// CLI error — operator-facing
throw new CliError(
  "Failed to fetch catalog from lgili/skillex.\n" +
  "GitHub returned 404. Check that --repo is correct and the repository is public.",
  "CATALOG_FETCH_FAILED",
);

// Log error — developer-facing (more context)
logger.error("Catalog fetch failed", {
  repo: "lgili/skillex",
  url: "https://raw.githubusercontent.com/lgili/skillex/main/catalog.json",
  status: 404,
  duration_ms: 312,
});
```

---

## What NOT to Include in Error Messages

| ❌ Never expose | ✅ Use instead |
|----------------|---------------|
| Stack traces to end users | Log internally; return generic message |
| Database column names | Use domain field names |
| Internal service URLs or IPs | "Service temporarily unavailable" |
| SQL error text | "Could not save record" |
| File system paths | "Configuration file not found" |
| User passwords (even masked) | Never log passwords at all |
| Session tokens or API keys | Mask to first 4 chars: `sk-live-****` |

---

## Error Code Convention

Use an uppercase `SNAKE_CASE` code alongside the human message. Codes allow:
- Programmatic handling without string matching.
- Translation / i18n of messages while keeping stable codes.
- Precise error tracking in monitoring systems.

```typescript
// error code format: DOMAIN_SPECIFIC_PROBLEM
"VALIDATION_REQUIRED_FIELD"
"VALIDATION_INVALID_FORMAT"
"NOT_FOUND_SKILL"
"NOT_FOUND_ADAPTER"
"NETWORK_TIMEOUT"
"NETWORK_RATE_LIMIT"
"AUTH_UNAUTHORIZED"
"AUTH_TOKEN_EXPIRED"
"CATALOG_PARSE_ERROR"
"INSTALL_ALREADY_INSTALLED"
```
