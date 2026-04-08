---
name: typescript-pro
description: Senior TypeScript engineering specialist for designing, implementing, reviewing, and refactoring type-safe, production-grade TypeScript code with strict mode, modern tooling, and Node.js or browser runtimes. Use when working with .ts/.tsx files, tsconfig.json, package.json, vitest/jest suites, async services, library design, or performance-sensitive code. Trigger for asks like "typescript pro", "strict typescript", "fix type errors", "design types for this", "refactor to typescript", "improve type safety", "type this correctly", "add generics", or any task involving TypeScript architecture, strict mode violations, or quality.
---

# TypeScript Pro

## Overview

Use this skill to build type-safe TypeScript solutions with strict configuration,
clean module design, strong test strategy, and a reliable build and delivery pipeline.

## Core Workflow

1. Inspect configuration and constraints.
   - Read `tsconfig.json`: confirm `strict: true`, `module`, `moduleResolution`, `target`, and `outDir`.
   - Check Node.js version, runtime model (CLI / API / library / browser), and deployment context.
   - Review existing patterns for imports, error handling, and module boundaries.
   - Note any deviations from strict mode and their documented justification.

2. Design types before implementation.
   - Model domain concepts as explicit interfaces or type aliases before writing logic.
   - Prefer **discriminated unions** over optional fields for shapes that differ by variant.
   - Use `unknown` for all external data; narrow with type guards or `zod` before use.
   - Keep types co-located with the code they describe; avoid centralized `types.ts` files for large projects.

3. Implement with strict typing.
   - Annotate all public function signatures with explicit parameter and return types.
   - Avoid `any`; use `unknown` + narrowing or well-constrained generics instead.
   - Use utility types (`Readonly`, `Partial`, `Required`, `Pick`, `Record`, `ReturnType`) to express intent.
   - Apply `as const` for literal types and enum-like objects.
   - Use `satisfies` to validate shapes without widening types.

4. Validate quality.
   - Run `tsc --noEmit` for type checking without emitting.
   - Run linter (`eslint` with `@typescript-eslint`) and formatter (`prettier`).
   - Run tests with full coverage; confirm all type errors are resolved.
   - Use `scripts/run_quality_gates.js` for a single-command quality check before delivery.

5. Deliver safely.
   - Keep build output clean: resolve `noUnusedLocals`, `noUnusedParameters`, `strictNullChecks`.
   - Update exported `.d.ts` types and JSDoc for any public API changes.
   - Document non-obvious type decisions inline.
   - Call out migration risk and rollback strategy for breaking type changes.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Type system | `references/type-system.md` | Generics, utility types, conditional types, mapped types, template literals |
| Async patterns | `references/async-patterns.md` | Promises, async/await, error handling, concurrency, AbortSignal |
| Module design | `references/module-design.md` | ESM imports, barrel files, module boundaries, `exports` in package.json |
| Tooling | `references/tooling.md` | tsconfig options, tsc, esbuild/tsx, vitest/jest, eslint, prettier setup |
| Advanced patterns | `references/advanced-patterns.md` | Discriminated unions, branded types, builder pattern, decorators, `satisfies` |

## Bundled Scripts

- `scripts/bootstrap_ts_project.js`
  - Scaffold a production-ready TypeScript project skeleton with strict tsconfig, vitest, eslint, prettier, and a recommended `src/` layout.
  - Use when starting a new project or standardizing a legacy repository baseline.
  - Run: `node skills/typescript-pro/scripts/bootstrap_ts_project.js --name my-project --type library`
  - Types: `library`, `cli`, `api`

- `scripts/run_quality_gates.js`
  - Run typecheck, lint, format check, and tests with one command; exits non-zero on any failure.
  - Use before final delivery, PR submission, or to verify CI parity locally.
  - Run: `node skills/typescript-pro/scripts/run_quality_gates.js`
  - Or: `node skills/typescript-pro/scripts/run_quality_gates.js --json`

## Constraints

### MUST DO

- Enable `strict: true` in `tsconfig.json` and resolve all resulting type errors.
- Annotate all exported and public function/method signatures with explicit return types.
- Use `unknown` for any external data (API responses, `JSON.parse`, `process.env` values) and narrow before use.
- Use discriminated unions for type variants that have structurally different shapes.
- Keep module boundaries explicit: no circular imports, no deep re-exports through unrelated modules.
- Run `tsc --noEmit` before suggesting a commit or PR.

### MUST NOT DO

- Use `any` as an escape hatch; use `unknown` + narrowing or a proper generic.
- Use `as <Type>` casts without a preceding type guard or inline justification comment.
- Suppress TypeScript errors with `// @ts-ignore` without a comment explaining why it is safe.
- Use `namespace` instead of ES modules for new code.
- Add `@types/*` packages for modules that already ship their own `.d.ts` declarations.
- Ship code with `noEmit` violations, unused imports, unreachable code, or unresolved type errors.

## Output Template

For non-trivial TypeScript tasks, provide:

1. **Type design summary** — new types, interfaces, or utility types introduced and their rationale.
2. **Implementation details** — key APIs, generic constraints, and error model used.
3. **Test updates** — behaviors covered, edge cases, and type-level tests if applicable.
4. **Quality gates** — typecheck / lint / format / test results, or what was blocked.
5. **Risk notes** — behavioral impact, API compatibility, and migration steps for breaking changes.

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive — Basarat](https://basarat.gitbook.io/typescript/)
- [Total TypeScript — Matt Pocock](https://www.totaltypescript.com/)
- [typescript-eslint](https://typescript-eslint.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Node.js — TypeScript Guide](https://nodejs.org/en/learn/getting-started/nodejs-with-typescript)
- [tsconfig Reference](https://www.typescriptlang.org/tsconfig)
