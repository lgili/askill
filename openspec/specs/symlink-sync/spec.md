# symlink-sync Specification

## Purpose
TBD - created by archiving change add-symlink-run-ui-and-direct-install. Update Purpose after archive.
## Requirements
### Requirement: Symlink-Based Sync For Dedicated Adapter Files
Installed skills SHALL be stored in `.agent-skills/skills/<skill-id>/`. Dedicated adapter outputs SHALL be generated in `.agent-skills/generated/<adapter>/` and linked to each adapter target path via relative filesystem symlinks when possible.

#### Scenario: Generated adapter file is linked from the workspace
- **WHEN** `syncAdapterFiles()` runs for a dedicated adapter such as `cline`
- **THEN** the generated adapter file exists under `.agent-skills/generated/cline/`
- **AND** the adapter target path is a relative symlink to that generated file

#### Scenario: Re-sync refreshes generated artifact content
- **WHEN** `updateInstalledSkills()` refreshes an installed skill and `sync` runs again
- **THEN** the generated adapter artifact under `.agent-skills/generated/` is updated
- **AND** the adapter symlink continues to point to the same generated location

### Requirement: Symlink Fallback to Copy Mode
On platforms where `fs.symlink` fails with `EPERM` or `ENOTSUP` (e.g. Windows without Developer Mode), the system SHALL fall back silently to direct file writes, emit a warning to stderr, and record `"syncMode": "copy"` in the lockfile.

#### Scenario: Symlink failure falls back gracefully
- **WHEN** creating a symlink throws `EPERM`
- **THEN** the system copies the file instead
- **AND** a warning is printed to stderr describing the fallback
- **AND** `skills.json` records `"syncMode": "copy"`

### Requirement: Sync Mode Recorded in Lockfile
The lockfile SHALL store a top-level `"syncMode": "symlink" | "copy"` field reflecting the mode used during the last sync operation.

#### Scenario: Lockfile reflects symlink mode after successful sync
- **WHEN** `syncAdapterFiles()` succeeds using symlinks
- **THEN** `skills.json` contains `"syncMode": "symlink"`

### Requirement: Copy Mode Override Flag
The `sync` command SHALL accept a `--mode copy` flag to force direct file writes regardless of platform symlink support, allowing users to opt out of symlinks permanently.

#### Scenario: --mode copy produces copied files
- **WHEN** `skillex sync --mode copy` is executed on a platform that supports symlinks
- **THEN** skill files are copied to adapter target paths instead of linked
- **AND** `skills.json` records `"syncMode": "copy"`

