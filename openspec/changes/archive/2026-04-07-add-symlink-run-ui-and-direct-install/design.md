## Context
`skillex` currently writes or updates adapter files directly in place. For dedicated adapter files (for example Cline, Cursor, Windsurf), that means the generated file lives only at the adapter target path. This change moves dedicated generated artifacts into `.agent-skills/generated/` and links adapter targets to that central artifact when symlinks are supported. It also adds three new capabilities (`run`, `ui`, direct GitHub install) and one behavioral enhancement (context auto-inject) to differentiate from the competitor.

## Goals / Non-Goals
- Goals:
  - Symlink-based sync as the new default for dedicated adapter files; direct write as a silent fallback
  - `run` command executing scripts bundled in `skill.json` via `scripts` map
  - `install owner/repo[@ref]` for direct GitHub installs
  - `ui` command with interactive terminal checklist and fuzzy search
  - Context auto-inject for skills declaring `autoInject: true`
- Non-Goals:
  - Building a central skill registry or requiring authentication (stay 100% GitHub-based)
  - Windows symlink support as first-class (fallback to copy; document limitation)
  - Changing the `SKILL.md` format beyond adding optional frontmatter fields
  - Sandboxed script execution for the `run` command

## Decisions

- **Symlinks: always relative, no `--absolute` opt-in** — relative symlinks are portable across machines, CI runners, containers, and clones at any path. Both the generated store (`.agent-skills/generated/`) and the adapter targets (`.cursor/rules/`, `.clinerules/`, etc.) live inside the same project root, so a relative path always resolves correctly. Absolute symlinks break on any path change and would silently corrupt teammates' workspaces. No opt-in is provided; the added complexity has no real use case. Created with `fs.symlink(relativeTarget, linkPath)`.
- **Central stores** — installed skills live in `.agent-skills/skills/<skill-id>/`. Dedicated adapter outputs are generated in `.agent-skills/generated/<adapter>/` and adapter targets point to that generated artifact. Lockfile gains a top-level `"syncMode": "symlink" | "copy"` field.
- **Symlink fallback to copy** — if `fs.symlink` throws `EPERM` or `ENOTSUP`, fall back to the current copy behavior, log a `warn` to stderr, and write `"syncMode": "copy"` to the lockfile. No crash, no user action required.
- **`run` command via `child_process.spawn`** — streams stdout/stderr live to the terminal. The skill's `skill.json` declares runnable commands under a `scripts` object (same shape as npm `scripts`). Working directory is set to the skill's install directory. Scripts inherit the full `process.env` (same model as `npm scripts`) so user-installed tools (`git`, `python`, `node`, etc.) resolve correctly without any configuration. Isolation is the user's responsibility if needed.
- **`run` requires explicit confirmation unless `--yes`** — executing arbitrary third-party scripts is a security surface; a one-time prompt per invocation makes the risk visible.
- **Run script timeout: 30s default, `--timeout <seconds>` override** — kills the child process on `SIGTERM` after the timeout elapses; exits with code 1.
- **Direct GitHub installs bypass catalog** — `skillex install owner/repo[@ref]` fetches `skill.json` from `raw.githubusercontent.com`; falls back to synthesizing a manifest from `SKILL.md` if `skill.json` is absent. Lockfile entry records `"source": "github:<owner>/<repo>@<ref>"`.
- **Unverified skill warning + `--trust` flag** — any install not found in the active catalog shows a warning and requires interactive confirmation or `--trust` to proceed non-interactively.
- **`@inquirer/prompts` for UI, no pagination** — lightweight, ESM-compatible, zero-config interactive prompts. No heavy TUI framework (rejected `ink`). The implemented flow asks for a filter query first and then renders a checkbox list for the filtered set. A hint line reminds the user to filter first, then select.
- **Auto-inject managed block** — uses a new sentinel pair `<!-- SKILLEX:AUTO-INJECT:START -->` / `<!-- SKILLEX:AUTO-INJECT:END -->` separate from the existing `<!-- SKILLEX:START -->` / `<!-- SKILLEX:END -->` blocks. Content is rebuilt idempotently on every sync from the set of installed skills with `autoInject: true`.

## Alternatives Considered
- **Hardlinks instead of symlinks** — cannot cross filesystem boundaries and cannot be atomically replaced. Rejected.
- **`ink` (React for CLI)** — powerful but adds 40+ transitive dependencies. `@inquirer/prompts` is sufficient. Rejected.
- **Central registry (like competitor's `askill login`)** — creates server dependency, contradicts our decentralized value proposition. Rejected.
- **Sandbox for `run` (Docker, VM)** — out of scope and breaks portability. Document instead that scripts run with the user's own permissions. Deferred.

## Risks / Trade-offs
- **Symlinks on Windows** — `fs.symlink` requires Developer Mode or elevation on NTFS. Mitigation: detect `EPERM`/`ENOTSUP`, fall back to copy, emit a clear warning once.
- **`run` security** — executing code from a skill repo is a trust boundary. Mitigation: always show the full command before execution; require `--yes` or interactive confirm.
- **Direct GitHub installs without vetting** — no catalog review. Mitigation: always show unverified warning; document that the user is responsible for trusting the source.
- **Breaking sync mode** — existing projects have copied files in adapter dirs. Mitigation: document migration step in README; provide `skillex sync --mode copy` to opt out.

## Migration Plan
1. Add symlink helpers to `src/fs.ts`; update `src/sync.ts` to use symlinks by default for dedicated adapter files.
2. Add `"syncMode"` to lockfile schema.
3. Add `src/runner.ts` module; wire `run` command in `src/cli.ts`.
4. Add direct GitHub install path to `src/install.ts`.
5. Add `ui` command using `@inquirer/prompts` in `src/cli.ts`.
6. Add auto-inject logic to `src/sync.ts` with new managed block sentinels.
7. Update README with migration notes and new command docs.
