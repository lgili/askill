import * as path from "node:path";
import { listAdapters } from "./adapters.js";
import {
  computeCatalogCacheKey,
  loadCatalog,
  readCatalogCache,
  searchCatalogSkills,
} from "./catalog.js";
import { DEFAULT_INSTALL_SCOPE, getScopedStatePaths } from "./config.js";
import {
  addProjectSource,
  getInstalledSkills,
  initProject,
  installSkills,
  listProjectSources,
  loadProjectCatalogs,
  removeProjectSource,
  removeSkills,
  resolveProjectSource,
  syncInstalledSkills,
  updateInstalledSkills,
} from "./install.js";
import * as output from "./output.js";
import { setVerbose } from "./output.js";
import { parseSkillCommandReference, runSkillScript } from "./runner.js";
import { runInteractiveUi } from "./ui.js";
import type { InstallScope, ParsedArgs, ProjectOptions, SearchOptions, SyncWriteMode } from "./types.js";
import { CliError } from "./types.js";
import { VALID_CONFIG_KEYS, readUserConfig, writeUserConfig } from "./user-config.js";
import type { UserConfig } from "./user-config.js";

type CliFlags = Record<string, string | boolean>;

// ---------------------------------------------------------------------------
// Per-command help text
// ---------------------------------------------------------------------------

const COMMAND_HELP: Record<string, string> = {
  init: `Usage: skillex init [--repo <owner/repo>] [options]

Initialize Skillex state for the local workspace or global user scope.

Options:
  --repo <owner/repo>   GitHub repository with skills (default: lgili/skillex)
  --ref <ref>           Branch, tag, or commit (default: main)
  --adapter <id>        Force a specific adapter
  --auto-sync           Enable auto-sync after install/update/remove
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global
  --cwd <path>          Target project directory (default: current directory)

Example:
  skillex init
  skillex init --repo myorg/my-skills
  skillex init --global --adapter codex`,

  list: `Usage: skillex list [options]

List all skills in the configured sources.

Options:
  --repo <owner/repo>   GitHub repository (limits this command to one source)
  --ref <ref>           Branch, tag, or commit
  --no-cache            Bypass local catalog cache
  --json                Output results as JSON

Example:
  skillex list
  skillex list --repo myorg/my-skills --json`,

  search: `Usage: skillex search [query] [options]

Search skills by text, compatibility, or tags.

Options:
  --repo <owner/repo>   GitHub repository (limits this command to one source)
  --compatibility <id>  Filter by adapter compatibility
  --tag <tag>           Filter by tag
  --no-cache            Bypass local catalog cache
  --json                Output results as JSON

Example:
  skillex search git --compatibility claude`,

  install: `Usage: skillex install <skill-id...> [options]
         skillex install --all [options]
         skillex install <owner/repo[@ref]> [options]

Install one or more skills from the catalog or directly from GitHub.

Options:
  --all                 Install all skills from the catalog
  --repo <owner/repo>   GitHub repository (limits this command to one source)
  --ref <ref>           Branch, tag, or commit
  --trust               Skip confirmation for direct GitHub installs
  --adapter <id>        Target adapter
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global
  --no-cache            Bypass local catalog cache

Example:
  skillex install git-master code-review
  skillex install --all --repo myorg/my-skills
  skillex install octocat/my-skill@main --trust`,

  update: `Usage: skillex update [skill-id...] [options]

Update installed skills to the latest catalog version.

Options:
  --repo <owner/repo>   GitHub repository
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global
  --no-cache            Bypass local catalog cache

Example:
  skillex update
  skillex update git-master`,

  remove: `Usage: skillex remove <skill-id...> [options]

Remove installed skills from the selected scope.

Options:
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global

Example:
  skillex remove git-master code-review`,

  sync: `Usage: skillex sync [options]

Synchronize installed skills to adapter targets.

Options:
  --adapter <id>        Target adapter (overrides saved config)
  --dry-run             Preview changes without writing to disk
  --mode <symlink|copy> Sync write mode (default: symlink)
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global

Example:
  skillex sync
  skillex sync --adapter cursor --dry-run
  skillex sync --global --adapter codex`,

  run: `Usage: skillex run <skill-id:command> [options]

Execute a script bundled inside an installed skill.

Options:
  --yes                 Skip confirmation prompt
  --timeout <seconds>   Script timeout in seconds (default: 30)

Example:
  skillex run git-master:cleanup --yes`,

  ui: `Usage: skillex ui [options]

Open the interactive terminal browser to browse and install skills.

Options:
  --repo <owner/repo>   GitHub repository
  --no-cache            Bypass local catalog cache

Example:
  skillex ui`,

  status: `Usage: skillex status [options]

Show the installation status of the selected scope.

Options:
  --cwd <path>          Target project directory
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global
  --json                Output as JSON

Example:
  skillex status
  skillex status --json`,

  doctor: `Usage: skillex doctor [options]

Run environment and configuration checks to diagnose issues.

Options:
  --json                Output results as JSON

Example:
  skillex doctor`,

  config: `Usage: skillex config set <key> <value>
         skillex config get <key>

Manage global Skillex preferences stored in ~/.askillrc.json.
CLI flags always take precedence over these values.

Valid keys: ${VALID_CONFIG_KEYS.join(", ")}

Precedence order: CLI flag > GITHUB_TOKEN env > global config > default

Example:
  skillex config set defaultRepo myorg/my-skills
  skillex config get defaultRepo`,

  source: `Usage: skillex source <add|remove|list> [repo] [options]

Manage the workspace source list.

Commands:
  skillex source list
  skillex source add <owner/repo> [--ref main] [--label work]
  skillex source remove <owner/repo>

Options:
  --ref <ref>           Branch, tag, or commit (default: main)
  --label <label>       Human-readable source label

Example:
  skillex source add myorg/my-skills --label work`,
};

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

/**
 * Runs the Skillex CLI entrypoint.
 *
 * @param argv - Raw CLI arguments without the Node executable prefix.
 * @throws {CliError} When the command or flag values are invalid.
 */
export async function main(argv: string[]): Promise<void> {
  const { command, positionals, flags } = parseArgs(argv);

  // Apply verbose flag early so debug output works from the start
  if (flags.verbose === true || flags.v === true) {
    setVerbose(true);
  }

  // Load global user config once at startup
  const userConfig = await readUserConfig();

  // Apply githubToken from user config as env fallback (env always wins)
  if (userConfig.githubToken && !process.env.GITHUB_TOKEN) {
    process.env.GITHUB_TOKEN = userConfig.githubToken;
  }

  // Per-command --help
  if (flags.help === true && command && command !== "help") {
    const helpText = COMMAND_HELP[command];
    if (helpText) {
      output.info(helpText);
    } else {
      printHelp();
    }
    return;
  }

  // Resolve command aliases
  const resolvedCommand = resolveAlias(command);

  switch (resolvedCommand) {
    case "help":
    case undefined:
      printHelp();
      return;
    case "init":
      await handleInit(flags, userConfig);
      return;
    case "list":
      await handleList(flags, userConfig);
      return;
    case "search":
      await handleSearch(positionals, flags, userConfig);
      return;
    case "install":
      await handleInstall(positionals, flags, userConfig);
      return;
    case "update":
      await handleUpdate(positionals, flags, userConfig);
      return;
    case "remove":
      await handleRemove(positionals, flags, userConfig);
      return;
    case "sync":
      await handleSync(flags, userConfig);
      return;
    case "run":
      await handleRun(positionals, flags, userConfig);
      return;
    case "ui":
      await handleUi(flags, userConfig);
      return;
    case "status":
      await handleStatus(flags, userConfig);
      return;
    case "doctor":
      await handleDoctor(flags, userConfig);
      return;
    case "config":
      await handleConfig(positionals, flags);
      return;
    case "source":
      await handleSource(positionals, flags, userConfig);
      return;
    default:
      throw new CliError(
        `Unknown command: ${resolvedCommand}. Run "skillex help" to see available commands.`,
      );
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleInit(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const repo = asOptionalString(flags.repo) ?? userConfig.defaultRepo;

  const opts = commonOptions(flags, userConfig);
  const result = await initProject({
    ...opts,
    ...(repo ? { repo } : {}),
  });

  if (result.created) {
    output.success(`Initialized ${result.statePaths.scope} state at ${result.statePaths.stateDir}`);
  } else {
    output.info(`Already configured at ${result.statePaths.stateDir}`);
  }

  const primarySource = result.lockfile.sources[0];
  output.info(`  Source  : ${primarySource?.repo}@${primarySource?.ref}`);
  if (result.lockfile.sources.length > 1) {
    output.info(`  Sources : ${result.lockfile.sources.length}`);
  }

  if (result.lockfile.adapters.active) {
    output.info(`  Adapter : ${result.lockfile.adapters.active}`);
  } else {
    output.warn(
      "No adapter detected in this directory.\n" +
        `  Use --adapter <id> to specify one. Available: ${listAdapters().map((a) => a.id).join(", ")}`,
    );
  }

  output.info(`  Auto-sync: ${result.lockfile.settings.autoSync ? "enabled" : "disabled"}`);
  output.info("\nNext: run 'skillex list' to browse available skills");
}

async function handleList(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const opts = commonOptions(flags, userConfig);
  const aggregated = await loadProjectCatalogs({ ...opts, ...cacheOptions(opts) });

  if (aggregated.skills.length === 0) {
    output.info("No skills found.");
    return;
  }

  if (flags.json === true) {
    output.info(JSON.stringify(aggregated.skills, null, 2));
    return;
  }

  for (const source of aggregated.sources) {
    output.info(`Source: ${source.repo}@${source.ref}${source.label ? ` [${source.label}]` : ""}`);
    printTable(
      aggregated.skills
        .filter((skill) => skill.source.repo === source.repo && skill.source.ref === source.ref)
        .map((skill) => ({
          id: skill.id,
          version: skill.version,
          name: skill.name,
          description: truncate(skill.description, 96),
        })),
    );
    output.info("");
  }
}

async function handleSearch(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const opts = commonOptions(flags, userConfig);
  const aggregated = await loadProjectCatalogs({ ...opts, ...cacheOptions(opts) });

  const searchOptions: SearchOptions = { query: positionals.join(" ") };
  const compatibility = asOptionalString(flags.compatibility);
  const tag = asOptionalString(flags.tag);
  if (compatibility) searchOptions.compatibility = compatibility;
  if (tag) searchOptions.tags = tag;

  const filtered = searchCatalogSkills(aggregated.skills, searchOptions) as typeof aggregated.skills;

  if (filtered.length === 0) {
    output.info("No skills match the given filters.");
    return;
  }

  if (flags.json === true) {
    output.info(JSON.stringify(filtered, null, 2));
    return;
  }

  for (const source of aggregated.sources) {
    const sourceMatches = filtered.filter((skill) => skill.source.repo === source.repo && skill.source.ref === source.ref);
    if (sourceMatches.length === 0) {
      continue;
    }
    output.info(`Source: ${source.repo}@${source.ref}${source.label ? ` [${source.label}]` : ""}`);
    printTable(
      sourceMatches.map((skill) => ({
        id: skill.id,
        version: skill.version,
        compatibility: skill.compatibility.join(","),
        description: truncate(skill.description, 72),
      })),
    );
    output.info("");
  }
}

async function handleInstall(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const installAll = Boolean(flags.all);
  const opts = commonOptions(flags, userConfig);
  const result = await installSkills(positionals, {
    ...opts,
    installAll,
    onProgress: (current, total, skillId) => output.progress(current, total, skillId),
  });

  output.success(`Installed ${result.installedCount} skill(s)`);
  for (const skill of result.installedSkills) {
    output.info(`  + ${skill.id}@${skill.version}`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleUpdate(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const opts = commonOptions(flags, userConfig);
  const result = await updateInstalledSkills(positionals, {
    ...opts,
    onProgress: (current, total, skillId) => output.progress(current, total, skillId),
  });

  if (result.updatedSkills.length === 0) {
    output.info("No skills updated.");
  } else {
    output.success(`Updated ${result.updatedSkills.length} skill(s)`);
    for (const skill of result.updatedSkills) {
      output.info(`  ↑ ${skill.id}@${skill.version}`);
    }
  }

  for (const skillId of result.missingFromCatalog) {
    output.warn(`${skillId} no longer exists in the remote catalog`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleRemove(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const result = await removeSkills(positionals, commonOptions(flags, userConfig));

  if (result.removedSkills.length > 0) {
    output.success(`Removed ${result.removedSkills.length} skill(s)`);
    for (const skillId of result.removedSkills) {
      output.info(`  - ${skillId}`);
    }
  }

  for (const skillId of result.missingSkills) {
    output.warn(`${skillId} is not installed`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleSync(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const result = await syncInstalledSkills(commonOptions(flags, userConfig));

  if (result.dryRun) {
    output.info(`Preview: ${result.skillCount} skill(s) → ${result.sync.adapter}`);
    output.info(`Target path : ${result.sync.targetPath}`);
    output.info(`Sync mode   : ${result.syncMode}`);
    process.stdout.write(result.diff);
    return;
  }

  output.success(`Synced ${result.skillCount} skill(s) → ${result.sync.adapter}`);
  output.info(`Target path : ${result.sync.targetPath}`);
  output.info(`Sync mode   : ${result.syncMode}`);
  if (!result.changed) {
    output.info("No changes to the target path.");
  }
}

async function handleRun(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const target = positionals[0];
  if (!target) {
    throw new CliError('Provide a target in the format "skill-id:command".', "RUN_REQUIRES_TARGET");
  }

  const parsed = parseSkillCommandReference(target);
  const exitCode = await runSkillScript(parsed.skillId, parsed.command, {
    ...commonOptions(flags, userConfig),
    yes: parseBooleanFlag(flags.yes) || false,
    timeout: parsePositiveInt(asOptionalString(flags.timeout)),
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

async function handleUi(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const options = commonOptions(flags, userConfig);
  const state = await getInstalledSkills(options);
  const source = await resolveProjectSource(options);

  output.statusLine("Fetching catalog...");
  const catalog = await loadCatalog({ ...source, ...cacheOptions(options) });
  output.clearStatus();

  if (catalog.skills.length === 0) {
    output.info("No skills available in the catalog.");
    return;
  }

  const installedIds = Object.keys(state?.installed || {});
  const selection = await runInteractiveUi({ skills: catalog.skills, installedIds });

  if (selection.visibleIds.length === 0) {
    output.info(
      selection.query
        ? `No skills match the filter "${selection.query}".`
        : "No skills available in the catalog.",
    );
    return;
  }

  const installResult =
    selection.toInstall.length > 0
      ? await installSkills(selection.toInstall, {
          ...options,
          onProgress: (current, total, skillId) => output.progress(current, total, skillId),
        })
      : null;
  const removeResult =
    selection.toRemove.length > 0 ? await removeSkills(selection.toRemove, options) : null;

  if (!installResult && !removeResult) {
    output.info("No changes applied.");
    return;
  }

  if (installResult) {
    output.success(`Installed: ${installResult.installedSkills.map((s) => s.id).join(", ")}`);
  }
  if (removeResult) {
    output.success(`Removed: ${removeResult.removedSkills.join(", ")}`);
  }
  printAutoSyncResult(installResult?.autoSync ?? removeResult?.autoSync ?? null);
}

async function handleStatus(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const options = commonOptions(flags, userConfig);
  const state = await getInstalledSkills(options);
  if (!state) {
    output.warn(
      resolveScope(flags) === "global"
        ? "No global installation found. Run: skillex init --global --adapter <id>"
        : "No local installation found. Run: skillex init",
    );
    return;
  }

  if (flags.json === true) {
    output.info(JSON.stringify(state, null, 2));
    return;
  }

  const statePaths = getScopedStatePaths(options.cwd ?? process.cwd(), {
    scope: options.scope,
    baseDir: options.agentSkillsDir,
  });
  const installedEntries = Object.entries(state.installed || {});
  output.info(`Scope        : ${resolveScope(flags)}`);
  output.info(`State root   : ${statePaths.stateDir}`);
  output.info(`Sources      : ${state.sources.map((source) => `${source.repo}@${source.ref}`).join(", ")}`);
  output.info(`Active adapter: ${state.adapters.active || "(none)"}`);
  output.info(`Auto-sync    : ${state.settings.autoSync ? "enabled" : "disabled"}`);
  output.info(`Sync mode    : ${state.syncMode || "(none)"}`);
  if (state.adapters.detected.length > 0) {
    output.info(`Detected     : ${state.adapters.detected.join(", ")}`);
  }
  if (state.sync) {
    output.info(`Last sync    : ${state.sync.adapter} → ${state.sync.targetPath} at ${state.sync.syncedAt}`);
  }
  if (installedEntries.length === 0) {
    output.info("No skills installed.");
    return;
  }

  printTable(
    installedEntries.map(([id, metadata]) => ({
      id,
      version: metadata.version,
      source: metadata.source || "catalog",
      installedAt: metadata.installedAt,
    })),
  );
}

async function handleDoctor(flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const opts = commonOptions(flags, userConfig);
  const cwd = opts.cwd ?? process.cwd();
  const statePaths = getScopedStatePaths(cwd, {
    scope: opts.scope,
    baseDir: opts.agentSkillsDir,
  });

  interface DoctorCheck {
    name: string;
    passed: boolean;
    message: string;
    hint?: string;
  }

  const checks: DoctorCheck[] = [];

  // 1. Lockfile
  const state = await getInstalledSkills(opts);
  if (state) {
    checks.push({ name: "lockfile", passed: true, message: `Found at ${statePaths.lockfilePath}` });
  } else {
    checks.push({
      name: "lockfile",
      passed: false,
      message: "Lockfile not found",
      hint: "Run: skillex init",
    });
  }

  // 2. Sources configured
  const stateSources = state?.sources ?? [];
  if (stateSources.length > 0) {
    checks.push({
      name: "source",
      passed: true,
      message: stateSources.map((source) => `${source.repo}@${source.ref}`).join(", "),
    });
  } else {
    checks.push({
      name: "source",
      passed: false,
      message: "No catalog source configured",
      hint: "Run: skillex init",
    });
  }

  // 3. Adapter detected
  const hasAdapter = Boolean(state?.adapters?.active || (state?.adapters?.detected?.length ?? 0) > 0);
  if (hasAdapter) {
    const adapter = state?.adapters?.active ?? state?.adapters?.detected?.[0];
    checks.push({ name: "adapter", passed: true, message: `Active: ${adapter}` });
  } else {
    checks.push({
      name: "adapter",
      passed: false,
      message: "No adapter detected",
      hint: `Use --adapter <id>. Available: ${listAdapters().map((a) => a.id).join(", ")}`,
    });
  }

  // 4. GitHub reachable
  try {
    const response = await fetch("https://api.github.com", {
      method: "HEAD",
      headers: { "User-Agent": "skillex" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status < 500) {
      checks.push({ name: "github", passed: true, message: "GitHub API is reachable" });
    } else {
      checks.push({
        name: "github",
        passed: false,
        message: `GitHub API returned ${response.status}`,
        hint: "Try again in a moment.",
      });
    }
  } catch {
    checks.push({
      name: "github",
      passed: false,
      message: "GitHub API is unreachable",
      hint: "Check your internet connection or proxy settings.",
    });
  }

  // 5. GitHub token (warning only — never fails)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    checks.push({ name: "token", passed: true, message: "GitHub token set (authenticated — 5,000 req/hr)" });
  } else {
    checks.push({ name: "token", passed: true, message: "No GitHub token (unauthenticated — 60 req/hr)" });
  }

  // 6. Cache
  const cacheDir = path.join(statePaths.stateDir, ".cache");
  if ((state?.sources?.length ?? 0) > 0) {
    const source = await resolveProjectSource(opts);
    const cacheKey = computeCatalogCacheKey(source);
    const cached = await readCatalogCache(cacheDir, cacheKey);
    if (cached) {
      checks.push({ name: "cache", passed: true, message: "Catalog cache is fresh" });
    } else {
      checks.push({ name: "cache", passed: true, message: "No cached catalog (will fetch on next command)" });
    }
  } else {
    checks.push({ name: "cache", passed: true, message: "Cache not checked (no repo configured)" });
  }

  const anyFailed = checks.some((c) => !c.passed);

  if (flags.json === true) {
    const jsonResult: Record<string, { passed: boolean; message: string; hint?: string }> = {};
    for (const check of checks) {
      jsonResult[check.name] = {
        passed: check.passed,
        message: check.message,
        ...(check.hint ? { hint: check.hint } : {}),
      };
    }
    output.info(JSON.stringify(jsonResult, null, 2));
  } else {
    for (const check of checks) {
      const symbol = check.passed ? "✓" : "✗";
      const line = `${symbol} ${check.name.padEnd(10)} ${check.message}`;
      if (check.passed) {
        output.info(line);
      } else {
        output.error(line);
        if (check.hint) {
          output.info(`           Hint: ${check.hint}`);
        }
      }
    }
  }

  if (anyFailed) {
    process.exitCode = 1;
  }
}

async function handleSource(positionals: string[], flags: CliFlags, userConfig: UserConfig): Promise<void> {
  const subcommand = positionals[0];
  const options = commonOptions(flags, userConfig);

  if (!subcommand || subcommand === "help" || flags.help === true) {
    output.info(COMMAND_HELP.source ?? "");
    return;
  }

  if (subcommand === "list") {
    const sources = await listProjectSources(options);
    if (flags.json === true) {
      output.info(JSON.stringify(sources, null, 2));
      return;
    }

    printTable(
      sources.map((source) => ({
        repo: source.repo,
        ref: source.ref,
        label: source.label || "",
      })),
    );
    return;
  }

  if (subcommand === "add") {
    const repo = positionals[1];
    if (!repo) {
      throw new CliError("Usage: skillex source add <owner/repo>", "SOURCE_ADD_REQUIRES_REPO");
    }

    const lockfile = await addProjectSource(
      {
        repo,
        ref: asOptionalString(flags.ref),
        label: asOptionalString(flags.label),
      },
      options,
    );
    output.success(`Added source ${repo}`);
    output.info(`Configured sources: ${lockfile.sources.length}`);
    return;
  }

  if (subcommand === "remove") {
    const repo = positionals[1];
    if (!repo) {
      throw new CliError("Usage: skillex source remove <owner/repo>", "SOURCE_REMOVE_REQUIRES_REPO");
    }

    const lockfile = await removeProjectSource(repo, options);
    output.success(`Removed source ${repo}`);
    output.info(`Configured sources: ${lockfile.sources.length}`);
    return;
  }

  throw new CliError(`Unknown source subcommand: ${subcommand}.`, "SOURCE_UNKNOWN_SUBCOMMAND");
}

async function handleConfig(positionals: string[], flags: CliFlags): Promise<void> {
  const subcommand = positionals[0];

  if (!subcommand || subcommand === "help" || flags.help === true) {
    output.info(COMMAND_HELP.config ?? "");
    return;
  }

  if (subcommand === "get") {
    const key = positionals[1] as keyof UserConfig | undefined;
    if (!key) {
      throw new CliError("Usage: skillex config get <key>", "CONFIG_GET_REQUIRES_KEY");
    }
    if (!VALID_CONFIG_KEYS.includes(key)) {
      throw new CliError(
        `Unknown config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`,
        "CONFIG_INVALID_KEY",
      );
    }
    const config = await readUserConfig();
    const value = config[key];
    output.info(value !== undefined ? String(value) : "(not set)");
    return;
  }

  if (subcommand === "set") {
    const key = positionals[1] as keyof UserConfig | undefined;
    const value = positionals[2];
    if (!key || value === undefined) {
      throw new CliError("Usage: skillex config set <key> <value>", "CONFIG_SET_REQUIRES_KEY_VALUE");
    }
    if (!VALID_CONFIG_KEYS.includes(key)) {
      throw new CliError(
        `Unknown config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`,
        "CONFIG_INVALID_KEY",
      );
    }
    // Coerce boolean keys
    const coerced: string | boolean = key === "disableAutoSync" ? value === "true" : value;
    await writeUserConfig({ [key]: coerced });
    output.success(`Set ${key} = ${coerced} in ~/.askillrc.json`);
    return;
  }

  throw new CliError(
    `Unknown config subcommand: ${subcommand}. Use "get" or "set".`,
    "CONFIG_UNKNOWN_SUBCOMMAND",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAlias(command: string | undefined): string | undefined {
  const ALIASES: Record<string, string> = {
    ls: "list",
    rm: "remove",
    uninstall: "remove",
  };
  return command !== undefined ? (ALIASES[command] ?? command) : undefined;
}

function commonOptions(flags: CliFlags, userConfig: UserConfig = {}): ProjectOptions {
  const options: ProjectOptions = {
    cwd: path.resolve(asOptionalString(flags.cwd) || process.cwd()),
    scope: resolveScope(flags),
  };

  const repo = asOptionalString(flags.repo) ?? userConfig.defaultRepo;
  const ref = asOptionalString(flags.ref);
  const catalogPath = asOptionalString(flags["catalog-path"]);
  const catalogUrl = asOptionalString(flags["catalog-url"]);
  const skillsDir = asOptionalString(flags["skills-dir"]);
  const agentSkillsDir = asOptionalString(flags["agent-skills-dir"]);
  const adapter = asOptionalString(flags.adapter) ?? userConfig.defaultAdapter;
  const autoSync = parseBooleanFlag(flags["auto-sync"]) ?? (userConfig.disableAutoSync ? false : undefined);
  const dryRun = parseBooleanFlag(flags["dry-run"]);
  const trust = parseBooleanFlag(flags.trust);
  const yes = parseBooleanFlag(flags.yes);
  const mode = parseSyncMode(asOptionalString(flags.mode));
  const timeout = parsePositiveInt(asOptionalString(flags.timeout));
  const noCache = parseBooleanFlag(flags["no-cache"]);

  if (repo) options.repo = repo;
  if (ref) options.ref = ref;
  if (catalogPath) options.catalogPath = catalogPath;
  if (catalogUrl) options.catalogUrl = catalogUrl;
  if (skillsDir) options.skillsDir = skillsDir;
  if (agentSkillsDir) options.agentSkillsDir = agentSkillsDir;
  if (adapter) options.adapter = adapter;
  if (autoSync !== undefined) options.autoSync = autoSync;
  if (dryRun !== undefined) options.dryRun = dryRun;
  if (trust !== undefined) options.trust = trust;
  if (yes !== undefined) options.yes = yes;
  if (mode) options.mode = mode;
  if (timeout !== undefined) options.timeout = timeout;
  if (noCache !== undefined) options.noCache = noCache;

  return options;
}

/** Returns cache-related options to spread into a loadCatalog call. */
function cacheOptions(opts: ProjectOptions): { cacheDir: string; noCache?: boolean } {
  const cwd = opts.cwd ?? process.cwd();
  const stateDir = getScopedStatePaths(cwd, {
    scope: opts.scope ?? DEFAULT_INSTALL_SCOPE,
    baseDir: opts.agentSkillsDir,
  }).stateDir;
  return {
    cacheDir: path.join(stateDir, ".cache"),
    ...(opts.noCache !== undefined ? { noCache: opts.noCache } : {}),
  };
}

function resolveScope(flags: CliFlags): InstallScope {
  const rawScope = asOptionalString(flags.scope);
  const globalFlag = parseBooleanFlag(flags.global);

  if (rawScope && rawScope !== "local" && rawScope !== "global") {
    throw new CliError(`Invalid scope: ${rawScope}. Use "local" or "global".`, "INVALID_SCOPE");
  }
  if (rawScope === "local" && globalFlag === true) {
    throw new CliError('Conflicting scope flags: use either "--scope local" or "--global".', "CONFLICTING_SCOPE");
  }
  if (globalFlag === true) {
    return "global";
  }
  return (rawScope as InstallScope | undefined) || DEFAULT_INSTALL_SCOPE;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: CliFlags = {};
  const positionals: string[] = [];
  let command: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;

    if (!command && !token.startsWith("-")) {
      command = token;
      continue;
    }

    if (token === "-v") {
      flags.verbose = true;
      continue;
    }

    if (token.startsWith("--")) {
      const [rawKey, inlineValue] = token.slice(2).split("=", 2);
      if (!rawKey) continue;
      if (inlineValue !== undefined) {
        flags[rawKey] = inlineValue;
        continue;
      }

      const next = argv[index + 1];
      if (!next || next.startsWith("-")) {
        flags[rawKey] = true;
        continue;
      }

      flags[rawKey] = next;
      index += 1;
      continue;
    }

    positionals.push(token);
  }

  return { command, positionals, flags };
}

function printHelp(): void {
  output.info(`skillex — AI agent skill manager

Commands:
  skillex init [--repo owner/repo] [--ref main]
  skillex list [--json]
  skillex search [query] [--compatibility claude] [--tag git]
  skillex install <skill-id... | owner/repo[@ref]> [--trust]
  skillex install --all
  skillex update [skill-id...]
  skillex remove <skill-id...>           aliases: rm, uninstall
  skillex source <add|remove|list> [...]
  skillex sync [--adapter id] [--dry-run] [--mode copy]
  skillex run <skill-id:command> [--yes] [--timeout 30]
  skillex ui
  skillex status [--json]
  skillex doctor [--json]
  skillex config set <key> <value>
  skillex config get <key>

Global flags:
  --repo <owner/repo>   GitHub repository with skills (default: lgili/skillex)
  --ref <ref>           Branch, tag, or commit (default: main)
  --adapter <id>        Force adapter: ${listAdapters()
    .map((a) => a.id)
    .join(", ")}
  --scope <scope>       local or global (default: local)
  --global              Shortcut for --scope global
  --cwd <path>          Project directory (default: current)
  --verbose, -v         Enable debug output
  --json                Machine-readable JSON output
  --no-cache            Bypass local catalog cache
  --dry-run             Preview without writing to disk

Run "skillex <command> --help" for command-specific usage.`);
}

function printTable(rows: Array<Record<string, string | number | boolean | null | undefined>>): void {
  const columns = Object.keys(rows[0]!);
  const widths: number[] = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)),
  );
  output.info(columns.map((column, index) => column.padEnd(widths[index] ?? 0)).join("  "));
  output.info(widths.map((size) => "-".repeat(size)).join("  "));
  for (const row of rows) {
    output.info(
      columns.map((column, index) => String(row[column] ?? "").padEnd(widths[index] ?? 0)).join("  "),
    );
  }
}

function truncate(value: string, maxLength: number): string {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function parseBooleanFlag(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new CliError(`Invalid boolean value: ${value}`, "INVALID_BOOLEAN_FLAG");
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Invalid numeric value: ${value}`, "INVALID_NUMBER_FLAG");
  }
  return parsed;
}

function parseSyncMode(value: string | undefined): SyncWriteMode | undefined {
  if (!value) return undefined;
  if (value === "copy" || value === "symlink") return value;
  throw new CliError(`Invalid sync mode: ${value}. Use "symlink" or "copy".`, "INVALID_SYNC_MODE");
}

function printAutoSyncResult(
  result:
    | Awaited<ReturnType<typeof installSkills>>["autoSync"]
    | Awaited<ReturnType<typeof updateInstalledSkills>>["autoSync"]
    | Awaited<ReturnType<typeof removeSkills>>["autoSync"],
): void {
  if (!result) return;
  const suffix = result.changed ? "" : " (no changes)";
  output.info(`Sync: ${result.sync.adapter} → ${result.sync.targetPath} [${result.syncMode}]${suffix}`);
}

function asOptionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
