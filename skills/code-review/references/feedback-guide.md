# Feedback Guide

> Reference for: code-review
> Load when: Writing review comments, structuring feedback, or calibrating tone

## Comment Levels

Label every comment so the author knows how to prioritize:

| Label | Meaning | Example trigger |
|-------|---------|----------------|
| `blocker:` | Must be resolved before merge | Security bug, correctness error, missing critical test |
| `suggestion:` | Worthwhile improvement, not required | Better approach, cleaner abstraction |
| `nit:` | Cosmetic, optional, easy to skip | Typo, minor naming preference |
| `question:` | Seeking understanding, not a critique | "Why was X chosen over Y here?" |
| `praise:` | Something done especially well | Acknowledge good patterns |

---

## Comment Structure

A good blocker or suggestion comment has three parts:

1. **What** — what the problem or improvement is.
2. **Why** — why it matters (correctness, security, maintainability, performance).
3. **How** — a concrete suggestion or example.

```
blocker: This SQL query is vulnerable to injection.
The email parameter is concatenated directly into the query string,
allowing an attacker to inject arbitrary SQL.

Use a parameterized query instead:
  db.query("SELECT * FROM users WHERE email = $1", [email])
```

```
suggestion: Consider extracting the retry logic into a shared helper.
This is the third place in the codebase with an identical retry loop.
A shared `withRetry(fn, { attempts, delay })` would reduce duplication
and make the retry policy easier to change in one place.
```

```
nit: s/userId/user_id/ in this file to match the naming convention in
the rest of the module (snake_case for database field names).
```

---

## Tone and Framing

**Ask, don't accuse:**
```
❌ "This is wrong."
✅ "This will fail when email is null — can we add a guard clause here?"

❌ "Why did you do it this way?"
✅ "I'm curious about the choice to use polling here — was an event-driven approach considered?"

❌ "Bad practice."
✅ "suggestion: Using Math.random() for tokens is not cryptographically secure.
    crypto.randomBytes(32) is the safe alternative."
```

**Be specific:**
```
❌ "This function is too complex."
✅ "suggestion: This function is doing three things: parsing, validating, and persisting.
    Extracting the validation step would make each part easier to test independently."
```

**Acknowledge good work:**
```
praise: The guard clause pattern here is clean — errors bubble up early and the
happy path stays unindented. Nice.

praise: Good call adding the integration test for the retry path —
that's exactly the kind of scenario that breaks in production.
```

---

## Blocking vs Non-Blocking

**Block on (blockers):**
- Correctness bugs that will cause failures in production.
- Security vulnerabilities (injection, exposed secrets, missing auth).
- Missing tests for new behavior that is non-trivial or critical.
- Breaking changes not documented or not backward-compatible.
- Code that won't compile or will fail the build.

**Do NOT block on:**
- Style issues that a linter enforces (configure the linter, don't comment).
- Naming that is clear and consistent with the rest of the file.
- Personal preference when both approaches are equally valid.
- Architectural improvements that are out of scope for this PR.
- Performance optimizations without measured data showing a problem.

---

## Reviewing Large PRs

When a PR is too large to review properly:

1. Comment on the PR: "This is > 800 lines changed, which makes a thorough review difficult. Can we split this into: (a) the data model change, (b) the feature on top?"
2. If splitting is not possible, prioritize: security review first, then correctness, then design, then style.
3. Acknowledge the limitation: "I've reviewed the auth and input handling carefully; the refactoring in the utils layer is a lighter pass."

---

## Example Review Output

```
## Summary

The core logic looks correct and the tests cover the happy path well.
There are two blockers to address before merge — one security issue and
one missing edge case test.

## Blockers

**blocker** `src/api/users.ts:47` — Missing ownership check.
The handler fetches the order by ID without verifying it belongs to the
requesting user. This allows any authenticated user to view any order.
Fix: add `userId: req.user.id` to the WHERE clause.

**blocker** `test/users.test.ts` — No test for the error path when the order is not found.
The handler currently returns a 500 for missing orders. Add a test that
verifies it returns 404 with a clear message.

## Suggestions

**suggestion** `src/api/users.ts:62` — The retry logic here is identical to
`src/api/catalog.ts:89`. Consider extracting to a shared `withRetry` helper.

## Nits

**nit** `src/api/users.ts:31` — `userId` → `user_id` to match db field naming convention.

## Positives

The zod schema for request validation is thorough — covers format, length,
and the enum constraint. Good defensive approach.
```
