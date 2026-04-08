import * as path from "node:path";
import { pathExists } from "./fs.js";
import type { AdapterConfig, AdapterState } from "./types.js";
import { AdapterNotFoundError } from "./types.js";

const ADAPTERS: AdapterConfig[] = [
  {
    id: "codex",
    label: "OpenAI Codex",
    markers: [
      { path: "AGENTS.md", weight: 1 },
      { path: ".codex", weight: 12 },
      { path: ".codex/skills", weight: 16 },
    ],
    syncTarget: ".codex/skills/skillex-skills.md",
    syncMode: "managed-file",
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    markers: [{ path: ".github/copilot-instructions.md", weight: 16 }],
    syncTarget: ".github/copilot-instructions.md",
    syncMode: "managed-block",
  },
  {
    id: "cline",
    label: "Cline / Roo Code",
    markers: [
      { path: ".cline", weight: 16 },
      { path: ".roo", weight: 16 },
      { path: ".clinerules", weight: 12 },
      { path: ".roo/rules", weight: 12 },
    ],
    syncTarget: ".clinerules/skillex-skills.md",
    legacySyncTargets: [".clinerules/askill-skills.md"],
    syncMode: "managed-file",
  },
  {
    id: "cursor",
    label: "Cursor",
    markers: [
      { path: ".cursor", weight: 16 },
      { path: ".cursor/rules", weight: 18 },
      { path: ".cursorrules", weight: 12 },
    ],
    syncTarget: ".cursor/rules/skillex-skills.mdc",
    legacySyncTargets: [".cursor/rules/askill-skills.mdc"],
    syncMode: "managed-file",
  },
  {
    id: "claude",
    label: "Claude Code",
    markers: [
      { path: "CLAUDE.md", weight: 16 },
      { path: ".claude", weight: 18 },
    ],
    syncTarget: ".claude/skills/skillex-skills.md",
    legacySyncTargets: ["CLAUDE.md"],
    syncMode: "managed-file",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    markers: [
      { path: "GEMINI.md", weight: 16 },
      { path: ".gemini", weight: 18 },
    ],
    syncTarget: ".gemini/skills/skillex-skills.md",
    legacySyncTargets: ["GEMINI.md"],
    syncMode: "managed-file",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    markers: [
      { path: ".windsurf", weight: 16 },
      { path: ".windsurf/rules", weight: 18 },
    ],
    syncTarget: ".windsurf/rules/skillex-skills.md",
    legacySyncTargets: [".windsurf/rules/askill-skills.md"],
    syncMode: "managed-file",
  },
];

const ADAPTER_INDEX = new Map<string, number>(ADAPTERS.map((adapter, index) => [adapter.id, index]));
const ADAPTER_ALIASES = new Map([
  ["github-copilot", "copilot"],
  ["roo", "cline"],
  ["roo-code", "cline"],
  ["claude-code", "claude"],
  ["gemini-cli", "gemini"],
  ["codeium", "windsurf"],
  ["codeium-windsurf", "windsurf"],
]);

/**
 * Lists supported adapters for CLI help and UI display.
 *
 * @returns Lightweight adapter descriptors.
 */
export function listAdapters(): Array<Pick<AdapterConfig, "id" | "label">> {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
  }));
}

/**
 * Lists canonical adapter identifiers.
 *
 * @returns Supported adapter ids.
 */
export function listAdapterIds(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}

/**
 * Normalizes adapter aliases to canonical adapter identifiers.
 *
 * @param adapterId - User-supplied adapter identifier.
 * @returns Canonical adapter id or `null` when empty.
 */
export function normalizeAdapterId(adapterId: string | null | undefined): string | null {
  if (adapterId === undefined || adapterId === null) {
    return null;
  }

  const normalized = String(adapterId).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ADAPTER_ALIASES.get(normalized) || normalized;
}

/**
 * Normalizes a list of adapter identifiers or aliases.
 *
 * @param values - Adapter values as a list or comma-separated string.
 * @returns Canonical adapter ids without duplicates.
 */
export function normalizeAdapterList(values: string[] | string | null | undefined): string[] {
  if (!values) {
    return [];
  }

  const items = Array.isArray(values) ? values : String(values).split(",");
  const normalized: string[] = [];

  for (const item of items) {
    const canonical = normalizeAdapterId(item);
    if (!canonical || normalized.includes(canonical)) {
      continue;
    }
    normalized.push(canonical);
  }

  return normalized;
}

/**
 * Checks whether an adapter id or alias maps to a supported adapter.
 *
 * @param adapterId - Adapter identifier to check.
 * @returns `true` when the adapter is known.
 */
export function isKnownAdapter(adapterId: string | null | undefined): boolean {
  return ADAPTERS.some((adapter) => adapter.id === normalizeAdapterId(adapterId));
}

/**
 * Resolves a canonical adapter configuration by id or alias.
 *
 * @param adapterId - Adapter identifier to resolve.
 * @returns Adapter configuration.
 * @throws {AdapterNotFoundError} When the adapter is unknown.
 */
export function getAdapter(adapterId: string): AdapterConfig {
  const adapter = ADAPTERS.find((candidate) => candidate.id === normalizeAdapterId(adapterId)) || null;
  if (!adapter) {
    throw new AdapterNotFoundError(String(adapterId));
  }
  return adapter;
}

/**
 * Detects supported adapters present in a workspace and orders them by specificity.
 *
 * @param cwd - Workspace root.
 * @returns Ordered list of detected adapter ids.
 */
export async function detectAdapters(cwd: string): Promise<string[]> {
  const detected: Array<{ id: string; score: number; index: number }> = [];

  for (const adapter of ADAPTERS) {
    const score = await adapterScore(cwd, adapter);
    if (score > 0) {
      detected.push({ id: adapter.id, score, index: ADAPTER_INDEX.get(adapter.id) || 0 });
    }
  }

  detected.sort((left, right) => right.score - left.score || left.index - right.index);
  return detected.map((adapter) => adapter.id);
}

/**
 * Resolves the active adapter state for a workspace.
 *
 * @param options - Resolution options including cwd and optional adapter override.
 * @returns Active and detected adapter ids.
 * @throws {AdapterNotFoundError} When the explicit override is unknown.
 */
export async function resolveAdapterState(
  options: { cwd?: string | undefined; adapter?: string | undefined } = {},
): Promise<AdapterState> {
  const cwd = options.cwd || process.cwd();
  const preferred = normalizeAdapterId(options.adapter);
  if (preferred && !isKnownAdapter(preferred)) {
    throw new AdapterNotFoundError(preferred);
  }

  const detected = await detectAdapters(cwd);
  return {
    active: preferred || detected[0] || null,
    detected,
  };
}

async function adapterScore(cwd: string, adapter: AdapterConfig): Promise<number> {
  let score = 0;

  for (const marker of adapter.markers) {
    if (await pathExists(path.join(cwd, marker.path))) {
      score += marker.weight;
    }
  }

  return score;
}
