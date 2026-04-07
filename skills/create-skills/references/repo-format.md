# Repository Skill Format

Use these conventions when adding a first-party skill to this repository.

## Location

- Create the skill under `skills/<skill-id>/`.
- Keep the folder name identical to the skill id.

## Required files

- `SKILL.md`
- `skill.json`
- `agents/openai.yaml`

## Catalog registration

- Add the skill to the root `catalog.json`.
- Keep skills sorted by `id`.
- In `files`, list the tracked skill files that must be downloaded by the CLI.
- Do not include `skill.json` in the `files` list because the CLI generates a local manifest during install.

## Metadata expectations

- `skill.json.id` must match the folder name.
- `skill.json.entry` should point to `SKILL.md`.
- `skill.json.compatibility` should use canonical adapter ids such as `codex`, `copilot`, `cline`, `cursor`, `claude`, `gemini`, and `windsurf`.
- `SKILL.md` frontmatter should contain only `name` and `description`.
- `agents/openai.yaml.interface.default_prompt` must mention the skill as `$skill-id`.

## Validation

- Run `npm test`.
- Review `catalog.json` and the new `skill.json`.
- If the new skill adds tracked files, update the `files` arrays accordingly.
