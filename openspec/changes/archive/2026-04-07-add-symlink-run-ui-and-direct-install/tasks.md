## 1. Symlink Sync Infrastructure
- [x] 1.1 Add `createSymlink(target, linkPath)` helper to `src/fs.ts` that creates a relative symlink and catches `EPERM`/`ENOTSUP` to return a `{ok, fallback}` result
- [x] 1.2 Add `removeSymlink(linkPath)` helper that removes a symlink without following it
- [x] 1.3 Update `syncAdapterFiles()` in `src/sync.ts` to create symlinks by default for dedicated adapter files; fall back to file copy if symlink creation fails and emit a `warn` to stderr
- [x] 1.4 Add `"syncMode": "symlink" | "copy"` field to the lockfile schema in `src/install.ts`
- [x] 1.5 Update `prepareSyncAdapterFiles()` (dry-run preview) to reflect symlink targets in the diff output
- [x] 1.6 Add `--mode copy` flag to `skillex sync` to allow opt-out of symlinks
- [x] 1.7 Write tests: symlink created for dedicated adapters, fallback to copy on `EPERM`, lockfile records correct `syncMode`

## 2. `run` Command
- [x] 2.1 Add `scripts` map field to `skill.json` manifest schema (e.g. `"scripts": { "cleanup": "node scripts/cleanup.js" }`)
- [x] 2.2 Create `src/runner.ts` with `runSkillScript(skillId, command, opts)` using `child_process.spawn`, streaming stdout/stderr, enforcing timeout
- [x] 2.3 Wire `run <skill-id>:<command>` sub-command in `src/cli.ts`; parse `skill-id:command` notation
- [x] 2.4 Add confirmation prompt before execution (skip with `--yes`)
- [x] 2.5 Add `--timeout <seconds>` flag; default 30s; kill process and exit 1 on exceeded timeout
- [x] 2.6 Write tests: known command executes and streams output, unknown command prints available commands and exits 1, timeout kills process

## 3. Direct GitHub Install
- [x] 3.1 Add `parseDirectGitHubRef(arg)` utility that extracts `owner`, `repo`, `ref` from `owner/repo[@ref]` strings
- [x] 3.2 Update `installSkills()` in `src/install.ts` to detect `owner/repo[@ref]` syntax and route to a `fetchDirectGitHubSkill()` helper
- [x] 3.3 Implement `fetchDirectGitHubSkill(owner, repo, ref)`: fetch `skill.json`; fall back to synthesizing manifest from `SKILL.md` if absent
- [x] 3.4 Add unverified-skill warning and interactive confirmation (skip with `--trust` flag)
- [x] 3.5 Record `"source": "github:<owner>/<repo>@<ref>"` in the lockfile entry for direct installs
- [x] 3.6 Write tests: `owner/repo` resolves skill.json, fallback to SKILL.md, lockfile records correct source, warning shown without `--trust`

## 4. Interactive UI Command
- [x] 4.1 Add `@inquirer/prompts` to `dependencies` in `package.json`
- [x] 4.2 Implement `ui` command in `src/cli.ts`: load catalog, render checkbox list, install selected skills, and remove deselected installed skills
- [x] 4.3 Add a filter input that narrows the visible skill list before selection
- [x] 4.4 Pre-check skills that are already installed in the current project
- [x] 4.5 Print an install summary after the user confirms selections
- [x] 4.6 Write tests: pre-selection of installed skills, empty filtered set, and selection diffing

## 5. Context Auto-Inject
- [x] 5.1 Extend `SKILL.md` frontmatter parser to read `autoInject: true` and `activationPrompt: "<text>"` fields
- [x] 5.2 Add `buildAutoInjectBlock(skills)` in `src/sync.ts` that renders the managed `<!-- SKILLEX:AUTO-INJECT:START -->` / `<!-- SKILLEX:AUTO-INJECT:END -->` block
- [x] 5.3 Update `syncAdapterFiles()` to append/update the auto-inject block in each adapter main target when any installed skill has `autoInject: true`
- [x] 5.4 Remove the auto-inject block entirely when no installed skills have `autoInject: true`
- [x] 5.5 Ensure idempotency: re-syncing with the same skills produces identical file content
- [x] 5.6 Write tests: prompt injected on sync, prompt removed on skill removal, and non-auto-inject skill leaves config unchanged

## 6. Documentation
- [x] 6.1 Update README with migration notes for the symlink breaking change (`skillex sync --mode copy` to opt out)
- [x] 6.2 Document `run` command usage and security note
- [x] 6.3 Document `install owner/repo[@ref]` syntax and `--trust` flag
- [x] 6.4 Document `ui` command
- [x] 6.5 Document `autoInject` and `activationPrompt` frontmatter fields in `SKILL.md` format docs
