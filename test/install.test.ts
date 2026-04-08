import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

import { ensureDir, pathExists, writeJson, writeText } from "../src/fs.js";
import {
  addProjectSource,
  getInstalledSkills,
  initProject,
  installSkills,
  listProjectSources,
  loadProjectCatalogs,
  parseDirectGitHubRef,
  removeProjectSource,
  removeSkills,
  updateInstalledSkills,
} from "../src/install.js";
import type { CatalogData, SkillManifest } from "../src/types.js";

function createCatalog(version: string): CatalogData {
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
        compatibility: ["codex"],
        entry: "SKILL.md",
        path: "skills/git-master",
        files: ["SKILL.md", "tools/run.js"],
        scripts: {
          cleanup: "node tools/run.js",
        },
      },
    ],
  };
}

async function fakeDownloader(
  skill: SkillManifest,
  catalog: CatalogData,
  skillsDir: string,
): Promise<void> {
  const skillDir = path.join(skillsDir, skill.id);
  await ensureDir(path.join(skillDir, "tools"));
  await writeText(path.join(skillDir, "SKILL.md"), `# ${skill.name} ${skill.version}\n`);
  await writeText(path.join(skillDir, "tools", "run.js"), `console.log("${catalog.repo}");\n`);
  await writeJson(path.join(skillDir, "skill.json"), {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    entry: "SKILL.md",
    scripts: skill.scripts,
  });
}

test("parseDirectGitHubRef aceita owner/repo[@ref]", () => {
  assert.deepEqual(parseDirectGitHubRef("octocat/demo-skill@dev"), {
    owner: "octocat",
    repo: "demo-skill",
    ref: "dev",
  });
  assert.equal(parseDirectGitHubRef("git-master"), null);
});

test("initProject usa o catalogo official por padrao", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-init-default-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  const result = await initProject({
    cwd,
    now: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(result.lockfile.sources[0]?.repo, "lgili/skillex");
  assert.equal(result.lockfile.sources[0]?.ref, "main");
  assert.equal(result.lockfile.settings.autoSync, true);
});

test("lockfile com placeholder owner/repo cai de volta para o source padrao", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-placeholder-source-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  // Simulate a lockfile written by an old version with the placeholder repo
  await ensureDir(path.join(cwd, ".agent-skills"));
  await writeJson(path.join(cwd, ".agent-skills", "skills.json"), {
    formatVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sources: [{ repo: "owner/repo", ref: "main" }],
    adapters: { active: null, detected: [] },
    settings: { autoSync: false },
    sync: null,
    syncMode: null,
    installed: {},
  });

  const sources = await listProjectSources({ cwd });
  // placeholder must be stripped; falls back to the real default
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.repo, "lgili/skillex");
});

test("getInstalledSkills migra lockfile legado com catalog unico", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-legacy-lockfile-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await ensureDir(path.join(cwd, ".agent-skills"));
  await writeJson(path.join(cwd, ".agent-skills", "skills.json"), {
    formatVersion: 1,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    catalog: { repo: "example/skills", ref: "main" },
    adapters: { active: null, detected: [] },
    settings: { autoSync: false },
    sync: null,
    syncMode: null,
    installed: {},
  });

  const state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.deepEqual(state.sources, [{ repo: "example/skills", ref: "main" }]);
});

test("install, update e remove manipulam o lockfile local", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-install-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");

  await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-06T00:00:00.000Z",
  });

  const catalogV1 = createCatalog("1.0.0");
  await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => catalogV1,
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:10:00.000Z",
  });

  let state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.equal(state.adapters.active, "codex");
  assert.equal(state.installed["git-master"]!.version, "1.0.0");
  assert.equal(await pathExists(path.join(cwd, ".agent-skills", "skills", "git-master", "SKILL.md")), true);

  const catalogV2 = createCatalog("2.0.0");
  const updateResult = await updateInstalledSkills([], {
    cwd,
    catalogLoader: async () => catalogV2,
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.equal(updateResult.updatedSkills.length, 1);
  assert.deepEqual(updateResult.missingFromCatalog, []);

  state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.equal(state.installed["git-master"]!.version, "2.0.0");

  const removeResult = await removeSkills(["git-master"], {
    cwd,
    now: () => "2026-04-06T00:30:00.000Z",
  });

  assert.deepEqual(removeResult.removedSkills, ["git-master"]);
  assert.deepEqual(removeResult.missingSkills, []);

  state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.deepEqual(state.installed, {});
  assert.equal(await pathExists(path.join(cwd, ".agent-skills", "skills", "git-master")), false);
});

test("escopos local e global mantem estados isolados", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-install-scope-"));
  const globalStateDir = path.join(cwd, ".global-state");
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-06T00:00:00.000Z",
  });
  await initProject({
    cwd,
    scope: "global",
    agentSkillsDir: globalStateDir,
    repo: "example/skills",
    adapter: "codex",
    autoSync: false,
    now: () => "2026-04-06T00:01:00.000Z",
  });

  await installSkills(["git-master"], {
    cwd,
    scope: "global",
    agentSkillsDir: globalStateDir,
    catalogLoader: async () => createCatalog("1.0.0"),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:10:00.000Z",
  });

  const localState = await getInstalledSkills({ cwd });
  const globalState = await getInstalledSkills({ cwd, scope: "global", agentSkillsDir: globalStateDir });

  assert.ok(localState);
  assert.ok(globalState);
  assert.deepEqual(localState.installed, {});
  assert.equal(globalState.installed["git-master"]!.version, "1.0.0");
  assert.equal(await pathExists(path.join(globalStateDir, "skills", "git-master", "SKILL.md")), true);
  assert.equal(path.isAbsolute(globalState.installed["git-master"]!.path), true);
});

test("source add, list e remove manipulam multiplos sources", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-sources-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    now: () => "2026-04-06T00:00:00.000Z",
  });

  await addProjectSource(
    { repo: "myorg/my-skills", ref: "main", label: "work" },
    { cwd, now: () => "2026-04-06T00:10:00.000Z" },
  );

  let sources = await listProjectSources({ cwd });
  assert.deepEqual(sources, [
    { repo: "lgili/skillex", ref: "main", label: "official" },
    { repo: "myorg/my-skills", ref: "main", label: "work" },
  ]);

  const updatedState = await removeProjectSource("myorg/my-skills", {
    cwd,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  sources = await listProjectSources({ cwd });
  assert.equal(updatedState.sources.length, 1);
  assert.deepEqual(sources, [{ repo: "lgili/skillex", ref: "main", label: "official" }]);
});

test("loadProjectCatalogs agrega skills de todos os sources", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-aggregate-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({ cwd, now: () => "2026-04-06T00:00:00.000Z" });
  await addProjectSource(
    { repo: "myorg/my-skills", label: "work" },
    { cwd, now: () => "2026-04-06T00:10:00.000Z" },
  );

  const aggregated = await loadProjectCatalogs(
    { cwd },
    async (source) => ({
      formatVersion: 1,
      repo: source.repo,
      ref: source.ref,
      skills: [
        {
          id: source.repo === "lgili/skillex" ? "create-skills" : "code-review",
          name: source.repo === "lgili/skillex" ? "Create Skills" : "Code Review",
          version: "1.0.0",
          description: "demo",
          author: null,
          tags: [],
          compatibility: ["codex"],
          entry: "SKILL.md",
          path: "skills/demo",
          files: ["SKILL.md"],
        },
      ],
    }),
  );

  assert.deepEqual(aggregated.skills.map((skill) => skill.id), ["create-skills", "code-review"]);
  assert.deepEqual(aggregated.sources.map((source) => source.repo), ["lgili/skillex", "myorg/my-skills"]);
});

test("installSkills falha quando um id existe em mais de um source configurado", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-ambiguous-install-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({ cwd, now: () => "2026-04-06T00:00:00.000Z" });
  await addProjectSource(
    { repo: "myorg/my-skills" },
    { cwd, now: () => "2026-04-06T00:10:00.000Z" },
  );

  await assert.rejects(
    () =>
      installSkills(["code-review"], {
        cwd,
        catalogLoader: async (source) => ({
          formatVersion: 1,
          repo: source.repo,
          ref: source.ref,
          skills: [
            {
              id: "code-review",
              name: "Code Review",
              version: "1.0.0",
              description: "demo",
              author: null,
              tags: [],
              compatibility: ["codex"],
              entry: "SKILL.md",
              path: "skills/code-review",
              files: ["SKILL.md"],
            },
          ],
        }),
        downloader: fakeDownloader,
      }),
    /Use --repo to choose one/,
  );
});

test("installSkills --all falha quando ha ids duplicados entre sources", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-ambiguous-install-all-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({ cwd, now: () => "2026-04-06T00:00:00.000Z" });
  await addProjectSource(
    { repo: "myorg/my-skills" },
    { cwd, now: () => "2026-04-06T00:10:00.000Z" },
  );

  await assert.rejects(
    () =>
      installSkills([], {
        cwd,
        installAll: true,
        catalogLoader: async (source) => ({
          formatVersion: 1,
          repo: source.repo,
          ref: source.ref,
          skills: [
            {
              id: "shared-skill",
              name: "Shared Skill",
              version: "1.0.0",
              description: "demo",
              author: null,
              tags: [],
              compatibility: ["codex"],
              entry: "SKILL.md",
              path: "skills/shared-skill",
              files: ["SKILL.md"],
            },
          ],
        }),
        downloader: fakeDownloader,
      }),
    /Use --repo to choose one source at a time/,
  );
});

test("updateInstalledSkills reporta skill ausente no catalogo remoto", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-update-missing-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-06T00:00:00.000Z",
  });

  await installSkills(["git-master"], {
    cwd,
    catalogLoader: async () => createCatalog("1.0.0"),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:10:00.000Z",
  });

  const result = await updateInstalledSkills([], {
    cwd,
    catalogLoader: async () => ({
      formatVersion: 1,
      repo: "example/skills",
      ref: "main",
      skills: [],
    }),
    downloader: fakeDownloader,
    now: () => "2026-04-06T00:20:00.000Z",
  });

  assert.deepEqual(result.updatedSkills, []);
  assert.deepEqual(result.missingFromCatalog, ["git-master"]);
});

test("installSkills suporta instalacao direta do GitHub usando skill.json", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-direct-install-"));
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(cwd, { recursive: true, force: true });
  });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/skill.json")) {
      return new Response(
        JSON.stringify({
          id: "demo-skill",
          name: "Demo Skill",
          version: "1.2.3",
          description: "Direct install.",
          author: "octocat",
          tags: ["demo"],
          compatibility: ["codex"],
          entry: "SKILL.md",
          files: ["SKILL.md", "scripts/run.js"],
          scripts: {
            run: "node scripts/run.js",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.endsWith("/SKILL.md")) {
      return new Response("# Demo Skill\n", { status: 200 });
    }
    if (url.endsWith("/scripts/run.js")) {
      return new Response('console.log("direct");\n', { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const result = await installSkills(["octocat/demo-skill"], {
    cwd,
    trust: true,
    now: () => "2026-04-06T00:10:00.000Z",
  });

  assert.equal(result.installedCount, 1);
  assert.equal(result.installedSkills[0]!.id, "demo-skill");
  assert.equal(await pathExists(path.join(cwd, ".agent-skills", "skills", "demo-skill", "scripts", "run.js")), true);

  const state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.equal(state.installed["demo-skill"]!.source, "github:octocat/demo-skill@main");
});

test("instalacao direta faz fallback para SKILL.md e exige confianca explicita", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-direct-fallback-"));
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(cwd, { recursive: true, force: true });
  });

  const warnings: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/skill.json")) {
      return new Response("not found", { status: 404 });
    }
    if (url.endsWith("/SKILL.md")) {
      return new Response(
        [
          "---",
          'name: "Fallback Skill"',
          'description: "Skill sem manifesto."',
          "---",
          "",
          "# Fallback Skill",
        ].join("\n"),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  };

  const result = await installSkills(["octocat/fallback-skill@dev"], {
    cwd,
    confirm: async () => true,
    warn: (message) => {
      warnings.push(message);
    },
    now: () => "2026-04-06T00:10:00.000Z",
  });

  assert.equal(result.installedSkills[0]!.id, "fallback-skill");
  assert.equal(warnings.length, 1);

  const state = await getInstalledSkills({ cwd });
  assert.ok(state);
  assert.equal(state.installed["fallback-skill"]!.source, "github:octocat/fallback-skill@dev");
  assert.equal(await pathExists(path.join(cwd, ".agent-skills", "skills", "fallback-skill", "SKILL.md")), true);
});
