## MODIFIED Requirements

### Requirement: Provide A Skill For Authoring New Skills

The repository SHALL include a first-party skill dedicated to creating new repository skills in the correct format and keeping the root catalog updated automatically.

#### Scenario: Create-skills skill scaffolds a new skill

- **WHEN** the skill is used to create a new skill for a compatible repository
- **THEN** it creates the expected folder structure and metadata files
- **AND** registers the new skill in the root `catalog.json` automatically

## ADDED Requirements

### Requirement: Bootstrap A New Skill Catalog Repository

The `create-skills` automation SHALL be able to scaffold a new local repository that follows the Skillex skill-catalog format.

#### Scenario: Scaffold a new repository

- **WHEN** a maintainer runs the repository-bootstrap flow of `create-skills`
- **THEN** the target directory contains a root `catalog.json`
- **AND** contains a `skills/` directory ready for first-party skills

### Requirement: Seed New Repositories With Create-Skills

New repositories scaffolded for storing skills SHALL include the `create-skills` skill itself and register it in the root catalog.

#### Scenario: Bootstrapped repository includes create-skills

- **WHEN** a new repository is scaffolded by the `create-skills` automation
- **THEN** the repository contains `skills/create-skills/`
- **AND** the root `catalog.json` includes a `create-skills` entry pointing to that folder

### Requirement: Auto-Register Newly Created Skills In Root Catalog

The skill-authoring workflow SHALL add every newly scaffolded skill to the root `catalog.json` of the target repository.

#### Scenario: Add second skill after repository bootstrap

- **WHEN** a maintainer uses `create-skills` inside a bootstrapped repository to create another skill
- **THEN** the new skill is appended to the root `catalog.json`
- **AND** the catalog remains sorted and valid for Skillex consumption

### Requirement: Provide Callable Helper Scripts When Useful

The repository skill-authoring workflow SHALL include helper scripts when they materially improve bootstrap, validation, or maintenance for a human user or an AI agent.

#### Scenario: Helper script is shipped as part of the workflow

- **WHEN** the implementation needs a deterministic repeated step such as repository bootstrap or catalog validation
- **THEN** the workflow may provide a callable script for that step
- **AND** any shipped script is included in the skill metadata and catalog file lists when required for installation