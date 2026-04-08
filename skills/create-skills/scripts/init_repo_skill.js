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
  const references = parseList(options.references, []);

  const catalogPath = path.join(rootDir, "catalog.json");
  const catalog = await readCatalog(catalogPath, rootDir);
  const skillDir = path.join(rootDir, "skills", skillId);
  const entry = "SKILL.md";
  const files = ["SKILL.md", "agents/openai.yaml"];

  if (await pathExists(skillDir)) {
    throw new Error(`Skill folder already exists: ${skillDir}`);
  }

  if (catalog.skills.some((skill) => skill.id === skillId)) {
    throw new Error(`Skill "${skillId}" already exists in catalog.json.`);
  }

  await fs.mkdir(path.join(skillDir, "agents"), { recursive: true });
  await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true });
  await fs.mkdir(path.join(skillDir, "references"), { recursive: true });

  await fs.writeFile(path.join(skillDir, entry), buildSkillMarkdown(skillId, name, description, references), "utf8");
  await fs.writeFile(path.join(skillDir, "agents", "openai.yaml"), buildOpenAiYaml(skillId, name, description), "utf8");

  for (const ref of references) {
    const refPath = `references/${ref}.md`;
    await fs.writeFile(path.join(skillDir, refPath), buildReferencePlaceholder(ref, skillId), "utf8");
    files.push(refPath);
  }

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
  };

  await writeJson(path.join(skillDir, "skill.json"), manifest);

  registerSkillInCatalog(catalog, toCatalogEntry(manifest));
  await writeJson(catalogPath, sortCatalog(catalog));

  return {
    rootDir,
    skillDir,
    skillId,
    catalogPath,
    references,
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
    formatVersion: 2,
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
    errors.push("catalog.json must contain a `skills` array.");
  }

  const skillIds = Array.isArray(catalog.skills) ? catalog.skills.map((skill) => skill.id) : [];
  const sortedIds = [...skillIds].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(skillIds) !== JSON.stringify(sortedIds)) {
    errors.push("Skills in catalog.json must be sorted by id.");
  }

  for (const entry of catalog.skills || []) {
    const skillDir = path.join(rootDir, "skills", entry.id);
    if (!(await pathExists(skillDir))) {
      errors.push(`Skill folder not found: skills/${entry.id}`);
      continue;
    }

    const manifestPath = path.join(skillDir, "skill.json");
    if (!(await pathExists(manifestPath))) {
      errors.push(`skill.json missing for ${entry.id}`);
      continue;
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.id !== entry.id) {
      errors.push(`catalog.json and skill.json ids do not match for ${entry.id}`);
    }

    for (const relativePath of manifest.files || []) {
      if (!(await pathExists(path.join(skillDir, relativePath)))) {
        errors.push(`File listed in skill.json not found: ${entry.id}/${relativePath}`);
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
      throw new Error(`Invalid argument: ${token}`);
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
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || !flags["skill-id"]) {
    console.log("Usage: node init_repo_skill.js --skill-id <id> --name <name> --description <desc> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --skill-id <id>          Skill identifier (lowercase letters, digits, and hyphens only)");
    console.log("  --name <name>            Human-readable skill name (default: title-cased skill-id)");
    console.log("  --description <desc>     Skill description — include trigger patterns");
    console.log("  --root <path>            Repository root directory (default: current directory)");
    console.log("  --author <handle>        Author name or GitHub handle (default: lgili)");
    console.log("  --tags <a,b,c>           Comma-separated list of tags");
    console.log("  --references <a,b,c>     Comma-separated reference file names to scaffold");
    console.log("  --compatibility <ids>    Comma-separated adapter ids (default: all adapters)");
    console.log("");
    console.log("Examples:");
    console.log(`  node init_repo_skill.js --skill-id api-design --name "API Design" \\`);
    console.log(`    --description "REST API design conventions. Activates when you say 'design an API'." \\`);
    console.log(`    --references rest-conventions,versioning,error-responses \\`);
    console.log(`    --tags api,rest,design`);
    console.log("");
    console.log(`  node init_repo_skill.js --skill-id git-workflow --name "Git Workflow" \\`);
    console.log(`    --description "Branch and commit conventions." \\`);
    console.log(`    --references branching,commit-messages`);
    if (!flags["skill-id"]) process.exitCode = 1;
    return;
  }

  try {
    const result = await createSkillScaffold({
      root: flags.root,
      skillId: flags["skill-id"],
      name: flags.name,
      description: flags.description,
      author: flags.author,
      compatibility: flags.compatibility,
      tags: flags.tags,
      references: flags.references,
    });

    console.log(`Skill created:   ${result.skillId}`);
    console.log(`Folder:          ${result.skillDir}`);
    console.log(`Catalog updated: ${result.catalogPath}`);
    if (result.references.length > 0) {
      console.log(`References:      ${result.references.map((r) => `references/${r}.md`).join(", ")}`);
    }
    console.log("");
    console.log("Next steps:");
    console.log(`  1. Edit skills/${result.skillId}/SKILL.md`);
    console.log("     - Fill in Core Workflow steps with actionable instructions.");
    console.log("     - Complete the Output Template section.");
    console.log("     - Add trigger patterns to the description frontmatter field.");
    let step = 2;
    for (const ref of result.references) {
      console.log(`  ${step}. Edit skills/${result.skillId}/references/${ref}.md — replace TODOs with real domain guidance.`);
      step += 1;
    }
    console.log(`  ${step}. Add real scripts to skills/${result.skillId}/scripts/ if needed.`);
    step += 1;
    console.log(`  ${step}. Update catalog.json files[] if you add more tracked files.`);
    step += 1;
    console.log(`  ${step}. Run: node skills/create-skills/scripts/check_catalog.js --root .`);
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
  registerSkillInCatalog(catalog, toCatalogEntry(sourceManifest));
  await writeJson(catalogPath, sortCatalog(catalog));
}

function normalizeSkillId(value) {
  if (!value) {
    throw new Error("Provide --skill-id.");
  }

  const normalized = String(value).trim();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error(`Invalid skill-id: "${value}". Use lowercase letters, digits, and hyphens only.`);
  }
  return normalized;
}

function normalizeDescription(value) {
  if (!value || !String(value).trim()) {
    throw new Error("Provide --description.");
  }
  return String(value).trim();
}

function normalizeRepositoryId(value, rootDir) {
  const candidate = value ? String(value).trim() : `${DEFAULT_CATALOG_OWNER}/${path.basename(rootDir)}`;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate)) {
    throw new Error(`Invalid repository id: "${candidate}". Use owner/repo format.`);
  }
  return candidate;
}

function parseList(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

function toCatalogEntry(manifest) {
  return { id: manifest.id };
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

function buildSkillMarkdown(skillId, name, description, references) {
  const refTableRows = references.length > 0
    ? references.map((ref) => `| ${toTitleCase(ref)} | \`references/${ref}.md\` | When working with ${ref.replace(/-/g, " ")} |`).join("\n")
    : `| Domain Knowledge | \`references/domain.md\` | When you need domain-specific context |`;

  const scriptRow = `| \`scripts/example.js\` | Describe what the script validates or generates | \`node skills/${skillId}/scripts/example.js --help\` |`;

  return [
    "---",
    `name: "${escapeYaml(name)}"`,
    `description: "${escapeYaml(description)}"`,
    "---",
    "",
    `# ${name}`,
    "",
    description,
    "",
    "## Core Workflow",
    "",
    "1. **Understand the request** — Read the task and identify exactly what the user needs.",
    "2. **Gather context** — Load the relevant reference files from the Reference Guide below.",
    "3. **Apply constraints** — Follow the MUST DO / MUST NOT DO rules before generating output.",
    "4. **Produce the output** — Use the Output Template as the structure for your response.",
    "5. **Validate** — Run any bundled scripts that verify correctness before returning.",
    "",
    "## Reference Guide",
    "",
    "| Topic | Reference | When to load |",
    "|-------|-----------|--------------|",
    refTableRows,
    "",
    "## Bundled Scripts",
    "",
    "| Script | Purpose | Usage |",
    "|--------|---------|-------|",
    scriptRow,
    "",
    "## Constraints",
    "",
    "**MUST DO**",
    "- Follow the conventions documented in the reference files.",
    "- Explain your reasoning when a rule conflict arises.",
    "- Produce output that matches the Output Template structure below.",
    "",
    "**MUST NOT DO**",
    "- Do not invent conventions not documented in the references.",
    "- Do not skip validation steps when a script is available.",
    "- Do not produce output that contradicts the active constraints.",
    "",
    "## Output Template",
    "",
    "```",
    "<!-- Describe the expected output structure here. -->",
    "<!-- For example: a commit message, a code diff, a code block with explanation, etc. -->",
    "```",
    "",
    "## References",
    "",
    "- Add authoritative external links here (specs, RFCs, official documentation).",
    "",
  ].join("\n");
}

function buildReferencePlaceholder(ref, skillId) {
  const title = toTitleCase(ref);
  return [
    `# ${title}`,
    "",
    `> Reference for: ${skillId}`,
    `> Load when: Working with ${ref.replace(/-/g, " ")}`,
    "",
    "## Overview",
    "",
    "TODO: Add domain-specific guidance here.",
    "",
    "## Key Concepts",
    "",
    "TODO: Document key concepts, patterns, and conventions.",
    "",
    "## Examples",
    "",
    "```",
    "TODO: Add code examples.",
    "```",
    "",
    "## Anti-Patterns",
    "",
    "TODO: Document common mistakes to avoid.",
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

function buildRepositoryReadme(repoId, repoName, description) {
  return [
    `# ${repoName}`,
    "",
    description,
    "",
    "## Layout",
    "",
    "- `catalog.json` — root catalog consumed by Skillex.",
    "- `skills/` — first-party skills published by this repository.",
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
    `node skills/create-skills/scripts/init_repo_skill.js \\`,
    `  --skill-id my-skill --name "My Skill" \\`,
    `  --description "Describe what this skill does. Activates when you say '...'." \\`,
    "  --references topic-one,topic-two",
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

  throw new Error("Could not locate create-skills skill for seeding.");
}

async function assertDirectoryIsEmpty(targetDir) {
  if (!(await pathExists(targetDir))) {
    await fs.mkdir(targetDir, { recursive: true });
    return;
  }

  const entries = await fs.readdir(targetDir);
  if (entries.length > 0) {
    throw new Error(`Target directory must be empty: ${targetDir}`);
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
