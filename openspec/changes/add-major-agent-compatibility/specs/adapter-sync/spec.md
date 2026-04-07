## ADDED Requirements

### Requirement: Synchronize Skills To Additional Agent Targets

The system SHALL synchronize installed skills into the official project instruction targets of additional major agent adapters.

#### Scenario: Sync to Claude Code

- **WHEN** the active adapter is `claude`
- **THEN** the CLI writes the managed skills block to `CLAUDE.md`

#### Scenario: Sync to Gemini CLI

- **WHEN** the active adapter is `gemini`
- **THEN** the CLI writes the managed skills block to `GEMINI.md`

#### Scenario: Sync to Windsurf

- **WHEN** the active adapter is `windsurf`
- **THEN** the CLI writes a generated rules file to `.windsurf/rules/askill-skills.md`

### Requirement: Preserve Manual Content In Additional Shared Files

The system SHALL preserve user-authored content in shared instruction files for newly supported adapters while updating the managed skills content.

#### Scenario: Sync into existing CLAUDE.md

- **WHEN** the workspace already contains manual content in `CLAUDE.md`
- **THEN** the CLI updates only its managed block
- **AND** leaves unrelated user content unchanged

#### Scenario: Sync into existing GEMINI.md

- **WHEN** the workspace already contains manual content in `GEMINI.md`
- **THEN** the CLI updates only its managed block
- **AND** leaves unrelated user content unchanged
