## 1. CLI And Routing

- [x] 1.1 Change `skillex` with no subcommand to open the terminal browser flow
- [x] 1.2 Add explicit `skillex browse` and `skillex tui` aliases for the terminal browser flow
- [x] 1.3 Change `skillex ui` to launch the local Web UI
- [x] 1.4 Update CLI help text and migration messages for the command reassignment

## 2. Local Web UI Backend

- [x] 2.1 Add a loopback-only local server for the Web UI
- [x] 2.2 Expose API routes for catalog, state, sources, install, remove, update, and sync
- [x] 2.3 Reuse existing `src/` core functions instead of duplicating business logic
- [x] 2.4 Add minimal local-session protection for browser-to-local-server calls

## 3. Web Frontend

- [x] 3.1 Scaffold the local frontend shell served by the CLI
- [x] 3.2 Build the catalog browser with search, tags, compatibility, and source labels
- [x] 3.3 Build the skill detail panel with rendered `SKILL.md`
- [x] 3.4 Add install, remove, update, and sync actions
- [x] 3.5 Add source add/remove/list management in the UI
- [x] 3.6 Surface detected adapters and sync targets in the UI

## 4. Packaging And Validation

- [x] 4.1 Add frontend build output to the npm package
- [x] 4.2 Add tests for CLI routing changes and local API behavior
- [x] 4.3 Add docs for the new default terminal flow and the Web UI command
