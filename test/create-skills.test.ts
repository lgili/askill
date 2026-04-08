import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

import {
  createSkillRepoScaffold,
  createSkillScaffold,
  validateSkillRepoCatalog,
} from "../skills/create-skills/scripts/init_repo_skill.js";

test("createSkillScaffold cria a skill e registra no catalogo", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-create-skill-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.writeFile(
    path.join(root, "catalog.json"),
    `${JSON.stringify({ formatVersion: 2, repo: "lgili/skillex", ref: "main", skills: [] }, null, 2)}\n`,
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

  // catalog entry is slim — only id
  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));
  assert.equal(catalog.skills.length, 1);
  assert.deepEqual(catalog.skills[0], { id: "demo-skill" });

  // full metadata lives in skill.json
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
  assert.deepEqual(skillManifest.files, ["SKILL.md", "agents/openai.yaml"]);
});

test("createSkillRepoScaffold cria repo compativel e semeia create-skills no catalogo raiz", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-create-skill-repo-"));
  await fs.rm(root, { recursive: true, force: true });

  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const result = await createSkillRepoScaffold({
    root,
    repo: "myorg/my-skills",
    name: "My Skills",
    description: "Shared team skills.",
  });

  assert.equal(result.repo, "myorg/my-skills");
  assert.equal(await fileExists(path.join(root, "catalog.json")), true);
  assert.equal(await fileExists(path.join(root, "README.md")), true);
  assert.equal(await fileExists(path.join(root, "skills", "create-skills", "SKILL.md")), true);
  assert.equal(await fileExists(path.join(root, "skills", "create-skills", "skill.json")), true);
  assert.equal(await fileExists(path.join(root, "skills", "create-skills", "scripts", "bootstrap_skill_repo.js")), true);
  assert.equal(await fileExists(path.join(root, "skills", "create-skills", "scripts", "check_catalog.js")), true);

  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));
  assert.equal(catalog.formatVersion, 2);
  assert.equal(catalog.repo, "myorg/my-skills");
  assert.equal(catalog.skills.length, 1);
  assert.deepEqual(catalog.skills[0], { id: "create-skills" });
});

test("repo bootstrapado consegue criar nova skill e manter catalogo raiz valido", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-bootstrapped-repo-"));
  await fs.rm(root, { recursive: true, force: true });

  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await createSkillRepoScaffold({
    root,
    repo: "myorg/my-skills",
  });

  await createSkillScaffold({
    root,
    skillId: "demo-skill",
    name: "Demo Skill",
    description: "Create demo outputs in the repository format.",
  });

  const validation = await validateSkillRepoCatalog({ root });
  assert.equal(validation.skillCount, 2);

  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));
  assert.deepEqual(catalog.skills, [{ id: "create-skills" }, { id: "demo-skill" }]);
});

test("validateSkillRepoCatalog detecta arquivos faltando listados no skill.json", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-invalid-catalog-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, "skills", "broken-skill", "agents"), { recursive: true });

  // slim catalog entry — only id
  await fs.writeFile(
    path.join(root, "catalog.json"),
    `${JSON.stringify(
      { formatVersion: 2, repo: "myorg/my-skills", ref: "main", skills: [{ id: "broken-skill" }] },
      null,
      2,
    )}\n`,
    "utf8",
  );

  // skill.json declares files that don't exist on disk
  await fs.writeFile(
    path.join(root, "skills", "broken-skill", "skill.json"),
    `${JSON.stringify(
      {
        id: "broken-skill",
        name: "Broken Skill",
        version: "0.1.0",
        description: "broken",
        author: null,
        tags: [],
        compatibility: [],
        entry: "SKILL.md",
        files: ["SKILL.md", "agents/openai.yaml"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await assert.rejects(() => validateSkillRepoCatalog({ root }), /File listed in skill\.json not found/);
});

test("catalogo first-party referencia arquivos reais", async () => {
  const root = process.cwd();
  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"));

  assert.ok(Array.isArray(catalog.skills));
  assert.ok(catalog.skills.length >= 1);
  assert.equal(catalog.formatVersion, 2);

  for (const entry of catalog.skills) {
    // catalog entries are slim: only id
    assert.deepEqual(Object.keys(entry), ["id"]);

    const skillDir = path.join(root, "skills", entry.id);
    assert.equal(await fileExists(skillDir), true, `skill dir missing: skills/${entry.id}`);
    assert.equal(await fileExists(path.join(skillDir, "skill.json")), true, `skill.json missing: ${entry.id}`);

    // files are declared in skill.json, not in catalog
    const manifest = JSON.parse(await fs.readFile(path.join(skillDir, "skill.json"), "utf8"));
    for (const relativePath of manifest.files ?? []) {
      assert.equal(
        await fileExists(path.join(skillDir, relativePath)),
        true,
        `file missing: ${entry.id}/${relativePath}`,
      );
    }
  }
});

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
