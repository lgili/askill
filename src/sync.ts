import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getAdapter } from "./adapters.js";
import {
  copyPath,
  createSymlink,
  ensureDir,
  pathExists,
  readJson,
  readSymlink,
  readText,
  removePath,
  writeText,
} from "./fs.js";
import { normalizeSkillContent, parseSkillFrontmatter } from "./skill.js";
import type {
  AdapterConfig,
  InstalledSkillDocument,
  LockfileState,
  PreparedDirectoryEntry,
  PreparedSyncResult,
  SyncOptions,
  SyncResult,
} from "./types.js";
import { SyncError } from "./types.js";

const MANAGED_START = "<!-- SKILLEX:START -->";
const MANAGED_END = "<!-- SKILLEX:END -->";
const AUTO_INJECT_START = "<!-- SKILLEX:AUTO-INJECT:START -->";
const AUTO_INJECT_END = "<!-- SKILLEX:AUTO-INJECT:END -->";
const LEGACY_MANAGED_BLOCKS = [{ start: "<!-- ASKILL:START -->", end: "<!-- ASKILL:END -->" }];
const LEGACY_AUTO_INJECT_BLOCKS = [
  { start: "<!-- ASKILL:AUTO-INJECT:START -->", end: "<!-- ASKILL:AUTO-INJECT:END -->" },
];

/**
 * Loads installed skill documents from the selected Skillex state directory.
 *
 * @param context - Workspace root and lockfile context.
 * @returns Installed skill documents used for sync rendering.
 */
export async function loadInstalledSkillDocuments(context: {
  cwd: string;
  lockfile: LockfileState;
}): Promise<InstalledSkillDocument[]> {
  const installedEntries = Object.entries(context.lockfile.installed || {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const documents: InstalledSkillDocument[] = [];
  for (const [skillId, metadata] of installedEntries) {
    const skillDir = resolveInstalledSkillPath(context.cwd, metadata.path);
    const manifest =
      (await readJson<{
        entry?: string;
        name?: string;
        version?: string;
        scripts?: Record<string, string>;
      }>(path.join(skillDir, "skill.json"), {})) || {};
    const entry = manifest.entry || "SKILL.md";
    const rawContent = (await readText(path.join(skillDir, entry), "")) || "";
    const frontmatter = parseSkillFrontmatter(rawContent);

    documents.push({
      id: skillId,
      name: manifest.name || metadata.name || skillId,
      version: manifest.version || metadata.version || "0.1.0",
      body: normalizeSkillContent(rawContent),
      skillDir,
      scripts: manifest.scripts || {},
      autoInject: Boolean(frontmatter.autoInject && frontmatter.activationPrompt),
      activationPrompt: frontmatter.activationPrompt || null,
    });
  }

  return documents;
}

/**
 * Synchronizes installed skills into the target consumed by an adapter.
 *
 * @param options - Sync execution options.
 * @returns Final sync result.
 * @throws {SyncError} When sync preparation or file writing fails.
 */
export async function syncAdapterFiles(options: SyncOptions): Promise<SyncResult> {
  try {
    const prepared = await prepareSyncAdapterFiles(options);

    if (!options.dryRun) {
      if (prepared.removeTarget) {
        if (prepared.generatedSourcePath) {
          await removePath(prepared.generatedSourcePath);
        }
        await removePath(prepared.absoluteTargetPath);
        for (const cleanupPath of prepared.cleanupPaths) {
          await removePath(cleanupPath);
        }
      } else if (prepared.directoryEntries) {
        await ensureDir(prepared.absoluteTargetPath);
        const createLink = options.linkFactory || createSymlink;
        let finalMode = prepared.syncMode;

        for (const entry of prepared.directoryEntries) {
          if (prepared.syncMode === "symlink") {
            const linkResult = await createLink(entry.sourcePath, entry.absoluteTargetPath);
            if (linkResult.fallback) {
              (options.warn || console.error)(
                `Aviso: symlink indisponivel para ${entry.targetPath}; usando copia no lugar.`,
              );
              await copyPath(entry.sourcePath, entry.absoluteTargetPath);
              finalMode = "copy";
            }
          } else {
            await copyPath(entry.sourcePath, entry.absoluteTargetPath);
          }
        }

        for (const cleanupPath of prepared.cleanupPaths) {
          await removePath(cleanupPath);
        }

        prepared.syncMode = finalMode;
      } else {
        await ensureDir(path.dirname(prepared.absoluteTargetPath));

        if (prepared.generatedSourcePath) {
          await ensureDir(path.dirname(prepared.generatedSourcePath));
          await writeText(prepared.generatedSourcePath, prepared.nextContent);
        }

        if (prepared.syncMode === "symlink" && prepared.generatedSourcePath) {
          const createLink = options.linkFactory || createSymlink;
          const linkResult = await createLink(prepared.generatedSourcePath, prepared.absoluteTargetPath);

          if (linkResult.fallback) {
            (options.warn || console.error)(
              `Aviso: symlink indisponivel para ${prepared.targetPath}; usando copia no lugar.`,
            );
            await writeText(prepared.absoluteTargetPath, prepared.nextContent);
            await removePath(prepared.generatedSourcePath);
            prepared.syncMode = "copy";
          }
        } else {
          await writeText(prepared.absoluteTargetPath, prepared.nextContent);
        }

        for (const cleanupPath of prepared.cleanupPaths) {
          await removePath(cleanupPath);
        }
      }
    }

    return {
      adapter: prepared.adapter,
      targetPath: prepared.targetPath,
      changed: prepared.changed,
      diff: prepared.diff,
      syncMode: prepared.syncMode,
    };
  } catch (error) {
    if (error instanceof SyncError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new SyncError(`Falha ao sincronizar adapter ${options.adapterId}: ${message}`);
  }
}

/**
 * Prepares the next sync state without writing files.
 *
 * @param options - Sync preparation options.
 * @returns Prepared sync state with before/after content and diff.
 * @throws {SyncError} When the adapter cannot be prepared.
 */
export async function prepareSyncAdapterFiles(
  options: Omit<SyncOptions, "dryRun">,
): Promise<PreparedSyncResult> {
  const adapter = getAdapter(options.adapterId);
  const absoluteTargetPath = resolveAdapterTargetPath(adapter, options);
  const targetPath = toDisplayPath(options.cwd, absoluteTargetPath, options.statePaths.scope);
  const cleanupPaths = await resolveCleanupPaths(adapter, options, absoluteTargetPath);

  if (adapter.syncMode === "managed-directory") {
    return prepareManagedDirectorySync({
      adapter,
      absoluteTargetPath,
      targetPath,
      cleanupPaths,
      options,
    });
  }

  if (options.statePaths.scope === "global") {
    throw new SyncError(
      `Adapter ${adapter.id} nao suporta sync global no momento. Use --scope local.`,
      "GLOBAL_SYNC_UNSUPPORTED",
    );
  }

  if (!adapter.syncTarget) {
    throw new SyncError(`Adapter ${adapter.id} nao define um alvo de sync.`, "SYNC_TARGET_MISSING");
  }

  const body = renderInstalledSkills(options.skills);
  const autoInjectBlock = buildAutoInjectBlock(options.skills);

  if (adapter.syncMode === "managed-block") {
    const existing = (await readText(absoluteTargetPath, "")) || "";
    const nextManaged =
      options.skills.length === 0
        ? upsertManagedBlock(existing, null)
        : upsertManagedBlock(existing, wrapManagedBlock(MANAGED_START, MANAGED_END, body));
    const nextContent = upsertAutoInjectBlock(nextManaged, options.skills.length === 0 ? null : autoInjectBlock);

    if (nextContent === "") {
      return {
        adapter: adapter.id,
        absoluteTargetPath,
        targetPath,
        cleanupPaths,
        removeTarget: true,
        changed: Boolean(normalizeComparableText(existing)) || cleanupPaths.length > 0,
        currentContent: existing,
        nextContent: "",
        diff: createManagedBlockRemovalDiff({
          targetPath,
          currentContent: existing,
          cleanupPaths: cleanupPaths.map((cleanupPath) => toDisplayPath(options.cwd, cleanupPath, options.statePaths.scope)),
        }),
        syncMode: "copy",
      };
    }

    return {
      adapter: adapter.id,
      absoluteTargetPath,
      targetPath,
      cleanupPaths,
      changed:
        normalizeComparableText(existing) !== normalizeComparableText(nextContent) || cleanupPaths.length > 0,
      currentContent: existing,
      nextContent,
      diff: createTextDiff(existing, nextContent, targetPath),
      syncMode: "copy",
    };
  }

  const nextContent = buildManagedFileContent(adapter.id, body, autoInjectBlock);
  const requestedMode = options.mode || "symlink";
  const generatedSourcePath = path.join(options.statePaths.generatedDirPath, adapter.id, path.basename(adapter.syncTarget));
  if (options.skills.length === 0) {
    const currentDescriptor = await describeTarget(absoluteTargetPath);
    const currentVisibleContent = (await readText(absoluteTargetPath, "")) || "";
    const generatedExists = await pathExists(generatedSourcePath);

    return {
      adapter: adapter.id,
      absoluteTargetPath,
      targetPath,
      cleanupPaths,
      removeTarget: true,
      changed:
        Boolean(normalizeComparableText(currentDescriptor)) ||
        Boolean(normalizeComparableText(currentVisibleContent)) ||
        generatedExists ||
        cleanupPaths.length > 0,
      currentContent: currentDescriptor,
      nextContent: "",
      diff: createManagedFileRemovalDiff({
        targetPath,
        generatedPath: toDisplayPath(options.cwd, generatedSourcePath, options.statePaths.scope),
        generatedExists,
        currentDescriptor,
        currentContent: currentVisibleContent,
        cleanupPaths: cleanupPaths.map((cleanupPath) => toDisplayPath(options.cwd, cleanupPath, options.statePaths.scope)),
      }),
      syncMode: requestedMode,
      generatedSourcePath,
    };
  }

  if (requestedMode === "copy") {
    const existing = (await readText(absoluteTargetPath, "")) || "";
    return {
      adapter: adapter.id,
      absoluteTargetPath,
      targetPath,
      cleanupPaths,
      changed:
        normalizeComparableText(existing) !== normalizeComparableText(nextContent) || cleanupPaths.length > 0,
      currentContent: existing,
      nextContent,
      diff: createTextDiff(existing, nextContent, targetPath),
      syncMode: "copy",
    };
  }

  const currentDescriptor = await describeTarget(absoluteTargetPath);
  const currentVisibleContent = (await readText(absoluteTargetPath, "")) || "";
  const nextDescriptor = `symlink -> ${toPosix(path.relative(path.dirname(absoluteTargetPath), generatedSourcePath))}\n`;
  const descriptorChanged = normalizeComparableText(currentDescriptor) !== normalizeComparableText(nextDescriptor);
  const contentChanged = normalizeComparableText(currentVisibleContent) !== normalizeComparableText(nextContent);

  return {
    adapter: adapter.id,
    absoluteTargetPath,
    targetPath,
    cleanupPaths,
    changed: descriptorChanged || contentChanged || cleanupPaths.length > 0,
    currentContent: currentDescriptor,
    nextContent,
    diff: createManagedFileDiff({
      targetPath,
      currentDescriptor,
      nextDescriptor,
      generatedPath: toDisplayPath(options.cwd, generatedSourcePath, options.statePaths.scope),
      currentContent: currentVisibleContent,
      nextContent,
      cleanupPaths: cleanupPaths.map((cleanupPath) => toDisplayPath(options.cwd, cleanupPath, options.statePaths.scope)),
    }),
    syncMode: "symlink",
    generatedSourcePath,
  };
}

/**
 * Renders installed skills into a single markdown document.
 *
 * @param skills - Installed skill documents.
 * @returns Consolidated markdown body.
 */
export function renderInstalledSkills(skills: InstalledSkillDocument[]): string {
  const sections = skills.map(renderSkillSection).filter(Boolean);
  const lines = [
    "## Skillex Managed Skills",
    "",
    "> Conteudo gerado por `skillex sync`. Edicoes aqui podem ser sobrescritas.",
    "",
  ];

  if (sections.length === 0) {
    lines.push("Nenhuma skill instalada no momento.");
  } else {
    lines.push(sections.join("\n\n---\n\n"));
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Builds the managed auto-inject block for all installed skills that request it.
 *
 * @param skills - Installed skill documents.
 * @returns Managed auto-inject block or `null` when nothing should be injected.
 */
export function buildAutoInjectBlock(skills: InstalledSkillDocument[]): string | null {
  const entries = skills
    .filter((skill) => skill.autoInject && skill.activationPrompt)
    .map((skill) => [`### ${skill.name} (\`${skill.id}\`)`, "", skill.activationPrompt!].join("\n"));

  if (entries.length === 0) {
    return null;
  }

  const body = [
    "## Skillex Auto-Inject",
    "",
    "> Prompts de ativacao gerados automaticamente por `skillex sync`.",
    "",
    entries.join("\n\n---\n\n"),
  ].join("\n");

  return wrapManagedBlock(AUTO_INJECT_START, AUTO_INJECT_END, body);
}

async function prepareManagedDirectorySync(context: {
  adapter: AdapterConfig;
  absoluteTargetPath: string;
  targetPath: string;
  cleanupPaths: string[];
  options: Omit<SyncOptions, "dryRun">;
}): Promise<PreparedSyncResult> {
  const requestedMode = context.options.mode || "symlink";
  const directoryEntries = await Promise.all(
    context.options.skills.map(async (skill): Promise<PreparedDirectoryEntry> => {
      const absoluteSkillTargetPath = path.join(context.absoluteTargetPath, skill.id);
      const targetPath = toDisplayPath(context.options.cwd, absoluteSkillTargetPath, context.options.statePaths.scope);
      const currentDescriptor = await describeTarget(absoluteSkillTargetPath);
      const nextDescriptor =
        requestedMode === "symlink"
          ? `symlink -> ${toPosix(path.relative(path.dirname(absoluteSkillTargetPath), skill.skillDir))}\n`
          : "directory\n";

      return {
        skillId: skill.id,
        sourcePath: skill.skillDir,
        absoluteTargetPath: absoluteSkillTargetPath,
        targetPath,
        currentDescriptor,
        nextDescriptor,
      };
    }),
  );

  const changed =
    directoryEntries.some(
      (entry) => normalizeComparableText(entry.currentDescriptor) !== normalizeComparableText(entry.nextDescriptor),
    ) || context.cleanupPaths.length > 0;

  return {
    adapter: context.adapter.id,
    absoluteTargetPath: context.absoluteTargetPath,
    targetPath: context.targetPath,
    cleanupPaths: context.cleanupPaths,
    changed,
    currentContent: "",
    nextContent: "",
    diff: createManagedDirectoryDiff({
      targetPath: context.targetPath,
      entries: directoryEntries,
      cleanupPaths: context.cleanupPaths.map((cleanupPath) =>
        toDisplayPath(context.options.cwd, cleanupPath, context.options.statePaths.scope),
      ),
    }),
    syncMode: requestedMode,
    directoryEntries,
  };
}

async function resolveCleanupPaths(
  adapter: AdapterConfig,
  options: Omit<SyncOptions, "dryRun">,
  absoluteTargetPath: string,
): Promise<string[]> {
  const cleanupPaths = new Set<string>();

  for (const legacyTarget of adapter.legacySyncTargets || []) {
    const resolvedLegacyPath =
      options.statePaths.scope === "global"
        ? path.join(absoluteTargetPath, path.basename(legacyTarget))
        : path.resolve(options.cwd, legacyTarget);
    if (await pathExists(resolvedLegacyPath)) {
      cleanupPaths.add(resolvedLegacyPath);
    }
  }

  if (adapter.syncMode === "managed-directory") {
    const currentSkillIds = new Set(options.skills.map((skill) => skill.id));
    for (const previousSkillId of options.previousSkillIds || []) {
      if (!currentSkillIds.has(previousSkillId)) {
        const stalePath = path.join(absoluteTargetPath, previousSkillId);
        if (await pathExists(stalePath)) {
          cleanupPaths.add(stalePath);
        }
      }
    }
  }

  return [...cleanupPaths];
}

function resolveAdapterTargetPath(adapter: AdapterConfig, options: Omit<SyncOptions, "dryRun">): string {
  if (options.statePaths.scope === "global") {
    if (!adapter.globalSyncTarget) {
      throw new SyncError(
        `Adapter ${adapter.id} nao suporta sync global no momento. Use --scope local.`,
        "GLOBAL_SYNC_UNSUPPORTED",
      );
    }
    return path.resolve(adapter.globalSyncTarget);
  }

  if (!adapter.syncTarget) {
    throw new SyncError(`Adapter ${adapter.id} nao define um alvo de sync.`, "SYNC_TARGET_MISSING");
  }
  return path.join(options.cwd, adapter.syncTarget);
}

function renderSkillSection(skill: InstalledSkillDocument): string {
  const body = skill.body.trim() || "_Sem conteudo._";
  return [`### ${skill.name} (\`${skill.id}@${skill.version}\`)`, "", body].join("\n");
}

function buildManagedFileContent(adapterId: string, body: string, autoInjectBlock: string | null): string {
  const sections = [body.trim()];
  if (autoInjectBlock) {
    sections.push(autoInjectBlock.trim());
  }

  switch (adapterId) {
    case "cursor":
      return [
        "---",
        'description: "Skillex managed skills"',
        "alwaysApply: true",
        "---",
        "",
        sections.join("\n\n"),
        "",
      ].join("\n");
    case "windsurf":
      return [
        "---",
        'description: "Skillex managed skills"',
        "trigger: always_on",
        "---",
        "",
        sections.join("\n\n"),
        "",
      ].join("\n");
    case "cline":
      return `${sections.join("\n\n")}\n`;
    default:
      throw new SyncError(`Adapter desconhecido: ${adapterId}`, "SYNC_ADAPTER_UNKNOWN");
  }
}

function wrapManagedBlock(start: string, end: string, body: string): string {
  return [start, body.trim(), end, ""].join("\n");
}

function upsertManagedBlock(existingContent: string, blockContent: string | null): string {
  return upsertNamedBlock(existingContent, blockContent, MANAGED_START, MANAGED_END, LEGACY_MANAGED_BLOCKS);
}

function upsertAutoInjectBlock(existingContent: string, autoInjectBlock: string | null): string {
  return upsertNamedBlock(existingContent, autoInjectBlock, AUTO_INJECT_START, AUTO_INJECT_END, LEGACY_AUTO_INJECT_BLOCKS);
}

function upsertNamedBlock(
  existingContent: string,
  blockContent: string | null,
  start: string,
  end: string,
  legacyBlocks: Array<{ start: string; end: string }>,
): string {
  const allBlocks = [{ start, end }, ...legacyBlocks];
  let nextContent = existingContent;

  for (const block of allBlocks) {
    const pattern = new RegExp(`${escapeRegExp(block.start)}[\\s\\S]*?${escapeRegExp(block.end)}\\n?`, "m");
    if (pattern.test(nextContent)) {
      nextContent = blockContent ? nextContent.replace(pattern, `${blockContent}\n`) : nextContent.replace(pattern, "");
    }
  }

  if (!blockContent) {
    return nextContent.trimEnd() ? `${nextContent.trimEnd()}\n` : "";
  }

  if (!nextContent.trim()) {
    return `${blockContent}\n`;
  }

  if (nextContent.includes(start)) {
    return nextContent;
  }

  return `${nextContent.trimEnd()}\n\n${blockContent}\n`;
}

async function describeTarget(targetPath: string): Promise<string> {
  const linkTarget = await readSymlink(targetPath);
  if (linkTarget) {
    return `symlink -> ${toPosix(linkTarget)}\n`;
  }

  try {
    const stats = await fs.lstat(targetPath);
    if (stats.isDirectory()) {
      return "directory\n";
    }
    if (stats.isFile()) {
      return "file\n";
    }
    return "path\n";
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function createManagedDirectoryDiff(context: {
  targetPath: string;
  entries: PreparedDirectoryEntry[];
  cleanupPaths: string[];
}): string {
  const parts: string[] = [];

  for (const entry of context.entries) {
    if (normalizeComparableText(entry.currentDescriptor) === normalizeComparableText(entry.nextDescriptor)) {
      continue;
    }
    parts.push(createTextDiff(entry.currentDescriptor, entry.nextDescriptor, entry.targetPath).trimEnd());
  }

  for (const cleanupPath of context.cleanupPaths) {
    parts.push(`- remove ${cleanupPath}`);
  }

  if (parts.length === 0) {
    return `Sem alteracoes em ${context.targetPath}.\n`;
  }

  return `${parts.join("\n")}\n`;
}

function createManagedFileDiff(context: {
  targetPath: string;
  currentDescriptor: string;
  nextDescriptor: string;
  generatedPath: string;
  currentContent: string;
  nextContent: string;
  cleanupPaths: string[];
}): string {
  const descriptorChanged =
    normalizeComparableText(context.currentDescriptor) !== normalizeComparableText(context.nextDescriptor);
  const contentChanged =
    normalizeComparableText(context.currentContent) !== normalizeComparableText(context.nextContent);

  if (!descriptorChanged && !contentChanged && context.cleanupPaths.length === 0) {
    return `Sem alteracoes em ${context.targetPath}.\n`;
  }

  const parts: string[] = [];
  if (descriptorChanged) {
    parts.push(createTextDiff(context.currentDescriptor, context.nextDescriptor, context.targetPath).trimEnd());
  }
  if (contentChanged) {
    parts.push(createTextDiff(context.currentContent, context.nextContent, context.generatedPath).trimEnd());
  }
  for (const cleanupPath of context.cleanupPaths) {
    parts.push(`- remove ${cleanupPath}`);
  }

  return `${parts.join("\n")}\n`;
}

function createManagedBlockRemovalDiff(context: {
  targetPath: string;
  currentContent: string;
  cleanupPaths: string[];
}): string {
  const parts: string[] = [];

  if (normalizeComparableText(context.currentContent) !== "") {
    parts.push(createTextDiff(context.currentContent, "", context.targetPath).trimEnd());
  }
  for (const cleanupPath of context.cleanupPaths) {
    parts.push(`- remove ${cleanupPath}`);
  }

  if (parts.length === 0) {
    return `Sem alteracoes em ${context.targetPath}.\n`;
  }

  return `${parts.join("\n")}\n`;
}

function createManagedFileRemovalDiff(context: {
  targetPath: string;
  generatedPath: string;
  generatedExists: boolean;
  currentDescriptor: string;
  currentContent: string;
  cleanupPaths: string[];
}): string {
  const parts: string[] = [];

  if (normalizeComparableText(context.currentDescriptor) !== "") {
    parts.push(createTextDiff(context.currentDescriptor, "", context.targetPath).trimEnd());
  }
  if (normalizeComparableText(context.currentContent) !== "") {
    parts.push(createTextDiff(context.currentContent, "", context.targetPath).trimEnd());
  }
  if (context.generatedExists) {
    parts.push(`- remove ${context.generatedPath}`);
  }
  for (const cleanupPath of context.cleanupPaths) {
    parts.push(`- remove ${cleanupPath}`);
  }

  return `${parts.join("\n")}\n`;
}

function createTextDiff(currentContent: string, nextContent: string, targetPath: string): string {
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

function splitLines(content: string): string[] {
  if (!content) {
    return [];
  }

  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function normalizeComparableText(content: string): string {
  if (!content) {
    return "";
  }

  return content.replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
}

function diffLines(leftLines: string[], rightLines: string[]): Array<{ type: string; line: string }> {
  const rowCount = leftLines.length + 1;
  const columnCount = rightLines.length + 1;
  const matrix = Array.from({ length: rowCount }, () => Array(columnCount).fill(0));

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const leftLine = leftLines[leftIndex]!;
      const rightLine = rightLines[rightIndex]!;
      const currentRow = matrix[leftIndex]!;
      const nextRow = matrix[leftIndex + 1]!;
      if (leftLine === rightLine) {
        currentRow[rightIndex] = (nextRow[rightIndex + 1] ?? 0) + 1;
      } else {
        currentRow[rightIndex] = Math.max(nextRow[rightIndex] ?? 0, currentRow[rightIndex + 1] ?? 0);
      }
    }
  }

  const operations: Array<{ type: string; line: string }> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    const leftLine = leftLines[leftIndex]!;
    const rightLine = rightLines[rightIndex]!;
    if (leftLine === rightLine) {
      operations.push({ type: " ", line: leftLine });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    const currentRow = matrix[leftIndex]!;
    const nextRow = matrix[leftIndex + 1]!;
    if ((nextRow[rightIndex] ?? 0) >= (currentRow[rightIndex + 1] ?? 0)) {
      operations.push({ type: "-", line: leftLine });
      leftIndex += 1;
    } else {
      operations.push({ type: "+", line: rightLine });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    operations.push({ type: "-", line: leftLines[leftIndex]! });
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    operations.push({ type: "+", line: rightLines[rightIndex]! });
    rightIndex += 1;
  }

  return operations;
}

function resolveInstalledSkillPath(cwd: string, skillPath: string): string {
  return path.isAbsolute(skillPath) ? skillPath : path.resolve(cwd, skillPath);
}

function toDisplayPath(cwd: string, targetPath: string, scope: "local" | "global"): string {
  return scope === "local" ? toPosix(path.relative(cwd, targetPath)) : toPosix(targetPath);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
