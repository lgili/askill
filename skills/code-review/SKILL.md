---
name: code-review
description: Code review specialist for conducting thorough, systematic, and constructive reviews of pull requests and code changes across any language or framework. Use when asked to review a PR, audit code quality, check for security issues, evaluate architecture decisions, or provide structured feedback on an implementation. Trigger for asks like "review this PR", "check my code", "is this safe", "any issues with this implementation", "code review", "give me feedback", "what's wrong with this", or "is this ready to merge".
---

# Code Review

## Overview

Use this skill to conduct systematic, actionable code reviews that improve correctness,
security, and maintainability without blocking progress on style opinions.

## Core Workflow

1. Understand context before reading the diff.
   - Read the PR description, linked issue, and any referenced tickets.
   - Understand what problem is being solved and why this approach was chosen.
   - Identify the scope: bug fix, new feature, refactor, hotfix, or dependency update.

2. Review architecture and design.
   - Does the change fit the existing structure, or does it introduce inconsistency?
   - Are new abstractions necessary, or does this add complexity without clear benefit?
   - Are module boundaries, naming conventions, and dependency directions respected?

3. Check security implications.
   - Does the change handle untrusted input? Is it validated and sanitized?
   - Are secrets managed correctly — no literals, env vars used?
   - Does the change introduce new attack surface: new endpoints, file access, shell commands, or data exposure?

4. Verify correctness and logic.
   - Trace the happy path and at least two edge cases mentally.
   - Look for off-by-one errors, null dereferences, unchecked array accesses, and race conditions.
   - Confirm error paths are handled and errors are not silently swallowed.
   - Check that async code is properly awaited and error cases propagate correctly.

5. Assess test coverage and maintainability.
   - Is there sufficient test coverage for the changed behavior?
   - Are tests meaningful — do they cover edge cases and error paths, not just the happy path?
   - Is the code readable without tracing multiple layers?
   - Are variable and function names clear and consistent with the codebase?

6. Write structured feedback.
   - Use levels: `blocker`, `suggestion`, `nit`.
   - Explain the *why* behind every blocker — link to docs or examples when helpful.
   - Acknowledge what was done well — reinforces good patterns.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Review checklist | `references/review-checklist.md` | Full systematic checklist for any code review |
| Security review | `references/security-review.md` | Reviewing auth, input handling, secrets, and data exposure |
| Feedback guide | `references/feedback-guide.md` | Writing clear, constructive, and actionable review comments |

## Constraints

### MUST DO

- Read the full diff and the context it lives in before commenting.
- Distinguish blockers (must fix before merge) from suggestions (nice to have).
- Explain the reason for every blocker — not just "this is wrong", but why and how to fix it.
- Check that new or changed behavior has test coverage.
- Always check security implications on changes that touch input handling, auth, or I/O.

### MUST NOT DO

- Block PRs on style issues that a linter or formatter can and should enforce automatically.
- Comment on code style that is consistent with the existing codebase convention.
- Approve PRs with known security blockers to avoid slowing down delivery.
- Leave vague comments: "this is wrong", "bad practice", "don't do this" — without explanation.
- Review while ignoring the PR description and the problem it solves.
- Nit-pick variable names when they are clear and consistent with the rest of the file.

## Output Template

For code review tasks, provide:

1. **Summary** — one paragraph on overall quality and readiness to merge.
2. **Blockers** — issues that must be resolved: correctness bugs, security issues, missing tests for critical paths.
3. **Suggestions** — improvements worth considering but not required for merge.
4. **Nits** — minor style or naming preferences (clearly labeled, easy to skip).
5. **Positives** — what was done well (at least one if the code is generally good).

## References

- [Google Engineering Practices — Code Review](https://google.github.io/eng-practices/review/)
- [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/)
- [Conventional Comments](https://conventionalcomments.org/)
- [SmartBear — Best Practices for Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
- [The Art of Giving and Receiving Code Reviews](https://www.alexandra-hill.com/2018/06/25/the-art-of-giving-and-receiving-code-reviews/)
