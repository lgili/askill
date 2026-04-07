import * as path from "node:path";
import { listAdapters } from "./adapters.js";
import { loadCatalog, searchCatalogSkills } from "./catalog.js";
import {
  getInstalledSkills,
  initProject,
  installSkills,
  removeSkills,
  resolveProjectSource,
  syncInstalledSkills,
  updateInstalledSkills,
} from "./install.js";
import { parseSkillCommandReference, runSkillScript } from "./runner.js";
import { runInteractiveUi } from "./ui.js";
import type { ParsedArgs, ProjectOptions, SearchOptions, SyncWriteMode } from "./types.js";
import { CliError } from "./types.js";

type CliFlags = Record<string, string | boolean>;

/**
 * Runs the Skillex CLI entrypoint.
 *
 * @param argv - Raw CLI arguments without the Node executable prefix.
 * @throws {CliError} When the command or flag values are invalid.
 */
export async function main(argv: string[]): Promise<void> {
  const { command, positionals, flags } = parseArgs(argv);

  switch (command) {
    case "help":
    case undefined:
      printHelp();
      return;
    case "init":
      await handleInit(flags);
      return;
    case "list":
      await handleList(flags);
      return;
    case "search":
      await handleSearch(positionals, flags);
      return;
    case "install":
      await handleInstall(positionals, flags);
      return;
    case "update":
      await handleUpdate(positionals, flags);
      return;
    case "remove":
      await handleRemove(positionals, flags);
      return;
    case "sync":
      await handleSync(flags);
      return;
    case "run":
      await handleRun(positionals, flags);
      return;
    case "ui":
      await handleUi(flags);
      return;
    case "status":
      await handleStatus(flags);
      return;
    default:
      throw new CliError(`Comando desconhecido: ${command}. Rode "skillex help" para ver os comandos.`);
  }
}

async function handleInit(flags: CliFlags): Promise<void> {
  const result = await initProject(commonOptions(flags));
  if (result.created) {
    console.log(`Inicializado em ${result.statePaths.stateDir}`);
  } else {
    console.log(`Ja existe configuracao em ${result.statePaths.stateDir}`);
  }

  if (result.lockfile.adapters.active) {
    console.log(`Adapter ativo: ${result.lockfile.adapters.active}`);
  } else {
    console.log("Nenhum adapter detectado.");
  }
  console.log(`Auto-sync: ${result.lockfile.settings.autoSync ? "enabled" : "disabled"}`);
}

async function handleList(flags: CliFlags): Promise<void> {
  const catalog = await loadCatalog(await resolveProjectSource(commonOptions(flags)));
  const rows = catalog.skills.map((skill) => ({
    id: skill.id,
    version: skill.version,
    name: skill.name,
    description: truncate(skill.description, 96),
  }));

  if (rows.length === 0) {
    console.log("Nenhuma skill encontrada.");
    return;
  }

  console.log(`Catalogo: ${catalog.repo}@${catalog.ref}`);
  printTable(rows);
}

async function handleSearch(positionals: string[], flags: CliFlags): Promise<void> {
  const catalog = await loadCatalog(await resolveProjectSource(commonOptions(flags)));
  const searchOptions: SearchOptions = {
    query: positionals.join(" "),
  };
  const compatibility = asOptionalString(flags.compatibility);
  const tag = asOptionalString(flags.tag);
  if (compatibility) {
    searchOptions.compatibility = compatibility;
  }
  if (tag) {
    searchOptions.tags = tag;
  }
  const filtered = searchCatalogSkills(catalog.skills, searchOptions);

  if (filtered.length === 0) {
    console.log("Nenhuma skill corresponde aos filtros informados.");
    return;
  }

  console.log(`Catalogo: ${catalog.repo}@${catalog.ref}`);
  printTable(
    filtered.map((skill) => ({
      id: skill.id,
      version: skill.version,
      compatibility: skill.compatibility.join(","),
      description: truncate(skill.description, 72),
    })),
  );
}

async function handleInstall(positionals: string[], flags: CliFlags): Promise<void> {
  const installAll = Boolean(flags.all);
  const result = await installSkills(positionals, {
    ...commonOptions(flags),
    installAll,
  });

  console.log(`Instaladas ${result.installedCount} skill(s) em ${result.statePaths.stateDir}`);
  for (const skill of result.installedSkills) {
    console.log(`- ${skill.id}@${skill.version}`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleUpdate(positionals: string[], flags: CliFlags): Promise<void> {
  const result = await updateInstalledSkills(positionals, commonOptions(flags));
  if (result.updatedSkills.length === 0) {
    console.log("Nenhuma skill atualizada.");
  } else {
    console.log(`Atualizadas ${result.updatedSkills.length} skill(s) em ${result.statePaths.stateDir}`);
    for (const skill of result.updatedSkills) {
      console.log(`- ${skill.id}@${skill.version}`);
    }
  }

  for (const skillId of result.missingFromCatalog) {
    console.log(`- ${skillId} nao existe mais no catalogo remoto`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleRemove(positionals: string[], flags: CliFlags): Promise<void> {
  const result = await removeSkills(positionals, commonOptions(flags));
  if (result.removedSkills.length > 0) {
    console.log(`Removidas ${result.removedSkills.length} skill(s) de ${result.statePaths.stateDir}`);
    for (const skillId of result.removedSkills) {
      console.log(`- ${skillId}`);
    }
  }

  for (const skillId of result.missingSkills) {
    console.log(`- ${skillId} nao esta instalado`);
  }
  printAutoSyncResult(result.autoSync);
}

async function handleSync(flags: CliFlags): Promise<void> {
  const result = await syncInstalledSkills(commonOptions(flags));
  if (result.dryRun) {
    console.log(`Preview de ${result.skillCount} skill(s) para ${result.sync.adapter}`);
    console.log(`Arquivo alvo: ${result.sync.targetPath}`);
    console.log(`Modo de sync: ${result.syncMode}`);
    process.stdout.write(result.diff);
    return;
  }

  console.log(`Sincronizadas ${result.skillCount} skill(s) para ${result.sync.adapter}`);
  console.log(`Arquivo alvo: ${result.sync.targetPath}`);
  console.log(`Modo de sync: ${result.syncMode}`);
  if (!result.changed) {
    console.log("Sem alteracoes no arquivo alvo.");
  }
}

async function handleRun(positionals: string[], flags: CliFlags): Promise<void> {
  const target = positionals[0];
  if (!target) {
    throw new CliError('Informe o alvo no formato "skill-id:comando".', "RUN_REQUIRES_TARGET");
  }

  const parsed = parseSkillCommandReference(target);
  const exitCode = await runSkillScript(parsed.skillId, parsed.command, {
    ...commonOptions(flags),
    yes: parseBooleanFlag(flags.yes) || false,
    timeout: parsePositiveInt(asOptionalString(flags.timeout)),
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

async function handleUi(flags: CliFlags): Promise<void> {
  const options = commonOptions(flags);
  const state = await getInstalledSkills(options);
  const catalog = await loadCatalog(await resolveProjectSource(options));
  if (catalog.skills.length === 0) {
    console.log("Nenhuma skill disponivel no catalogo.");
    return;
  }

  const installedIds = Object.keys(state?.installed || {});
  const selection = await runInteractiveUi({
    skills: catalog.skills,
    installedIds,
  });

  if (selection.visibleIds.length === 0) {
    console.log(
      selection.query
        ? `Nenhuma skill corresponde ao filtro "${selection.query}".`
        : "Nenhuma skill disponivel no catalogo.",
    );
    return;
  }

  const installResult =
    selection.toInstall.length > 0
      ? await installSkills(selection.toInstall, options)
      : null;
  const removeResult =
    selection.toRemove.length > 0
      ? await removeSkills(selection.toRemove, options)
      : null;

  if (!installResult && !removeResult) {
    console.log("Nenhuma alteracao aplicada.");
    return;
  }

  console.log("Resumo do UI:");
  if (installResult) {
    console.log(`- Instaladas: ${installResult.installedSkills.map((skill) => skill.id).join(", ")}`);
  }
  if (removeResult) {
    console.log(`- Removidas: ${removeResult.removedSkills.join(", ")}`);
  }
}

async function handleStatus(flags: CliFlags): Promise<void> {
  const state = await getInstalledSkills(commonOptions(flags));
  if (!state) {
    console.log("Nenhuma instalacao local encontrada. Rode: skillex init");
    return;
  }

  const installedEntries = Object.entries(state.installed || {});
  console.log(`Catalogo configurado: ${state.catalog.repo}@${state.catalog.ref}`);
  console.log(`Adapter ativo: ${state.adapters.active || "(nenhum)"}`);
  console.log(`Auto-sync: ${state.settings.autoSync ? "enabled" : "disabled"}`);
  console.log(`Sync mode: ${state.syncMode || "(nenhum)"}`);
  if (state.adapters.detected.length > 0) {
    console.log(`Adapters detectados: ${state.adapters.detected.join(", ")}`);
  }
  if (state.sync) {
    console.log(`Ultimo sync: ${state.sync.adapter} -> ${state.sync.targetPath} em ${state.sync.syncedAt}`);
  }
  if (installedEntries.length === 0) {
    console.log("Nenhuma skill instalada.");
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

function commonOptions(flags: CliFlags): ProjectOptions {
  const options: ProjectOptions = {
    cwd: path.resolve(asOptionalString(flags.cwd) || process.cwd()),
  };

  const repo = asOptionalString(flags.repo);
  const ref = asOptionalString(flags.ref);
  const catalogPath = asOptionalString(flags["catalog-path"]);
  const catalogUrl = asOptionalString(flags["catalog-url"]);
  const skillsDir = asOptionalString(flags["skills-dir"]);
  const agentSkillsDir = asOptionalString(flags["agent-skills-dir"]);
  const adapter = asOptionalString(flags.adapter);
  const autoSync = parseBooleanFlag(flags["auto-sync"]);
  const dryRun = parseBooleanFlag(flags["dry-run"]);
  const trust = parseBooleanFlag(flags.trust);
  const yes = parseBooleanFlag(flags.yes);
  const mode = parseSyncMode(asOptionalString(flags.mode));
  const timeout = parsePositiveInt(asOptionalString(flags.timeout));

  if (repo) {
    options.repo = repo;
  }
  if (ref) {
    options.ref = ref;
  }
  if (catalogPath) {
    options.catalogPath = catalogPath;
  }
  if (catalogUrl) {
    options.catalogUrl = catalogUrl;
  }
  if (skillsDir) {
    options.skillsDir = skillsDir;
  }
  if (agentSkillsDir) {
    options.agentSkillsDir = agentSkillsDir;
  }
  if (adapter) {
    options.adapter = adapter;
  }
  if (autoSync !== undefined) {
    options.autoSync = autoSync;
  }
  if (dryRun !== undefined) {
    options.dryRun = dryRun;
  }
  if (trust !== undefined) {
    options.trust = trust;
  }
  if (yes !== undefined) {
    options.yes = yes;
  }
  if (mode) {
    options.mode = mode;
  }
  if (timeout !== undefined) {
    options.timeout = timeout;
  }

  return options;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: CliFlags = {};
  const positionals: string[] = [];
  let command: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (!command && !token.startsWith("-")) {
      command = token;
      continue;
    }

    if (token.startsWith("--")) {
      const [rawKey, inlineValue] = token.slice(2).split("=", 2);
      if (!rawKey) {
        continue;
      }
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

  return {
    command,
    positionals,
    flags,
  };
}

function printHelp(): void {
  console.log(`skillex

Comandos:
  skillex init --repo owner/repo [--ref main]
  skillex list --repo owner/repo [--ref main]
  skillex search [texto] --repo owner/repo [--compatibility codex]
  skillex install <skill-id... | owner/repo[@ref]>
  skillex install --all --repo owner/repo [--ref main]
  skillex update [skill-id...]
  skillex remove <skill-id...>
  skillex sync [--adapter codex] [--dry-run] [--mode copy]
  skillex run <skill-id:comando> [--yes] [--timeout 30]
  skillex ui
  skillex status

Flags:
  --repo               Repositorio GitHub no formato owner/repo
  --ref                Branch, tag ou commit. Padrao: main
  --catalog-path       Caminho do catalogo no repo. Padrao: catalog.json
  --catalog-url        URL direta para o catalogo remoto
  --skills-dir         Pasta remota das skills. Padrao: skills
  --agent-skills-dir   Pasta local gerenciada. Padrao: .agent-skills
  --cwd                Projeto alvo. Padrao: diretorio atual
  --adapter            Adapter forçado: ${listAdapters().map((adapter) => adapter.id).join(", ")}
  --auto-sync          Habilita sync automatico no workspace
  --dry-run            Faz preview/diff sem escrever no disco
  --mode               Modo de sync: symlink ou copy
  --compatibility      Filtra skills por compatibilidade
  --tag                Filtra skills por tags
  --all                Instala todas as skills do catalogo
  --trust              Aceita instalar skill direta do GitHub sem confirmacao
  --yes                Pula confirmacao para o comando run
  --timeout            Timeout em segundos para scripts executados via run
`);
}

function printTable(rows: Array<Record<string, string | number | boolean | null | undefined>>): void {
  const columns = Object.keys(rows[0]!);
  const widths: number[] = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)),
  );

  console.log(columns.map((column, index) => column.padEnd(widths[index] ?? 0)).join("  "));
  console.log(widths.map((size) => "-".repeat(size)).join("  "));
  for (const row of rows) {
    console.log(
      columns
        .map((column, index) => String(row[column] ?? "").padEnd(widths[index] ?? 0))
        .join("  "),
    );
  }
}

function truncate(value: string, maxLength: number): string {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function parseBooleanFlag(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === true) {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new CliError(`Valor booleano invalido: ${value}`, "INVALID_BOOLEAN_FLAG");
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Valor numerico invalido: ${value}`, "INVALID_NUMBER_FLAG");
  }
  return parsed;
}

function parseSyncMode(value: string | undefined): SyncWriteMode | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "copy" || value === "symlink") {
    return value;
  }

  throw new CliError(`Modo de sync invalido: ${value}`, "INVALID_SYNC_MODE");
}

function printAutoSyncResult(
  result: Awaited<ReturnType<typeof installSkills>>["autoSync"] |
    Awaited<ReturnType<typeof updateInstalledSkills>>["autoSync"] |
    Awaited<ReturnType<typeof removeSkills>>["autoSync"],
): void {
  if (!result) {
    return;
  }

  const suffix = result.changed ? "" : " (sem alteracoes)";
  console.log(`Auto-sync: ${result.sync.adapter} -> ${result.sync.targetPath} [${result.syncMode}]${suffix}`);
}

function asOptionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
