# Type System

> Reference for: typescript-pro
> Load when: Using generics, utility types, conditional types, mapped types, or template literal types

## Utility Types

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  createdAt: Date;
}

type CreateUserInput  = Omit<User, "id" | "createdAt">;
type UpdateUserInput  = Partial<Omit<User, "id" | "createdAt">>;
type PublicUser       = Pick<User, "id" | "name" | "role">;
type ReadonlyUser     = Readonly<User>;
type UserById         = Record<string, User>;

// ReturnType, Parameters — extract from function signatures
type HandlerReturn = ReturnType<typeof handleInstall>;
type HandlerParams = Parameters<typeof handleInstall>;

// Awaited — unwrap a Promise
type ResolvedUser = Awaited<Promise<User>>;
```

---

## Generics

```typescript
// Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic with default
interface Repository<T, Id = string> {
  findById(id: Id): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: Id): Promise<void>;
}

// Multiple constraints
function merge<A extends object, B extends object>(a: A, b: B): A & B {
  return { ...a, ...b };
}
```

---

## Discriminated Unions

Model variants with different shapes using a shared literal field:

```typescript
type SyncResult =
  | { status: "success"; skillCount: number; targetPath: string }
  | { status: "dry-run"; diff: string; skillCount: number }
  | { status: "no-change" }
  | { status: "error"; error: Error };

function handleSyncResult(result: SyncResult): void {
  switch (result.status) {
    case "success":  console.log(`Synced ${result.skillCount} skills`); break;
    case "dry-run":  console.log(result.diff); break;
    case "no-change": console.log("Nothing to sync"); break;
    case "error":    console.error(result.error.message); break;
    // TypeScript will warn if a case is missing (exhaustive check)
  }
}

// Exhaustive check helper
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
```

---

## Conditional Types

```typescript
// Extract the element type of an array
type ElementOf<T> = T extends (infer E)[] ? E : never;
type SkillId = ElementOf<string[]>; // string

// Distribute over unions
type NonNullable<T> = T extends null | undefined ? never : T;

// Infer from function return
type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;

// Check if a type extends another
type IsString<T> = T extends string ? true : false;
```

---

## Mapped Types

```typescript
// Make all properties optional and nullable
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] | null;
};

// Remove readonly
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Only include keys whose values extend a type
type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];
```

---

## Template Literal Types

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type ApiPath = `/api/${string}`;

// Build event name types
type SkillEvent = `skill:${"installed" | "updated" | "removed"}`;
// "skill:installed" | "skill:updated" | "skill:removed"

// Accessor patterns
type Getter<T extends string> = `get${Capitalize<T>}`;
type Setter<T extends string> = `set${Capitalize<T>}`;
```

---

## Type Guards

```typescript
// instanceof guard
function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

// Property check guard
function hasMessage(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

// Discriminant guard
function isSuccessResult(result: SyncResult): result is Extract<SyncResult, { status: "success" }> {
  return result.status === "success";
}

// Usage
try {
  await sync();
} catch (err: unknown) {
  if (isAppError(err)) {
    output.error(err.message);
  } else if (hasMessage(err)) {
    output.error(err.message);
  } else {
    output.error("Unknown error");
  }
}
```

---

## `satisfies` Operator (TypeScript 4.9+)

Validates a value against a type without widening it to that type:

```typescript
const ADAPTER_CONFIG = {
  claude:   { syncTarget: "CLAUDE.md",   mode: "managed-block" },
  codex:    { syncTarget: "AGENTS.md",   mode: "managed-block" },
  cursor:   { syncTarget: ".cursor/rules/skillex.mdc", mode: "symlink" },
} satisfies Record<string, { syncTarget: string; mode: "managed-block" | "symlink" }>;

// TypeScript knows ADAPTER_CONFIG.claude.mode is "managed-block", not the full union
type ClaudeMode = typeof ADAPTER_CONFIG.claude.mode; // "managed-block"
```

---

## Branded Types (Nominal Typing)

Prevent mixing compatible primitive types that have different semantics:

```typescript
type SkillId  = string & { readonly _brand: "SkillId" };
type RepoSlug = string & { readonly _brand: "RepoSlug" };

function toSkillId(s: string): SkillId   { return s as SkillId; }
function toRepoSlug(s: string): RepoSlug { return s as RepoSlug; }

function installSkill(id: SkillId): void { /* ... */ }

const id   = toSkillId("git-master");
const repo = toRepoSlug("lgili/skillex");

installSkill(id);    // ✅
installSkill(repo);  // ❌ Type error: RepoSlug is not assignable to SkillId
```
