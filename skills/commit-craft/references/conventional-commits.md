# Conventional Commits

> Reference for: commit-craft
> Load when: Writing or validating commit messages, enforcing format in CI hooks

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Subject line rules
- Maximum 72 characters
- Use lowercase for `type` and `description`
- No period at the end
- Imperative mood: "add feature" not "added feature" or "adds feature"

---

## Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature visible to users or consumers |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD pipeline changes |
| `chore` | Maintenance tasks (release scripts, config) |
| `revert` | Reverts a previous commit |

---

## Scope

The scope is optional and describes what part of the codebase was changed:

```
feat(auth): add OAuth2 login flow
fix(catalog): resolve pagination offset error
refactor(cli): extract argument parser into separate module
```

Use consistent scope names across the team. Common scopes: `api`, `cli`, `auth`, `ui`, `db`, `config`, `ci`, `deps`.

---

## Breaking Changes

Mark breaking changes with `!` after the type/scope, and add a `BREAKING CHANGE:` footer:

```
feat(api)!: remove deprecated v1 endpoints

BREAKING CHANGE: /api/v1/users and /api/v1/items are removed.
Migrate to /api/v2/users and /api/v2/items.
```

---

## Issue References (footer)

```
fix(auth): handle expired session tokens

Closes #142
Refs #98
```

---

## Multi-paragraph body

Use the body when the diff alone does not explain the *why*:

```
refactor(sync): replace polling with event-driven sync

The previous implementation polled the remote every 5 s regardless
of activity, causing unnecessary API calls on idle workspaces.

The new approach subscribes to file-system events and only triggers
a sync when a tracked file changes, reducing API calls by ~90% in
typical usage.
```

---

## Quick Examples

```bash
feat(ui): add dark mode toggle to settings panel
fix(install): resolve path error on Windows with spaces in home dir
docs(readme): update quick-start to use npx syntax
refactor(catalog): extract cache helpers into separate functions
test(sync): add coverage for dry-run mode with symlinks
chore(deps): upgrade typescript from 5.4 to 5.9
ci: add Node 22 to the test matrix
perf(catalog): skip full tree fetch when catalog.json is present
feat(cli)!: rename --repo flag to --source

BREAKING CHANGE: --repo is no longer accepted. Use --source instead.
```

---

## Git Hook Setup

Wire `check_commit_msg.js` as a `commit-msg` hook to enforce format on every commit:

```bash
# .git/hooks/commit-msg
#!/bin/sh
node skills/commit-craft/scripts/check_commit_msg.js --file "$1"
```

```bash
chmod +x .git/hooks/commit-msg
```

Or use [husky](https://typicode.github.io/husky/) for team-wide enforcement:

```json
// package.json
{
  "husky": {
    "hooks": {
      "commit-msg": "node skills/commit-craft/scripts/check_commit_msg.js --file $HUSKY_GIT_PARAMS"
    }
  }
}
```
