import path from "node:path";
import { pathExists } from "./fs.js";

const ADAPTERS = [
  {
    id: "codex",
    label: "OpenAI Codex",
    markers: [
      { path: "AGENTS.md", weight: 1 },
      { path: ".codex", weight: 12 },
      { path: ".codex/skills", weight: 16 },
    ],
    syncTarget: "AGENTS.md",
    syncMode: "managed-block",
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
    syncTarget: ".clinerules/askill-skills.md",
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
    syncTarget: ".cursor/rules/askill-skills.mdc",
    syncMode: "managed-file",
  },
  {
    id: "claude",
    label: "Claude Code",
    markers: [
      { path: "CLAUDE.md", weight: 16 },
      { path: ".claude", weight: 18 },
    ],
    syncTarget: "CLAUDE.md",
    syncMode: "managed-block",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    markers: [
      { path: "GEMINI.md", weight: 16 },
      { path: ".gemini", weight: 18 },
    ],
    syncTarget: "GEMINI.md",
    syncMode: "managed-block",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    markers: [
      { path: ".windsurf", weight: 16 },
      { path: ".windsurf/rules", weight: 18 },
    ],
    syncTarget: ".windsurf/rules/askill-skills.md",
    syncMode: "managed-file",
  },
];

const ADAPTER_INDEX = new Map(ADAPTERS.map((adapter, index) => [adapter.id, index]));
const ADAPTER_ALIASES = new Map([
  ["github-copilot", "copilot"],
  ["roo", "cline"],
  ["roo-code", "cline"],
  ["claude-code", "claude"],
  ["gemini-cli", "gemini"],
  ["codeium", "windsurf"],
  ["codeium-windsurf", "windsurf"],
]);

export function listAdapters() {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
  }));
}

export function listAdapterIds() {
  return ADAPTERS.map((adapter) => adapter.id);
}

export function normalizeAdapterId(adapterId) {
  if (adapterId === undefined || adapterId === null) {
    return null;
  }

  const normalized = String(adapterId).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ADAPTER_ALIASES.get(normalized) || normalized;
}

export function normalizeAdapterList(values) {
  if (!values) {
    return [];
  }

  const items = Array.isArray(values) ? values : String(values).split(",");
  const normalized = [];

  for (const item of items) {
    const canonical = normalizeAdapterId(item);
    if (!canonical || normalized.includes(canonical)) {
      continue;
    }
    normalized.push(canonical);
  }

  return normalized;
}

export function isKnownAdapter(adapterId) {
  return ADAPTERS.some((adapter) => adapter.id === normalizeAdapterId(adapterId));
}

export function getAdapter(adapterId) {
  return ADAPTERS.find((adapter) => adapter.id === normalizeAdapterId(adapterId)) || null;
}

export async function detectAdapters(cwd) {
  const detected = [];

  for (const adapter of ADAPTERS) {
    const score = await adapterScore(cwd, adapter);
    if (score > 0) {
      detected.push({ id: adapter.id, score, index: ADAPTER_INDEX.get(adapter.id) || 0 });
    }
  }

  detected.sort((left, right) => right.score - left.score || left.index - right.index);
  return detected.map((adapter) => adapter.id);
}

export async function resolveAdapterState(options = {}) {
  const cwd = options.cwd || process.cwd();
  const preferred = normalizeAdapterId(options.adapter);
  if (preferred && !isKnownAdapter(preferred)) {
    throw new Error(`Adapter desconhecido: ${preferred}`);
  }

  const detected = await detectAdapters(cwd);
  return {
    active: preferred || detected[0] || null,
    detected,
  };
}

async function adapterScore(cwd, adapter) {
  let score = 0;

  for (const marker of adapter.markers) {
    if (await pathExists(path.join(cwd, marker.path))) {
      score += marker.weight;
    }
  }

  return score;
}
