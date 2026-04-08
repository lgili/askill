---
name: secure-defaults
description: Security-first code generation specialist that enforces safe defaults for secret management, input validation, authentication, dependency hygiene, and data exposure prevention across any language or framework. Use when generating code that handles user input, external APIs, authentication, file uploads, database queries, environment configuration, or shell commands. Trigger for asks like "add auth", "handle user input", "connect to database", "read env vars", "run shell command", "handle file upload", "is this secure", or any task that processes untrusted data or touches credentials.
---

# Secure Defaults

## Overview

Use this skill to generate code with security controls built in from the start —
not bolted on after a vulnerability is found in production.

## Core Workflow

1. Identify trust boundaries.
   - List every source of external input: user data, API responses, env vars, files, CLI args, headers.
   - Classify data sensitivity: public, internal, confidential, secret (credentials/keys/PII).
   - Map output sinks: database, filesystem, shell, network responses, logs.
   - Any data crossing a trust boundary must be validated before use.

2. Apply secret management controls.
   - Read secrets only from environment variables or a secret manager — never from source code.
   - Check that no token, password, key, or connection string appears as a string literal in code.
   - Verify `.env` and credential files are listed in `.gitignore`.
   - Run `scripts/scan_secrets.js` on staged files before committing.

3. Validate and sanitize all input.
   - Validate type, length, format, and range at every trust boundary entry point.
   - Parameterize all database queries — never concatenate user data into SQL strings.
   - Encode or escape output for the target context: HTML, shell, SQL, JSON, URLs.

4. Apply authentication and authorization controls.
   - Use an established library for auth — never roll custom crypto or session management.
   - Verify identity (authn) before checking permissions (authz).
   - Use short-lived tokens; store refresh tokens securely (httpOnly cookies or encrypted storage).
   - Enforce least privilege: grant the minimum permissions required for each operation.

5. Harden the runtime environment.
   - Use HTTPS for all external network requests — never disable TLS verification.
   - Set security-relevant HTTP headers (CSP, HSTS, X-Frame-Options) for web services.
   - Pin or lock dependency versions; audit with `npm audit` / `pip audit` / `cargo audit`.
   - Log security-relevant events without logging secrets or PII in plain text.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Secret management | `references/secret-management.md` | Handling API keys, passwords, tokens, connection strings, env vars |
| Input validation | `references/input-validation.md` | Validating and sanitizing user or external input |
| OWASP Top 10 | `references/owasp-top10.md` | Reviewing code for the most critical vulnerability classes |
| Dependency security | `references/dependency-security.md` | Auditing packages, pinning versions, supply chain hardening |

## Bundled Scripts

- `scripts/scan_secrets.js`
  - Scan files or git-staged changes for common secret patterns: API keys, tokens, passwords, private keys, connection strings.
  - Use before every commit, or wire as a `pre-commit` git hook.
  - Run: `node skills/secure-defaults/scripts/scan_secrets.js`
  - Or: `node skills/secure-defaults/scripts/scan_secrets.js --path src/`
  - Or: `node skills/secure-defaults/scripts/scan_secrets.js --staged`

## Constraints

### MUST DO

- Use environment variables for all secrets; add required vars to `.env.example` with placeholder values.
- Validate and sanitize all external input before use — type, length, format, and range.
- Use parameterized queries or an ORM for all database operations.
- Use HTTPS for all external network requests.
- Apply least privilege to tokens, IAM roles, database users, and file permissions.
- Log security-relevant events (login, access denied, config changes) with context but without secrets.

### MUST NOT DO

- Hardcode API keys, passwords, tokens, or connection strings anywhere in source code.
- Log request bodies, user passwords, auth tokens, or PII in plain text.
- Disable TLS verification (`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify`).
- Construct shell commands by concatenating user-controlled input.
- Use `eval()` or dynamic code execution on untrusted data.
- Skip validation because "this is an internal API" — insider threats and SSRF exist.
- Store secrets in version control, even in private repositories.

## Output Template

For security-sensitive tasks, provide:

1. **Trust boundary map** — sources of untrusted input and output sinks identified.
2. **Secret handling** — env vars used, `.env.example` entries needed.
3. **Validation strategy** — what is validated, how, and at which layer.
4. **Auth/authz approach** — library chosen, token lifecycle, permission model.
5. **Known limitations** — deferred controls with justification and follow-up plan.

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GitHub — Secret scanning](https://docs.github.com/en/code-security/secret-scanning)
