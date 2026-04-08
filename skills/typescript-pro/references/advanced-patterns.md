# Advanced TypeScript Patterns

> Reference for: typescript-pro
> Load when: Using discriminated unions, builder pattern, branded types, decorators, or inversion of control

## Exhaustive Discriminated Union Handling

```typescript
type AdapterMode = "managed-block" | "symlink" | "copy";

function describeMode(mode: AdapterMode): string {
  switch (mode) {
    case "managed-block": return "Inject into shared config file between markers";
    case "symlink":       return "Create a relative symlink to the generated file";
    case "copy":          return "Copy the generated file directly to the target";
    default:
      // TypeScript error if a new case is added to AdapterMode but not handled here
      return assertNever(mode);
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

---

## Builder Pattern

Useful for constructing complex objects with many optional fields:

```typescript
class QueryBuilder {
  private clauses: string[] = [];
  private params: unknown[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  where(condition: string, ...values: unknown[]): this {
    this.clauses.push(condition);
    this.params.push(...values);
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  offset(n: number): this {
    this.offsetValue = n;
    return this;
  }

  build(): { sql: string; params: unknown[] } {
    let sql = "SELECT * FROM skills";
    if (this.clauses.length > 0) sql += ` WHERE ${this.clauses.join(" AND ")}`;
    if (this.limitValue !== undefined) sql += ` LIMIT ${this.limitValue}`;
    if (this.offsetValue !== undefined) sql += ` OFFSET ${this.offsetValue}`;
    return { sql, params: this.params };
  }
}

// Usage
const { sql, params } = new QueryBuilder()
  .where("compatibility @> $1", ["claude"])
  .where("version >= $2", "1.0.0")
  .limit(10)
  .offset(20)
  .build();
```

---

## Factory Pattern

```typescript
interface Adapter {
  syncTarget: string;
  writeSkills(skills: Skill[]): Promise<void>;
}

class ManagedBlockAdapter implements Adapter {
  constructor(readonly syncTarget: string) {}
  async writeSkills(skills: Skill[]): Promise<void> { /* inject between markers */ }
}

class SymlinkAdapter implements Adapter {
  constructor(readonly syncTarget: string) {}
  async writeSkills(skills: Skill[]): Promise<void> { /* create symlink */ }
}

function createAdapter(id: string, config: AdapterConfig): Adapter {
  switch (config.mode) {
    case "managed-block": return new ManagedBlockAdapter(config.syncTarget);
    case "symlink":       return new SymlinkAdapter(config.syncTarget);
    case "copy":          return new SymlinkAdapter(config.syncTarget); // same impl
    default:              return assertNever(config.mode);
  }
}
```

---

## Dependency Injection (without a framework)

```typescript
// Define interfaces for dependencies
interface HttpClient {
  fetchText(url: string): Promise<string>;
  fetchJson<T>(url: string): Promise<T>;
}

interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

// Service depends on interfaces, not implementations
class CatalogService {
  constructor(
    private readonly http: HttpClient,
    private readonly logger: Logger,
  ) {}

  async load(repo: string): Promise<CatalogData> {
    this.logger.info(`Fetching catalog: ${repo}`);
    const data = await this.http.fetchJson<CatalogData>(buildCatalogUrl(repo));
    return data;
  }
}

// In production
const service = new CatalogService(realHttpClient, consoleLogger);

// In tests
const service = new CatalogService(mockHttpClient, noopLogger);
```

---

## Opaque / Branded Types

```typescript
// Prevent passing a RepoSlug where a SkillId is expected
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

type SkillId  = Brand<string, "SkillId">;
type RepoSlug = Brand<string, "RepoSlug">;
type FilePath = Brand<string, "FilePath">;

// Constructor functions (the only way to create branded values)
const SkillId  = (s: string): SkillId  => s as SkillId;
const RepoSlug = (s: string): RepoSlug => s as RepoSlug;
const FilePath = (s: string): FilePath => s as FilePath;

function installSkill(id: SkillId): void { /* ... */ }
installSkill(SkillId("git-master"));   // ✅
installSkill(RepoSlug("lgili/skillex")); // ❌ Type error
```

---

## `infer` in Conditional Types

```typescript
// Extract return type of async function
type AsyncReturn<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

type InstallResult = AsyncReturn<typeof installSkills>;

// Extract first argument type
type FirstArg<T extends (...args: any[]) => any> =
  T extends (first: infer F, ...rest: any[]) => any ? F : never;

// Deeply flatten nested arrays
type Flatten<T> = T extends Array<infer Item> ? Flatten<Item> : T;
type Flat = Flatten<string[][][]>; // string
```

---

## const Enums vs Object Maps

Prefer `as const` objects over `enum` for better tree-shaking and interoperability:

```typescript
// ❌ enum — generates runtime code, not tree-shakeable, issues with isolation
enum SyncMode { Symlink = "symlink", Copy = "copy", ManagedBlock = "managed-block" }

// ✅ as const object — zero runtime cost, fully typed
const SYNC_MODE = {
  Symlink:      "symlink",
  Copy:         "copy",
  ManagedBlock: "managed-block",
} as const;

type SyncMode = typeof SYNC_MODE[keyof typeof SYNC_MODE];
// "symlink" | "copy" | "managed-block"
```

---

## Template Literal Types for Event Systems

```typescript
type AdapterId = "codex" | "copilot" | "claude" | "cursor" | "cline" | "gemini" | "windsurf";
type SkillEvent = "installed" | "updated" | "removed" | "synced";

type EventName = `skill:${SkillEvent}` | `adapter:${AdapterId}:synced`;

type EventPayload<E extends EventName> =
  E extends `skill:${infer Action}`
    ? { skillId: string; action: Action }
    : E extends `adapter:${infer Adapter}:synced`
      ? { adapter: Adapter; skillCount: number; targetPath: string }
      : never;

function emit<E extends EventName>(event: E, payload: EventPayload<E>): void {
  // fully typed per event name
}

emit("skill:installed",       { skillId: "git-master", action: "installed" }); // ✅
emit("adapter:claude:synced", { adapter: "claude", skillCount: 3, targetPath: "CLAUDE.md" }); // ✅
```
