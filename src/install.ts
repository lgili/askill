import * as path from "node:path";
import { DEFAULT_AGENT_SKILLS_DIR, getStatePaths } from "./config.js";
import { confirmAction } from "./confirm.js";
import { ensureDir, pathExists, readJson, removePath, writeJson, writeText } from "./fs.js";
import { fetchOptionalJson, fetchOptionalText, fetchText } from "./http.js";
import { buildRawGitHubUrl, loadCatalog, resolveSource } from "./catalog.js";
import { resolveAdapterState } from "./adapters.js";
import { loadInstalledSkillDocuments, syncAdapterFiles } from "./sync.js";
import { parseSkillFrontmatter } from "./skill.js";
import type {
  CatalogData,
  CatalogLoader,
  CatalogSource,
  CatalogSourceInput,
  DirectGitHubRef,
  InitProjectResult,
  InstallSkillsResult,
  LockfileState,
  NowFn,
  ProjectOptions,
  RemoveSkillsResult,
  SkillDownloader,
  SkillManifest,
  SyncCommandResult,
  SyncWriteMode,
  UpdateInstalledSkillsResult,
} from "./types.js";
import { CliError, InstallError } from "./types.js";

interface InstallOptions extends ProjectOptions {
  catalogLoader?: CatalogLoader;
  downloader?: SkillDownloader;
  installAll?: boolean;
  confirm?: (() => Promise<boolean>) | undefined;
  warn?: ((message: string) => void) | undefined;
}

interface DownloadedSkillManifest extends SkillManifest {
  source: {
    repo: string;
    ref: string;
    path: string;
  };
}

interface DirectInstallPayload {
  manifest: SkillManifest;
  repo: string;
  ref: string;
  source: string;
}

/**
 * Initializes the local Skillex workspace state.
 *
 * @param options - Project initialization options.
 * @returns Lockfile initialization result.
 * @throws {InstallError} When initialization fails.
 */
export async function initProject(options: ProjectOptions = {}): Promise<InitProjectResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
    const now = getNow(options);

    await ensureDir(statePaths.stateDir);
    await ensureDir(statePaths.skillsDirPath);
    await ensureDir(statePaths.generatedDirPath);

    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
    const source = resolveSource(
      toCatalogSourceInput(options, {
        repo: options.repo || existing?.catalog?.repo,
        ref: options.ref || existing?.catalog?.ref,
      }),
    );
    const lockfile = normalizeLockfile(existing, source, now);
    lockfile.adapters = await resolveAdapterState({
      cwd,
      ...(options.adapter || lockfile.adapters.active
        ? { adapter: options.adapter || lockfile.adapters.active || undefined }
        : {}),
    });
    lockfile.catalog = {
      repo: source.repo,
      ref: source.ref,
    };
    lockfile.settings.autoSync = options.autoSync ?? lockfile.settings.autoSync;
    if (lockfile.settings.autoSync && !lockfile.adapters.active) {
      throw new InstallError(
        "Auto-sync exige um adapter ativo. Use --adapter <id> ou rode em um workspace detectavel.",
        "AUTO_SYNC_REQUIRES_ADAPTER",
      );
    }
    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);
    return { created: !existing, statePaths, lockfile };
  } catch (error) {
    throw toInstallError(error, "Falha ao inicializar o projeto");
  }
}

/**
 * Installs one or more catalog skills or direct GitHub skills into the local workspace state.
 *
 * @param requestedSkillIds - Requested skill ids or `owner/repo[@ref]` direct references.
 * @param options - Installation options.
 * @returns Install summary.
 * @throws {InstallError} When installation fails.
 */
export async function installSkills(
  requestedSkillIds: string[],
  options: InstallOptions = {},
): Promise<InstallSkillsResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
    const now = getNow(options);
    const catalogLoader = options.catalogLoader || loadCatalog;
    const downloader = options.downloader || downloadSkill;

    await ensureDir(statePaths.stateDir);
    await ensureDir(statePaths.skillsDirPath);
    await ensureDir(statePaths.generatedDirPath);

    const source = await resolveProjectSource(options);
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
    const lockfile = normalizeLockfile(existing, source, now);
    if (!lockfile.adapters.active) {
      lockfile.adapters = await resolveAdapterState({
        cwd,
        ...(options.adapter ? { adapter: options.adapter } : {}),
      });
    }

    const directRefs = requestedSkillIds
      .map((skillId) => ({ input: skillId, reference: parseDirectGitHubRef(skillId) }))
      .filter((entry) => entry.reference !== null) as Array<{ input: string; reference: DirectGitHubRef }>;
    const catalogIds = requestedSkillIds.filter((skillId) => parseDirectGitHubRef(skillId) === null);
    const installedSkills: SkillManifest[] = [];

    if (options.installAll && directRefs.length > 0) {
      throw new InstallError("Nao misture --all com referencias diretas do GitHub.", "INSTALL_ALL_WITH_DIRECT_REF");
    }

    if (options.installAll || catalogIds.length > 0) {
      const catalog = await catalogLoader(source);
      const selectedSkills = selectSkills(catalog.skills, catalogIds, options.installAll);
      for (const skill of selectedSkills) {
        await downloader(skill, catalog, statePaths.skillsDirPath);
        lockfile.installed[skill.id] = buildInstalledMetadata(skill, {
          cwd,
          statePaths,
          installedAt: now(),
          source: `catalog:${catalog.repo}@${catalog.ref}`,
        });
        installedSkills.push(skill);
      }
      lockfile.catalog = {
        repo: catalog.repo,
        ref: catalog.ref,
      };
    } else if (!directRefs.length) {
      throw new InstallError("Informe ao menos um skill-id, use --all ou passe owner/repo[@ref].", "INSTALL_REQUIRES_SKILL");
    }

    for (const directRef of directRefs) {
      if (!options.trust) {
        await confirmDirectInstall(directRef.input, options);
      }

      const directSkill = await fetchDirectGitHubSkill(directRef.reference);
      await downloadDirectGitHubSkill(directSkill, statePaths.skillsDirPath);
      lockfile.installed[directSkill.manifest.id] = buildInstalledMetadata(directSkill.manifest, {
        cwd,
        statePaths,
        installedAt: now(),
        source: directSkill.source,
      });
      installedSkills.push(directSkill.manifest);
    }

    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);
    const autoSync = await maybeAutoSync(
      withAgentSkillsDir(
        {
          cwd,
          adapter: lockfile.adapters.active,
          enabled: lockfile.settings.autoSync,
          now,
          changed: installedSkills.length > 0,
          mode: options.mode,
        },
        options.agentSkillsDir,
      ),
    );

    return {
      installedCount: installedSkills.length,
      installedSkills,
      statePaths,
      autoSync,
    };
  } catch (error) {
    throw toInstallError(error, "Falha ao instalar skills");
  }
}

/**
 * Updates installed skills from the configured remote catalog or their direct GitHub sources.
 *
 * @param requestedSkillIds - Optional subset of installed skills to update.
 * @param options - Update options.
 * @returns Update summary.
 * @throws {InstallError} When update fails.
 */
export async function updateInstalledSkills(
  requestedSkillIds: string[],
  options: InstallOptions = {},
): Promise<UpdateInstalledSkillsResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
    const now = getNow(options);
    const catalogLoader = options.catalogLoader || loadCatalog;
    const downloader = options.downloader || downloadSkill;
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError("Nenhuma instalacao local encontrada. Rode: skillex init", "LOCKFILE_MISSING");
    }

    const source = await resolveProjectSource(options);
    const lockfile = normalizeLockfile(existing, source, now);
    const skillIds = resolveInstalledSkillIds(lockfile, requestedSkillIds);
    const directIds = skillIds.filter((skillId) => {
      const metadata = lockfile.installed[skillId];
      return Boolean(metadata?.source?.startsWith("github:"));
    });
    const catalogIds = skillIds.filter((skillId) => !directIds.includes(skillId));
    const updatedSkills: SkillManifest[] = [];
    const missingFromCatalog: string[] = [];

    if (catalogIds.length > 0) {
      const catalog = await catalogLoader(source);
      const catalogById = new Map<string, SkillManifest>(catalog.skills.map((skill) => [skill.id, skill]));
      for (const skillId of catalogIds) {
        const skill = catalogById.get(skillId);
        if (!skill) {
          missingFromCatalog.push(skillId);
          continue;
        }

        await downloader(skill, catalog, statePaths.skillsDirPath);
        lockfile.installed[skill.id] = buildInstalledMetadata(skill, {
          cwd,
          statePaths,
          installedAt: now(),
          source: `catalog:${catalog.repo}@${catalog.ref}`,
        });
        updatedSkills.push(skill);
      }
      lockfile.catalog = {
        repo: catalog.repo,
        ref: catalog.ref,
      };
    }

    for (const skillId of directIds) {
      const metadata = lockfile.installed[skillId];
      const directRef = metadata?.source ? parseGitHubSource(metadata.source) : null;
      if (!directRef) {
        throw new InstallError(`Fonte direta invalida para "${skillId}".`, "DIRECT_SOURCE_INVALID");
      }

      const directSkill = await fetchDirectGitHubSkill(directRef);
      await downloadDirectGitHubSkill(directSkill, statePaths.skillsDirPath);
      lockfile.installed[directSkill.manifest.id] = buildInstalledMetadata(directSkill.manifest, {
        cwd,
        statePaths,
        installedAt: now(),
        source: directSkill.source,
      });
      updatedSkills.push(directSkill.manifest);
    }

    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);
    const autoSync = await maybeAutoSync(
      withAgentSkillsDir(
        {
          cwd,
          adapter: lockfile.adapters.active,
          enabled: lockfile.settings.autoSync,
          now,
          changed: updatedSkills.length > 0,
          mode: options.mode,
        },
        options.agentSkillsDir,
      ),
    );

    return {
      statePaths,
      updatedSkills,
      missingFromCatalog,
      autoSync,
    };
  } catch (error) {
    throw toInstallError(error, "Falha ao atualizar skills");
  }
}

/**
 * Removes installed skills from the local workspace state.
 *
 * @param requestedSkillIds - Skill ids to remove.
 * @param options - Remove options.
 * @returns Remove summary.
 * @throws {InstallError} When removal fails.
 */
export async function removeSkills(
  requestedSkillIds: string[],
  options: ProjectOptions = {},
): Promise<RemoveSkillsResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
    const now = getNow(options);
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError("Nenhuma instalacao local encontrada. Rode: skillex init", "LOCKFILE_MISSING");
    }

    if (!requestedSkillIds.length) {
      throw new InstallError("Informe ao menos um skill-id para remover.", "REMOVE_REQUIRES_SKILL");
    }

    const source = await resolveProjectSource(options);
    const lockfile = normalizeLockfile(existing, source, now);
    const removedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const skillId of requestedSkillIds) {
      const metadata = lockfile.installed[skillId];
      if (!metadata) {
        missingSkills.push(skillId);
        continue;
      }

      await removePath(path.resolve(cwd, metadata.path));
      delete lockfile.installed[skillId];
      removedSkills.push(skillId);
    }

    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);
    const autoSync = await maybeAutoSync(
      withAgentSkillsDir(
        {
          cwd,
          adapter: lockfile.adapters.active,
          enabled: lockfile.settings.autoSync,
          now,
          changed: removedSkills.length > 0,
          mode: options.mode,
        },
        options.agentSkillsDir,
      ),
    );

    return {
      statePaths,
      removedSkills,
      missingSkills,
      autoSync,
    };
  } catch (error) {
    throw toInstallError(error, "Falha ao remover skills");
  }
}

/**
 * Synchronizes installed skills to the active or requested adapter target.
 *
 * @param options - Sync options.
 * @returns Sync command result.
 * @throws {InstallError} When workspace state is missing or invalid.
 */
export async function syncInstalledSkills(options: ProjectOptions = {}): Promise<SyncCommandResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
    const now = getNow(options);
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError("Nenhuma instalacao local encontrada. Rode: skillex init", "LOCKFILE_MISSING");
    }

    const source = await resolveProjectSource(options);
    const lockfile = normalizeLockfile(existing, source, now);
    const adapterId = options.adapter || lockfile.adapters.active;
    if (!adapterId) {
      throw new InstallError(
        "Nenhum adapter ativo definido. Rode: skillex init --adapter <id> ou use --adapter.",
        "ACTIVE_ADAPTER_MISSING",
      );
    }

    const skills = await loadInstalledSkillDocuments({
      cwd,
      lockfile,
    });
    const syncResult = await syncAdapterFiles({
      cwd,
      adapterId,
      statePaths,
      skills,
      ...(options.mode ? { mode: options.mode } : {}),
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    });

    if (options.dryRun) {
      return {
        statePaths,
        sync: {
          adapter: syncResult.adapter,
          targetPath: syncResult.targetPath,
        },
        skillCount: skills.length,
        changed: syncResult.changed,
        diff: syncResult.diff,
        dryRun: true,
        syncMode: syncResult.syncMode,
      };
    }

    lockfile.sync = {
      adapter: syncResult.adapter,
      targetPath: syncResult.targetPath,
      syncedAt: now(),
    };
    lockfile.syncMode = syncResult.syncMode;
    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);

    return {
      statePaths,
      sync: lockfile.sync,
      skillCount: skills.length,
      changed: syncResult.changed,
      diff: syncResult.diff,
      dryRun: false,
      syncMode: syncResult.syncMode,
    };
  } catch (error) {
    throw toInstallError(error, "Falha ao sincronizar skills");
  }
}

/**
 * Reads the local workspace lockfile when it exists.
 *
 * @param options - Project lookup options.
 * @returns Normalized lockfile state or `null` when no install exists.
 */
export async function getInstalledSkills(options: ProjectOptions = {}): Promise<LockfileState | null> {
  const cwd = options.cwd || process.cwd();
  const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
  if (!(await pathExists(statePaths.lockfilePath))) {
    return null;
  }
  const source = resolveSource(toCatalogSourceInput(options, { repo: options.repo, ref: options.ref }));
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
  if (!existing) {
    return null;
  }
  return normalizeLockfile(existing, source, getNow(options));
}

/**
 * Resolves the effective project catalog source using CLI overrides or local state.
 *
 * @param options - Project lookup options.
 * @returns Resolved catalog source.
 */
export async function resolveProjectSource(options: ProjectOptions = {}): Promise<CatalogSource> {
  const cwd = options.cwd || process.cwd();
  const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

  return resolveSource(
    toCatalogSourceInput(options, {
      repo: options.repo || existing?.catalog?.repo,
      ref: options.ref || existing?.catalog?.ref,
    }),
  );
}

/**
 * Parses a direct GitHub install reference in `owner/repo[@ref]` format.
 *
 * @param input - User-supplied install argument.
 * @returns Parsed direct GitHub reference or `null` when the value is not a direct ref.
 */
export function parseDirectGitHubRef(input: string): DirectGitHubRef | null {
  if (!input || input.startsWith("http://") || input.startsWith("https://")) {
    return null;
  }

  const match = input.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:@(.+))?$/);
  if (!match) {
    return null;
  }

  return {
    owner: match[1]!,
    repo: match[2]!,
    ref: match[3] || "main",
  };
}

function createBaseLockfile(source: CatalogSource, now: NowFn): LockfileState {
  return {
    formatVersion: 1,
    createdAt: now(),
    updatedAt: now(),
    catalog: {
      repo: source.repo,
      ref: source.ref,
    },
    adapters: {
      active: null,
      detected: [],
    },
    settings: {
      autoSync: false,
    },
    sync: null,
    syncMode: null,
    installed: {},
  };
}

function selectSkills(allSkills: SkillManifest[], requestedSkillIds: string[], installAll = false): SkillManifest[] {
  if (installAll) {
    return allSkills;
  }

  if (!requestedSkillIds.length) {
    return [];
  }

  const byId = new Map<string, SkillManifest>(allSkills.map((skill) => [skill.id, skill]));
  const selected = requestedSkillIds.map((skillId) => {
    const skill = byId.get(skillId);
    if (!skill) {
      throw new InstallError(`Skill "${skillId}" nao encontrada no catalogo remoto.`, "SKILL_NOT_FOUND");
    }
    return skill;
  });

  return selected;
}

async function downloadSkill(skill: SkillManifest, catalog: CatalogData, skillsDirPath: string): Promise<void> {
  const skillTargetDir = path.join(skillsDirPath, skill.id);
  await removePath(skillTargetDir);
  await ensureDir(skillTargetDir);

  for (const relativePath of skill.files) {
    const remotePath = skill.path ? path.posix.join(skill.path, relativePath) : relativePath;
    const rawUrl = buildRawGitHubUrl(catalog.repo, catalog.ref, remotePath);
    const content = await fetchText(rawUrl, { headers: { Accept: "text/plain" } });
    const localPath = path.join(skillTargetDir, relativePath);
    await writeText(localPath, content);
  }

  await writeDownloadedManifest(skillTargetDir, {
    ...skill,
    source: {
      repo: catalog.repo,
      ref: catalog.ref,
      path: skill.path,
    },
  });
}

async function downloadDirectGitHubSkill(skill: DirectInstallPayload, skillsDirPath: string): Promise<void> {
  const skillTargetDir = path.join(skillsDirPath, skill.manifest.id);
  await removePath(skillTargetDir);
  await ensureDir(skillTargetDir);

  for (const relativePath of skill.manifest.files) {
    const remotePath = skill.manifest.path ? path.posix.join(skill.manifest.path, relativePath) : relativePath;
    const rawUrl = buildRawGitHubUrl(skill.repo, skill.ref, remotePath);
    const content = await fetchText(rawUrl, { headers: { Accept: "text/plain" } });
    await writeText(path.join(skillTargetDir, relativePath), content);
  }

  await writeDownloadedManifest(skillTargetDir, {
    ...skill.manifest,
    source: {
      repo: skill.repo,
      ref: skill.ref,
      path: skill.manifest.path,
    },
  });
}

async function writeDownloadedManifest(skillTargetDir: string, manifest: DownloadedSkillManifest): Promise<void> {
  await writeJson(path.join(skillTargetDir, "skill.json"), manifest);
}

async function fetchDirectGitHubSkill(reference: DirectGitHubRef): Promise<DirectInstallPayload> {
  const repoId = `${reference.owner}/${reference.repo}`;
  const manifestUrl = buildRawGitHubUrl(repoId, reference.ref, "skill.json");
  const manifest =
    await fetchOptionalJson<Partial<SkillManifest> & { scripts?: Record<string, string> }>(manifestUrl, {
      headers: { Accept: "application/json" },
    });

  if (manifest) {
    return {
      repo: repoId,
      ref: reference.ref,
      source: `github:${repoId}@${reference.ref}`,
      manifest: normalizeDirectManifest(manifest, reference),
    };
  }

  const skillMarkdown = await fetchOptionalText(buildRawGitHubUrl(repoId, reference.ref, "SKILL.md"), {
    headers: { Accept: "text/plain" },
  });
  if (!skillMarkdown) {
    throw new InstallError(`Nenhum skill.json ou SKILL.md encontrado em ${repoId}@${reference.ref}.`, "DIRECT_SKILL_NOT_FOUND");
  }

  const frontmatter = parseSkillFrontmatter(skillMarkdown);
  return {
    repo: repoId,
    ref: reference.ref,
    source: `github:${repoId}@${reference.ref}`,
    manifest: {
      id: normalizeRepoSkillId(reference.repo),
      name: frontmatter.name || toTitleCase(reference.repo),
      version: "0.1.0",
      description: frontmatter.description || `Skill instalada diretamente de ${repoId}.`,
      author: reference.owner,
      tags: [],
      compatibility: [],
      entry: "SKILL.md",
      path: "",
      files: ["SKILL.md"],
    },
  };
}

function normalizeDirectManifest(
  manifest: Partial<SkillManifest> & { scripts?: Record<string, string> },
  reference: DirectGitHubRef,
): SkillManifest {
  return {
    id: manifest.id || normalizeRepoSkillId(reference.repo),
    name: manifest.name || toTitleCase(reference.repo),
    version: manifest.version || "0.1.0",
    description: manifest.description || `Skill instalada diretamente de ${reference.owner}/${reference.repo}.`,
    author: manifest.author || reference.owner,
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    compatibility: Array.isArray(manifest.compatibility) ? manifest.compatibility : [],
    entry: manifest.entry || "SKILL.md",
    path: manifest.path || "",
    files: Array.isArray(manifest.files) && manifest.files.length > 0 ? manifest.files : [manifest.entry || "SKILL.md"],
    ...(manifest.scripts ? { scripts: manifest.scripts } : {}),
  };
}

function normalizeLockfile(existing: LockfileState | null, source: CatalogSource, now: NowFn): LockfileState {
  if (!existing) {
    return createBaseLockfile(source, now);
  }

  const detectedAdapters = Array.isArray(existing.adapters)
    ? existing.adapters
    : Array.isArray(existing.adapters?.detected)
      ? existing.adapters.detected
      : [];

  const activeAdapter = Array.isArray(existing.adapters)
    ? existing.adapters[0] || null
    : existing.adapters?.active || detectedAdapters[0] || null;

  return {
    formatVersion: Number(existing.formatVersion || 1),
    createdAt: existing.createdAt || now(),
    updatedAt: existing.updatedAt || now(),
    catalog: {
      repo: existing.catalog?.repo || source.repo,
      ref: existing.catalog?.ref || source.ref,
    },
    adapters: {
      active: activeAdapter,
      detected: [...new Set(detectedAdapters.filter(Boolean))],
    },
    settings: {
      autoSync: Boolean(existing.settings?.autoSync),
    },
    sync: existing.sync || null,
    syncMode: existing.syncMode || null,
    installed: existing.installed || {},
  };
}

function buildInstalledMetadata(
  skill: SkillManifest,
  context: { cwd: string; statePaths: ReturnType<typeof getStatePaths>; installedAt: string; source: string },
): LockfileState["installed"][string] {
  return {
    name: skill.name,
    version: skill.version,
    path: toPosix(path.relative(context.cwd, path.join(context.statePaths.skillsDirPath, skill.id))),
    installedAt: context.installedAt,
    compatibility: skill.compatibility,
    tags: skill.tags,
    source: context.source,
  };
}

function resolveInstalledSkillIds(lockfile: LockfileState, requestedSkillIds: string[]): string[] {
  const installedIds = Object.keys(lockfile.installed || {});
  if (installedIds.length === 0) {
    throw new InstallError("Nenhuma skill instalada para atualizar.", "NO_SKILLS_INSTALLED");
  }

  if (!requestedSkillIds.length) {
    return installedIds;
  }

  const installedSet = new Set(installedIds);
  for (const skillId of requestedSkillIds) {
    if (!installedSet.has(skillId)) {
      throw new InstallError(`Skill "${skillId}" nao esta instalada localmente.`, "SKILL_NOT_INSTALLED");
    }
  }

  return requestedSkillIds;
}

function getNow(options: ProjectOptions): NowFn {
  return options.now || (() => new Date().toISOString());
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

async function maybeAutoSync(options: {
  cwd: string;
  agentSkillsDir?: string | undefined;
  adapter: string | null;
  enabled: boolean;
  now: NowFn;
  changed: boolean;
  mode?: SyncWriteMode | undefined;
}): Promise<SyncCommandResult | null> {
  if (!options.enabled || !options.changed) {
    return null;
  }

  return syncInstalledSkills({
    cwd: options.cwd,
    ...(options.agentSkillsDir ? { agentSkillsDir: options.agentSkillsDir } : {}),
    ...(options.adapter ? { adapter: options.adapter } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    now: options.now,
  });
}

function toCatalogSourceInput(
  options: ProjectOptions,
  overrides: { repo?: string | undefined; ref?: string | undefined } = {},
): CatalogSourceInput {
  const input: CatalogSourceInput = {};

  if (options.owner) {
    input.owner = options.owner;
  }
  if (options.repoName) {
    input.repoName = options.repoName;
  }
  if (overrides.repo ?? options.repo) {
    input.repo = overrides.repo ?? options.repo;
  }
  if (overrides.ref ?? options.ref) {
    input.ref = overrides.ref ?? options.ref;
  }
  if (options.catalogPath) {
    input.catalogPath = options.catalogPath;
  }
  if (options.skillsDir) {
    input.skillsDir = options.skillsDir;
  }
  if (options.catalogUrl !== undefined) {
    input.catalogUrl = options.catalogUrl;
  }

  return input;
}

function withAgentSkillsDir<T extends { agentSkillsDir?: string | undefined }>(
  options: Omit<T, "agentSkillsDir">,
  agentSkillsDir: string | undefined,
): T {
  return {
    ...options,
    ...(agentSkillsDir ? { agentSkillsDir } : {}),
  } as T;
}

async function confirmDirectInstall(skillRef: string, options: InstallOptions): Promise<void> {
  const warning = `Aviso: ${skillRef} sera instalado diretamente do GitHub e nao foi verificado pelo catalogo ativo.`;
  (options.warn || console.error)(warning);

  const confirm = options.confirm || (() => confirmAction("Continuar com a instalacao direta?"));
  const accepted = await confirm();
  if (!accepted) {
    throw new InstallError("Instalacao direta cancelada pelo usuario.", "INSTALL_CANCELLED");
  }
}

function parseGitHubSource(source: string): DirectGitHubRef | null {
  if (!source.startsWith("github:")) {
    return null;
  }

  const withoutPrefix = source.slice("github:".length);
  const separatorIndex = withoutPrefix.lastIndexOf("@");
  if (separatorIndex <= 0) {
    return null;
  }

  return parseDirectGitHubRef(
    `${withoutPrefix.slice(0, separatorIndex)}@${withoutPrefix.slice(separatorIndex + 1)}`,
  );
}

function normalizeRepoSkillId(repo: string): string {
  return repo.trim().toLowerCase();
}

function toTitleCase(skillId: string): string {
  return skillId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toInstallError(error: unknown, fallbackMessage: string): InstallError {
  if (error instanceof InstallError) {
    return error;
  }
  if (error instanceof CliError) {
    return new InstallError(error.message, error.code);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new InstallError(`${fallbackMessage}: ${message}`);
}
