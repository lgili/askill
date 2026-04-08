#!/usr/bin/env node
/**
 * run_quality_gates.js
 * Run typecheck, lint, format check, and tests with one command.
 * Exits non-zero if any gate fails.
 *
 * Usage:
 *   node skills/typescript-pro/scripts/run_quality_gates.js
 *   node skills/typescript-pro/scripts/run_quality_gates.js --json
 *   node skills/typescript-pro/scripts/run_quality_gates.js --skip lint
 *
 * Exit codes:
 *   0 — all gates passed
 *   1 — one or more gates failed
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const skipIndex = args.indexOf("--skip");
const skipped = new Set(skipIndex !== -1 ? (args[skipIndex + 1] ?? "").split(",") : []);

// ---------------------------------------------------------------------------
// Gate definitions
// ---------------------------------------------------------------------------

function detectScripts() {
  try {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve("package.json"), "utf-8"),
    );
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

// Probe for available tools
function hasScript(name) {
  try {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve("package.json"), "utf-8"),
    );
    return Boolean(pkg.scripts?.[name]);
  } catch {
    return false;
  }
}

const GATES = [
  {
    id: "typecheck",
    label: "TypeScript",
    commands: [
      "npx tsc --noEmit",
      "npm run typecheck",
    ],
  },
  {
    id: "lint",
    label: "ESLint",
    commands: [
      "npx eslint src/ --max-warnings 0",
      "npm run lint",
    ],
  },
  {
    id: "format",
    label: "Prettier",
    commands: [
      "npx prettier --check src/",
      "npm run format:check",
    ],
  },
  {
    id: "test",
    label: "Tests",
    commands: [
      "npm test",
      "npx vitest run",
    ],
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runCommand(cmd) {
  try {
    execSync(cmd, { stdio: "pipe", cwd: resolve(".") });
    return { ok: true, output: "" };
  } catch (err) {
    const output = [
      err.stdout?.toString() ?? "",
      err.stderr?.toString() ?? "",
    ].filter(Boolean).join("\n").trim();
    return { ok: false, output };
  }
}

function tryCommands(commands) {
  for (const cmd of commands) {
    const result = runCommand(cmd);
    if (result.ok !== null) return result; // ran (passed or failed)
  }
  return { ok: null, output: "No command available" };
}

// ---------------------------------------------------------------------------
// Execute gates
// ---------------------------------------------------------------------------

const results = [];
const start = Date.now();

for (const gate of GATES) {
  if (skipped.has(gate.id)) {
    results.push({ id: gate.id, label: gate.label, status: "skipped", duration: 0 });
    continue;
  }

  const gateStart = Date.now();
  if (!asJson) process.stdout.write(`  Running ${gate.label}...`);

  const { ok, output } = tryCommands(gate.commands);
  const duration = Date.now() - gateStart;

  if (!asJson) {
    if (ok === true)  process.stdout.write(` ✓\n`);
    else if (ok === false) process.stdout.write(` ✗\n`);
    else process.stdout.write(` skipped (no runner found)\n`);
  }

  results.push({
    id: gate.id,
    label: gate.label,
    status: ok === true ? "passed" : ok === false ? "failed" : "unavailable",
    duration,
    output: ok === false ? output : undefined,
  });
}

const totalMs = Date.now() - start;
const failed = results.filter((r) => r.status === "failed");
const passed = results.filter((r) => r.status === "passed");

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (asJson) {
  console.log(JSON.stringify({ passed: failed.length === 0, results, totalMs }, null, 2));
} else {
  console.log();
  for (const r of results) {
    const icon = r.status === "passed" ? "✓" : r.status === "failed" ? "✗" : "–";
    const label = `${icon}  ${r.label.padEnd(14)} ${r.status.padEnd(11)} ${r.duration}ms`;
    if (r.status === "failed") console.error(label);
    else console.log(label);
  }

  console.log(`\n${passed.length}/${GATES.length} gates passed in ${totalMs}ms`);

  if (failed.length > 0) {
    console.error("\nFailures:\n");
    for (const r of failed) {
      console.error(`── ${r.label} ──`);
      if (r.output) console.error(r.output.slice(0, 2000));
      console.error();
    }
  }
}

if (failed.length > 0) {
  process.exit(1);
}
