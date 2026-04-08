---
name: "Create Skills"
description: "Bootstrap skill-catalog repositories and scaffold new skills in the advanced format — full SKILL.md with Core Workflow, Reference Guide, Constraints, Output Template, placeholder reference files, and OpenAI agent config. Activates when you say 'create a skill', 'scaffold a skill', 'add a new skill', 'bootstrap a skill repo', or 'init a skill repository'."
---

# Create Skills

Use this skill whenever you need to bootstrap a new skill-catalog repository or scaffold a new skill inside an existing one. Generated skills follow the advanced format: structured SKILL.md with Core Workflow, Reference Guide, Constraints, and Output Template — the same standard used by production skills in this catalog.

## Core Workflow

1. **Decide the task** — Determine whether the request is `bootstrap-repo` (create a new skill catalog repository from scratch) or `create-skill` (add a new skill to an existing repository).
2. **Gather skill metadata** — Collect: skill id (lowercase, hyphens), human name, description (include trigger patterns), tags, and the list of reference topics the skill needs.
3. **Run the scaffold script** — Use `init_repo_skill.js` with `--references` to generate the full advanced SKILL.md and all placeholder reference files in one pass.
4. **Fill in the generated templates** — Edit `SKILL.md` (Core Workflow steps, Output Template), and each `references/*.md` file (concepts, examples, anti-patterns). Replace every TODO placeholder with real content.
5. **Validate and register** — Run `check_catalog.js` to confirm catalog consistency. Update `catalog.json` `files[]` if you added extra tracked files beyond the scaffold defaults.

## Reference Guide

| Topic | Reference | When to load |
|-------|-----------|--------------|
| Repository structure and catalog format | `references/repo-format.md` | Always — covers all conventions for this skill format |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/init_repo_skill.js` | Scaffold a new skill in an existing repository | `node skills/create-skills/scripts/init_repo_skill.js --help` |
| `scripts/bootstrap_skill_repo.js` | Bootstrap a brand-new skill-catalog repository | `node skills/create-skills/scripts/bootstrap_skill_repo.js --root /path --repo owner/repo` |
| `scripts/check_catalog.js` | Validate catalog consistency and file presence | `node skills/create-skills/scripts/check_catalog.js --root .` |

## Constraints

**MUST DO**
- Generate skills in the advanced format: SKILL.md must contain Overview, Core Workflow, Reference Guide table, Bundled Scripts, Constraints, and Output Template sections.
- Use `--references` to scaffold placeholder `references/*.md` files for every domain topic the skill needs — do not leave the Reference Guide table empty.
- Register the new skill in `catalog.json` with a complete `files[]` list that includes every tracked file (SKILL.md, agents/openai.yaml, all references/*.md, all scripts/*.js).
- Include trigger patterns in the `description` frontmatter field (e.g., "Activates when you say 'commit this', ...").
- Keep skill id lowercase with hyphens only; keep `catalog.json` skills sorted by id.

**MUST NOT DO**
- Do not generate the old minimal format (frontmatter + basic workflow + resources list) — always use the advanced format.
- Do not leave TODO placeholders in reference files — fill in real domain guidance after scaffolding.
- Do not add `README.md` inside individual skill folders.
- Do not put `skill.json` in the `files[]` list — the CLI generates a local manifest during install.
- Do not create extra directories beyond `agents/`, `scripts/`, and `references/`.

## Output Template

When creating a new skill, produce a summary like:

```
Skill created:   <skill-id>
Folder:          skills/<skill-id>/
Catalog updated: catalog.json

Files generated:
  skills/<skill-id>/SKILL.md
  skills/<skill-id>/agents/openai.yaml
  skills/<skill-id>/references/<topic>.md   ← one per --references entry
  ...

Next steps:
  1. Edit SKILL.md — fill Core Workflow steps, Output Template, trigger patterns.
  2. Edit references/<topic>.md — replace TODOs with real domain guidance.
  3. Add real scripts to scripts/ if the skill needs validation or scaffolding.
  4. Update catalog.json files[] if you add more tracked files.
  5. Run: node skills/create-skills/scripts/check_catalog.js --root .
```

## References

- [Skillex catalog format](https://github.com/lgili/skillex) — root catalog schema and adapter compatibility list.
