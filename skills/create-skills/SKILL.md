---
name: create-skills
description: Bootstrap a Skillex-compatible skill repository or scaffold a new skill inside one while keeping the root catalog updated.
---

# Create Skills

Use this skill when you need to bootstrap a new skill-catalog repository or add a new skill to an existing compatible repository.

## Workflow

1. Decide whether the task is `bootstrap-repo` or `create-skill`.
2. For a new repository, run `scripts/bootstrap_skill_repo.js` to create the root layout and seed `create-skills` into the root catalog.
3. For a new skill, run `scripts/init_repo_skill.js` to scaffold the folder and register it in `catalog.json` automatically.
4. Review the generated `SKILL.md`, `skill.json`, and `agents/openai.yaml`.
5. Add any real `scripts/`, `references/`, or `assets/` files needed by the skill or repository workflow.
6. If you add tracked files beyond the initial scaffold, update the skill `files` list so installed users receive them.
7. Run `scripts/check_catalog.js` to validate the repository structure and catalog consistency.

## Commands

Bootstrap a new skill repository:

```bash
node skills/create-skills/scripts/bootstrap_skill_repo.js \
  --root /path/to/new-skill-repo \
  --repo myorg/my-skills
```

Create a new skill in a compatible repository root:

```bash
node skills/create-skills/scripts/init_repo_skill.js \
  --root /path/to/skill-repo \
  --skill-id my-skill \
  --name "My Skill" \
  --description "Describe what the skill does and when to use it."
```

Validate the root catalog after bootstrap or changes:

```bash
node skills/create-skills/scripts/check_catalog.js \
  --root /path/to/skill-repo
```

## Rules

- Keep the skill id lowercase with digits and hyphens only.
- Keep repository ids in `owner/repo` format when you know the final GitHub target.
- Keep `SKILL.md` frontmatter limited to `name` and `description`.
- Keep `agents/openai.yaml` concise and machine-readable.
- The scaffold defaults compatibility to `codex`, `copilot`, `cline`, `cursor`, `claude`, `gemini`, and `windsurf`.
- The root `catalog.json` must always include every scaffolded skill, including `create-skills` in a bootstrapped repository.
- Do not create extra docs like `README.md` inside individual skill folders unless the repository format explicitly needs them.
- Prefer adding scripts for deterministic setup, validation, or maintenance work that a user or AI can call directly.

## References

- Read `references/repo-format.md` for the local repository conventions.
