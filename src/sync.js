import path from "node:path";
import { ensureDir, readJson, readText, writeText } from "./fs.js";
import { getAdapter } from "./adapters.js";

const MANAGED_START = "<!-- ASKILL:START -->";
const MANAGED_END = "<!-- ASKILL:END -->";

export async function loadInstalledSkillDocuments(context) {
  const installedEntries = Object.entries(context.lockfile.installed || {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const documents = [];
  for (const [skillId, metadata] of installedEntries) {
    const skillDir = path.join(context.stateDir, skillId);
    const manifest = await readJson(path.join(skillDir, "skill.json"), {});
    const entry = manifest.entry || "SKILL.md";
    const rawContent = await readText(path.join(skillDir, entry), "");
    documents.push({
      id: skillId,
      name: manifest.name || metadata.name || skillId,
      version: manifest.version || metadata.version || "0.1.0",
      body: normalizeSkillContent(rawContent),
    });
  }

  return documents;
}

export async function syncAdapterFiles(options) {
  const prepared = await prepareSyncAdapterFiles(options);
  if (!options.dryRun) {
    await ensureDir(path.dirname(prepared.absoluteTargetPath));
    await writeText(prepared.absoluteTargetPath, prepared.nextContent);
  }

  return {
    adapter: prepared.adapter,
    targetPath: prepared.targetPath,
    changed: prepared.changed,
    diff: prepared.diff,
  };
}

export async function prepareSyncAdapterFiles(options) {
  const adapter = getAdapter(options.adapterId);
  if (!adapter) {
    throw new Error(`Adapter desconhecido: ${options.adapterId}`);
  }

  const targetPath = path.join(options.cwd, adapter.syncTarget);
  const relativeTargetPath = toPosix(path.relative(options.cwd, targetPath));
  const consolidatedBody = renderInstalledSkills(options.skills);
  const fileContent = buildAdapterFileContent(adapter.id, consolidatedBody);
  const existing = (await readText(targetPath, "")) || "";
  const nextContent =
    adapter.syncMode === "managed-block" ? upsertManagedBlock(existing, fileContent) : fileContent;
  const changed = normalizeComparableText(existing) !== normalizeComparableText(nextContent);

  return {
    adapter: adapter.id,
    absoluteTargetPath: targetPath,
    targetPath: relativeTargetPath,
    changed,
    currentContent: existing,
    nextContent,
    diff: createTextDiff(existing, nextContent, relativeTargetPath),
  };
}

export function renderInstalledSkills(skills) {
  const sections = skills.map(renderSkillSection).filter(Boolean);
  const lines = [
    "## Askill Managed Skills",
    "",
    "> Conteudo gerado por `askill sync`. Edicoes aqui podem ser sobrescritas.",
    "",
  ];

  if (sections.length === 0) {
    lines.push("Nenhuma skill instalada no momento.");
  } else {
    lines.push(sections.join("\n\n---\n\n"));
  }

  return `${lines.join("\n").trim()}\n`;
}

function renderSkillSection(skill) {
  const body = skill.body.trim() || "_Sem conteudo._";
  return [`### ${skill.name} (\`${skill.id}@${skill.version}\`)`, "", body].join("\n");
}

function buildAdapterFileContent(adapterId, body) {
  switch (adapterId) {
    case "cursor":
      return [
        "---",
        'description: "Askill managed skills"',
        "alwaysApply: true",
        "---",
        "",
        body.trim(),
        "",
      ].join("\n");
    case "windsurf":
      return [
        "---",
        'description: "Askill managed skills"',
        "trigger: always_on",
        "---",
        "",
        body.trim(),
        "",
      ].join("\n");
    case "cline":
      return body;
    case "codex":
    case "copilot":
    case "claude":
    case "gemini":
      return [MANAGED_START, body.trim(), MANAGED_END, ""].join("\n");
    default:
      throw new Error(`Adapter desconhecido: ${adapterId}`);
  }
}

function upsertManagedBlock(existingContent, blockContent) {
  const blockPattern = new RegExp(`${escapeRegExp(MANAGED_START)}[\\s\\S]*?${escapeRegExp(MANAGED_END)}\\n?`, "m");
  if (blockPattern.test(existingContent)) {
    return existingContent.replace(blockPattern, `${blockContent}\n`);
  }

  const trimmed = existingContent.trimEnd();
  if (!trimmed) {
    return `${blockContent}\n`;
  }

  return `${trimmed}\n\n${blockContent}\n`;
}

function normalizeSkillContent(content) {
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  const withoutTopHeading = withoutFrontmatter.replace(/^#\s+.+\n+/, "");
  return withoutTopHeading.trim();
}

function createTextDiff(currentContent, nextContent, targetPath) {
  if (normalizeComparableText(currentContent) === normalizeComparableText(nextContent)) {
    return `Sem alteracoes em ${targetPath}.\n`;
  }

  const currentLines = splitLines(currentContent);
  const nextLines = splitLines(nextContent);
  const operations = diffLines(currentLines, nextLines);
  const output = [`--- atual/${targetPath}`, `+++ novo/${targetPath}`];

  for (const operation of operations) {
    output.push(`${operation.type}${operation.line}`);
  }

  return `${output.join("\n")}\n`;
}

function splitLines(content) {
  if (!content) {
    return [];
  }

  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function normalizeComparableText(content) {
  if (!content) {
    return "";
  }

  return content.replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
}

function diffLines(leftLines, rightLines) {
  const rowCount = leftLines.length + 1;
  const columnCount = rightLines.length + 1;
  const matrix = Array.from({ length: rowCount }, () => Array(columnCount).fill(0));

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        matrix[leftIndex][rightIndex] = matrix[leftIndex + 1][rightIndex + 1] + 1;
      } else {
        matrix[leftIndex][rightIndex] = Math.max(
          matrix[leftIndex + 1][rightIndex],
          matrix[leftIndex][rightIndex + 1],
        );
      }
    }
  }

  const operations = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      operations.push({ type: " ", line: leftLines[leftIndex] });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
      operations.push({ type: "-", line: leftLines[leftIndex] });
      leftIndex += 1;
    } else {
      operations.push({ type: "+", line: rightLines[rightIndex] });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    operations.push({ type: "-", line: leftLines[leftIndex] });
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    operations.push({ type: "+", line: rightLines[rightIndex] });
    rightIndex += 1;
  }

  return operations;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
