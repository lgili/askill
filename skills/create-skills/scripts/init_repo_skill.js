#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_COMPATIBILITY = ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"];
const DEFAULT_CATALOG_OWNER = "your-org";
const DEFAULT_REF = "main";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(CURRENT_FILE);
const CREATE_SKILLS_DIR = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_CREATE_SKILLS_DIR = path.resolve(CREATE_SKILLS_DIR, "..", "..", "..", "skills", "create-skills");

export async function createSkillScaffold(options) {
  const rootDir = path.resolve(options.root || process.cwd());
  const skillId = normalizeSkillId(options.skillId);
  const name = (options.name || toTitleCase(skillId)).trim();
  const description = normalizeDescription(options.description);
  const author = (options.author || "lgili").trim();
  const compatibility = parseList(options.compatibility, DEFAULT_COMPATIBILITY);
  const tags = parseList(options.tags, []);

  const catalogPath = path.join(rootDir, "catalog.json");
  const catalog = await readCatalog(catalogPath, rootDir);
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

  const manifest = {
    id: skillId,
    name,
    version: "0.1.0",
    description,
    author,
    tags,
    compatibility,
    entry,
    files,
    scripts: {},
  };

  await writeJson(path.join(skillDir, "skill.json"), manifest);
  await fs.writeFile(path.join(skillDir, "agents", "openai.yaml"), buildOpenAiYaml(skillId, name, description), "utf8");

  registerSkillInCatalog(catalog, toCatalogEntry(manifest, `skills/${skillId}`));
  await writeJson(catalogPath, sortCatalog(catalog));

  return {
    rootDir,
    skillDir,
    skillId,
    catalogPath,
  };
}

export async function createSkillRepoScaffold(options) {
  const rootDir = path.resolve(options.root || process.cwd());
  const repoId = normalizeRepositoryId(options.repo, rootDir);
  const ref = options.ref ? String(options.ref).trim() : DEFAULT_REF;
  const repoName = (options.name || toTitleCase(path.basename(rootDir))).trim();
  const description = options.description
    ? String(options.description).trim()
    : `Skill catalog for ${repoName}.`;

  await assertDirectoryIsEmpty(rootDir);
  await fs.mkdir(path.join(rootDir, "skills"), { recursive: true });

  const catalogPath = path.join(rootDir, "catalog.json");
  await writeJson(catalogPath, {
    formatVersion: 1,
    repo: repoId,
    ref,
    skills: [],
  });

  await fs.writeFile(path.join(rootDir, "README.md"), buildRepositoryReadme(repoId, repoName, description), "utf8");
  await seedCreateSkillsSkill(rootDir);
  await validateSkillRepoCatalog({ root: rootDir });

  return {
    rootDir,
    catalogPath,
    repo: repoId,
  };
}

export async function validateSkillRepoCatalog(options) {
  const rootDir = path.resolve(options.root || process.cwd());
  const catalogPath = path.join(rootDir, "catalog.json");
  const catalog = await readCatalog(catalogPath, rootDir);
  const errors = [];

  if (!Array.isArray(catalog.skills)) {
    errors.push("catalog.json precisa conter um array `skills`.");
  }

  const skillIds = Array.isArray(catalog.skills) ? catalog.skills.map((skill) => skill.id) : [];
  const sortedIds = [...skillIds].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(skillIds) !== JSON.stringify(sortedIds)) {
    errors.push("As skills em catalog.json devem estar ordenadas por id.");
  }

  for (const skill of catalog.skills || []) {
    const skillDir = path.join(rootDir, skill.path || `skills/${skill.id}`);
    if (!(await pathExists(skillDir))) {
      errors.push(`Pasta da skill ausente: ${skill.path || `skills/${skill.id}`}`);
      continue;
    }

    const manifestPath = path.join(skillDir, "skill.json");
    if (!(await pathExists(manifestPath))) {
      errors.push(`skill.json ausente para ${skill.id}`);
      continue;
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.id !== skill.id) {
      errors.push(`catalog.json e skill.json divergem para ${skill.id}`);
    }

    for (const relativePath of skill.files || []) {
      if (!(await pathExists(path.join(skillDir, relativePath)))) {
        errors.push(`Arquivo listado no catalogo nao encontrado: ${skill.id}/${relativePath}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    rootDir,
    catalogPath,
    skillCount: catalog.skills.length,
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

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === CURRENT_FILE;
if (isMainModule) {
  await main();
}

async function seedCreateSkillsSkill(rootDir) {
  const sourceSkillDir = await resolveCreateSkillsSourceDir();
  const sourceManifestPath = path.join(sourceSkillDir, "skill.json");
  const sourceManifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  const targetSkillDir = path.join(rootDir, "skills", sourceManifest.id);

  await fs.mkdir(targetSkillDir, { recursive: true });
  await copyFile(path.join(sourceSkillDir, "skill.json"), path.join(targetSkillDir, "skill.json"));
  for (const relativePath of sourceManifest.files || []) {
    await copyFile(path.join(sourceSkillDir, relativePath), path.join(targetSkillDir, relativePath));
  }

  const catalogPath = path.join(rootDir, "catalog.json");
  const catalog = await readCatalog(catalogPath, rootDir);
  registerSkillInCatalog(catalog, toCatalogEntry(sourceManifest, `skills/${sourceManifest.id}`));
  await writeJson(catalogPath, sortCatalog(catalog));
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

function normalizeRepositoryId(value, rootDir) {
  const candidate = value ? String(value).trim() : `${DEFAULT_CATALOG_OWNER}/${path.basename(rootDir)}`;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate)) {
    throw new Error(`Repositorio invalido: "${candidate}". Use owner/repo.`);
  }
  return candidate;
}

function parseList(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

function toCatalogEntry(manifest, skillPath) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version || "0.1.0",
    description: manifest.description || "",
    path: skillPath,
    entry: manifest.entry || "SKILL.md",
    files: manifest.files || ["SKILL.md"],
    compatibility: manifest.compatibility || [],
    tags: manifest.tags || [],
    author: manifest.author || null,
  };
}

function registerSkillInCatalog(catalog, entry) {
  catalog.skills = Array.isArray(catalog.skills) ? catalog.skills.filter((skill) => skill.id !== entry.id) : [];
  catalog.skills.push(entry);
}

function sortCatalog(catalog) {
  return {
    ...catalog,
    skills: [...catalog.skills].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function buildSkillMarkdown(skillId, name, description) {
  return [
    "---",
    `name: \"${escapeYaml(name)}\"`,
    `description: \"${escapeYaml(description)}\"`,
    "# autoInject: true",
    '# activationPrompt: "Describe quando esta skill deve ser ativada automaticamente."',
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
    "- If the skill needs auto-inject, uncomment `autoInject` and fill `activationPrompt` in the frontmatter.",
    `- Always ensure the root catalog keeps an entry for \`${skillId}\` when this skill is added to a repository.`,
    "",
  ].join("\n");
}

function buildOpenAiYaml(skillId, name, description) {
  const shortDescription = description.length > 64 ? `${description.slice(0, 61)}...` : description;
  return [
    "interface:",
    `  display_name: \"${escapeYaml(name)}\"`,
    `  short_description: \"${escapeYaml(shortDescription)}\"`,
    `  default_prompt: \"Use $${skillId} to help me with this task.\"`,
    "",
    "policy:",
    "  allow_implicit_invocation: true",
    "",
  ].join("\n");
}

function buildRepositoryReadme(repoId, repoName, description) {
  return [
    `# ${repoName}`,
    "",
    description,
    "",
    "## Layout",
    "",
    "- `catalog.json`: root catalog consumed by Skillex.",
    "- `skills/`: first-party skills published by this repository.",
    "",
    "## Included Skill",
    "",
    "This repository ships with `create-skills` so you can scaffold additional skills and keep the root catalog updated automatically.",
    "",
    "## Commands",
    "",
    "Create a new skill in this repository:",
    "",
    "```bash",
    "node skills/create-skills/scripts/init_repo_skill.js --root . --skill-id my-skill --name \"My Skill\" --description \"Describe what this skill does.\"",
    "```",
    "",
    "Validate the catalog:",
    "",
    "```bash",
    "node skills/create-skills/scripts/check_catalog.js --root .",
    "```",
    "",
    `Before publishing, ensure \`catalog.json\` points to the final GitHub repo id. Current value: \`${repoId}\`.`,
    "",
  ].join("\n");
}

async function readCatalog(catalogPath, rootDir) {
  if (!(await pathExists(catalogPath))) {
    return {
      formatVersion: 1,
      repo: `${DEFAULT_CATALOG_OWNER}/${path.basename(rootDir)}`,
      ref: DEFAULT_REF,
      skills: [],
    };
  }

  const content = await fs.readFile(catalogPath, "utf8");
  return JSON.parse(content);
}

async function writeJson(targetPath, value) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function resolveCreateSkillsSourceDir() {
  if (await pathExists(path.join(CREATE_SKILLS_DIR, "skill.json"))) {
    return CREATE_SKILLS_DIR;
  }

  if (await pathExists(path.join(WORKSPACE_CREATE_SKILLS_DIR, "skill.json"))) {
    return WORKSPACE_CREATE_SKILLS_DIR;
  }

  throw new Error("Nao foi possivel localizar a skill create-skills para copiar o scaffold.");
}

async function assertDirectoryIsEmpty(targetDir) {
  if (!(await pathExists(targetDir))) {
    await fs.mkdir(targetDir, { recursive: true });
    return;
  }

  const entries = await fs.readdir(targetDir);
  if (entries.length > 0) {
    throw new Error(`A pasta de destino precisa estar vazia: ${targetDir}`);
  }
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
