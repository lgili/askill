## ADDED Requirements

### Requirement: Scaffold New Skills With Current Adapter Defaults

The repository skill scaffold SHALL default new skills to the current set of supported adapter identifiers unless the maintainer overrides compatibility explicitly.

#### Scenario: Create skill without compatibility override

- **WHEN** a maintainer runs the `create-skills` scaffold without `--compatibility`
- **THEN** the generated `skill.json` includes the current supported adapter ids
- **AND** the same compatibility list is written to `catalog.json`
