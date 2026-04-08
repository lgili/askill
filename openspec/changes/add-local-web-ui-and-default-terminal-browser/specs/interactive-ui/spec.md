## MODIFIED Requirements
### Requirement: Interactive Terminal UI
The CLI SHALL provide the interactive terminal skill browser as the default
experience when `skillex` is executed without a subcommand, and SHALL also make
the same flow available through explicit terminal-oriented commands.

#### Scenario: No subcommand opens the terminal browser
- **WHEN** `skillex` is executed without a subcommand
- **THEN** an interactive checklist of all catalog skills is rendered in the terminal
- **AND** each entry shows the skill name, description, and compatibility tags

#### Scenario: Explicit terminal browser command opens the same flow
- **WHEN** `skillex browse` or `skillex tui` is executed
- **THEN** the same interactive terminal checklist is rendered
- **AND** the selection flow behaves identically to the default no-subcommand experience

#### Scenario: User selects and installs skills
- **WHEN** the user toggles one or more skills and confirms
- **THEN** the selected skills are installed via the standard `installSkills()` flow
- **AND** a success summary is printed after installation

#### Scenario: Empty catalog shows friendly message
- **WHEN** the terminal browser is opened and the catalog returns no skills
- **THEN** a message is printed stating no skills are available
- **AND** the command exits successfully

### Requirement: Search Filter

The interactive terminal browser SHALL support a text input field that filters
the visible skill list before selection, matching skill names and descriptions
case-insensitively.

#### Scenario: Entering a filter narrows the skill list
- **WHEN** the user enters `"git"` in the search field
- **THEN** only skills whose name or description contains `"git"` case-insensitively are shown

#### Scenario: Clearing search restores full list
- **WHEN** the user deletes all text from the search field
- **THEN** all catalog skills are shown again

### Requirement: Pre-Selected Installed Skills

The interactive terminal browser SHALL pre-check skills that are already
installed in the current project so the user can see current installation state
at a glance.

#### Scenario: Installed skills appear pre-checked
- **WHEN** the terminal browser is opened and `git-master` is already installed
- **THEN** the `git-master` entry in the checklist appears pre-selected

#### Scenario: Deselecting an installed skill removes it
- **WHEN** the user unchecks an already-installed skill and confirms
- **THEN** `removeSkills()` is called for that skill
- **AND** a removal summary is printed

## ADDED Requirements
### Requirement: Local Web UI
The CLI SHALL provide a local Web UI launched by `skillex ui` for browsing and
managing skills in a browser.

#### Scenario: UI command launches local Web UI
- **WHEN** the user runs `skillex ui`
- **THEN** Skillex starts a local server bound to loopback
- **AND** opens the browser to the local UI

#### Scenario: Web UI does not require remote hosting
- **WHEN** the user opens `skillex ui`
- **THEN** all UI assets and API calls are served locally from the user's machine
- **AND** no hosted Skillex dashboard is required

### Requirement: Web UI Catalog Presentation
The local Web UI SHALL present the aggregated skill catalog in a visual format
that improves discovery and inspection before installation.

#### Scenario: Web UI shows skill cards with source context
- **WHEN** the Web UI loads the catalog
- **THEN** each skill is displayed with its name, description, tags, compatibility, and source

#### Scenario: Web UI shows skill detail content
- **WHEN** the user opens a skill detail view
- **THEN** the UI shows the skill manifest metadata
- **AND** renders the skill instructions in a readable detail panel

### Requirement: Web UI Skill And Source Management
The local Web UI SHALL let the user manage skills and catalog sources using the
same underlying flows as the CLI.

#### Scenario: Install or remove from the Web UI
- **WHEN** the user clicks install or remove in the Web UI
- **THEN** the UI invokes the existing local install or remove workflow
- **AND** refreshes the visible state after completion

#### Scenario: Manage sources from the Web UI
- **WHEN** the user adds or removes a catalog source in the Web UI
- **THEN** Skillex updates the local source configuration
- **AND** refreshes the aggregated catalog view

#### Scenario: Trigger sync from the Web UI
- **WHEN** the user triggers sync in the Web UI
- **THEN** the existing local sync workflow is executed
- **AND** the UI shows the resulting adapter targets and summary
