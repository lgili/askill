# Pull Request Checklist

> Reference for: commit-craft
> Load when: Preparing or reviewing a pull request before opening or merging

## Before Opening a PR

### Code
- [ ] Changes are limited to the stated purpose — no unrelated refactors mixed in.
- [ ] Dead code, debug logs, and TODO comments from development are removed.
- [ ] No hardcoded credentials, tokens, or environment-specific values.
- [ ] No generated or build files accidentally committed.

### Tests
- [ ] New behavior has tests covering the happy path and key edge cases.
- [ ] Existing tests pass (`npm test` / `pytest` / `go test ./...`).
- [ ] Regression test added if this is a bug fix.

### Documentation
- [ ] Public API changes are reflected in docs, JSDoc, or type signatures.
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if the project maintains one.
- [ ] README updated if user-facing behavior changed.

### Commits
- [ ] Commit messages follow Conventional Commits format.
- [ ] No WIP, fixup, or merge commits in the branch history (squash or rebase first).
- [ ] Each commit is atomic and could be understood independently.

---

## PR Description Template

```markdown
## What

Brief summary of what changed and why (not what the diff shows — that's visible).

## Why

Motivation: what problem does this solve, or what feature does it enable?
Link to the issue: Closes #<n>

## How

Key implementation decisions. Mention non-obvious trade-offs.

## Test Plan

Steps to verify the change works:
1. ...
2. ...

## Screenshots / Demo (if UI change)

## Notes / Follow-up

Any known limitations, deferred work, or issues to open after merge.
```

---

## PR Size Guidelines

| Size | Guideline |
|------|-----------|
| Ideal | < 400 lines changed |
| Acceptable | 400–800 lines |
| Needs splitting | > 800 lines |

Large PRs are harder to review thoroughly. Split by:
- Separating refactoring from new behavior.
- Shipping the data model change first, then the feature on top.
- Shipping tests for existing behavior separately from the new behavior.

---

## Before Merging (reviewer)

- [ ] The PR description explains the motivation clearly.
- [ ] All CI checks pass.
- [ ] No unresolved review comments.
- [ ] No merge conflicts.
- [ ] Approved by at least one other contributor (for shared repos).

---

## Merge Strategies

| Strategy | When to use |
|----------|-------------|
| **Squash merge** | Short-lived branches with many WIP commits; one clean commit in `main` |
| **Rebase merge** | Well-structured branches where each commit is meaningful to preserve |
| **Merge commit** | Long-lived branches or when the branch context should be visible in history |

Default for most teams: **squash merge** small PRs, **merge commit** for releases and long-lived feature branches.
