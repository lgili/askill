import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRawGitHubUrl,
  parseGitHubRepo,
  resolveSource,
  searchCatalogSkills,
} from "../src/catalog.js";

test("parseGitHubRepo aceita owner/repo", () => {
  assert.deepEqual(parseGitHubRepo("openai/skills"), {
    owner: "openai",
    repo: "skills",
    ref: null,
  });
});

test("parseGitHubRepo aceita URL com tree/ref", () => {
  assert.deepEqual(
    parseGitHubRepo("https://github.com/openai/skills/tree/main"),
    {
      owner: "openai",
      repo: "skills",
      ref: "main",
    },
  );
});

test("buildRawGitHubUrl preserva refs simples", () => {
  assert.equal(
    buildRawGitHubUrl("openai/skills", "main", "skills/git-master/SKILL.md"),
    "https://raw.githubusercontent.com/openai/skills/main/skills/git-master/SKILL.md",
  );
});

test("resolveSource usa defaults previsiveis", () => {
  const source = resolveSource({ repo: "openai/skills" });
  assert.equal(source.repo, "openai/skills");
  assert.equal(source.ref, "main");
  assert.equal(source.catalogPath, "catalog.json");
  assert.equal(source.skillsDir, "skills");
});

test("searchCatalogSkills filtra por texto e compatibilidade", () => {
  const skills = [
    {
      id: "git-master",
      name: "Git Master",
      version: "1.0.0",
      description: "Fluxo semantico para git",
      tags: ["git", "workflow"],
      compatibility: ["codex", "copilot"],
    },
    {
      id: "pdf-toolkit",
      name: "PDF Toolkit",
      version: "1.0.0",
      description: "Manipula pdfs",
      tags: ["pdf"],
      compatibility: ["cline"],
    },
  ];

  const results = searchCatalogSkills(skills, {
    query: "git",
    compatibility: "codex",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "git-master");
});

test("searchCatalogSkills normaliza aliases de compatibilidade", () => {
  const skills = [
    {
      id: "reviewer",
      name: "Reviewer",
      version: "1.0.0",
      description: "Review de codigo",
      tags: ["review"],
      compatibility: ["claude"],
    },
    {
      id: "issue-helper",
      name: "Issue Helper",
      version: "1.0.0",
      description: "Ajuda com issues",
      tags: ["issues"],
      compatibility: ["gemini-cli"],
    },
  ];

  const claudeResults = searchCatalogSkills(skills, {
    compatibility: "claude-code",
  });
  assert.equal(claudeResults.length, 1);
  assert.equal(claudeResults[0].id, "reviewer");

  const geminiResults = searchCatalogSkills(skills, {
    compatibility: "gemini",
  });
  assert.equal(geminiResults.length, 1);
  assert.equal(geminiResults[0].id, "issue-helper");
});
