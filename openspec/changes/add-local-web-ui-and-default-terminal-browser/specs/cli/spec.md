## ADDED Requirements
### Requirement: Default Command Opens Terminal Browser
The `skillex` CLI SHALL open the terminal browser flow when it is executed
without a subcommand.

#### Scenario: No subcommand dispatches to terminal browser
- **WHEN** the user runs `skillex`
- **THEN** the CLI opens the terminal browser flow
- **AND** does not treat the empty command as an error

### Requirement: Explicit Terminal Browser Command
The `skillex` CLI SHALL provide an explicit command for opening the terminal
browser flow after `ui` is reassigned to the Web UI.

#### Scenario: Browse command opens the terminal browser
- **WHEN** the user runs `skillex browse`
- **THEN** the CLI opens the terminal browser flow

#### Scenario: TUI alias opens the terminal browser
- **WHEN** the user runs `skillex tui`
- **THEN** the CLI opens the terminal browser flow

### Requirement: UI Command Launches Web UI
The `skillex` CLI SHALL reserve the `ui` command for launching the local Web UI.

#### Scenario: UI command no longer dispatches to terminal browser
- **WHEN** the user runs `skillex ui`
- **THEN** the CLI launches the local Web UI flow
- **AND** does not open the terminal checklist browser
