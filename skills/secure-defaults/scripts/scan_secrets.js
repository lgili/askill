#!/usr/bin/env node
/**
 * scan_secrets.js
 * Scans files for common secret patterns (API keys, tokens, passwords, private keys).
 *
 * Usage:
 *   node scan_secrets.js                    # scan current directory
 *   node scan_secrets.js --path src/        # scan a specific path
 *   node scan_secrets.js --staged           # scan only git-staged files
 *
 * Exit codes:
 *   0 — no secrets found
 *   1 — secrets found or usage error
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Secret patterns
// ---------------------------------------------------------------------------

const PATTERNS = [
  {
    name: "Generic API Key assignment",
    pattern: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}["']?/i,
  },
  {
    name: "Generic password assignment",
    pattern: /(?<![a-z])(?:password|passwd|pwd|secret)\s*[:=]\s*["'][^"'$%{(]{8,}["']/i,
  },
  {
    name: "Bearer token literal",
    pattern: /bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/i,
  },
  {
    name: "AWS Access Key ID",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "AWS Secret Access Key",
    pattern: /aws[_-]?secret[_-]?(?:access[_-]?)?key\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i,
  },
  {
    name: "GitHub Personal Access Token",
    pattern: /\bghp_[A-Za-z0-9]{36}\b/,
  },
  {
    name: "GitHub OAuth Token",
    pattern: /\bgho_[A-Za-z0-9]{36}\b/,
  },
  {
    name: "PEM Private Key block",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "Database connection string with credentials",
    pattern: /(?:mongodb|postgresql|postgres|mysql|mariadb|redis):\/\/[^:@\s]+:[^@\s]{4,}@/i,
  },
  {
    name: "Slack token",
    pattern: /\bxox[baprs]-[0-9A-Za-z]{10,}\b/,
  },
  {
    name: "Stripe live key",
    pattern: /\b(?:sk|pk|rk)_live_[0-9a-zA-Z]{24,}\b/,
  },
  {
    name: "SendGrid API key",
    pattern: /\bSG\.[A-Za-z0-9\-_]{22,}\.[A-Za-z0-9\-_]{43,}\b/,
  },
  {
    name: "Twilio Auth Token",
    pattern: /\bSK[0-9a-fA-F]{32}\b/,
  },
  {
    name: "Google API Key",
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/,
  },
  {
    name: "JWT with non-trivial payload",
    pattern: /\beyJ[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\b/,
  },
];

// ---------------------------------------------------------------------------
// File filtering
// ---------------------------------------------------------------------------

const IGNORE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pdf", ".zip", ".gz", ".tar", ".tgz", ".rar", ".7z",
  ".mp3", ".mp4", ".avi", ".mov", ".wav",
  ".lock",        // lockfiles like package-lock.json are noisy
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".cache",
  "coverage", "__pycache__", ".venv", "venv", ".tox",
  ".next", ".nuxt", "out",
]);

const IGNORE_FILENAMES = new Set([
  ".env.example", ".env.sample", ".env.template",
  ".env.test", ".env.ci",  // placeholders
]);

function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    if (IGNORE_FILENAMES.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && !IGNORE_EXTENSIONS.has(extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf-8",
    });
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((f) => resolve(f));
  } catch {
    console.error("Error: could not get staged files. Are you in a git repository?");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--path");
const useStaged = args.includes("--staged");
const targetPath = pathIndex !== -1 ? resolve(args[pathIndex + 1] ?? ".") : resolve(".");

const files = useStaged ? getStagedFiles() : collectFiles(targetPath);

let findings = 0;

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    continue;
  }

  const lines = content.split("\n");
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? "";

    // Skip obvious placeholder lines
    if (/your[_-]?(?:api[_-]?)?key|placeholder|replace.?me|example|<[A-Z_]+>/i.test(line)) {
      continue;
    }

    for (const { name, pattern } of PATTERNS) {
      if (pattern.test(line)) {
        const preview = line.trim().slice(0, 120);
        console.error(`✗  ${name}`);
        console.error(`   ${file}:${lineNum + 1}`);
        console.error(`   ${preview}`);
        console.error();
        findings++;
        break; // one finding per line is enough
      }
    }
  }
}

if (findings > 0) {
  console.error(
    `Found ${findings} potential secret(s) in ${files.length} file(s).\n` +
    "Review and remove before committing. If these are false positives,\n" +
    "add a placeholder comment or use a secrets manager.",
  );
  process.exit(1);
}

console.log(`✓  No secrets detected in ${files.length} file(s).`);
