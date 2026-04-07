import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { pathExists, writeJson, writeText } from "../src/fs.js";
import {
  getInstalledSkills,
  initProject,
  installSkills,
  removeSkills,
  syncInstalledSkills,
  updateInstalledSkills,
} from "../src/install.js";

async function fakeDownloader(skill, catalog, stateDir) {
  const skillDir = path.join(stateDir, skill.id);
  await fs.mkdir(path.join(skillDir, "tools"), { recursive: true });
  await writeText(
    path.join(skillDir, "SKILL.md"),
    [
      "---",
      'description: "frontmatter temporario"',
      "---",
      "",
      `# ${skill.name}`,
      "",
      `Use esta skill a partir de ${catalog.repo}.`,
      "",
      "- Regra 1",
    ].join("\n"),
  );
  await writeJson(path.join(skillDir, "skill.json"), {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    entry: "SKILL.md",
  });
}

function createCatalog() {
  return {
    repo: "example/skills",
    ref: "main",
    skills: [
      {
        id: "git-master",
        name: "Git Master",
        version: "1.0.0",
        description: "Fluxo Git",
        author: "example",
        tags: ["git"],
        compatibility: ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"],
        entry: "SKILL.md",
        path: "skills/git-master",
        files: ["SKILL.md"],
      },
    ],
  };
}

async function setupInstalledSkill(cwd, options = {}) {
  await initProject({
    cwd,
    repo: "example/skills",
    adapter: options.adapter,
    now: () => "2026-04-06T00:00:00.000Z",
  });

  await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => createCatalog(),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:10:00.000Z",
  });
}

test("syncInstalledSkills preserva conteudo manual em AGENTS.md", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-codex-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await writeText(
    path.join(cwd, "AGENTS.md"),
    [
      "# Manual",
      "",
      "Antes do bloco",
      "",
      "<!-- ASKILL:START -->",
      "bloco antigo",
      "<!-- ASKILL:END -->",
      "",
      "Depois do bloco",
      "",
    ].join("\n"),
  );

  await setupInstalledSkill(cwd);
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "codex");
  assert.equal(result.sync.targetPath, "AGENTS.md");

  const content = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
  assert.match(content, /# Manual/);
  assert.match(content, /Depois do bloco/);
  assert.match(content, /## Askill Managed Skills/);
  assert.match(content, /### Git Master \(`git-master@1\.0\.0`\)/);
  assert.match(content, /Use esta skill a partir de example\/skills\./);
  assert.doesNotMatch(content, /^description:/m);
  assert.doesNotMatch(content, /^# Git Master$/m);

  const state = await getInstalledSkills({ cwd });
  assert.equal(state.adapters.active, "codex");
  assert.equal(state.sync.adapter, "codex");
  assert.equal(state.sync.targetPath, "AGENTS.md");
});

test("syncInstalledSkills preserva conteudo manual em copilot-instructions", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-copilot-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(cwd, ".github"), { recursive: true });
  await writeText(
    path.join(cwd, ".github", "copilot-instructions.md"),
    [
      "# Manual Copilot",
      "",
      "Regras do repositorio.",
      "",
    ].join("\n"),
  );

  await setupInstalledSkill(cwd);
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "copilot");
  assert.equal(result.sync.targetPath, ".github/copilot-instructions.md");

  const content = await fs.readFile(path.join(cwd, ".github", "copilot-instructions.md"), "utf8");
  assert.match(content, /# Manual Copilot/);
  assert.match(content, /## Askill Managed Skills/);
  assert.match(content, /<!-- ASKILL:START -->/);
});

test("syncInstalledSkills preserva conteudo manual em CLAUDE.md", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-claude-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await writeText(
    path.join(cwd, "CLAUDE.md"),
    [
      "# Manual Claude",
      "",
      "Contexto do projeto.",
      "",
    ].join("\n"),
  );

  await setupInstalledSkill(cwd);
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "claude");
  assert.equal(result.sync.targetPath, "CLAUDE.md");

  const content = await fs.readFile(path.join(cwd, "CLAUDE.md"), "utf8");
  assert.match(content, /# Manual Claude/);
  assert.match(content, /## Askill Managed Skills/);
  assert.match(content, /<!-- ASKILL:START -->/);
});

test("syncInstalledSkills preserva conteudo manual em GEMINI.md", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-gemini-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await writeText(
    path.join(cwd, "GEMINI.md"),
    [
      "# Manual Gemini",
      "",
      "Padroes do repositorio.",
      "",
    ].join("\n"),
  );

  await setupInstalledSkill(cwd);
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "gemini");
  assert.equal(result.sync.targetPath, "GEMINI.md");

  const content = await fs.readFile(path.join(cwd, "GEMINI.md"), "utf8");
  assert.match(content, /# Manual Gemini/);
  assert.match(content, /## Askill Managed Skills/);
  assert.match(content, /<!-- ASKILL:START -->/);
});

test("syncInstalledSkills escreve arquivo dedicado para cline", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-cline-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "cline",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "cline");
  assert.equal(result.sync.targetPath, ".clinerules/askill-skills.md");
  assert.equal(await pathExists(path.join(cwd, ".clinerules", "askill-skills.md")), true);

  const content = await fs.readFile(path.join(cwd, ".clinerules", "askill-skills.md"), "utf8");
  assert.match(content, /## Askill Managed Skills/);
  assert.match(content, /### Git Master \(`git-master@1\.0\.0`\)/);

  const state = await getInstalledSkills({ cwd });
  assert.equal(state.adapters.active, "codex");
  assert.equal(state.sync.adapter, "cline");
});

test("syncInstalledSkills escreve arquivo MDC para cursor", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-cursor-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "cursor",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "cursor");
  assert.equal(result.sync.targetPath, ".cursor/rules/askill-skills.mdc");

  const content = await fs.readFile(path.join(cwd, ".cursor", "rules", "askill-skills.mdc"), "utf8");
  assert.match(content, /^---$/m);
  assert.match(content, /alwaysApply: true/);
  assert.match(content, /## Askill Managed Skills/);
});

test("syncInstalledSkills escreve arquivo de regras para windsurf", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-windsurf-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "windsurf",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "windsurf");
  assert.equal(result.sync.targetPath, ".windsurf/rules/askill-skills.md");

  const content = await fs.readFile(path.join(cwd, ".windsurf", "rules", "askill-skills.md"), "utf8");
  assert.match(content, /^---$/m);
  assert.match(content, /trigger: always_on/);
  assert.match(content, /## Askill Managed Skills/);
});

test("syncInstalledSkills dry-run gera diff sem escrever arquivo nem lockfile", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-sync-dry-run-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });

  const result = await syncInstalledSkills({
    cwd,
    dryRun: true,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.changed, true);
  assert.equal(result.sync.targetPath, "AGENTS.md");
  assert.match(result.diff, /^--- atual\/AGENTS\.md$/m);
  assert.match(result.diff, /^\+\+\+ novo\/AGENTS\.md$/m);
  assert.equal(await pathExists(path.join(cwd, "AGENTS.md")), false);

  const state = await getInstalledSkills({ cwd });
  assert.equal(state.sync, null);
});

test("auto-sync roda apos install, update e remove quando habilitado", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "askill-auto-sync-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    repo: "example/skills",
    adapter: "codex",
    autoSync: true,
    now: () => "2026-04-06T00:00:00.000Z",
  });

  const installResult = await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => createCatalog(),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:10:00.000Z",
  });

  assert.equal(installResult.autoSync.sync.adapter, "codex");
  let content = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
  assert.match(content, /git-master@1\.0\.0/);

  const updateResult = await updateInstalledSkills(["git-master"], {
    cwd,
    catalogLoader: async () => ({
      ...createCatalog(),
      skills: [{ ...createCatalog().skills[0], version: "2.0.0" }],
    }),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(updateResult.autoSync.sync.adapter, "codex");
  content = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
  assert.match(content, /git-master@2\.0\.0/);

  const removeResult = await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  assert.equal(removeResult.autoSync.sync.adapter, "codex");
  content = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
  assert.match(content, /Nenhuma skill instalada no momento\./);

  const state = await getInstalledSkills({ cwd });
  assert.equal(state.settings.autoSync, true);
  assert.equal(state.sync.adapter, "codex");
});
