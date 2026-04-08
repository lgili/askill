import * as path from "node:path";
import {
  DEFAULT_AGENT_SKILLS_DIR,
  DEFAULT_INSTALL_SCOPE,
  DEFAULT_REF,
  DEFAULT_REPO,
  getScopedStatePaths,
} from "./config.js";
import { confirmAction } from "./confirm.js";
import { ensureDir, pathExists, readJson, removePath, writeJson, writeText } from "./fs.js";
import { fetchOptionalJson, fetchOptionalText, fetchText } from "./http.js";
import { buildRawGitHubUrl, loadCatalog, resolveSource } from "./catalog.js";
import { resolveAdapterState } from "./adapters.js";
import { loadInstalledSkillDocuments, syncAdapterFiles } from "./sync.js";
import { parseSkillFrontmatter } from "./skill.js";
import type {
  AggregatedCatalogData,
  CatalogData,
  CatalogLoader,
  CatalogSource,
  CatalogSourceInput,
  DirectGitHubRef,
  InitProjectResult,
  InstallSkillsResult,
  LockfileSource,
  LockfileState,
  NowFn,
  ProjectOptions,
  RemoveSkillsResult,
  ResolvedSkillSelection,
  StatePaths,
  SourcedSkillManifest,
  SkillDownloader,
  SkillManifest,
  InstallScope,
  SyncCommandResult,
  SyncHistory,
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
    const statePaths = resolveStatePathsForOptions(cwd, options);
    const now = getNow(options);

    await ensureDir(statePaths.stateDir);
    await ensureDir(statePaths.skillsDirPath);
    await ensureDir(statePaths.generatedDirPath);

    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
    const source = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
    const lockfile = normalizeLockfile(existing, source, now);
    lockfile.adapters = await resolveAdapterState({
      cwd,
      ...(options.adapter || lockfile.adapters.active
        ? { adapter: options.adapter || lockfile.adapters.active || undefined }
        : {}),
    });
    if (options.repo) {
      lockfile.sources = [toLockfileSource(source)];
    }
    lockfile.settings.autoSync = options.autoSync ?? lockfile.settings.autoSync;
    if (lockfile.settings.autoSync && !lockfile.adapters.active) {
      throw new InstallError(
        "Auto-sync requires an active adapter. Use --adapter <id> or run in a detectable workspace.",
        "AUTO_SYNC_REQUIRES_ADAPTER",
      );
    }
    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);

    // Create .gitignore for the local state directory on first init.
    if (statePaths.scope === "local") {
      const gitignorePath = path.join(statePaths.stateDir, ".gitignore");
      if (!(await pathExists(gitignorePath))) {
        await writeText(gitignorePath, ".cache/\n*.log\n");
      }
    }

    return { created: !existing, statePaths, lockfile };
  } catch (error) {
    throw toInstallError(error, "Failed to initialize project");
  }
}

/**
 * Installs one or more catalog skills or direct GitHub skills into the selected Skillex state.
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
    const statePaths = resolveStatePathsForOptions(cwd, options);
    const now = getNow(options);
    const catalogLoader = options.catalogLoader || loadCatalog;
    const downloader = options.downloader || downloadSkill;

    await ensureDir(statePaths.stateDir);
    await ensureDir(statePaths.skillsDirPath);
    await ensureDir(statePaths.generatedDirPath);

    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
    const overrideSource = options.repo ? resolveSource(toCatalogSourceInput(options, { repo: options.repo, ref: options.ref })) : null;
    const defaultSource = overrideSource || resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
    const lockfile = normalizeLockfile(existing, defaultSource, now);
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
      throw new InstallError("Do not mix --all with direct GitHub references.", "INSTALL_ALL_WITH_DIRECT_REF");
    }

    if (options.installAll || catalogIds.length > 0) {
      const selectedSkills = await selectSkillsFromSources(lockfile, catalogIds, options, catalogLoader);
      const totalCount = selectedSkills.length + directRefs.length;
      for (let i = 0; i < selectedSkills.length; i++) {
        const selection = selectedSkills[i]!;
        const skill = selection.skill;
        options.onProgress?.(i + 1, totalCount, skill.id);
        await downloader(skill, selection.catalog, statePaths.skillsDirPath);
        lockfile.installed[skill.id] = buildInstalledMetadata(skill, {
          cwd,
          statePaths,
          installedAt: now(),
          source: `catalog:${selection.catalog.repo}@${selection.catalog.ref}`,
        });
        installedSkills.push(skill);
      }
    } else if (!directRefs.length) {
      throw new InstallError("Provide at least one skill-id, use --all, or pass owner/repo[@ref].", "INSTALL_REQUIRES_SKILL");
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
          scope: options.scope,
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
    throw toInstallError(error, "Failed to install skills");
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
    const statePaths = resolveStatePathsForOptions(cwd, options);
    const now = getNow(options);
    const catalogLoader = options.catalogLoader || loadCatalog;
    const downloader = options.downloader || downloadSkill;
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError(
        statePaths.scope === "global"
          ? "No global installation found. Run: skillex init --global --adapter <id>"
          : "No local installation found. Run: skillex init",
        "LOCKFILE_MISSING",
      );
    }

    const defaultSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
    const lockfile = normalizeLockfile(existing, defaultSource, now);
    const skillIds = resolveInstalledSkillIds(lockfile, requestedSkillIds);
    const directIds = skillIds.filter((skillId) => {
      const metadata = lockfile.installed[skillId];
      return Boolean(metadata?.source?.startsWith("github:"));
    });
    const catalogIds = skillIds.filter((skillId) => !directIds.includes(skillId));
    const updatedSkills: SkillManifest[] = [];
    const missingFromCatalog: string[] = [];

    if (catalogIds.length > 0) {
      for (const skillId of catalogIds) {
        const metadata = lockfile.installed[skillId];
        const catalogSelection = await resolveInstalledCatalogSelection(skillId, metadata?.source, options, lockfile, catalogLoader);
        if (!catalogSelection) {
          missingFromCatalog.push(skillId);
          continue;
        }

        const skill = catalogSelection.skill;
        await downloader(skill, catalogSelection.catalog, statePaths.skillsDirPath);
        lockfile.installed[skill.id] = buildInstalledMetadata(skill, {
          cwd,
          statePaths,
          installedAt: now(),
          source: `catalog:${catalogSelection.catalog.repo}@${catalogSelection.catalog.ref}`,
        });
        updatedSkills.push(skill);
      }
    }

    for (const skillId of directIds) {
      const metadata = lockfile.installed[skillId];
      const directRef = metadata?.source ? parseGitHubSource(metadata.source) : null;
      if (!directRef) {
        throw new InstallError(`Invalid direct source for "${skillId}".`, "DIRECT_SOURCE_INVALID");
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
          scope: options.scope,
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
    throw toInstallError(error, "Failed to update skills");
  }
}

/**
 * Removes installed skills from the selected Skillex state.
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
    const statePaths = resolveStatePathsForOptions(cwd, options);
    const now = getNow(options);
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError(
        statePaths.scope === "global"
          ? "No global installation found. Run: skillex init --global --adapter <id>"
          : "No local installation found. Run: skillex init",
        "LOCKFILE_MISSING",
      );
    }

    if (!requestedSkillIds.length) {
      throw new InstallError("Provide at least one skill-id to remove.", "REMOVE_REQUIRES_SKILL");
    }

    const defaultSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
    const lockfile = normalizeLockfile(existing, defaultSource, now);
    const removedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const skillId of requestedSkillIds) {
      const metadata = lockfile.installed[skillId];
      if (!metadata) {
        missingSkills.push(skillId);
        continue;
      }

      await removePath(resolveInstalledSkillPath(cwd, metadata.path));
      delete lockfile.installed[skillId];
      removedSkills.push(skillId);
    }

    lockfile.updatedAt = now();
    await writeJson(statePaths.lockfilePath, lockfile);
    const autoSync = await maybeSyncAfterRemove(
      withAgentSkillsDir(
        {
          cwd,
          scope: options.scope,
          adapter: lockfile.adapters.active,
          syncHistory: lockfile.syncHistory,
          legacySync: lockfile.sync,
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
    throw toInstallError(error, "Failed to remove skills");
  }
}

/**
 * Synchronizes installed skills to the active or requested adapter target.
 *
 * @param options - Sync options.
 * @returns Sync command result.
 * @throws {InstallError} When the selected install scope is missing or invalid.
 */
export async function syncInstalledSkills(options: ProjectOptions = {}): Promise<SyncCommandResult> {
  try {
    const cwd = options.cwd || process.cwd();
    const statePaths = resolveStatePathsForOptions(cwd, options);
    const now = getNow(options);
    const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

    if (!existing) {
      throw new InstallError(
        statePaths.scope === "global"
          ? "No global installation found. Run: skillex init --global --adapter <id>"
          : "No local installation found. Run: skillex init",
        "LOCKFILE_MISSING",
      );
    }

    const defaultSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
    const lockfile = normalizeLockfile(existing, defaultSource, now);
    const adapterId = options.adapter || lockfile.adapters.active;
    if (!adapterId) {
      throw new InstallError(
        "No active adapter configured. Run: skillex init --adapter <id> or use --adapter.",
        "ACTIVE_ADAPTER_MISSING",
      );
    }

    const skills = await loadInstalledSkillDocuments({
      cwd,
      lockfile,
    });
    const syncResult = await syncAdapterFiles({
      cwd,
      scope: statePaths.scope,
      adapterId,
      statePaths,
      skills,
      previousSkillIds: lockfile.syncHistory[adapterId]?.skillIds || lockfile.sync?.skillIds || [],
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

    const syncMetadata = {
      adapter: syncResult.adapter,
      targetPath: syncResult.targetPath,
      syncedAt: now(),
      skillIds: skills.map((skill) => skill.id),
    };
    lockfile.sync = syncMetadata;
    lockfile.syncHistory = {
      ...lockfile.syncHistory,
      [adapterId]: syncMetadata,
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
    throw toInstallError(error, "Failed to synchronize skills");
  }
}

/**
 * Reads the selected Skillex lockfile when it exists.
 *
 * @param options - Project lookup options.
 * @returns Normalized lockfile state or `null` when no install exists.
 */
export async function getInstalledSkills(options: ProjectOptions = {}): Promise<LockfileState | null> {
  const cwd = options.cwd || process.cwd();
  const statePaths = resolveStatePathsForOptions(cwd, options);
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
  const statePaths = resolveStatePathsForOptions(cwd, options);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

  return resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
}

/**
 * Resolves all effective project sources using CLI overrides or local state.
 *
 * @param options - Project lookup options.
 * @returns Resolved source list.
 */
export async function resolveProjectSources(options: ProjectOptions = {}): Promise<LockfileSource[]> {
  const cwd = options.cwd || process.cwd();
  const statePaths = resolveStatePathsForOptions(cwd, options);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

  if (options.repo) {
    return [toLockfileSource(resolveSource(toCatalogSourceInput(options, { repo: options.repo, ref: options.ref })))];
  }

  return getLockfileSources(existing, resolveSource(toCatalogSourceInput(options)));
}

/**
 * Aggregates skills from all effective project sources.
 *
 * @param options - Project lookup options.
 * @param catalogLoader - Optional catalog loader override.
 * @returns Aggregated skills grouped by source metadata.
 */
export async function loadProjectCatalogs(
  options: ProjectOptions = {},
  catalogLoader: CatalogLoader = loadCatalog,
): Promise<AggregatedCatalogData> {
  const sources = await resolveProjectSources(options);
  const loaded = await Promise.all(
    sources.map(async (source) => {
      const catalog = await catalogLoader(resolveSource(toCatalogSourceInput(options, source)));
      const skills: SourcedSkillManifest[] = catalog.skills.map((skill) => ({
        ...skill,
        source: {
          repo: source.repo,
          ref: source.ref,
          ...(source.label ? { label: source.label } : {}),
        },
      }));
      return { source, catalog, skills };
    }),
  );

  return {
    formatVersion: 1,
    skills: loaded.flatMap((entry) => entry.skills),
    sources: loaded.map((entry) => ({ ...entry.source, skillCount: entry.catalog.skills.length })),
  };
}

/**
 * Adds a source to the workspace lockfile.
 *
 * @param sourceInput - Repository to add.
 * @param options - Project options.
 * @returns Updated normalized lockfile.
 */
export async function addProjectSource(
  sourceInput: { repo: string; ref?: string | undefined; label?: string | undefined },
  options: ProjectOptions = {},
): Promise<LockfileState> {
  const cwd = options.cwd || process.cwd();
  const statePaths = resolveStatePathsForOptions(cwd, options);
  const now = getNow(options);
  await ensureDir(statePaths.stateDir);
  await ensureDir(statePaths.skillsDirPath);
  await ensureDir(statePaths.generatedDirPath);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
  const fallbackSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
  const lockfile = normalizeLockfile(existing, fallbackSource, now);
  const source = toLockfileSource(resolveSource(toCatalogSourceInput(options, sourceInput)), sourceInput.label);
  if (lockfile.sources.some((entry) => entry.repo === source.repo && entry.ref === source.ref)) {
    throw new InstallError(`Source \"${source.repo}@${source.ref}\" is already configured.`, "SOURCE_ALREADY_EXISTS");
  }
  lockfile.sources.push(source);
  lockfile.updatedAt = now();
  await writeJson(statePaths.lockfilePath, lockfile);
  return lockfile;
}

/**
 * Removes a source from the workspace lockfile.
 *
 * @param repo - Repository to remove.
 * @param options - Project options.
 * @returns Updated normalized lockfile.
 */
export async function removeProjectSource(repo: string, options: ProjectOptions = {}): Promise<LockfileState> {
  const cwd = options.cwd || process.cwd();
  const statePaths = resolveStatePathsForOptions(cwd, options);
  const now = getNow(options);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);

  if (!existing) {
    throw new InstallError(
      statePaths.scope === "global"
        ? "No global installation found. Run: skillex init --global --adapter <id>"
        : "No local installation found. Run: skillex init",
      "LOCKFILE_MISSING",
    );
  }

  const fallbackSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
  const lockfile = normalizeLockfile(existing, fallbackSource, now);
  const remaining = lockfile.sources.filter((entry) => entry.repo !== repo);
  if (remaining.length === lockfile.sources.length) {
    throw new InstallError(`Source \"${repo}\" is not configured.`, "SOURCE_NOT_FOUND");
  }
  if (remaining.length === 0) {
    throw new InstallError("At least one source must remain configured.", "SOURCE_REMOVE_LAST");
  }
  lockfile.sources = remaining;
  lockfile.updatedAt = now();
  await writeJson(statePaths.lockfilePath, lockfile);
  return lockfile;
}

/**
 * Lists configured workspace sources.
 *
 * @param options - Project options.
 * @returns Normalized source list.
 */
export async function listProjectSources(options: ProjectOptions = {}): Promise<LockfileSource[]> {
  const cwd = options.cwd || process.cwd();
  const statePaths = resolveStatePathsForOptions(cwd, options);
  const existing = await readJson<LockfileState>(statePaths.lockfilePath, null);
  const fallbackSource = resolveSource(toCatalogSourceInput(options, resolvePrimarySourceOverride(options, existing)));
  return getLockfileSources(existing, fallbackSource);
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
    sources: [toLockfileSource(source)],
    adapters: {
      active: null,
      detected: [],
    },
    settings: {
      autoSync: false,
    },
    sync: null,
    syncHistory: {},
    syncMode: null,
    installed: {},
  };
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
    throw new InstallError(`No skill.json or SKILL.md found at ${repoId}@${reference.ref}.`, "DIRECT_SKILL_NOT_FOUND");
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
    sources: getLockfileSources(existing, source),
    adapters: {
      active: activeAdapter,
      detected: [...new Set(detectedAdapters.filter(Boolean))],
    },
    settings: {
      autoSync: Boolean(existing.settings?.autoSync),
    },
    sync: existing.sync || null,
    syncHistory: normalizeSyncHistory(existing),
    syncMode: existing.syncMode || null,
    installed: existing.installed || {},
  };
}

function normalizeSyncHistory(existing: LockfileState | null): SyncHistory {
  const history: SyncHistory = {};
  const candidate =
    existing && "syncHistory" in existing && existing.syncHistory && typeof existing.syncHistory === "object"
      ? existing.syncHistory
      : null;

  if (candidate) {
    for (const [adapterId, metadata] of Object.entries(candidate)) {
      if (!metadata || typeof metadata !== "object") {
        continue;
      }
      if (!("adapter" in metadata) || !("targetPath" in metadata) || !("syncedAt" in metadata)) {
        continue;
      }
      history[adapterId] = metadata as SyncHistory[string];
    }
  }

  if (existing?.sync?.adapter && !history[existing.sync.adapter]) {
    history[existing.sync.adapter] = existing.sync;
  }

  return history;
}

/** Repos that are known placeholder values written by older versions and must be ignored. */
const PLACEHOLDER_REPOS = new Set(["owner/repo"]);

function getLockfileSources(existing: LockfileState | null, fallbackSource: CatalogSource): LockfileSource[] {
  const legacyCatalog = getLegacyCatalog(existing);
  const configuredSources = Array.isArray(existing?.sources)
    ? existing.sources
        .filter((entry): entry is LockfileSource => Boolean(entry?.repo))
        .filter((entry) => !PLACEHOLDER_REPOS.has(entry.repo))
        .map((entry) => ({
          repo: entry.repo,
          ref: entry.ref || DEFAULT_REF,
          ...(entry.label ? { label: entry.label } : {}),
        }))
    : [];

  if (configuredSources.length > 0) {
    return dedupeSources(configuredSources);
  }

  if (legacyCatalog?.repo && !PLACEHOLDER_REPOS.has(legacyCatalog.repo)) {
    return dedupeSources([
      {
        repo: legacyCatalog.repo,
        ref: legacyCatalog.ref || DEFAULT_REF,
      },
    ]);
  }

  return [toLockfileSource(fallbackSource)];
}

function getLegacyCatalog(existing: LockfileState | null): { repo?: string; ref?: string } | null {
  if (!existing || !("catalog" in existing)) {
    return null;
  }
  const legacyState = existing as LockfileState & { catalog?: { repo?: string; ref?: string } };
  return legacyState.catalog || null;
}

function dedupeSources(sources: LockfileSource[]): LockfileSource[] {
  const unique = new Map<string, LockfileSource>();
  for (const source of sources) {
    const key = `${source.repo}@${source.ref}`;
    if (!unique.has(key)) {
      unique.set(key, source);
    }
  }
  return [...unique.values()];
}

function toLockfileSource(source: CatalogSource, label?: string): LockfileSource {
  return {
    repo: source.repo,
    ref: source.ref,
    ...((label || source.repo === DEFAULT_REPO) && (label || source.repo === DEFAULT_REPO)
      ? { label: label || "official" }
      : {}),
  };
}

function resolvePrimarySourceOverride(
  options: ProjectOptions,
  existing: LockfileState | null,
): { repo?: string; ref?: string } {
  const sources = getLockfileSources(existing, resolveSource(toCatalogSourceInput(options)));
  const repo = options.repo || sources[0]?.repo;
  const ref = options.ref || sources[0]?.ref;
  return {
    ...(repo ? { repo } : {}),
    ...(ref ? { ref } : {}),
  };
}

async function selectSkillsFromSources(
  lockfile: LockfileState,
  requestedSkillIds: string[],
  options: InstallOptions,
  catalogLoader: CatalogLoader,
): Promise<ResolvedSkillSelection[]> {
  const sources = options.repo
    ? [toLockfileSource(resolveSource(toCatalogSourceInput(options, { repo: options.repo, ref: options.ref })))]
    : lockfile.sources;
  const catalogs = await Promise.all(
    sources.map(async (source) => ({
      source,
      catalog: await catalogLoader(resolveSource(toCatalogSourceInput(options, source))),
    })),
  );

  if (options.installAll) {
    const selections = catalogs.flatMap(({ source, catalog }) => catalog.skills.map((skill) => ({ skill, catalog, source })));
    const seen = new Map<string, string>();
    for (const entry of selections) {
      const currentSource = `${entry.source.repo}@${entry.source.ref}`;
      const previousSource = seen.get(entry.skill.id);
      if (previousSource) {
        throw new InstallError(
          `Skill "${entry.skill.id}" exists in multiple sources: ${previousSource}, ${currentSource}. Use --repo to choose one source at a time.`,
          "SKILL_AMBIGUOUS_SOURCE",
        );
      }
      seen.set(entry.skill.id, currentSource);
    }
    return selections;
  }

  if (!requestedSkillIds.length) {
    return [];
  }

  return requestedSkillIds.map((skillId) => {
    const matches = catalogs.flatMap(({ source, catalog }) => {
      const skill = catalog.skills.find((entry) => entry.id === skillId);
      return skill ? [{ skill, catalog, source }] : [];
    });

    if (matches.length === 0) {
      throw new InstallError(`Skill "${skillId}" not found in the configured sources.`, "SKILL_NOT_FOUND");
    }

    if (matches.length > 1) {
      const sourceList = matches.map((entry) => `${entry.source.repo}@${entry.source.ref}`).join(", ");
      throw new InstallError(
        `Skill "${skillId}" exists in multiple sources: ${sourceList}. Use --repo to choose one.`,
        "SKILL_AMBIGUOUS_SOURCE",
      );
    }

    return matches[0]!;
  });
}

async function resolveInstalledCatalogSelection(
  skillId: string,
  sourceRef: string | undefined,
  options: InstallOptions,
  lockfile: LockfileState,
  catalogLoader: CatalogLoader,
): Promise<ResolvedSkillSelection | null> {
  const explicitSource = sourceRef?.startsWith("catalog:") ? parseCatalogSource(sourceRef) : null;
  const sources = explicitSource ? [explicitSource] : lockfile.sources;

  for (const source of sources) {
    const catalog = await catalogLoader(resolveSource(toCatalogSourceInput(options, source)));
    const skill = catalog.skills.find((entry) => entry.id === skillId);
    if (skill) {
      return { skill, catalog, source };
    }
  }

  return null;
}

function parseCatalogSource(source: string): LockfileSource | null {
  const match = source.match(/^catalog:([^@]+\/[^@]+)@(.+)$/);
  if (!match) {
    return null;
  }
  return {
    repo: match[1]!,
    ref: match[2]!,
  };
}

function buildInstalledMetadata(
  skill: SkillManifest,
  context: { cwd: string; statePaths: StatePaths; installedAt: string; source: string },
): LockfileState["installed"][string] {
  return {
    name: skill.name,
    version: skill.version,
    path:
      context.statePaths.scope === "global"
        ? toPosix(path.join(context.statePaths.skillsDirPath, skill.id))
        : toPosix(path.relative(context.cwd, path.join(context.statePaths.skillsDirPath, skill.id))),
    installedAt: context.installedAt,
    compatibility: skill.compatibility,
    tags: skill.tags,
    source: context.source,
  };
}

function resolveInstalledSkillIds(lockfile: LockfileState, requestedSkillIds: string[]): string[] {
  const installedIds = Object.keys(lockfile.installed || {});
  if (installedIds.length === 0) {
    throw new InstallError("No skills installed to update.", "NO_SKILLS_INSTALLED");
  }

  if (!requestedSkillIds.length) {
    return installedIds;
  }

  const installedSet = new Set(installedIds);
  for (const skillId of requestedSkillIds) {
    if (!installedSet.has(skillId)) {
      throw new InstallError(`Skill "${skillId}" is not installed in the selected scope.`, "SKILL_NOT_INSTALLED");
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
  scope?: InstallScope | undefined;
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
    scope: options.scope || DEFAULT_INSTALL_SCOPE,
    ...(options.agentSkillsDir ? { agentSkillsDir: options.agentSkillsDir } : {}),
    ...(options.adapter ? { adapter: options.adapter } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    now: options.now,
  });
}

async function maybeSyncAfterRemove(options: {
  cwd: string;
  scope?: InstallScope | undefined;
  agentSkillsDir?: string | undefined;
  adapter: string | null;
  syncHistory: SyncHistory;
  legacySync: LockfileState["sync"];
  enabled: boolean;
  now: NowFn;
  changed: boolean;
  mode?: SyncWriteMode | undefined;
}): Promise<SyncCommandResult | null> {
  if (!options.changed) {
    return null;
  }

  const adapters = new Set<string>();
  for (const adapterId of Object.keys(options.syncHistory || {})) {
    adapters.add(adapterId);
  }
  if (options.legacySync?.adapter) {
    adapters.add(options.legacySync.adapter);
  }
  if (options.enabled && options.adapter) {
    adapters.add(options.adapter);
  }

  let result: SyncCommandResult | null = null;
  for (const adapterId of adapters) {
    result = await syncInstalledSkills({
      cwd: options.cwd,
      scope: options.scope || DEFAULT_INSTALL_SCOPE,
      ...(options.agentSkillsDir ? { agentSkillsDir: options.agentSkillsDir } : {}),
      adapter: adapterId,
      ...(options.mode ? { mode: options.mode } : {}),
      now: options.now,
    });
  }

  return result;
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

function resolveStatePathsForOptions(cwd: string, options: ProjectOptions): StatePaths {
  return getScopedStatePaths(cwd, {
    scope: options.scope || DEFAULT_INSTALL_SCOPE,
    baseDir: options.agentSkillsDir,
  });
}

function resolveInstalledSkillPath(cwd: string, skillPath: string): string {
  return path.isAbsolute(skillPath) ? skillPath : path.resolve(cwd, skillPath);
}

async function confirmDirectInstall(skillRef: string, options: InstallOptions): Promise<void> {
  const warning = `Warning: ${skillRef} will be installed directly from GitHub and has not been verified by the active catalog.`;
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
