## ADDED Requirements

### Requirement: Detect Additional Major Agent Adapters

The system SHALL detect additional major agent adapters used in the local workspace and allow them to be selected as the active adapter.

#### Scenario: Detect Claude Code markers

- **WHEN** the workspace contains `CLAUDE.md` or `.claude/`
- **THEN** `askill init` detects the `claude` adapter

#### Scenario: Detect Gemini CLI markers

- **WHEN** the workspace contains `GEMINI.md` or `.gemini/`
- **THEN** `askill init` detects the `gemini` adapter

#### Scenario: Detect Windsurf markers

- **WHEN** the workspace contains `.windsurf/` or `.windsurf/rules/`
- **THEN** `askill init` detects the `windsurf` adapter

### Requirement: Prefer Specific Markers Over Shared Markers

The system SHALL prioritize more specific adapter markers over shared files when choosing the active detected adapter.

#### Scenario: Prefer Windsurf over shared AGENTS marker

- **WHEN** the workspace contains both `AGENTS.md` and `.windsurf/rules/`
- **THEN** `askill init` keeps `windsurf` ahead of `codex` in detected adapter priority

### Requirement: Accept Compatibility Aliases

The system SHALL normalize common compatibility aliases to canonical adapter identifiers during skill search filtering.

#### Scenario: Search using Claude alias

- **WHEN** the user runs `askill search review --compatibility claude-code --repo owner/repo`
- **THEN** the CLI treats `claude-code` as `claude`

#### Scenario: Search using Gemini alias

- **WHEN** the user runs `askill search docs --compatibility gemini-cli --repo owner/repo`
- **THEN** the CLI treats `gemini-cli` as `gemini`
