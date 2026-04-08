# Branching Strategy

> Reference for: commit-craft
> Load when: Creating branches, deciding rebase vs merge, managing releases or hotfixes

## Branch Naming

Use a consistent `type/short-description` pattern:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<description>` | `feat/oauth-login` |
| Bug fix | `fix/<description>` | `fix/catalog-pagination` |
| Release | `release/<version>` | `release/1.4.0` |
| Hotfix | `hotfix/<description>` | `hotfix/token-leak` |
| Chore | `chore/<description>` | `chore/upgrade-deps` |
| Docs | `docs/<description>` | `docs/api-reference` |

Rules:
- Use lowercase and hyphens only (no slashes inside the description).
- Keep descriptions short (3–5 words max).
- Include the issue number when one exists: `fix/142-session-expiry`.

---

## Trunk-Based Development (recommended for small teams)

```
main ──●──●──●──●──●──●──▶
        └─feat─┘  └─fix─┘
```

- All work branches off `main` and merges back quickly (< 2 days).
- No long-lived feature branches.
- Use feature flags for incomplete features in `main`.
- CI must pass before merge; direct commits to `main` are blocked.

**When to use:** Small teams, fast iteration, continuous deployment.

---

## GitFlow (for versioned releases)

```
main         ●─────────────────────────●──▶  (tagged releases)
              \                        /
develop   ●────●──●──●──●──●──●──●────▶
               └─feat─┘  └─feat─┘
```

Branches:
- `main` — production-ready, every commit is a release.
- `develop` — integration branch, always deployable.
- `feature/*` — branch from `develop`, merge back via PR.
- `release/*` — branch from `develop` for release prep; merge to both `main` and `develop`.
- `hotfix/*` — branch from `main`; merge to both `main` and `develop`.

**When to use:** Libraries with versioned releases, larger teams.

---

## Rebase vs Merge

| Scenario | Use |
|----------|-----|
| Updating a feature branch with latest `main` | `git rebase main` — keeps history linear |
| Merging a short-lived branch (1–3 commits) | `git merge --ff-only` or squash merge |
| Merging a long-lived branch with complex history | `git merge --no-ff` — preserves branch context |
| Cleaning up WIP commits before PR | `git rebase -i HEAD~N` — squash/fixup |

**Rules:**
- Never rebase branches that others are working on.
- Prefer `--ff-only` for simple feature branches to keep history linear.
- Use `--no-ff` merges when the branch context is meaningful to preserve.

---

## Keeping a Branch Up to Date

```bash
# Rebase approach (linear history)
git fetch origin
git rebase origin/main

# Merge approach (shows sync commit)
git fetch origin
git merge origin/main
```

Prefer rebase for feature branches; prefer merge for long-lived branches to avoid rewriting shared history.

---

## Tagging Releases

```bash
# Annotated tag (preferred — stores tagger, date, message)
git tag -a v1.4.0 -m "Release v1.4.0"
git push origin v1.4.0

# Push all tags at once
git push origin --tags
```

Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
- `MAJOR` — breaking changes
- `MINOR` — new backward-compatible features
- `PATCH` — backward-compatible bug fixes

---

## Stale Branch Cleanup

```bash
# List branches merged into main
git branch --merged main

# Delete locally
git branch -d feat/old-feature

# Delete remotely
git push origin --delete feat/old-feature

# Prune remote-tracking references
git fetch --prune
```
