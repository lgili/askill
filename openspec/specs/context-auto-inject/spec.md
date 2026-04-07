# context-auto-inject Specification

## Purpose
TBD - created by archiving change add-symlink-run-ui-and-direct-install. Update Purpose after archive.
## Requirements
### Requirement: Auto-Inject Activation Prompt
Skills that declare `autoInject: true` and `activationPrompt: "<text>"` in their `SKILL.md` YAML frontmatter SHALL have their activation prompt automatically appended to the adapter's main target file inside a managed block during sync.

#### Scenario: Activation prompt injected on first sync
- **WHEN** a skill with `autoInject: true` and a non-empty `activationPrompt` is synced to the `claude` adapter
- **THEN** the adapter's `CLAUDE.md` file contains the skill's `activationPrompt` text inside an `<!-- SKILLEX:AUTO-INJECT:START -->` / `<!-- SKILLEX:AUTO-INJECT:END -->` managed block

#### Scenario: Multiple auto-inject skills combine into one block
- **WHEN** two skills both have `autoInject: true` and are synced
- **THEN** both activation prompts appear together inside a single managed auto-inject block in the adapter config file

### Requirement: Auto-Inject Block Removed When No Skills Require It
The managed auto-inject block SHALL be removed from the adapter config file when no installed skills declare `autoInject: true`, leaving the file in a clean state.

#### Scenario: Removed skill clears its injected prompt
- **WHEN** the only auto-inject skill is removed and sync runs
- **THEN** the `<!-- SKILLEX:AUTO-INJECT:START -->` / `<!-- SKILLEX:AUTO-INJECT:END -->` block is deleted from all adapter config files

### Requirement: Idempotent Auto-Inject
Running sync multiple times with the same set of installed auto-inject skills SHALL produce identical adapter config file content without duplicating prompts.

#### Scenario: Re-syncing does not duplicate prompts
- **WHEN** `skillex sync` is run twice with the same installed auto-inject skills
- **THEN** the managed block in each adapter config file is byte-for-byte identical after both runs

### Requirement: Non-Auto-Inject Skills Are Unaffected
Skills that do not declare `autoInject: true` SHALL NOT cause any content to be added to adapter config files beyond the standard skill sync targets.

#### Scenario: Non-auto-inject skill leaves config files unchanged
- **WHEN** a skill without `autoInject: true` is installed and synced
- **THEN** no auto-inject block is created or modified in any adapter config file

