---
name: cpp-pro
description: Modern C++ (C++23/C++20) specialist for designing, implementing, reviewing, and modernizing performance-sensitive C++ across libraries, CLIs, services, and systems code. Use when working with `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.h`, `CMakeLists.txt`, `CMakePresets.json`, `vcpkg.json`, `conanfile.txt`, `conanfile.py`, or requests involving RAII, concepts, ranges, coroutines, template metaprogramming, concurrency, sanitizers, GoogleTest, Catch2, `clang-tidy`, profiling, ABI boundaries, or legacy C++ migration. Trigger for asks like "cpp pro", "modernizar c++", "cmake", "gtest", "catch2", "clang-tidy", "sanitizer", "performance c++", "concepts", "concurrency", or "refatorar c++ legado".
---

# C++ Pro

## Overview

Use this skill to deliver modern C++ with explicit ownership, target-based builds,
testable boundaries, and performance decisions backed by toolchain evidence.

Default stance:

- Prefer simple value-oriented designs before template cleverness.
- Make ownership, lifetimes, and thread-safety explicit in interfaces.
- Keep headers lean and stable; keep implementation detail in source files.
- Use modern standard-library facilities before introducing third-party abstractions.
- Treat warnings, sanitizer findings, and data-race reports as real defects.

## Core Workflow

1. Inspect toolchain and runtime constraints.
   - Confirm compiler family, standard library, target platform, and C++ standard.
   - Read `CMakeLists.txt`, `CMakePresets.json`, package-manager files, and CI before changing structure.
   - Identify whether the code is a library, CLI, service, or low-level subsystem with ABI/perf constraints.

2. Design interfaces around ownership and failure semantics.
   - Prefer value semantics by default; use `std::unique_ptr` for transfer of ownership.
   - Use `std::span`, `std::string_view`, and references for non-owning boundaries.
   - Decide early whether a subsystem uses exceptions, status objects, or `std::expected` style results.

3. Implement with modern, measurable C++ idioms.
   - Use concepts, ranges, algorithms, and `constexpr` where they improve clarity or safety.
   - Keep templates constrained and diagnostics readable.
   - Avoid exposing unstable implementation detail in public headers.

4. Verify quality before tuning.
   - Build with strict warnings and target-based compiler options.
   - Add or update focused GoogleTest or Catch2 coverage for changed behavior.
   - Run sanitizers, `clang-tidy`, and optional `cppcheck` when the environment supports them.

5. Optimize from evidence.
   - Profile before reworking algorithms, allocation strategy, or concurrency primitives.
   - Improve cache locality, copying behavior, and contention before low-value micro-optimizations.
   - Validate performance claims with benchmarks or reproducible measurements.

6. Deliver with migration notes.
   - Explain interface, ABI, and ownership tradeoffs.
   - Call out build-system or package-manager changes explicitly.
   - Prefer incremental modernization for legacy code instead of destabilizing rewrites.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Architecture and API boundaries | `references/architecture-and-interfaces.md` | Designing headers, ownership contracts, pimpl boundaries, ABI-sensitive APIs |
| Modern C++ features | `references/modern-cpp.md` | Concepts, ranges, coroutines, modules, and C++20/23 idioms |
| Template metaprogramming | `references/templates.md` | Concepts, traits, CRTP, variadics, or compile-time dispatch |
| Memory and performance | `references/memory-performance.md` | Allocators, move semantics, cache locality, SIMD, or data-layout work |
| Concurrency | `references/concurrency.md` | Atomics, thread pools, lock-free tradeoffs, cancellation, or parallel STL |
| Build and tooling | `references/build-tooling.md` | CMake, presets, sanitizers, static analysis, package managers, and CI |
| Legacy modernization | `references/legacy-modernization.md` | Incrementally upgrading raw pointers, old CMake, macros, or pre-modern C++ |
| Consolidated advanced samples | `references/advanced-patterns.md` | End-to-end examples, testing patterns, concurrency patterns, and production snippets |

## Bundled Scripts

- `scripts/bootstrap_cpp_project.py`
  - Scaffold a modern CMake baseline for `library`, `cli`, or `service` layouts.
  - Generates warnings policy, presets, optional sanitizers, optional `clang-tidy`, and starter tests.
  - Use when starting a new repository or standardizing an inconsistent baseline.

- `scripts/run_cpp_quality_gates.py`
  - Run configure, build, test, and optional `clang-format`, `clang-tidy`, and `cppcheck` steps.
  - Supports presets, explicit build dirs, optional target selection, and machine-readable reports.
  - Use before final delivery or to mirror CI locally.

- `scripts/scaffold_cpp_test_template.py`
  - Generate GoogleTest or Catch2 templates for `unit`, `integration`, or `regression` tests.
  - Use when you need consistent test structure without rewriting boilerplate each time.

- `scripts/audit_cpp_project.py`
  - Inspect an existing repository for CMake, tests, warnings, tooling, package-management, and CI gaps.
  - Use at the start of large refactors or when inheriting a weak or legacy C++ build.

## Constraints

### MUST DO

- Follow RAII and C++ Core Guidelines.
- Make ownership, lifetime, and mutability explicit in public interfaces.
- Keep CMake target-based and set the C++ standard explicitly.
- Add or update tests for all behavior changes.
- Use strict warnings and run relevant sanitizers or static analysis when available.
- Explain tradeoffs around exceptions, status returns, template constraints, and ABI stability.

### MUST NOT DO

- Use raw owning `new`/`delete` in normal application code.
- Hide ownership transfer or thread-safety assumptions.
- Mix incompatible error-handling models inside the same subsystem without a strong boundary reason.
- Put `using namespace std` in headers.
- Ship performance claims without profiling, benchmarking, or at least a concrete measurement plan.
- Rewrite large legacy areas all at once when an incremental migration path exists.

## Output Template

For non-trivial C++ tasks, provide:

1. Toolchain and architecture summary.
2. Interface and ownership decisions.
3. Implementation notes and notable C++20/23 features used.
4. Build, test, and tooling changes.
5. Risk notes, migration impact, and performance considerations.

## Primary References

- [cppreference](https://en.cppreference.com/)
- [CMake Documentation](https://cmake.org/cmake/help/latest/)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
- [GoogleTest Documentation](https://google.github.io/googletest/)
- [Catch2 Documentation](https://catch2-temp.readthedocs.io/en/latest/)
- [clang-tidy Documentation](https://clang.llvm.org/extra/clang-tidy/)
- [AddressSanitizer Documentation](https://clang.llvm.org/docs/AddressSanitizer.html)
