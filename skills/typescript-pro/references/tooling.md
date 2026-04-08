# TypeScript Tooling

> Reference for: typescript-pro
> Load when: Configuring tsconfig, setting up eslint/prettier, choosing a test runner, or debugging build issues

## tsconfig.json — Recommended Strict Config

```json
{
  "compilerOptions": {
    // Strict mode — enables all strict checks
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // Output
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Quality
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    // Helpers
    "esModuleInterop": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### Key options explained

| Option | Effect |
|--------|--------|
| `strict` | Enables `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, etc. |
| `noUncheckedIndexedAccess` | `arr[0]` is `T \| undefined`, not `T` |
| `exactOptionalPropertyTypes` | `{ x?: string }` does not allow `x: undefined` explicitly |
| `verbatimModuleSyntax` | Enforces `import type` for type-only imports |
| `isolatedModules` | Required for esbuild/swc transpilation |
| `declarationMap` | Enables "go to source" in editors for library consumers |

---

## eslint with @typescript-eslint

```json
// eslint.config.js (flat config, ESLint 9+)
import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
);
```

Key rules:
- `no-floating-promises` — catches unawaited async calls.
- `no-misused-promises` — catches Promises used in non-async contexts.
- `switch-exhaustiveness-check` — ensures all discriminated union cases are handled.

---

## Prettier

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

Run: `prettier --check src/` or `prettier --write src/`

---

## Test Runners

### Vitest (recommended for Node.js projects)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: { lines: 85, branches: 80, functions: 90 },
    },
  },
});
```

```json
// package.json scripts
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Node.js built-in (no extra dependencies)

```json
{
  "test": "tsc -p tsconfig.test.json && node --test .test-dist/**/*.test.js"
}
```

---

## Build Tools

| Tool | Use case |
|------|----------|
| `tsc` | Type checking + declaration emit; slower for large projects |
| `esbuild` | Fast bundling for CLI or API; no type checking |
| `tsx` | Run TypeScript directly in development (like `ts-node` but faster) |
| `tsup` | Library bundling: CJS + ESM + declarations in one command |

```bash
# Development — run TypeScript directly
npx tsx src/cli.ts

# Build library (CJS + ESM + .d.ts)
npx tsup src/index.ts --format cjs,esm --dts

# Type check without emitting
tsc --noEmit
```

---

## Useful Scripts in package.json

```json
{
  "scripts": {
    "build":       "tsc -p tsconfig.json",
    "typecheck":   "tsc --noEmit",
    "lint":        "eslint src/",
    "lint:fix":    "eslint src/ --fix",
    "format":      "prettier --write src/",
    "format:check":"prettier --check src/",
    "test":        "vitest run",
    "test:watch":  "vitest",
    "test:coverage":"vitest run --coverage",
    "check":       "npm run typecheck && npm run lint && npm run format:check && npm test"
  }
}
```

The `check` script mirrors what CI runs — use it locally before opening a PR.
