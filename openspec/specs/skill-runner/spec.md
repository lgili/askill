# skill-runner Specification

## Purpose
TBD - created by archiving change add-symlink-run-ui-and-direct-install. Update Purpose after archive.
## Requirements
### Requirement: Run Command
The CLI SHALL provide a `run <skill-id>:<command>` sub-command that executes a named script declared in the skill's `skill.json` `scripts` map, streaming stdout and stderr live to the terminal.

#### Scenario: Named script executes successfully
- **WHEN** `skillex run git-master:cleanup` is executed
- **AND** `git-master`'s `skill.json` declares `"scripts": { "cleanup": "node scripts/cleanup.js" }`
- **THEN** the script is executed via `spawn` with the skill's install directory as the working directory
- **AND** stdout and stderr are streamed to the terminal in real time
- **AND** the process exits with the script's exit code

#### Scenario: Unknown command exits with error
- **WHEN** `skillex run git-master:nonexistent` is executed
- **THEN** the CLI prints an error listing the available commands for `git-master`
- **AND** exits with code 1 without executing anything

#### Scenario: Skill not installed exits with error
- **WHEN** `skillex run unknown-skill:command` is executed and the skill is not installed
- **THEN** the CLI prints an error stating the skill is not installed
- **AND** exits with code 1

### Requirement: Execution Confirmation Prompt
The CLI SHALL display a confirmation prompt showing the full resolved command before executing any skill script, unless the `--yes` flag is supplied.

#### Scenario: Confirmation prompt appears without --yes
- **WHEN** `skillex run skill-id:command` is executed without `--yes`
- **THEN** the CLI prints the full command that will be run and asks the user to confirm
- **AND** the script executes only if the user confirms

#### Scenario: --yes flag skips confirmation
- **WHEN** `skillex run skill-id:command --yes` is executed
- **THEN** the script runs immediately without a confirmation prompt

### Requirement: Script Execution Timeout
The script runner SHALL terminate the child process after a configurable timeout (default: 30 seconds) and exit with code 1 and a timeout message.

#### Scenario: Script exceeds default timeout
- **WHEN** a script runs longer than 30 seconds and no `--timeout` flag is provided
- **THEN** the process is killed and the CLI exits with code 1 and a message indicating the timeout was exceeded

#### Scenario: --timeout flag overrides default
- **WHEN** `skillex run skill-id:command --timeout 60` is executed
- **THEN** the script is allowed to run for up to 60 seconds before being killed

