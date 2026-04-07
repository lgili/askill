## Why
A competitive analysis of `avibe-bot/askill` (NPM: `askill-cli`, site: `askill.sh`) reveals architectural patterns that are significantly better than our current approach: symlink-based sync eliminates duplication for dedicated adapter files, a `run` command turns the lib into an execution platform, and a direct GitHub install flow lowers the barrier for sharing skills without a central registry. Adding an interactive terminal UI and context auto-inject creates a differentiated experience that the competitor does not offer.

## What Changes
- **BREAKING (sync)**: Dedicated adapter files now default to `symlink` mode. Installed skills are stored in `.agent-skills/skills/<skill-id>/`, generated adapter artifacts are stored in `.agent-skills/generated/<adapter>/`, and adapter targets link to those generated artifacts when possible.
- Add `run <skill-id>:<command>` CLI command to execute scripts bundled inside a skill's `skill.json` manifest.
- Add `install <owner/repo[@ref]>` support for direct GitHub installs without a catalog entry.
- Add `ui` CLI command for an interactive terminal browser with arrow-key navigation and fuzzy search.
- Add context auto-inject: skills declaring `autoInject: true` in `SKILL.md` frontmatter have their `activationPrompt` automatically injected into the adapter's main config file during sync.

## Impact
- Affected capabilities: `symlink-sync`, `skill-runner`, `direct-github-install`, `interactive-ui`, `context-auto-inject`
- Affected code: `src/sync.js`, `src/install.js`, `src/cli.js`, `src/fs.js`; new module `src/runner.js`; new dev dependency `@inquirer/prompts`
- Breaking: Projects using the current direct-write sync must re-run `skillex sync` to switch dedicated adapter targets to symlinks; previously copied files remain until manually removed
