# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2026-04-08

### Changed
- `skillex ui` skill list now shows compact labels: `Name (id) · tag1, tag2, tag3` — description and full compatibility list removed from each row
- `skillex ui` shows "Fetching catalog..." while loading and limits visible rows to 12 at a time
- `skillex install` and `skillex update` now render an inline progress bar (`[████░░░░] 1/5 skill-id`) instead of printing one line per skill

## [0.2.3] - 2026-04-08

### Fixed
- `skillex list` and all catalog commands no longer fail with `owner/repo` when a lockfile was written by an older version that used the placeholder default source — the placeholder is now silently replaced by `lgili/skillex`

## [0.2.2] - 2026-04-08

### Added
- 9 first-party skills in the default catalog: `commit-craft`, `secure-defaults`, `error-handling`, `test-discipline`, `code-review`, `typescript-pro`, `python-pro`, `cpp-pro`, `latex-pro` — each with full reference files and bundled scripts
- `create-skills` skill upgraded to advanced format: generates SKILL.md with Core Workflow, Reference Guide table, Constraints, and Output Template sections; `--references` flag scaffolds placeholder reference files automatically

### Changed
- `catalog.json` is now a slim index (`formatVersion: 2`): each entry contains only `{ "id" }` — no repeated metadata
- Full skill metadata (name, version, description, tags, compatibility, files) now lives exclusively in each skill's `skill.json`
- CLI catalog loader detects v2 format and fetches each `skill.json` in parallel to hydrate the full manifest

## [0.2.1] - 2026-04-07

### Changed
- Skills and generated symlink sources are now stored in `~/.skillex/` (user-level) instead of `<project>/.agent-skills/`, so a single install is shared across all workspaces and symlinks always resolve correctly
- `claude` adapter: switched from managed-block in `CLAUDE.md` to a dedicated file at `.claude/skills/skillex-skills.md`; old `CLAUDE.md` block cleaned up automatically on next `sync`
- `gemini` adapter: switched from managed-block in `GEMINI.md` to a dedicated file at `.gemini/skills/skillex-skills.md`; old `GEMINI.md` block cleaned up automatically on next `sync`
- `codex` adapter: switched from managed-block in `AGENTS.md` to a dedicated file at `.codex/skills/skillex-skills.md` (introduced in this cycle)
- Symlinks are now absolute paths instead of relative, ensuring they work regardless of project depth
- `copilot` is now the only adapter that uses managed-block injection
- `--agent-skills-dir` flag still overrides to a project-local directory when isolation is needed

## [0.2.0] - 2026-04-07

### Added
- Multi-source catalogs with workspace-managed source lists and a default official source at `lgili/skillex@main`
- `source add`, `source remove`, and `source list` commands for managing configured catalog sources
- Bootstrapped `create-skills` flow for scaffolding full skill-catalog repositories with automatic root catalog registration
- Helper scripts for `create-skills` repository bootstrap and root catalog validation
- Symlink sync mode: skills stored once in `.agent-skills/skills/<id>/` and symlinked to adapter targets with relative paths
- `run` command: execute skill scripts defined in `skill.json` via `scripts.<name>`
- Direct GitHub install: `skillex install owner/repo/path@ref` installs skills without a catalog
- Interactive TUI for `list` and `search` using `@inquirer/prompts`
- Context auto-inject: skills with `autoInject: true` are included automatically on every sync
- Compatibility aliases for all major AI agents: `codex`, `copilot`, `cline`, `cursor`, `claude`, `gemini`, `windsurf`
- `doctor` command with 6 read-only workspace health checks (lockfile, repo, adapter, GitHub reachability, token status, cache freshness)
- `config get <key>` / `config set <key> <value>` commands for persistent global preferences stored in `~/.askillrc.json` (XDG-aware)
- `src/output.ts` module with `success()`, `info()`, `warn()`, `error()`, `debug()` helpers; respects `NO_COLOR` env and `isTTY`
- `--verbose` / `-v` global flag; enables debug-level HTTP logging
- `--json` flag on `list`, `search`, `doctor` commands for machine-readable output
- Command aliases: `ls` → `list`, `rm` / `uninstall` → `remove`
- Per-command `--help` flag
- Catalog disk cache with 5-minute TTL stored at `.agent-skills/.cache/<hash>.json`; bypass with `--no-cache`
- `GITHUB_TOKEN` environment variable support in all HTTP requests to raise API rate limit from 60 to 5,000 req/hr
- Install progress output: `[N/total] Installing <skill-id>...`
- Post-`init` onboarding summary with repo, adapter, and "Next steps" guidance
- `.agent-skills/.gitignore` auto-created on `skillex init` (excludes `.cache/` and `*.log`)
- `onProgress` callback in `installSkills()` for programmatic progress reporting

### Changed
- Full TypeScript migration: all source files converted to `.ts` with `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Module resolution updated to `NodeNext` with explicit `.js` import extensions
- All user-facing strings translated from Portuguese to English
- HTTP error messages rewritten to be actionable (rate limit, 404 with repo hint, 5xx retry suggestion)
- `--verbose` HTTP logging: URL and status code logged via `debug()` on every request

### Fixed
- `AdapterNotFoundError` message was in Portuguese; now reads "Unknown adapter: <id>"

## [0.1.1] - 2026-04-06

### Fixed
- Restored executable bit on `bin/skillex.js`

## [0.1.0] - 2026-04-06

### Added
- Initial release of the Skillex CLI
- `init`, `list`, `search`, `install`, `update`, `remove`, `sync`, `status` commands
- GitHub-hosted skill catalog support via `catalog.json` or repository tree inspection
- Adapter detection and managed-block sync for Copilot, Cline, Cursor, Claude, Gemini, Windsurf, Codex
- Lockfile-based workspace state at `.agent-skills/skills.json`

[Unreleased]: https://github.com/lgili/skillex/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lgili/skillex/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/lgili/skillex/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lgili/skillex/releases/tag/v0.1.0
