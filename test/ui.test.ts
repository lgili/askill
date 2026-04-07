import test from "node:test";
import assert from "node:assert/strict";

import { filterCatalogForUi, runInteractiveUi } from "../src/ui.js";
import type { CatalogData } from "../src/types.js";

const catalog: CatalogData = {
  formatVersion: 1,
  repo: "example/skills",
  ref: "main",
  skills: [
    {
      id: "git-master",
      name: "Git Master",
      version: "1.0.0",
      description: "Workflow de git",
      author: "example",
      tags: ["git"],
      compatibility: ["codex"],
      entry: "SKILL.md",
      path: "skills/git-master",
      files: ["SKILL.md"],
    },
    {
      id: "pdf-toolkit",
      name: "PDF Toolkit",
      version: "1.0.0",
      description: "Manipula PDFs",
      author: "example",
      tags: ["pdf"],
      compatibility: ["cursor"],
      entry: "SKILL.md",
      path: "skills/pdf-toolkit",
      files: ["SKILL.md"],
    },
  ],
};

test("filterCatalogForUi filtra por nome e descricao", () => {
  const results = filterCatalogForUi(catalog.skills, "git");
  assert.deepEqual(results.map((skill) => skill.id), ["git-master"]);
});

test("runInteractiveUi pre-seleciona instaladas e calcula instalacoes/remocoes", async () => {
  const result = await runInteractiveUi({
    skills: catalog.skills,
    installedIds: ["git-master"],
    prompts: {
      input: async () => "",
      checkbox: async ({ choices }) => {
        assert.equal(choices[0]!.checked, true);
        return ["pdf-toolkit"];
      },
    },
  });

  assert.deepEqual(result.visibleIds, ["git-master", "pdf-toolkit"]);
  assert.deepEqual(result.toInstall, ["pdf-toolkit"]);
  assert.deepEqual(result.toRemove, ["git-master"]);
});

test("runInteractiveUi lida com catalogo filtrado vazio", async () => {
  const result = await runInteractiveUi({
    skills: catalog.skills,
    installedIds: [],
    prompts: {
      input: async () => "inexistente",
      checkbox: async () => {
        throw new Error("checkbox nao deveria ser chamado");
      },
    },
  });

  assert.deepEqual(result.visibleIds, []);
  assert.deepEqual(result.selectedIds, []);
});
