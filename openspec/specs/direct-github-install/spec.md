# direct-github-install Specification

## Purpose
TBD - created by archiving change add-symlink-run-ui-and-direct-install. Update Purpose after archive.
## Requirements
### Requirement: Install Directly from GitHub
The `install` command SHALL accept an `owner/repo[@ref]` argument and install the skill directly from the specified GitHub repository without requiring the skill to be listed in the active catalog.

#### Scenario: Direct GitHub install resolves skill.json
- **WHEN** `skillex install octocat/my-skill@main` is executed
- **THEN** the CLI fetches `skill.json` from `https://raw.githubusercontent.com/octocat/my-skill/main/skill.json`
- **AND** installs the skill files into `.agent-skills/skills/my-skill/`
- **AND** exits with code 0 and prints a success message

#### Scenario: Fallback to SKILL.md when skill.json absent
- **WHEN** `skillex install octocat/my-skill` is executed and no `skill.json` exists in the repo root
- **THEN** the CLI fetches `SKILL.md` and synthesizes a minimal manifest from its frontmatter
- **AND** proceeds with installation using the synthesized manifest

#### Scenario: Neither skill.json nor SKILL.md found exits with error
- **WHEN** `skillex install octocat/my-skill` is executed and neither `skill.json` nor `SKILL.md` exists
- **THEN** the CLI prints an error explaining that no skill manifest was found
- **AND** exits with code 1 without modifying the lockfile

### Requirement: Unverified Skill Warning
Direct GitHub installs for skills not listed in the active catalog SHALL display an unverified warning and require interactive confirmation or the `--trust` flag to proceed.

#### Scenario: Warning shown for uncatalogued skill
- **WHEN** `skillex install octocat/my-skill` is executed and `my-skill` is absent from the catalog
- **THEN** the CLI prints a warning that the skill is not in the official catalog
- **AND** prompts the user to confirm before installing

#### Scenario: --trust suppresses the warning prompt
- **WHEN** `skillex install octocat/my-skill --trust` is executed
- **THEN** the installation proceeds without an interactive confirmation prompt

### Requirement: Lockfile Records Direct Install Source
Skills installed via direct GitHub reference SHALL have a lockfile entry with `"source": "github:<owner>/<repo>@<ref>"` to distinguish them from catalog installs.

#### Scenario: Direct install source recorded in lockfile
- **WHEN** `skillex install octocat/my-skill@v1.0.0` succeeds
- **THEN** `skills.json` contains an entry for `my-skill` with `"source": "github:octocat/my-skill@v1.0.0"`

#### Scenario: Default ref used when none specified
- **WHEN** `skillex install octocat/my-skill` is executed without a `@ref`
- **THEN** the lockfile entry records `"source": "github:octocat/my-skill@main"` using the default ref

