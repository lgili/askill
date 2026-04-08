# Module Design

> Reference for: typescript-pro
> Load when: Structuring ES modules, organizing imports/exports, or configuring package.json exports

## ESM Import Rules (NodeNext)

With `"moduleResolution": "NodeNext"` (required for modern Node.js):

```typescript
// ✅ Explicit .js extension — required for ESM even for .ts source files
import { installSkills } from "./install.js";
import type { ProjectOptions } from "./types.js";
import { DEFAULT_REPO } from "./config.js";

// ✅ Node built-ins with node: prefix (preferred since Node 14.18+)
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

// ❌ Missing .js extension — fails at runtime in ESM
import { installSkills } from "./install";

// ❌ No node: prefix — works but less explicit
import { readFile } from "fs/promises";
```

---

## Module Structure Patterns

### Feature module (co-locate by domain)

```
src/
  catalog/
    catalog.ts         ← main logic
    catalog.test.ts    ← tests next to source
    catalog-cache.ts   ← private implementation detail
    types.ts           ← catalog-specific types
    index.ts           ← public API (re-export selectively)
  install/
    install.ts
    install.test.ts
    types.ts
    index.ts
  shared/
    http.ts
    fs.ts
    output.ts
```

### Library layout (for published packages)

```
src/
  index.ts             ← main entry: re-export public API only
  adapters.ts
  catalog.ts
  install.ts
  types.ts             ← shared interfaces (keep small)
dist/                  ← compiled output (not committed)
```

---

## Barrel Files (index.ts)

Barrel files consolidate exports for a module's public API:

```typescript
// src/catalog/index.ts — only export what consumers need
export { loadCatalog, searchCatalogSkills } from "./catalog.js";
export { readCatalogCache, writeCatalogCache } from "./catalog-cache.js";
export type { CatalogData, CatalogSource } from "./types.js";

// Internal helpers are NOT re-exported:
// computeCacheKey, parseCatalogJson, buildRawGitHubUrl
```

**Avoid deep barrel files** that re-export everything from every submodule — they cause circular dependency issues and slow down TypeScript compilation in large projects.

---

## package.json `exports` Field

Configure the public API of your package precisely:

```json
{
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types":  "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./catalog": {
      "types":  "./dist/catalog.d.ts",
      "import": "./dist/catalog.js"
    },
    "./install": {
      "types":  "./dist/install.d.ts",
      "import": "./dist/install.js"
    }
  }
}
```

- The `"."` entry is the default import (`import from "my-package"`).
- Subpath exports (`"./catalog"`) restrict which internals consumers can import.
- `"types"` must come **before** `"import"` for TypeScript to resolve it.
- Files not listed in `"exports"` are not importable by consumers (enforced in Node 12+).

---

## Circular Dependencies

Circular imports cause runtime `undefined` values and confusing type errors.

**Detect them:**
```bash
npx madge --circular --extensions ts src/
```

**Break them by:**
1. Extracting shared types into a dedicated `types.ts` that nothing imports from.
2. Moving shared utilities into a `shared/` or `utils/` module that both sides import.
3. Injecting dependencies via constructor/function parameters instead of static imports.

**Never-circular rule:** Types and interfaces can be in a shared file. Implementations should not circularly depend on each other.

---

## Dependency Direction

Keep dependency flow strictly one-directional:

```
CLI / API layer  →  Domain / Application layer  →  Infrastructure / IO layer
                                                  ↑
                                          Types and interfaces (no dependencies)
```

```typescript
// ✅ Domain layer (install.ts) imports types and infrastructure
import type { ProjectOptions, SkillManifest } from "./types.js";
import { readJson, writeJson } from "./fs.js";
import { fetchText } from "./http.js";

// ❌ Types layer should NOT import from domain or infrastructure
// types.ts importing from install.ts → circular dependency
```

---

## Type-Only Imports

Use `import type` for type-only imports to ensure zero runtime cost:

```typescript
// ✅ type-only import — erased at compile time, no runtime import
import type { ProjectOptions, SyncWriteMode } from "./types.js";
import type { LockfileState } from "./install.js";

// Regular import — included in the bundle
import { installSkills, syncInstalledSkills } from "./install.js";
```

This also prevents accidentally using a type-only import as a value at runtime.
