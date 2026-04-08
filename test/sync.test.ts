import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

import { getAdapter } from "../src/adapters.js";
import { getStatePaths } from "../src/config.js";
import { pathExists, writeText } from "../src/fs.js";
import {
  getInstalledSkills,
  initProject,
  installSkills,
  removeSkills,
  syncInstalledSkills,
  updateInstalledSkills,
} from "../src/install.js";
import { loadInstalledSkillDocuments, syncAdapterFiles } from "../src/sync.js";
import type { CatalogData, LockfileState } from "../src/types.js";

function createCatalog(version = "1.0.0"): CatalogData {
  return {
    formatVersion: 1,
    repo: "example/skills",
    ref: "main",
    skills: [
      {
        id: "git-master",
        name: "Git Master",
        version,
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

function createDownloader(options: { autoInject?: boolean } = {}) {
  return async function fakeDownloader(
    skill: { id: string; name: string; version: string },
    catalog: { repo: string },
    skillsDir: string,
  ): Promise<void> {
    const skillDir = path.join(skillsDir, skill.id);
    await fs.mkdir(path.join(skillDir, "tools"), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        'description: "frontmatter temporario"',
        ...(options.autoInject ? ["autoInject: true", 'activationPrompt: "Sempre lembre de aplicar esta skill."'] : []),
        "---",
        "",
        `# ${skill.name}`,
        "",
        `Use esta skill a partir de ${catalog.repo}.`,
        "",
        "- Regra 1",
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(
      path.join(skillDir, "skill.json"),
      JSON.stringify(
        {
          id: skill.id,
          name: skill.name,
          version: skill.version,
          entry: "SKILL.md",
        },
        null,
        2,
      ),
      "utf8",
    );
  };
}

async function setupInstalledSkill(
  cwd: string,
  options: { adapter?: string; autoInject?: boolean; autoSync?: boolean } = {},
): Promise<void> {
  await initProject({
    cwd,
    repo: "example/skills",
    adapter: options.adapter,
    autoSync: options.autoSync,
    now: () => "2026-04-06T00:00:00.000Z",
  });

  await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => createCatalog(),
    downloader: createDownloader(
      options.autoInject !== undefined ? { autoInject: options.autoInject } : {},
    ),
    now: () => "2026-04-06T00:10:00.000Z",
  });
}

function assertState(state: LockfileState | null): LockfileState {
  assert.ok(state);
  return state;
}

async function isSymlink(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(targetPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

test("syncInstalledSkills preserva conteudo manual e injeta auto-inject em copilot-instructions", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-copilot-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await writeText(
    path.join(cwd, ".github", "copilot-instructions.md"),
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

  await setupInstalledSkill(cwd, { adapter: "copilot", autoInject: true });
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.adapter, "copilot");
  assert.equal(result.sync.targetPath, ".github/copilot-instructions.md");
  assert.equal(result.syncMode, "copy");

  const content = await fs.readFile(path.join(cwd, ".github", "copilot-instructions.md"), "utf8");
  assert.match(content, /# Manual/);
  assert.match(content, /Depois do bloco/);
  assert.match(content, /## Skillex Managed Skills/);
  assert.match(content, /<!-- SKILLEX:START -->/);
  assert.match(content, /<!-- SKILLEX:AUTO-INJECT:START -->/);
  assert.match(content, /Sempre lembre de aplicar esta skill\./);
});

test("syncInstalledSkills sincroniza todos os adapters detectados quando nenhum override e informado", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-multi-adapter-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await writeText(path.join(cwd, ".github", "copilot-instructions.md"), "# Manual\n");
  await fs.mkdir(path.join(cwd, ".codex"), { recursive: true });

  await setupInstalledSkill(cwd, { autoInject: true });
  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.deepEqual(
    result.syncs.map((entry) => entry.adapter),
    ["copilot", "codex"],
  );
  assert.equal(await pathExists(path.join(cwd, ".github", "copilot-instructions.md")), true);
  assert.equal(await isSymlink(path.join(cwd, ".codex", "skills", "git-master")), true);
});

test("syncInstalledSkills remove bloco auto-inject quando nao ha skills elegiveis", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-remove-auto-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "copilot", autoInject: true });
  await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });
  await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  const result = await syncInstalledSkills({
    cwd,
    now: () => "2026-04-06T00:40:00.000Z",
  });

  assert.equal(result.syncMode, "copy");
  assert.equal(await pathExists(path.join(cwd, ".github", "copilot-instructions.md")), false);
});

test("syncInstalledSkills cria symlink para adapters de arquivo dedicado por padrao", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-cline-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "cline",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  const targetPath = path.join(cwd, ".clinerules", "skillex-skills.md");
  assert.equal(result.sync.adapter, "cline");
  assert.equal(result.syncMode, "symlink");
  assert.equal(await pathExists(targetPath), true);
  assert.equal(await isSymlink(targetPath), true);

  const linkTarget = await fs.readlink(targetPath);
  assert.match(linkTarget, /\.agent-skills\/generated\/cline\/skillex-skills\.md$/);

  const state = assertState(await getInstalledSkills({ cwd }));
  assert.equal(state.syncMode, "symlink");
});

test("syncInstalledSkills materializa skills por pasta para codex e remove arquivo legado", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-codex-dir-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  await writeText(path.join(cwd, ".codex", "skills", "skillex-skills.md"), "legado\n");

  const result = await syncInstalledSkills({
    cwd,
    adapter: "codex",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  const targetDir = path.join(cwd, ".codex", "skills", "git-master");
  assert.equal(result.sync.adapter, "codex");
  assert.equal(result.sync.targetPath, ".codex/skills");
  assert.equal(result.syncMode, "symlink");
  assert.equal(await isSymlink(targetDir), true);
  assert.equal(await pathExists(path.join(cwd, ".codex", "skills", "skillex-skills.md")), false);

  const linkTarget = await fs.readlink(targetDir);
  assert.match(linkTarget, /^\.\.\/\.\.\/\.agent-skills\/skills\/git-master$/);
});

test("removeSkills limpa skill sincronizada em adapter directory-native sem sync manual extra", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-codex-cleanup-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  await syncInstalledSkills({
    cwd,
    adapter: "codex",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  const result = await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  assert.equal(result.autoSync?.sync.adapter, "codex");
  assert.equal(await pathExists(path.join(cwd, ".codex", "skills", "git-master")), false);
});

test("removeSkills limpa arquivo gerenciado e fonte gerada quando a ultima skill sai", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-managed-file-cleanup-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "cline" });
  await syncInstalledSkills({
    cwd,
    adapter: "cline",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  const targetPath = path.join(cwd, ".clinerules", "skillex-skills.md");
  const generatedPath = path.join(cwd, ".agent-skills", "generated", "cline", "skillex-skills.md");
  assert.equal(await pathExists(targetPath), true);
  assert.equal(await pathExists(generatedPath), true);

  const result = await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  assert.equal(result.autoSync?.sync.adapter, "cline");
  assert.equal(await pathExists(targetPath), false);
  assert.equal(await pathExists(generatedPath), false);
});

test("syncInstalledSkills suporta scope global para adapter directory-native", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-global-"));
  const globalStateDir = path.join(cwd, ".global-state");
  const globalTargetDir = path.join(cwd, ".global-codex-skills");
  const adapter = getAdapter("codex");
  const previousGlobalTarget = adapter.globalSyncTarget;
  adapter.globalSyncTarget = globalTargetDir;

  t.after(async () => {
    if (previousGlobalTarget) {
      adapter.globalSyncTarget = previousGlobalTarget;
    } else {
      delete adapter.globalSyncTarget;
    }
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    scope: "global",
    agentSkillsDir: globalStateDir,
    repo: "example/skills",
    adapter: "codex",
    now: () => "2026-04-06T00:00:00.000Z",
  });
  await installSkills(["git-master"], {
    cwd,
    scope: "global",
    agentSkillsDir: globalStateDir,
    catalogLoader: async () => createCatalog(),
    downloader: createDownloader(),
    now: () => "2026-04-06T00:10:00.000Z",
  });

  const result = await syncInstalledSkills({
    cwd,
    scope: "global",
    agentSkillsDir: globalStateDir,
    adapter: "codex",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.sync.targetPath, path.join(globalTargetDir).split(path.sep).join("/"));
  assert.equal(await isSymlink(path.join(globalTargetDir, "git-master")), true);
});

test("syncInstalledSkills aceita --mode copy e grava arquivo regular", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-copy-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "cline",
    mode: "copy",
    now: () => "2026-04-06T00:20:00.000Z",
  });

  const targetPath = path.join(cwd, ".clinerules", "skillex-skills.md");
  assert.equal(result.syncMode, "copy");
  assert.equal(await isSymlink(targetPath), false);

  const state = assertState(await getInstalledSkills({ cwd }));
  assert.equal(state.syncMode, "copy");
});

test("syncInstalledSkills dry-run de symlink mostra alvo gerado sem escrever arquivos", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-dry-run-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const result = await syncInstalledSkills({
    cwd,
    adapter: "cline",
    dryRun: true,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.syncMode, "symlink");
  assert.match(result.diff, /symlink ->/);
  assert.equal(await pathExists(path.join(cwd, ".clinerules", "skillex-skills.md")), false);
});

test("syncAdapterFiles faz fallback para copy quando symlink falha", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sync-fallback-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupInstalledSkill(cwd, { adapter: "codex" });
  const state = assertState(await getInstalledSkills({ cwd }));
  const statePaths = getStatePaths(cwd);
  const skills = await loadInstalledSkillDocuments({ cwd, lockfile: state });

  const warnings: string[] = [];
  const result = await syncAdapterFiles({
    cwd,
    adapterId: "cline",
    statePaths,
    skills,
    linkFactory: async (targetPath, linkPath) => ({
      ok: false,
      fallback: true,
      relativeTarget: path.relative(path.dirname(linkPath), targetPath),
    }),
    warn: (message) => {
      warnings.push(message);
    },
  });

  assert.equal(result.syncMode, "copy");
  assert.equal(warnings.length, 1);
  assert.equal(await isSymlink(path.join(cwd, ".clinerules", "skillex-skills.md")), false);
});

test("auto-sync roda por padrao apos install, update e remove", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-auto-sync-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    repo: "example/skills",
    adapter: "copilot",
    now: () => "2026-04-06T00:00:00.000Z",
  });

  const installResult = await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => createCatalog(),
    downloader: createDownloader(),
    now: () => "2026-04-06T00:10:00.000Z",
  });

  assert.ok(installResult.autoSync);
  assert.equal(installResult.autoSync.sync.adapter, "copilot");
  assert.equal(installResult.autoSync.syncMode, "copy");
  let content = await fs.readFile(path.join(cwd, ".github", "copilot-instructions.md"), "utf8");
  assert.match(content, /git-master@1\.0\.0/);

  const updateResult = await updateInstalledSkills(["git-master"], {
    cwd,
    catalogLoader: async () => ({
      ...createCatalog(),
      skills: [{ ...createCatalog().skills[0]!, version: "2.0.0" }],
    }),
    downloader: createDownloader(),
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.ok(updateResult.autoSync);
  assert.equal(updateResult.autoSync.sync.adapter, "copilot");
  content = await fs.readFile(path.join(cwd, ".github", "copilot-instructions.md"), "utf8");
  assert.match(content, /git-master@2\.0\.0/);

  const removeResult = await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  assert.ok(removeResult.autoSync);
  assert.equal(removeResult.autoSync.sync.adapter, "copilot");
  assert.equal(await pathExists(path.join(cwd, ".github", "copilot-instructions.md")), false);
});
