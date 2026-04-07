#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_COMPATIBILITY = ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"];

export async function createSkillScaffold(options) {
  const rootDir = path.resolve(options.root || process.cwd());
  const skillId = normalizeSkillId(options.skillId);
  const name = (options.name || toTitleCase(skillId)).trim();
  const description = normalizeDescription(options.description);
  const author = (options.author || "lgili").trim();
  const compatibility = parseList(options.compatibility, DEFAULT_COMPATIBILITY);
  const tags = parseList(options.tags, []);

  const catalogPath = path.join(rootDir, "catalog.json");
  const catalog = await readCatalog(catalogPath);
  const skillDir = path.join(rootDir, "skills", skillId);
  const entry = "SKILL.md";
  const files = ["SKILL.md", "agents/openai.yaml"];

  if (await pathExists(skillDir)) {
    throw new Error(`A pasta da skill ja existe: ${skillDir}`);
  }

  if (catalog.skills.some((skill) => skill.id === skillId)) {
    throw new Error(`A skill "${skillId}" ja existe em catalog.json.`);
  }

  await fs.mkdir(path.join(skillDir, "agents"), { recursive: true });
  await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true });
  await fs.mkdir(path.join(skillDir, "references"), { recursive: true });
  await fs.mkdir(path.join(skillDir, "assets"), { recursive: true });

  await fs.writeFile(path.join(skillDir, entry), buildSkillMarkdown(skillId, name, description), "utf8");
  await fs.writeFile(
    path.join(skillDir, "skill.json"),
    `${JSON.stringify(
      {
        id: skillId,
        name,
        version: "0.1.0",
        description,
        author,
        tags,
        compatibility,
        entry,
        files,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await fs.writeFile(path.join(skillDir, "agents", "openai.yaml"), buildOpenAiYaml(skillId, name, description), "utf8");

  catalog.skills.push({
    id: skillId,
    name,
    version: "0.1.0",
    description,
    path: `skills/${skillId}`,
    entry,
    files,
    compatibility,
    tags,
    author,
  });
  catalog.skills.sort((left, right) => left.id.localeCompare(right.id));

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  return {
    rootDir,
    skillDir,
    skillId,
    catalogPath,
  };
}

export function parseArgs(argv) {
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Argumento invalido: ${token}`);
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[rawKey] = true;
      continue;
    }

    flags[rawKey] = next;
    index += 1;
  }

  return flags;
}

async function main() {
  try {
    const flags = parseArgs(process.argv.slice(2));
    const result = await createSkillScaffold({
      root: flags.root,
      skillId: flags["skill-id"],
      name: flags.name,
      description: flags.description,
      author: flags.author,
      compatibility: flags.compatibility,
      tags: flags.tags,
    });

    console.log(`Skill criada: ${result.skillId}`);
    console.log(`Pasta: ${result.skillDir}`);
    console.log(`Catalogo atualizado: ${result.catalogPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  await main();
}

function normalizeSkillId(value) {
  if (!value) {
    throw new Error("Informe --skill-id.");
  }

  const normalized = String(value).trim();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error(`skill-id invalido: "${value}". Use apenas letras minusculas, numeros e hifens.`);
  }
  return normalized;
}

function normalizeDescription(value) {
  if (!value || !String(value).trim()) {
    throw new Error("Informe --description.");
  }
  return String(value).trim();
}

function parseList(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

function buildSkillMarkdown(skillId, name, description) {
  return [
    "---",
    `name: "${escapeYaml(skillId)}"`,
    `description: "${escapeYaml(description)}"`,
    "---",
    "",
    `# ${name}`,
    "",
    "Describe the concrete workflow this skill should handle.",
    "",
    "## Workflow",
    "",
    "1. Inspect the task and collect the required context.",
    "2. Use scripts or references only when they materially help.",
    "3. Produce the requested output with the repository conventions.",
    "",
    "## Resources",
    "",
    "- Add `scripts/` files only for deterministic or repeated steps.",
    "- Add `references/` only when the skill needs extra domain guidance.",
    "",
  ].join("\n");
}

function buildOpenAiYaml(skillId, name, description) {
  const shortDescription = description.length > 64 ? `${description.slice(0, 61)}...` : description;
  return [
    "interface:",
    `  display_name: "${escapeYaml(name)}"`,
    `  short_description: "${escapeYaml(shortDescription)}"`,
    `  default_prompt: "Use $${skillId} to help me with this task."`,
    "",
    "policy:",
    "  allow_implicit_invocation: true",
    "",
  ].join("\n");
}

async function readCatalog(catalogPath) {
  if (!(await pathExists(catalogPath))) {
    return {
      formatVersion: 1,
      repo: "lgili/askill",
      ref: "main",
      skills: [],
    };
  }

  const content = await fs.readFile(catalogPath, "utf8");
  return JSON.parse(content);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toTitleCase(skillId) {
  return skillId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeYaml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
