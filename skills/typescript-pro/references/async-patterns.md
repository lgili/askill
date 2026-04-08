# Async Patterns

> Reference for: typescript-pro
> Load when: Writing async/await code, handling Promise errors, managing concurrency, or using AbortSignal

## Async/Await Fundamentals

```typescript
// Always await Promises — never fire-and-forget critical operations
async function installSkill(id: string): Promise<Skill> {
  const skill = await fetchSkillFromCatalog(id); // awaited
  await writeSkillFiles(skill);                  // awaited
  return skill;
}

// Parallel independent operations — faster than sequential await
async function installAll(ids: string[]): Promise<Skill[]> {
  return Promise.all(ids.map((id) => installSkill(id)));
}

// Sequential when operations depend on each other
async function initAndInstall(repo: string, ids: string[]): Promise<void> {
  const catalog = await fetchCatalog(repo);   // must complete first
  const skills  = await installAll(ids);      // then install
  await sync(skills);                         // then sync
}
```

---

## Error Handling in Async Code

```typescript
// ✅ try/catch with typed unknown
async function loadCatalog(repo: string): Promise<CatalogData> {
  try {
    const text = await fetchText(buildCatalogUrl(repo));
    return JSON.parse(text) as CatalogData;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CatalogError(`Failed to load catalog from ${repo}: ${message}`);
  }
}

// ✅ Promise.allSettled — collect all results, including failures
async function installBatch(ids: string[]): Promise<BulkResult> {
  const results = await Promise.allSettled(ids.map(installSkill));

  return {
    succeeded: results
      .filter((r): r is PromiseFulfilledResult<Skill> => r.status === "fulfilled")
      .map((r) => r.value),
    failed: results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, i) => ({ id: ids[i]!, reason: String(r.reason) })),
  };
}
```

---

## Timeouts with AbortSignal

```typescript
// Built-in timeout (Node 17.3+ / modern browsers)
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new NetworkError(url, response.status);
  }
  return response;
}

// Manual AbortController for more control
async function fetchWithAbort(url: string): Promise<{ data: unknown; abort: () => void }> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  const data = await fetch(url, { signal: controller.signal })
    .then((r) => r.json());

  return { data, abort };
}
```

---

## Concurrency Control

```typescript
// Limit concurrent operations (e.g., max 3 parallel requests)
async function installWithConcurrencyLimit(
  ids: string[],
  maxConcurrent = 3,
): Promise<Skill[]> {
  const results: Skill[] = [];

  for (let i = 0; i < ids.length; i += maxConcurrent) {
    const batch = ids.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map(installSkill));
    results.push(...batchResults);
  }

  return results;
}

// Using a semaphore for fine-grained control
class Semaphore {
  private queue: Array<() => void> = [];
  constructor(private capacity: number) {}

  async acquire(): Promise<void> {
    if (this.capacity > 0) {
      this.capacity--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.capacity++;
    }
  }
}
```

---

## Async Iteration

```typescript
// Async generator — stream results as they become available
async function* streamSkills(repo: string): AsyncGenerator<Skill> {
  const catalog = await fetchCatalog(repo);
  for (const entry of catalog.skills) {
    const skill = await fetchSkillDetails(entry.id);
    yield skill;
  }
}

// Consume with for-await-of
for await (const skill of streamSkills("lgili/skillex")) {
  console.log(`Loaded: ${skill.id}`);
}
```

---

## Common Async Mistakes

```typescript
// ❌ forEach does not await async callbacks
ids.forEach(async (id) => {
  await installSkill(id); // errors are swallowed, not sequential
});

// ✅ Use for...of for sequential, Promise.all for parallel
for (const id of ids) {
  await installSkill(id);
}

// ❌ Promise constructor anti-pattern
new Promise(async (resolve, reject) => {
  const data = await fetch(url); // unhandled rejection here
  resolve(data);
});

// ✅ Just return the promise directly
function loadData(): Promise<Data> {
  return fetch(url).then((r) => r.json());
}

// ❌ Nested .then() — callback hell
fetch(url)
  .then((r) => r.json())
  .then((data) => process(data))
  .then((result) => save(result))
  .catch((err) => handle(err));

// ✅ async/await — flat and readable
async function loadAndSave(): Promise<void> {
  const data   = await fetch(url).then((r) => r.json());
  const result = await process(data);
  await save(result);
}
```

---

## Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 500 } = options;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unreachable");
}

// Usage
const catalog = await withRetry(() => fetchCatalog(repo), { attempts: 3 });
```
