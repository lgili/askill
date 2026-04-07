# interactive-ui Specification

## Purpose
TBD - created by archiving change add-symlink-run-ui-and-direct-install. Update Purpose after archive.
## Requirements
### Requirement: Interactive Terminal UI
The CLI SHALL provide a `ui` command that opens an interactive terminal flow displaying all available catalog skills, allowing the user to filter the catalog, toggle selections with the space bar, and install by pressing Enter.

#### Scenario: UI displays catalog skills
- **WHEN** `skillex ui` is executed
- **THEN** an interactive checklist of all catalog skills is rendered in the terminal
- **AND** each entry shows the skill name, description, and compatibility tags

#### Scenario: User selects and installs skills
- **WHEN** the user toggles one or more skills and presses Enter to confirm
- **THEN** the selected skills are installed via the standard `installSkills()` flow
- **AND** a success summary is printed after installation

#### Scenario: Empty catalog shows friendly message
- **WHEN** `skillex ui` is executed and the catalog returns no skills
- **THEN** a message is printed stating no skills are available and exits with code 0

### Requirement: Search Filter
The interactive UI SHALL support a text input field that filters the visible skill list before selection, matching skill names and descriptions case-insensitively.

#### Scenario: Entering a filter narrows the skill list
- **WHEN** the user enters `"git"` in the search field
- **THEN** only skills whose name or description contains `"git"` (case-insensitive) are shown

#### Scenario: Clearing search restores full list
- **WHEN** the user deletes all text from the search field
- **THEN** all catalog skills are shown again

### Requirement: Pre-Selected Installed Skills
The interactive UI SHALL pre-check skills that are already installed in the current project so the user can see current installation state at a glance.

#### Scenario: Installed skills appear pre-checked
- **WHEN** `skillex ui` is opened and `git-master` is already installed
- **THEN** the `git-master` entry in the checklist appears pre-selected

#### Scenario: Deselecting an installed skill removes it
- **WHEN** the user unchecks an already-installed skill and confirms
- **THEN** `removeSkills()` is called for that skill and a removal summary is printed

