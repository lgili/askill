import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import { initProject } from "../src/install.js";
import { ensureDir, writeJson, writeText } from "../src/fs.js";
import { parseSkillCommandReference, runSkillScript } from "../src/runner.js";

async function setupRunnableSkill(cwd: string): Promise<void> {
  await initProject({
    cwd,
    repo: "example/skills",
    now: () => "2026-04-06T00:00:00.000Z",
  });

  const skillDir = path.join(cwd, ".agent-skills", "skills", "git-master");
  await ensureDir(path.join(skillDir, "scripts"));
  await writeText(path.join(skillDir, "SKILL.md"), "# Git Master\n");
  await writeText(path.join(skillDir, "scripts", "echo.js"), 'console.log("runner-ok");\n');
  await writeJson(path.join(skillDir, "skill.json"), {
    id: "git-master",
    name: "Git Master",
    version: "1.0.0",
    entry: "SKILL.md",
    scripts: {
      echo: "node scripts/echo.js",
      sleep: 'node -e "setTimeout(() => console.log(\'late\'), 2000)"',
    },
  });
  await writeJson(path.join(cwd, ".agent-skills", "skills.json"), {
    formatVersion: 1,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    catalog: { repo: "example/skills", ref: "main" },
    adapters: { active: "codex", detected: ["codex"] },
    settings: { autoSync: false },
    sync: null,
    syncMode: null,
    installed: {
      "git-master": {
        name: "Git Master",
        version: "1.0.0",
        path: ".agent-skills/skills/git-master",
        installedAt: "2026-04-06T00:00:00.000Z",
        compatibility: ["codex"],
        tags: ["git"],
      },
    },
  });
}

function collectStream(stream: PassThrough): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    stream.on("data", (chunk) => {
      chunks.push(String(chunk));
    });
    stream.on("end", () => {
      resolve(chunks.join(""));
    });
  });
}

test("parseSkillCommandReference aceita skill-id:comando", () => {
  assert.deepEqual(parseSkillCommandReference("git-master:echo"), {
    skillId: "git-master",
    command: "echo",
  });
});

test("runSkillScript executa script conhecido e transmite stdout", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-runner-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupRunnableSkill(cwd);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const outputPromise = collectStream(stdout);
  stderr.resume();

  const exitCode = await runSkillScript("git-master", "echo", {
    cwd,
    yes: true,
    stdout,
    stderr,
  });

  stdout.end();
  stderr.end();
  assert.equal(exitCode, 0);
  assert.match(await outputPromise, /runner-ok/);
});

test("runSkillScript falha para comando desconhecido", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-runner-missing-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupRunnableSkill(cwd);

  await assert.rejects(
    () =>
      runSkillScript("git-master", "missing", {
        cwd,
        yes: true,
      }),
    /Disponiveis: echo, sleep/,
  );
});

test("runSkillScript interrompe script apos timeout", async (t: TestContext) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-runner-timeout-"));
  t.after(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  await setupRunnableSkill(cwd);
  const stderr = new PassThrough();
  const stderrOutput = collectStream(stderr);

  const exitCode = await runSkillScript("git-master", "sleep", {
    cwd,
    yes: true,
    timeout: 1,
    stderr,
  });

  stderr.end();
  assert.equal(exitCode, 1);
  assert.match(await stderrOutput, /Tempo limite excedido/);
});
