# Skillex

[![CI](https://github.com/lgili/skillex/actions/workflows/ci.yml/badge.svg)](https://github.com/lgili/skillex/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/skillex)](https://www.npmjs.com/package/skillex)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Skillex** is a CLI that installs and synchronizes AI agent skills from a GitHub-hosted catalog. It supports both workspace-local installs and user-global installs, and it exposes skills to major AI agents such as Codex, Copilot, Cline, Cursor, Claude, Gemini, and Windsurf.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Commands](#commands)
- [Adapters](#adapters)
- [Skill Catalog Format](#skill-catalog-format)
- [Skill Format](#skill-format)
- [GitHub Token](#github-token)
- [Global Configuration](#global-configuration)
- [Workspace Structure](#workspace-structure)
- [Auto-sync](#auto-sync)
- [Troubleshooting](#troubleshooting)
- [Publishing Your Own Catalog](#publishing-your-own-catalog)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

Get up and running in under two minutes using the built-in first-party skills catalog:

```bash
# 1. Initialize your workspace (auto-detects your AI agent)
npx skillex@latest init

# 2. Browse available skills
npx skillex@latest list

# 3. Install a skill
npx skillex@latest install create-skills
```

> **Important:** auto-sync is enabled by default. After `init`, `install`, `update`, and `remove`, Skillex automatically synchronizes skills into every detected adapter target. For directory-native adapters such as Codex, Claude, and Gemini, this materializes one folder per skill under the agent's `skills/` directory. For file-based adapters such as Copilot, Cursor, Cline, and Windsurf, it updates the adapter config file. Use `skillex sync` when you want to preview, re-run manually, or target a specific adapter.

After `init`, Skillex saves the configured source list in the local lockfile. New workspaces start with `lgili/skillex@main` by default, and you can add more sources later with `skillex source add`.

---

## Installation

### Option 1 — Run without installing (recommended for most users)

```bash
npx skillex@latest <command>
```

### Option 2 — Install globally

```bash
npm install -g skillex
skillex --help
```

### Option 3 — Install as a dev dependency (pin the version per project)

```bash
npm install -D skillex
npx skillex <command>
```

---

## Commands

### `init`

Initialize local or global Skillex state. Local scope creates `.agent-skills/skills.json` in the current workspace. Global scope creates `~/.skillex/skills.json`.

```bash
skillex init
skillex init --repo <owner/repo>
skillex init --repo lgili/skillex --adapter cursor
skillex init --repo lgili/skillex --auto-sync
skillex init --auto-sync=false
skillex init --global --adapter codex
```

| Flag | Description |
|------|-------------|
| `--repo <owner/repo>` | Optional. Overrides the default first-party source for this workspace. |
| `--adapter <id>` | Force a specific adapter instead of auto-detecting. |
| `--auto-sync` | Enable or disable automatic sync after install, update, and remove. Default: `true`. |
| `--ref <branch>` | Use a specific branch or tag (default: `main`). |
| `--scope <local\|global>` | Choose whether Skillex manages workspace or user-global state. |
| `--global` | Shortcut for `--scope global`. |

---

### `list`

List all skills available across the configured sources.

```bash
skillex list
skillex list --json
skillex list --repo myorg/my-skills
```

| Flag | Description |
|------|-------------|
| `--repo <owner/repo>` | Limit the command to a single source instead of aggregating all configured sources. |
| `--json` | Print raw JSON instead of formatted output. |
| `--no-cache` | Bypass the local catalog cache and fetch fresh data. |

---

### `search`

Search skills by keyword, adapter compatibility, or tag.

```bash
skillex search git
skillex search --compatibility cursor
skillex search --tags workflow
skillex search review --compatibility claude --tags code-quality
skillex search code-review --repo myorg/my-skills
```

| Flag | Description |
|------|-------------|
| `--repo <owner/repo>` | Limit the command to a single source instead of aggregating all configured sources. |
| `--compatibility <adapter>` | Filter by adapter (e.g. `cursor`, `claude`, `codex`). |
| `--tags <tag>` | Filter by tag. |
| `--json` | Print raw JSON. |

---

### `install`

Install one or more skills by ID, or all skills from the catalog.

```bash
# Install by ID
skillex install git-master

# Install multiple skills
skillex install git-master code-review

# Install all skills from the catalog
skillex install --all

# Install from one specific source when an id exists in multiple sources
skillex install code-review --repo myorg/my-skills

# Install directly from a GitHub repository (no catalog needed)
skillex install owner/repo/path/to/skill@main --trust

# Install once for all workspaces
skillex install create-skills --global
```

| Flag | Description |
|------|-------------|
| `--all` | Install every skill in the catalog. |
| `--repo <owner/repo>` | Limit resolution to a single source when needed. |
| `--trust` | Skip confirmation prompt for direct GitHub installs. |
| `--scope <local\|global>` | Choose whether Skillex writes to `.agent-skills/` or `~/.skillex/`. |
| `--global` | Shortcut for `--scope global`. |

> **After installing,** Skillex syncs automatically by default. Run `skillex sync` manually only when you want to preview changes, re-run synchronization, or force a specific adapter.

---

### `update`

Update installed skills to their latest catalog version.

```bash
# Update all installed skills
skillex update

# Update a specific skill
skillex update git-master

# Update global skills
skillex update --global
```

---

### `remove`

Remove one or more installed skills. Aliases: `rm`, `uninstall`.

```bash
skillex remove git-master
skillex rm git-master code-review
skillex remove create-skills --global
```

---

### `sync`

Expose all installed skills to the detected adapters. For `codex`, `claude`, and `gemini`, this creates one folder per skill under the adapter's `skills/` directory. For file-based adapters, it updates the adapter's config file. This is the same operation Skillex runs automatically after `install`, `update`, and `remove`.

```bash
# Sync to all detected adapters
skillex sync

# Preview changes without writing (shows a diff)
skillex sync --dry-run

# Force a specific adapter
skillex sync --adapter codex

# Copy files instead of using symlinks
skillex sync --mode copy

# Sync globally to your user-level Codex skills directory
skillex sync --global --adapter codex
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would change without writing anything. |
| `--adapter <id>` | Override the active adapter for this sync. |
| `--mode copy\|symlink` | File write strategy (default: `symlink` for dedicated targets). |
| `--scope <local\|global>` | Choose whether the sync reads local or global Skillex state. |
| `--global` | Shortcut for `--scope global`. |

#### Using multiple agents in the same workspace

By default, `sync` writes to every detected adapter in the workspace. If you want to limit the operation to one adapter, pass `--adapter`:

```bash
# Only sync Claude
skillex sync --adapter claude

# Only sync Codex
skillex sync --adapter codex
```

Each adapter writes to its own target path, so the syncs are independent and non-destructive. Automatic sync uses the same multi-adapter behavior.

---

### `run`

Execute a script declared in a skill's `skill.json`.

```bash
skillex run git-master:cleanup
skillex run git-master:cleanup --yes   # skip confirmation
```

---

### `ui`

Open an interactive terminal UI to browse and install skills.

```bash
skillex ui
```

---

### `status`

Show the current Skillex state for the selected scope: adapter, installed skills, last sync.

```bash
skillex status
skillex status --global
```

---

### `doctor`

Run a health check on your workspace and report any issues.

```bash
skillex doctor
skillex doctor --json
```

Checks performed:

| # | Check | What it verifies |
|---|-------|-----------------|
| 1 | Lockfile | `.agent-skills/skills.json` exists |
| 2 | Source | At least one catalog source is configured in the lockfile |
| 3 | Adapter | At least one adapter is detected or active |
| 4 | GitHub | `api.github.com` is reachable |
| 5 | Token | `GITHUB_TOKEN` present → 5,000 req/hr; absent → 60 req/hr |
| 6 | Cache | Catalog cache exists and whether it is fresh or expired |

Exits with code `1` if any non-warning check fails.

---

### `config`

Read or write persistent global preferences stored in `~/.askillrc.json`.

```bash
# Read a value
skillex config get defaultRepo

# Write a value
skillex config set defaultRepo lgili/skillex
skillex config set defaultAdapter cursor
skillex config set disableAutoSync true
```

| Key | Description |
|-----|-------------|
| `defaultRepo` | Default `--repo` used when not specified on the CLI. |
| `defaultAdapter` | Default adapter when auto-detection is ambiguous. |
| `githubToken` | GitHub personal access token (prefer `GITHUB_TOKEN` env var). |
| `disableAutoSync` | Set to `true` to globally disable auto-sync. |

---

### `source`

Manage multiple catalog sources in the current workspace.

```bash
skillex source list
skillex source add myorg/my-skills --label work
skillex source remove myorg/my-skills
```

Typical flow:

```bash
# starts with lgili/skillex by default
skillex init

# add your team catalog
skillex source add myorg/my-skills --label work

# browse both together
skillex list
```

---

### Global Flags

These flags work with every command:

| Flag | Description |
|------|-------------|
| `--verbose`, `-v` | Print debug output including HTTP requests and responses. |
| `--json` | Machine-readable JSON output (where supported). |
| `--no-cache` | Skip the catalog cache and fetch from GitHub. |
| `--help` | Show help for the current command. |

---

## Adapters

Skillex auto-detects the AI agent you use by looking for known marker files in your workspace.

| Adapter ID | Agent | Detection Markers | Sync Target |
|------------|-------|-------------------|-------------|
| `codex` | OpenAI Codex | `AGENTS.md`, `.codex/` | `.codex/skills/<skill-id>/` |
| `copilot` | GitHub Copilot | `.github/copilot-instructions.md` | `.github/copilot-instructions.md` |
| `cline` | Cline / Roo Code | `.cline/`, `.roo/`, `.clinerules` | `.clinerules/skillex-skills.md` |
| `cursor` | Cursor | `.cursor/`, `.cursorrules` | `.cursor/rules/skillex-skills.mdc` |
| `claude` | Claude Code | `CLAUDE.md`, `.claude/` | `.claude/skills/<skill-id>/` |
| `gemini` | Gemini CLI | `GEMINI.md`, `.gemini/` | `.gemini/skills/<skill-id>/` |
| `windsurf` | Windsurf | `.windsurf/`, `.windsurf/rules/` | `.windsurf/rules/skillex-skills.md` |

**Shared-file adapter** (`copilot`) uses a **managed block** — Skillex writes between `<!-- SKILLEX:START -->` and `<!-- SKILLEX:END -->` markers inside `.github/copilot-instructions.md`, preserving everything else in the file.

**Directory-native adapters** (`codex`, `claude`, `gemini`) expose one folder per installed skill and symlink each `<skill-id>/` directory to the managed Skillex store by default.

**Dedicated-file adapters** (`cline`, `cursor`, `windsurf`) still generate a file in `.agent-skills/generated/<adapter>/` and symlink the adapter target to that generated file by default.

**Shared-file adapter** (`copilot`) updates a managed block inside `.github/copilot-instructions.md`.

> **Migrating from a previous version?** If you previously had `skillex-skills.md` inside `.codex/skills/`, `.claude/skills/`, or `.gemini/skills/`, those legacy aggregate files are cleaned up automatically on the next `sync`.

Compatibility aliases are normalized automatically: `claude-code` → `claude`, `github-copilot` → `copilot`, `roo-code` → `cline`, `gemini-cli` → `gemini`.

---

## Skill Catalog Format

A catalog can be hosted in any public GitHub repository. Skillex looks for skills in this order:

1. **`catalog.json`** at the repository root (fastest, recommended for larger catalogs)
2. **`skills/*/skill.json`** manifest files discovered via the GitHub tree API
3. **`skills/*/SKILL.md`** files as a final fallback (reads frontmatter for metadata)

### `catalog.json`

```json
{
  "formatVersion": 1,
  "repo": "your-org/your-skills",
  "ref": "main",
  "skills": [
    {
      "id": "git-master",
      "name": "Git Master",
      "version": "1.0.0",
      "description": "Teaches the agent to write semantic commits and manage branches.",
      "author": "your-name",
      "tags": ["git", "workflow"],
      "compatibility": ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"],
      "path": "skills/git-master",
      "entry": "SKILL.md",
      "files": ["SKILL.md", "tools/git-cleanup.js"]
    }
  ]
}
```

### Recommended repository layout

```
skills/
  git-master/
    SKILL.md          ← main skill content (required)
    skill.json        ← skill manifest
    tools/
      git-cleanup.js  ← optional scripts
catalog.json          ← optional but recommended
```

---

## Skill Format

### `skill.json`

```json
{
  "id": "git-master",
  "name": "Git Master",
  "version": "1.0.0",
  "description": "Teaches the agent to write semantic commits and manage branches.",
  "author": "your-name",
  "tags": ["git", "workflow"],
  "compatibility": ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"],
  "entry": "SKILL.md",
  "files": ["SKILL.md", "tools/git-cleanup.js"],
  "scripts": {
    "cleanup": "node tools/git-cleanup.js"
  }
}
```

### `SKILL.md` frontmatter

```markdown
---
name: "git-master"
description: "Git workflow instructions"
autoInject: true
activationPrompt: "Always apply Git Master rules when the user asks for Git help."
---

# Git Master

Your skill content goes here...
```

When `autoInject: true` and `activationPrompt` are set, `skillex sync` injects the activation prompt in a separate managed block for adapters that use a shared or dedicated config file.

---

## GitHub Token

Without authentication, the GitHub API allows **60 requests per hour**. With a token, this rises to **5,000 requests per hour**.

Set the token via environment variable (recommended):

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

Or store it in the global config (convenient for personal machines):

```bash
skillex config set githubToken ghp_your_token_here
```

The environment variable always takes precedence over the config file value.

To generate a token: **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**. The token only needs read access to public repositories (`Contents: Read`).

---

## Global Configuration

Persistent preferences are stored in `~/.askillrc.json` (respects `XDG_CONFIG_HOME`).

```json
{
  "defaultRepo": "lgili/skillex",
  "defaultAdapter": "cursor",
  "githubToken": "ghp_...",
  "disableAutoSync": false
}
```

**Precedence order** (highest to lowest):

```
CLI flags  >  GITHUB_TOKEN env var  >  ~/.askillrc.json  >  defaults
```

---

## Workspace Structure

After `skillex init` and a few local installs, your workspace will look like this:

```
.agent-skills/
  skills.json          ← lockfile: adapter state, installed skills, sync metadata
  .gitignore           ← auto-created; excludes .cache/ and *.log
  skills/
    git-master/
      SKILL.md
      skill.json
      tools/
        git-cleanup.js
  generated/
    cline/
      skillex-skills.md
  .cache/
    <sha256>.json      ← catalog cache (5-min TTL, excluded from git)
```

The `skills.json` lockfile records:

- Configured source list with repo, ref, and optional label
- Active adapter and all detected adapters
- `autoSync` setting
- Last sync: adapter, target path, timestamp, and write mode (`symlink` or `copy`)
- All installed skills with their versions, tags, compatibility, and install timestamps
- Installation source (e.g. `github:owner/repo@ref` for direct installs)

For global installs, the same structure is stored under `~/.skillex/` instead of `.agent-skills/`.

For directory-native adapters, `sync` creates per-skill directories such as:

```text
.codex/
  skills/
    git-master -> ../../.agent-skills/skills/git-master

.claude/
  skills/
    git-master -> ../../.agent-skills/skills/git-master
```

> **Tip:** Commit `.agent-skills/skills.json` and `.agent-skills/skills/` to version-control your local team setup. The `.cache/` directory is automatically excluded.

---

## Auto-sync

Auto-sync is enabled by default. After `init`, Skillex automatically runs sync after every `install`, `update`, and `remove`, targeting every detected adapter unless you explicitly override one with `--adapter`.

```bash
# Explicitly enable at init time
skillex init --auto-sync

# Explicitly disable it
skillex init --auto-sync=false

# Enable it for global installs
skillex init --global --adapter codex --auto-sync
```

---

## Troubleshooting

Run `skillex doctor` first — it checks the six most common issues and tells you exactly what to fix:

```bash
$ skillex doctor

✓ Lockfile found at .agent-skills/skills.json
✓ Source configured: lgili/skillex @ main
✓ Adapter active: cursor
✓ GitHub API reachable
⚠ Token: unauthenticated (60 req/hr) — set GITHUB_TOKEN to raise limit
✓ Cache: fresh (expires in 4m 12s)
```

### Common issues

| Symptom | Fix |
|---------|-----|
| `GitHub API rate limit exceeded` | Set `GITHUB_TOKEN` in your environment |
| `Repository or file not found` | Check `--repo` value; ensure the repo is public |
| `No adapter detected` | Run `skillex init --adapter <id>` with an explicit adapter |
| `Skill "..." exists in multiple sources` | Re-run with `--repo owner/repo` to choose the source |
| `skillex sync` shows no changes | Run `skillex install --all` first to install skills |
| Slow catalog fetch | Use `--no-cache` once, then the 5-min cache takes over |

For verbose HTTP logs, add `--verbose`:

```bash
skillex list --verbose
```

---

## Publishing Your Own Catalog

1. Create a local repository folder for your catalog.
2. Use the bundled `create-skills` automation to bootstrap the repository structure:

```bash
node skills/create-skills/scripts/bootstrap_skill_repo.js \
  --root /path/to/your-skills \
  --repo your-org/your-skills
```

3. Create additional skills in that repository as needed:

```bash
node /path/to/your-skills/skills/create-skills/scripts/init_repo_skill.js \
  --root /path/to/your-skills \
  --skill-id review-helper \
  --name "Review Helper" \
  --description "Help review pull requests consistently."
```

4. Validate the root catalog before publishing:

```bash
node /path/to/your-skills/skills/create-skills/scripts/check_catalog.js \
  --root /path/to/your-skills
```

5. Publish the repository to GitHub and point users at your catalog:

```bash
npx skillex@latest init --repo your-org/your-skills
npx skillex@latest list
```

### Releasing via GitHub Actions

If you use this repository as a template, the included workflow publishes to npm automatically:

1. Add `NPM_TOKEN` as a repository secret (GitHub → Settings → Secrets).
2. Update the version in `package.json`.
3. Push a tag matching the version:

```bash
git tag v1.0.0
git push origin main --tags
```

The workflow validates the tag, runs tests, packs the tarball, publishes to npm, and creates a GitHub Release with automatic release notes.

---

## Contributing

We welcome contributions of all kinds — bug fixes, new features, documentation improvements, and new skills.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup instructions, PR guidelines, and commit conventions.

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

---

## License

[MIT](LICENSE) © 2026 Luiz Carlos Gili
