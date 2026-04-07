import { spawn } from "node:child_process";
import * as path from "node:path";
import type { Writable } from "node:stream";
import { DEFAULT_AGENT_SKILLS_DIR, getStatePaths } from "./config.js";
import { confirmAction } from "./confirm.js";
import { readJson } from "./fs.js";
import { CliError } from "./types.js";
import type { ProjectOptions } from "./types.js";

interface RunSkillOptions extends ProjectOptions {
  yes?: boolean | undefined;
  timeout?: number | undefined;
  confirm?: (() => Promise<boolean>) | undefined;
  stdout?: Writable | undefined;
  stderr?: Writable | undefined;
}

/**
 * Parses a `skill-id:command` reference used by the `run` command.
 *
 * @param value - User-supplied run target.
 * @returns Parsed skill id and command name.
 * @throws {CliError} When the reference is invalid.
 */
export function parseSkillCommandReference(value: string): { skillId: string; command: string } {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new CliError('Use o formato "skill-id:comando" para executar scripts.', "INVALID_RUN_REFERENCE");
  }

  return {
    skillId: value.slice(0, separatorIndex),
    command: value.slice(separatorIndex + 1),
  };
}

/**
 * Executes a named script declared in an installed skill manifest.
 *
 * @param skillId - Installed skill identifier.
 * @param commandName - Script name from the local `skill.json`.
 * @param options - Execution options.
 * @returns Child process exit code.
 * @throws {CliError} When the skill or command is unavailable.
 */
export async function runSkillScript(
  skillId: string,
  commandName: string,
  options: RunSkillOptions = {},
): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const statePaths = getStatePaths(cwd, options.agentSkillsDir || DEFAULT_AGENT_SKILLS_DIR);
  const lockfile =
    (await readJson<{
      installed?: Record<string, { path?: string }>;
    }>(statePaths.lockfilePath, null)) || null;

  if (!lockfile) {
    throw new CliError("Nenhuma instalacao local encontrada. Rode: skillex init", "LOCKFILE_MISSING");
  }

  const metadata = lockfile.installed?.[skillId];
  if (!metadata?.path) {
    throw new CliError(`Skill "${skillId}" nao esta instalada.`, "SKILL_NOT_INSTALLED");
  }

  const skillDir = path.resolve(cwd, metadata.path);
  const manifest =
    (await readJson<{ scripts?: Record<string, string> }>(path.join(skillDir, "skill.json"), {})) || {};
  const scripts = manifest.scripts || {};
  const script = scripts[commandName];
  if (!script) {
    const available = Object.keys(scripts);
    throw new CliError(
      available.length > 0
        ? `Comando "${commandName}" nao existe para "${skillId}". Disponiveis: ${available.join(", ")}`
        : `A skill "${skillId}" nao declara scripts executaveis.`,
      "RUN_COMMAND_NOT_FOUND",
    );
  }

  const confirm = options.confirm || (() => confirmAction(`Executar em ${skillId}: ${script}?`));
  if (!options.yes) {
    const accepted = await confirm();
    if (!accepted) {
      throw new CliError("Execucao cancelada pelo usuario.", "RUN_CANCELLED");
    }
  }

  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const timeoutSeconds = options.timeout || 30;
  const timeoutMs = timeoutSeconds * 1000;

  return new Promise<number>((resolve, reject) => {
    let timedOut = false;
    const child = spawn(script, {
      cwd: skillDir,
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk) => {
      stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr.write(chunk);
    });
    child.on("error", reject);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        stderr.write(`Tempo limite excedido (${timeoutSeconds}s).\n`);
        resolve(1);
        return;
      }
      resolve(code ?? 0);
    });
  });
}
