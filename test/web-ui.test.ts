import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

import { ensureDir, pathExists, writeJson, writeText } from "../src/fs.js";
import { initProject } from "../src/install.js";
import { createWebUiHandler } from "../src/web-ui.js";
import type { CatalogData, SkillManifest } from "../src/types.js";

function createCatalog(repo: string, version: string, skillId: string): CatalogData {
  return {
    formatVersion: 1,
    repo,
    ref: "main",
    skills: [
      {
        id: skillId,
        name: skillId === "git-master" ? "Git Master" : "Review Radar",
        version,
        description: skillId === "git-master" ? "Git workflow helper" : "Review workflow helper",
        author: "example",
        tags: skillId === "git-master" ? ["git"] : ["review"],
        compatibility: ["codex", "claude"],
        entry: "SKILL.md",
        path: `skills/${skillId}`,
        files: ["SKILL.md", "tools/run.js"],
        scripts: {
          run: "node tools/run.js",
        },
      },
    ],
  };
}

async function fakeDownloader(skill: SkillManifest, _catalog: CatalogData, skillsDir: string): Promise<void> {
  const skillDir = path.join(skillsDir, skill.id);
  await ensureDir(path.join(skillDir, "tools"));
  await writeText(path.join(skillDir, "SKILL.md"), `# ${skill.name}\n\nInstalled locally for ${skill.id}.\n`);
  await writeText(path.join(skillDir, "tools", "run.js"), `console.log("${skill.id}");\n`);
  await writeJson(path.join(skillDir, "skill.json"), {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    entry: "SKILL.md",
    files: skill.files,
    scripts: skill.scripts,
  });
}

test("local Web UI exposes catalog, install, sync, and source APIs", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-web-ui-"));
  const fakeHome = path.join(cwd, ".home");
  const globalStateDir = path.join(fakeHome, ".skillex");
  const previousHome = process.env.HOME;
  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await fs.rm(cwd, { recursive: true, force: true });
  });
  process.env.HOME = fakeHome;

  await fs.writeFile(path.join(cwd, "AGENTS.md"), "# workspace\n", "utf8");
  await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-08T10:00:00.000Z",
  });
  await initProject({
    cwd,
    scope: "global",
    repo: "example/skills",
    adapter: "codex",
    autoSync: false,
    now: () => "2026-04-08T10:00:30.000Z",
  });

  const catalogs = new Map<string, CatalogData>([
    ["example/skills", createCatalog("example/skills", "1.0.0", "git-master")],
    ["work/skills", createCatalog("work/skills", "1.1.0", "review-radar")],
  ]);

  const token = "test-session-token";
  const handler = createWebUiHandler({
    cwd,
    token,
    catalogLoader: async (source) => {
      const catalog = catalogs.get(source.repo);
      if (!catalog) {
        throw new Error(`Unknown test repo ${source.repo}`);
      }
      return catalog;
    },
    downloader: fakeDownloader,
  });

  async function requestJson(
    pathname: string,
    init: { method?: string; headers?: Record<string, string>; body?: string } = {},
  ): Promise<{ statusCode: number; body: unknown }> {
    const response = await request(pathname, init);
    return {
      statusCode: response.statusCode,
      body: response.json(),
    };
  }

  async function request(
    pathname: string,
    init: { method?: string; headers?: Record<string, string>; body?: string } = {},
  ): Promise<ReturnType<typeof createMockResponse>> {
    const headers: Record<string, string> = {
      ...(init.headers || {}),
    };
    if (init.body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    const request = Readable.from(init.body ? [Buffer.from(init.body, "utf8")] : []) as Readable & {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
    };
    request.method = init.method || "GET";
    request.url = pathname;
    request.headers = headers;

    const response = createMockResponse();
    await handler(request as never, response as never);
    return response;
  }

  const unauthorized = await requestJson("/api/state");
  assert.equal(unauthorized.statusCode, 401);

  const homeShell = await request(`/?token=${token}`);
  assert.equal(homeShell.statusCode, 200);
  const homeHtml = homeShell.text();
  assert.match(homeHtml, /data-app-root="skillex-web-ui"/);
  assert.match(homeHtml, /window\.__SKILLEX_BOOTSTRAP__ = \{/);
  const appScript = homeHtml.match(/src="([^"]*\/assets\/[^"]+\.js)"/);
  assert.ok(appScript);

  const detailShell = await request(`/skills/git-master?token=${token}&scope=global`);
  assert.equal(detailShell.statusCode, 200);
  assert.match(detailShell.text(), /"initialSkillId":"git-master"/);

  const assetResponse = await request(appScript[1] || "/assets/missing.js");
  assert.equal(assetResponse.statusCode, 200);
  assert.match(assetResponse.header("content-type"), /text\/javascript/);
  assert.ok(assetResponse.text().length > 0);

  const initialCatalog = (await requestJson("/api/catalog", {
    headers: { "x-skillex-token": token },
  })).body as {
    skills: Array<{ id: string; installed: boolean }>;
  };
  assert.deepEqual(
    initialCatalog.skills.map((skill) => skill.id),
    ["git-master"],
  );
  assert.equal(initialCatalog.skills[0]?.installed, false);

  const installResult = await requestJson("/api/install", {
    method: "POST",
    headers: { "x-skillex-token": token },
    body: JSON.stringify({
      skillIds: ["git-master"],
      repo: "example/skills",
      ref: "main",
    }),
  });
  assert.equal(installResult.statusCode, 200);

  const state = (await requestJson("/api/state", {
    headers: { "x-skillex-token": token },
  })).body as {
    installed: Array<{ id: string }>;
    adapters: { active: string | null };
  };
  assert.deepEqual(
    state.installed.map((skill) => skill.id),
    ["git-master"],
  );
  assert.equal(state.adapters.active, "codex");
  assert.equal(await pathExists(path.join(cwd, ".agent-skills", "skills", "git-master", "SKILL.md")), true);
  assert.equal(await pathExists(path.join(cwd, ".codex", "skills", "git-master")), true);

  const detail = (await requestJson("/api/catalog/git-master", {
    headers: { "x-skillex-token": token },
  })).body as {
    instructionsHtml: string;
    instructionsError: string | null;
  };
  assert.equal(detail.instructionsError, null);
  assert.match(detail.instructionsHtml, /<h1>Git Master<\/h1>/);

  const syncResult = (await requestJson("/api/sync", {
    method: "POST",
    headers: { "x-skillex-token": token },
    body: JSON.stringify({ dryRun: true }),
  })).body as {
    syncs: Array<{ adapter: string }>;
  };
  assert.equal(syncResult.syncs[0]?.adapter, "codex");

  const forcedSync = (await requestJson("/api/sync", {
    method: "POST",
    headers: { "x-skillex-token": token },
    body: JSON.stringify({ dryRun: true, adapter: "claude" }),
  })).body as {
    syncs: Array<{ adapter: string }>;
  };
  assert.equal(forcedSync.syncs[0]?.adapter, "claude");

  const addSourceResult = await requestJson("/api/sources", {
    method: "POST",
    headers: { "x-skillex-token": token },
    body: JSON.stringify({
      repo: "work/skills",
      ref: "main",
      label: "work",
    }),
  });
  assert.equal(addSourceResult.statusCode, 200);

  const sources = (await requestJson("/api/sources", {
    headers: { "x-skillex-token": token },
  })).body as Array<{ repo: string }>;
  assert.deepEqual(
    sources.map((source) => source.repo),
    ["example/skills", "work/skills"],
  );

  const expandedCatalog = (await requestJson("/api/catalog", {
    headers: { "x-skillex-token": token },
  })).body as {
    skills: Array<{ id: string }>;
  };
  assert.deepEqual(
    expandedCatalog.skills.map((skill) => skill.id).sort(),
    ["git-master", "review-radar"],
  );

  const globalInstallResult = await requestJson("/api/install", {
    method: "POST",
    headers: { "x-skillex-token": token },
    body: JSON.stringify({
      skillIds: ["review-radar"],
      repo: "work/skills",
      ref: "main",
      scope: "global",
    }),
  });
  assert.equal(globalInstallResult.statusCode, 200);

  const globalState = (await requestJson("/api/state?scope=global", {
    headers: { "x-skillex-token": token },
  })).body as {
    scope: string;
    installed: Array<{ id: string }>;
  };
  assert.equal(globalState.scope, "global");
  assert.deepEqual(
    globalState.installed.map((skill) => skill.id),
    ["review-radar"],
  );
  assert.equal(await pathExists(path.join(globalStateDir, "skills", "review-radar", "SKILL.md")), true);
});

function createMockResponse(): {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string | Buffer) => void;
  header: (name: string) => string;
  json: () => unknown;
  text: () => string;
} {
  const headers = new Map<string, string>();
  const chunks: Buffer[] = [];

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    header(name: string) {
      return headers.get(name.toLowerCase()) || "";
    },
    json() {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      return raw ? JSON.parse(raw) : {};
    },
    text() {
      return Buffer.concat(chunks).toString("utf8");
    },
  };
}
