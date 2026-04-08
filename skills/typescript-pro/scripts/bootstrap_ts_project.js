#!/usr/bin/env node
/**
 * bootstrap_ts_project.js
 * Scaffold a production-ready TypeScript project skeleton.
 *
 * Usage:
 *   node bootstrap_ts_project.js --name my-project
 *   node bootstrap_ts_project.js --name my-lib --type library
 *   node bootstrap_ts_project.js --name my-api --type api --out /path/to/dir
 *
 * Types:
 *   library  — publishable npm package (CJS+ESM+.d.ts)
 *   cli      — Node.js CLI tool (ESM, bin entry)
 *   api      — Node.js HTTP API (ESM)
 *
 * Exit codes:
 *   0 — scaffolded successfully
 *   1 — error
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const name = getArg("--name");
const type = getArg("--type") ?? "library";
const outDir = getArg("--out") ? resolve(getArg("--out")) : resolve(name ?? "my-project");

if (!name) {
  console.error(
    "Usage: node bootstrap_ts_project.js --name <project-name> [--type library|cli|api] [--out <path>]",
  );
  process.exit(1);
}

if (!["library", "cli", "api"].includes(type)) {
  console.error(`Unknown type: ${type}. Use: library, cli, or api`);
  process.exit(1);
}

if (existsSync(outDir)) {
  console.error(`Directory already exists: ${outDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function write(relPath, content) {
  const abs = join(outDir, relPath);
  mkdirSync(resolve(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf-8");
  console.log(`  created  ${relPath}`);
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

const packageJson = {
  name,
  version: "0.1.0",
  description: "",
  type: "module",
  engines: { node: ">=20.0.0" },
  scripts: {
    build: "tsc -p tsconfig.json",
    typecheck: "tsc --noEmit",
    lint: "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format:check": "prettier --check src/",
    format: "prettier --write src/",
    test: "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    check: "npm run typecheck && npm run lint && npm run format:check && npm test",
    ...(type === "library" ? { prepublishOnly: "npm run check && npm run build" } : {}),
  },
  ...(type === "library"
    ? {
        exports: {
          "./package.json": "./package.json",
          ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        },
        files: ["dist", "README.md"],
      }
    : {}),
  ...(type === "cli"
    ? { bin: { [name]: "bin/cli.js" } }
    : {}),
  devDependencies: {
    typescript: "^5.4.0",
    "@types/node": "^20.0.0",
    vitest: "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    eslint: "^9.0.0",
    "typescript-eslint": "^8.0.0",
    prettier: "^3.0.0",
  },
};

write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

// ---------------------------------------------------------------------------
// tsconfig.json
// ---------------------------------------------------------------------------

const tsconfig = {
  compilerOptions: {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    verbatimModuleSyntax: true,
    isolatedModules: true,
    outDir: "dist",
    ...(type === "library" ? { declaration: true, declarationMap: true, sourceMap: true } : {}),
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist", "test", "**/*.test.ts"],
};

write("tsconfig.json", JSON.stringify(tsconfig, null, 2) + "\n");

// ---------------------------------------------------------------------------
// .prettierrc
// ---------------------------------------------------------------------------

write(".prettierrc", JSON.stringify({
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  arrowParens: "always",
}, null, 2) + "\n");

// ---------------------------------------------------------------------------
// .gitignore
// ---------------------------------------------------------------------------

write(".gitignore", [
  "node_modules/",
  "dist/",
  ".env",
  ".env.*",
  "!.env.example",
  "coverage/",
  "*.tsbuildinfo",
  ".DS_Store",
  "*.log",
].join("\n") + "\n");

// ---------------------------------------------------------------------------
// vitest.config.ts
// ---------------------------------------------------------------------------

write("vitest.config.ts", `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 90,
      },
    },
  },
});
`);

// ---------------------------------------------------------------------------
// src/index.ts (or src/cli.ts / src/app.ts)
// ---------------------------------------------------------------------------

if (type === "library") {
  write("src/index.ts", `// Public API — re-export only what consumers need
export { example } from "./example.js";
export type { ExampleOptions } from "./types.js";
`);

  write("src/example.ts", `import type { ExampleOptions } from "./types.js";

/**
 * Example exported function.
 */
export function example(options: ExampleOptions): string {
  return \`Hello, \${options.name}!\`;
}
`);

  write("src/types.ts", `export interface ExampleOptions {
  name: string;
}
`);

  write("test/example.test.ts", `import { describe, it, expect } from "vitest";
import { example } from "../src/example.js";

describe("example", () => {
  it("returns a greeting for a valid name", () => {
    expect(example({ name: "World" })).toBe("Hello, World!");
  });

  it("includes the name in the output", () => {
    expect(example({ name: "Alice" })).toContain("Alice");
  });
});
`);
}

if (type === "cli") {
  write("src/cli.ts", `import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    help:    { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
});

if (values.help) {
  console.log("${name} — TODO: add description");
  console.log("Usage: ${name} [options]");
  process.exit(0);
}

if (values.version) {
  console.log("0.1.0");
  process.exit(0);
}

// TODO: add commands
console.log("Hello from ${name}!");
`);

  write("bin/cli.js", `#!/usr/bin/env node
import "../dist/cli.js";
`);
}

if (type === "api") {
  write("src/app.ts", `import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(\`Server listening on http://localhost:\${PORT}\`);
});

export { server };
`);
}

// ---------------------------------------------------------------------------
// README.md
// ---------------------------------------------------------------------------

write("README.md", `# ${name}

> TODO: add description

## Requirements

- Node.js ≥ 20

## Development

\`\`\`bash
npm install
npm run check   # typecheck + lint + format + tests
npm run build   # compile to dist/
\`\`\`
`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log(`\n✓  Scaffolded ${type} project: ${outDir}`);
console.log("\nNext steps:");
console.log(`  cd ${name}`);
console.log("  npm install");
console.log("  npm run check");
