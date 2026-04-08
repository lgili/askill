#!/usr/bin/env node
/**
 * check_commit_msg.js
 * Validates a commit message against the Conventional Commits specification.
 *
 * Usage:
 *   node check_commit_msg.js "feat(api): add pagination endpoint"
 *   node check_commit_msg.js --file .git/COMMIT_EDITMSG
 *
 * Exit codes:
 *   0 — valid
 *   1 — invalid or usage error
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TYPES = [
  "feat", "fix", "docs", "style", "refactor",
  "perf", "test", "build", "ci", "chore", "revert",
];

// Matches: [revert: ]type[(scope)][!]: description
const SUBJECT_PATTERN =
  /^(revert: )?(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?(!)?: .{1,100}$/;

function getInput() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");

  if (fileIndex !== -1) {
    const filePath = args[fileIndex + 1];
    if (!filePath) {
      console.error("Error: --file requires a path argument.");
      process.exit(1);
    }
    return readFileSync(resolve(filePath), "utf-8").trim();
  }

  const message = args.join(" ").trim();
  if (!message) {
    console.error(
      "Usage:\n" +
      '  node check_commit_msg.js "feat(scope): description"\n' +
      "  node check_commit_msg.js --file .git/COMMIT_EDITMSG",
    );
    process.exit(1);
  }

  return message;
}

function validate(message) {
  const errors = [];
  const warnings = [];

  // Strip comment lines (git adds these to COMMIT_EDITMSG)
  const lines = message
    .split("\n")
    .filter((line) => !line.startsWith("#"));

  const subject = (lines[0] ?? "").trim();

  if (!subject) {
    errors.push("Commit message is empty.");
    return { errors, warnings };
  }

  // 1. Subject format
  if (!SUBJECT_PATTERN.test(subject)) {
    errors.push("Subject line does not match Conventional Commits format.");
    errors.push(`  Expected : type(scope): description`);
    errors.push(`  Got      : ${subject}`);
    errors.push(`  Valid types: ${TYPES.join(", ")}`);
    errors.push("  Examples:");
    errors.push('    feat(auth): add OAuth2 login');
    errors.push('    fix(catalog): resolve pagination offset');
    errors.push('    chore(deps): upgrade typescript to 5.9');
  }

  // 2. Subject length
  if (subject.length > 72) {
    errors.push(
      `Subject line is ${subject.length} chars (max: 72). Shorten or move details to the body.`,
    );
  }

  // 3. Trailing period
  if (subject.endsWith(".")) {
    warnings.push("Subject line ends with a period — omit it by convention.");
  }

  // 4. Capitalized description (after the colon)
  const descPart = subject.replace(/^[^:]+:\s*/, "");
  const firstChar = descPart.charAt(0);
  if (firstChar && firstChar !== firstChar.toLowerCase()) {
    warnings.push(
      `Description starts with uppercase "${firstChar}" — use lowercase by convention.`,
    );
  }

  // 5. Blank line between subject and body
  if (lines.length > 1 && lines[1] !== undefined && lines[1].trim() !== "") {
    warnings.push(
      "No blank line between subject and body. Add one for correct rendering in git tools.",
    );
  }

  return { errors, warnings };
}

const message = getInput();
const { errors, warnings } = validate(message);

for (const w of warnings) {
  console.warn(`⚠  ${w}`);
}

if (errors.length > 0) {
  for (const e of errors) {
    console.error(`✗  ${e}`);
  }
  console.error("\nCommit message rejected.");
  process.exit(1);
}

if (warnings.length === 0) {
  console.log("✓  Commit message is valid.");
} else {
  console.log("✓  Commit message is valid (with warnings above).");
}
