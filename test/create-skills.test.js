import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createSkillScaffold } from "../skills/create-skills/scripts/init_repo_skill.js";

test("createSkillScaffold cria a skill e registra no catalogo", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "askill-create-skill-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.writeFile(
    path.join(root, "catalog.json"),
    `${JSON.stringify({ formatVersion: 1, repo: "lgili/askill", ref: "main", skills: [] }, null, 2)}\n`,
    "utf8",
  );

  const result = await createSkillScaffold({
    root,
    skillId: "demo-skill",
    name: "Demo Skill",
    description: "Create demo outputs in the repository format.",
    tags: "demo,repo",
  });

  assert.equal(result.skillId, "demo-skill");
  assert.equal(await fileExists(path.join(root, "skills", "demo-skill", "SKILL.md")), true);
  assert.equal(await fileExists(path.join(root, "skills", "demo-skill", "skill.json")), true);
  assert.equal(await fileExists(path.join(root, "skills", "demo-skill", "agents", "openai.yaml")), true);

  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));
  assert.equal(catalog.skills.length, 1);
  assert.equal(catalog.skills[0].id, "demo-skill");
  assert.deepEqual(catalog.skills[0].files, ["SKILL.md", "agents/openai.yaml"]);

  const skillManifest = JSON.parse(
    await fs.readFile(path.join(root, "skills", "demo-skill", "skill.json"), "utf8"),
  );
  assert.equal(skillManifest.id, "demo-skill");
  assert.equal(skillManifest.name, "Demo Skill");
  assert.deepEqual(skillManifest.compatibility, [
    "codex",
    "copilot",
    "cline",
    "cursor",
    "claude",
    "gemini",
    "windsurf",
  ]);
  assert.deepEqual(catalog.skills[0].compatibility, skillManifest.compatibility);
});

test("catalogo first-party referencia arquivos reais", async () => {
  const root = "/Users/lgili/Documents/01 - Codes/01 - Github/Skill";
  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));

  assert.ok(Array.isArray(catalog.skills));
  assert.ok(catalog.skills.length >= 1);

  for (const skill of catalog.skills) {
    const skillDir = path.join(root, skill.path);
    assert.equal(await fileExists(skillDir), true, `skill dir missing: ${skill.path}`);
    assert.equal(await fileExists(path.join(skillDir, "skill.json")), true, `skill.json missing: ${skill.id}`);
    for (const relativePath of skill.files) {
      assert.equal(
        await fileExists(path.join(skillDir, relativePath)),
        true,
        `catalog file missing: ${skill.id}/${relativePath}`,
      );
    }
  }
});

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
