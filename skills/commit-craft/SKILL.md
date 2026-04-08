---
name: commit-craft
description: Git workflow specialist for atomic commits, conventional commit messages, clean pull request descriptions, and safe branch management. Use when writing commit messages, preparing PRs, reviewing git history, rebasing, or enforcing team git conventions. Trigger for asks like "commit this", "write a commit message", "clean up git history", "prepare a PR", "review my branch", "squash commits", or "set up git workflow".
---

# Commit Craft

## Overview

Use this skill to produce atomic, well-described commits, clean branch history, and
pull request descriptions that make code review fast and `git bisect` reliable.

## Core Workflow

1. Assess the scope of changes.
   - Identify logical units of work: one fix, one feature, one refactor.
   - Group related changes together; split unrelated ones into separate commits.
   - Confirm no secrets, build artifacts, lock files with noise, or generated files are staged unintentionally.

2. Design atomic commit structure.
   - One commit = one logical change.
   - Keep refactoring commits separate from feature or fix commits.
   - Rebase or squash WIP commits before opening a PR.
   - Use `git add -p` to stage partial file changes when a file mixes concerns.

3. Write the commit message.
   - Use Conventional Commits format: `type(scope): short summary`.
   - Keep the subject line ≤ 72 characters.
   - Add a body paragraph when the "why" is not obvious from the diff alone.
   - Reference issues or tickets in the footer when applicable.

4. Verify the pre-commit checklist.
   - Run `scripts/check_commit_msg.js` to validate message format.
   - Confirm tests pass and linter is clean.
   - Confirm no `.env`, credentials, private keys, or large binaries are staged.

5. Write the pull request description.
   - Summarize what changed and why (not what — the diff shows that).
   - Add a test plan or steps to verify the change works.
   - Link the related issue with `Closes #<n>` or `Fixes #<n>`.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Conventional Commits | `references/conventional-commits.md` | Writing or validating commit messages, enforcing format in CI |
| Branching strategy | `references/branching-strategy.md` | Creating branches, rebase vs merge, release flow, hotfixes |
| PR checklist | `references/pr-checklist.md` | Preparing or reviewing pull requests before merge |

## Bundled Scripts

- `scripts/check_commit_msg.js`
  - Validate a commit message string against the Conventional Commits specification.
  - Use before committing or wire as a `commit-msg` git hook to enforce format automatically.
  - Run: `node skills/commit-craft/scripts/check_commit_msg.js "feat(api): add pagination"`
  - Or: `node skills/commit-craft/scripts/check_commit_msg.js --file .git/COMMIT_EDITMSG`

## Constraints

### MUST DO

- Use `type(scope): description` Conventional Commits format for every commit message.
- Keep each commit to one logical change — a reviewer should understand it independently.
- Reference the issue or ticket in the commit footer when one exists.
- Separate refactoring commits from feature or fix commits.
- Verify no secrets, credentials, or sensitive data are staged before committing.
- Ask before force-pushing to any shared branch.

### MUST NOT DO

- Force-push to `main` or `master` without explicit user confirmation.
- Mix unrelated changes (e.g., a bug fix + a refactor) in a single commit.
- Write vague messages: `"fix"`, `"update"`, `"WIP"`, `"stuff"`, `"changes"`, `"misc"`.
- Commit `.env` files, private keys, API tokens, or binary assets over 1 MB.
- Rewrite public branch history that other contributors may already have pulled.
- Amend a commit that has already been pushed without confirming with the user.

## Output Template

When preparing a commit or PR, provide:

1. **Commit message(s)** in Conventional Commits format, one per logical change.
2. **Scope justification** — why these changes belong together in one commit.
3. **PR description** with a summary, motivation, and test plan.
4. **Risk notes** — breaking changes, migration steps, or follow-up issues.

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/)
- [How to Write a Git Commit Message — Chris Beams](https://cbea.ms/git-commit/)
- [Pro Git Book](https://git-scm.com/book/en/v2)
- [GitHub — Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)
