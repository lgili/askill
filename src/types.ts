/**
 * Shared types and error classes for the Skillex CLI.
 */

/**
 * Supported sync file rendering modes.
 */
export type SyncMode = "managed-block" | "managed-file" | "managed-directory";

/**
 * Workspace sync write modes.
 */
export type SyncWriteMode = "symlink" | "copy";

/**
 * Supported install scopes.
 */
export type InstallScope = "local" | "global";

/**
 * Marker used to detect an adapter in a workspace.
 */
export interface AdapterMarker {
  path: string;
  weight: number;
}

/**
 * Static adapter definition used for detection and synchronization.
 */
export interface AdapterConfig {
  id: string;
  label: string;
  markers: AdapterMarker[];
  syncTarget?: string;
  globalSyncTarget?: string;
  legacySyncTargets?: string[];
  syncMode: SyncMode;
}

/**
 * Persisted adapter state in the workspace lockfile.
 */
export interface AdapterState {
  active: string | null;
  detected: string[];
}

/**
 * Remote catalog source configuration.
 */
export interface CatalogSource {
  owner: string;
  repoName: string;
  repo: string;
  ref: string;
  catalogPath: string;
  skillsDir: string;
  catalogUrl: string | null;
}

/**
 * Optional catalog source overrides accepted by CLI and installer entrypoints.
 */
export interface CatalogSourceInput {
  owner?: string | undefined;
  repoName?: string | undefined;
  repo?: string | undefined;
  ref?: string | undefined;
  catalogPath?: string | undefined;
  skillsDir?: string | undefined;
  catalogUrl?: string | null | undefined;
  /** Directory to store catalog cache files. Caching is skipped when absent. */
  cacheDir?: string | undefined;
  /** When `true`, bypass the local catalog cache and always fetch from the network. */
  noCache?: boolean | undefined;
}

/**
 * Parsed GitHub repository reference.
 */
export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  ref: string | null;
}

/**
 * Skill manifest stored in catalog and local installs.
 */
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string | null;
  tags: string[];
  compatibility: string[];
  entry: string;
  path: string;
  files: string[];
  scripts?: Record<string, string> | undefined;
}

/**
 * Alias used by catalog payloads for individual skill entries.
 */
export interface CatalogEntry extends SkillManifest {}

/**
 * Remote skill catalog structure.
 */
export interface CatalogData {
  formatVersion: number;
  repo: string;
  ref: string;
  skills: SkillManifest[];
}

/**
 * Skill entry annotated with its originating catalog source.
 */
export interface SourcedSkillManifest extends SkillManifest {
  source: {
    repo: string;
    ref: string;
    label?: string | undefined;
  };
}

/**
 * Clock function used to stamp lockfile updates during tests and runtime.
 */
export type NowFn = () => string;

/**
 * Search filters accepted by catalog lookups.
 */
export interface SearchOptions {
  query?: string;
  compatibility?: string[] | string;
  tags?: string[] | string;
}

/**
 * Local metadata for an installed skill entry.
 */
export interface InstalledSkillMetadata {
  name: string;
  version: string;
  path: string;
  installedAt: string;
  compatibility: string[];
  tags: string[];
  source?: string | undefined;
}

/**
 * Alias used by lockfile and installer contracts.
 */
export interface InstalledSkill extends InstalledSkillMetadata {}

/**
 * Catalog source persisted inside the local lockfile.
 */
export interface LockfileSource {
  repo: string;
  ref: string;
  label?: string | undefined;
}

/**
 * Workspace adapter state persisted in the lockfile.
 */
export interface LockfileAdapters extends AdapterState {}

/**
 * Workspace settings persisted in the lockfile.
 */
export interface LockfileSettings {
  autoSync: boolean;
}

/**
 * Last synchronization metadata persisted in the lockfile.
 */
export interface SyncMetadata {
  adapter: string;
  targetPath: string;
  syncedAt: string;
  skillIds?: string[] | undefined;
}

/**
 * Per-adapter synchronization metadata persisted in the lockfile.
 */
export type SyncHistory = Record<string, SyncMetadata>;

/**
 * Full workspace lockfile structure.
 */
export interface LockfileState {
  formatVersion: number;
  createdAt: string;
  updatedAt: string;
  sources: LockfileSource[];
  adapters: LockfileAdapters;
  settings: LockfileSettings;
  sync: SyncMetadata | null;
  syncHistory: SyncHistory;
  syncMode: SyncWriteMode | null;
  installed: Record<string, InstalledSkillMetadata>;
}

/**
 * Result of aggregating multiple remote catalogs.
 */
export interface AggregatedCatalogData {
  formatVersion: number;
  skills: SourcedSkillManifest[];
  sources: Array<LockfileSource & { skillCount: number }>;
}

/**
 * Result of resolving a skill id across configured sources.
 */
export interface ResolvedSkillSelection {
  skill: SkillManifest;
  catalog: CatalogData;
  source: LockfileSource;
}

/**
 * Common filesystem paths used by the local state manager.
 */
export interface StatePaths {
  scope: InstallScope;
  stateDir: string;
  lockfilePath: string;
  skillsDirPath: string;
  generatedDirPath: string;
}

/**
 * Shared workspace options accepted by most install and sync functions.
 */
export interface ProjectOptions extends CatalogSourceInput {
  cwd?: string | undefined;
  scope?: InstallScope | undefined;
  agentSkillsDir?: string | undefined;
  adapter?: string | undefined;
  autoSync?: boolean | undefined;
  dryRun?: boolean | undefined;
  mode?: SyncWriteMode | undefined;
  trust?: boolean | undefined;
  yes?: boolean | undefined;
  timeout?: number | undefined;
  now?: NowFn | undefined;
  /** When `true`, enables verbose debug output. */
  verbose?: boolean | undefined;
  /** Progress callback invoked for each skill during installation. */
  onProgress?: ((current: number, total: number, skillId: string) => void) | undefined;
}

/**
 * Sync target resolved for an adapter file.
 */
export interface SyncTarget {
  adapter: string;
  filePath: string;
  mode: SyncMode;
}

/**
 * Skill document loaded from disk for sync rendering.
 */
export interface InstalledSkillDocument {
  id: string;
  name: string;
  version: string;
  body: string;
  skillDir: string;
  scripts: Record<string, string>;
  autoInject: boolean;
  activationPrompt: string | null;
}

/**
 * Internal prepared sync state before writing to disk.
 */
export interface PreparedSyncResult {
  adapter: string;
  absoluteTargetPath: string;
  targetPath: string;
  cleanupPaths: string[];
  removeTarget?: boolean | undefined;
  changed: boolean;
  currentContent: string;
  nextContent: string;
  diff: string;
  syncMode: SyncWriteMode;
  generatedSourcePath?: string | undefined;
  directoryEntries?: PreparedDirectoryEntry[] | undefined;
}

/**
 * Prepared directory entry for directory-native adapter sync.
 */
export interface PreparedDirectoryEntry {
  skillId: string;
  sourcePath: string;
  absoluteTargetPath: string;
  targetPath: string;
  currentDescriptor: string;
  nextDescriptor: string;
}

/**
 * Dry-run preview returned before a sync writes files.
 */
export interface SyncPreview {
  adapter: string;
  filePath: string;
  before: string;
  after: string;
}

/**
 * Public sync result returned after writing or dry-run preparation.
 */
export interface SyncResult {
  adapter: string;
  targetPath: string;
  changed: boolean;
  diff: string;
  syncMode: SyncWriteMode;
}

/**
 * Shared options for sync execution.
 */
export interface SyncOptions {
  cwd: string;
  scope?: InstallScope | undefined;
  adapterId: string;
  statePaths: StatePaths;
  skills: InstalledSkillDocument[];
  previousSkillIds?: string[] | undefined;
  mode?: SyncWriteMode | undefined;
  dryRun?: boolean | undefined;
  linkFactory?: ((targetPath: string, linkPath: string) => Promise<CreateSymlinkResult>) | undefined;
  warn?: ((message: string) => void) | undefined;
}

/**
 * Result returned by the top-level sync command.
 */
export interface SyncCommandResult {
  statePaths: StatePaths;
  sync: {
    adapter: string;
    targetPath: string;
  } | SyncMetadata;
  skillCount: number;
  changed: boolean;
  diff: string;
  dryRun: boolean;
  syncMode: SyncWriteMode;
}

/**
 * Result returned by `initProject`.
 */
export interface InitProjectResult {
  created: boolean;
  statePaths: StatePaths;
  lockfile: LockfileState;
}

/**
 * Result returned by `installSkills`.
 */
export interface InstallSkillsResult {
  installedCount: number;
  installedSkills: SkillManifest[];
  statePaths: StatePaths;
  autoSync: SyncCommandResult | null;
}

/**
 * Result returned by `updateInstalledSkills`.
 */
export interface UpdateInstalledSkillsResult {
  statePaths: StatePaths;
  updatedSkills: SkillManifest[];
  missingFromCatalog: string[];
  autoSync: SyncCommandResult | null;
}

/**
 * Result returned by `removeSkills`.
 */
export interface RemoveSkillsResult {
  statePaths: StatePaths;
  removedSkills: string[];
  missingSkills: string[];
  autoSync: SyncCommandResult | null;
}

/**
 * Catalog loader signature override used in tests.
 */
export type CatalogLoader = (source: CatalogSource) => Promise<CatalogData>;

/**
 * Skill downloader implementation used by installers.
 */
export type SkillDownloader = (
  skill: SkillManifest,
  catalog: CatalogData,
  stateDir: string,
) => Promise<void>;

/**
 * Parsed CLI arguments.
 */
export interface ParsedArgs {
  command?: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parsed direct GitHub install reference.
 */
export interface DirectGitHubRef {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * Result of a filesystem link attempt.
 */
export interface CreateSymlinkResult {
  ok: boolean;
  fallback: boolean;
  relativeTarget: string;
}

/**
 * Shared base class for typed Skillex errors.
 */
export class SkillexError extends Error {
  code: string;

  /**
   * Creates a typed Skillex error.
   */
  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Error thrown for catalog lookup and parsing failures.
 */
export class CatalogError extends SkillexError {
  /**
   * Creates a catalog error.
   */
  constructor(message: string, code = "CATALOG_ERROR") {
    super(message, code);
  }
}

/**
 * Error thrown for install, update, or remove failures.
 */
export class InstallError extends SkillexError {
  /**
   * Creates an install error.
   */
  constructor(message: string, code = "INSTALL_ERROR") {
    super(message, code);
  }
}

/**
 * Error thrown for sync preparation or write failures.
 */
export class SyncError extends SkillexError {
  /**
   * Creates a sync error.
   */
  constructor(message: string, code = "SYNC_ERROR") {
    super(message, code);
  }
}

/**
 * Error thrown for invalid user input or unsafe data.
 */
export class ValidationError extends SkillexError {
  /**
   * Creates a validation error.
   */
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, code);
  }
}

/**
 * Error thrown when an unknown adapter is requested.
 */
export class AdapterNotFoundError extends SkillexError {
  /**
   * Creates an adapter lookup error.
   */
  constructor(adapterId: string) {
    super(`Unknown adapter: ${adapterId}`, "ADAPTER_NOT_FOUND");
  }
}

/**
 * Error thrown for invalid CLI usage.
 */
export class CliError extends SkillexError {
  /**
   * Creates a CLI error.
   */
  constructor(message: string, code = "CLI_ERROR") {
    super(message, code);
  }
}
