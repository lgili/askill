import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { detectAdapters, resolveAdapterState } from "../src/adapters.js";
import { initProject } from "../src/install.js";

test("detectAdapters encontra adapters por marcadores do workspace", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-adapters-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");
  await fs.mkdir(path.join(cwd, ".cursor", "rules"), { recursive: true });
  await fs.mkdir(path.join(cwd, ".github"), { recursive: true });
  await fs.writeFile(path.join(cwd, ".github", "copilot-instructions.md"), "rules\n", "utf8");

  const detected = await detectAdapters(cwd);
  assert.deepEqual(detected, ["cursor", "copilot", "codex"]);
});

test("detectAdapters prioriza markers especificos sobre arquivos compartilhados", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-adapters-priority-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");
  await fs.mkdir(path.join(cwd, ".windsurf", "rules"), { recursive: true });

  const detected = await detectAdapters(cwd);
  assert.deepEqual(detected, ["windsurf", "codex"]);
});

test("resolveAdapterState respeita override explicito", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-adapter-override-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");
  const adapterState = await resolveAdapterState({ cwd, adapter: "claude-code" });

  assert.equal(adapterState.active, "claude");
  assert.deepEqual(adapterState.detected, ["codex"]);
});

test("initProject persiste adapter ativo e detectados", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-init-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");
  const result = await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(result.created, true);
  assert.equal(result.lockfile.adapters.active, "codex");
  assert.deepEqual(result.lockfile.adapters.detected, ["codex"]);
});
