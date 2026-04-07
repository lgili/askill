---
name: create-skills
description: Scaffold new first-party skills for the Open Agent Skills repository. Use when creating or updating a skill in this repo so the result matches the local catalog structure, required metadata files, and registration rules.
---

# Create Skills

Use this skill when adding a new skill to this repository.

## Workflow

1. Confirm the new skill id, human-facing name, and trigger description.
2. Run `scripts/init_repo_skill.js` to scaffold the folder and register it in `catalog.json`.
3. Review the generated `SKILL.md`, `skill.json`, and `agents/openai.yaml`.
4. Add any real `scripts/`, `references/`, or `assets/` files needed by the skill.
5. Confirm whether the default compatibility list fits the new skill or trim unsupported adapters.
6. Update the new skill's `files` list in both `skill.json` and `catalog.json` if you add tracked files beyond the initial scaffold.
7. Validate the repository by running tests and checking the catalog entry.

## Commands

Create a new skill in this repository root:

```bash
node skills/create-skills/scripts/init_repo_skill.js \
  --root /path/to/open-agent-skills \
  --skill-id my-skill \
  --name "My Skill" \
  --description "Describe what the skill does and when to use it."
```

## Rules

- Keep the skill id lowercase with digits and hyphens only.
- Keep `SKILL.md` frontmatter limited to `name` and `description`.
- Keep `agents/openai.yaml` concise and machine-readable.
- The scaffold defaults compatibility to `codex`, `copilot`, `cline`, `cursor`, `claude`, `gemini`, and `windsurf`.
- Do not create extra docs like `README.md` inside the skill folder.
- Prefer adding scripts for deterministic setup or validation work.

## References

- Read `references/repo-format.md` for the local repository conventions.
