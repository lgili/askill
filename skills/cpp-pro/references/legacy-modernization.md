# Legacy Modernization

> Reference for: cpp-pro
> Load when: refactoring pre-modern C++, replacing raw pointers, updating old CMake, or tightening quality gates

## Modernize in Layers

Do not rewrite a legacy C++ codebase in one pass. Use a sequence like this:

1. Make the current behavior observable.
2. Stabilize the build and warnings.
3. Add regression coverage around risky code.
4. Modernize ownership and boundaries.
5. Improve data structures and algorithms only after correctness is stable.

## First Pass: Baseline the Repository

Capture the current state before changing behavior:

- Compiler versions and target platforms
- Current warning levels
- Existing tests and their execution path
- Sanitizer support
- Package-manager state (`vcpkg`, `conan`, vendored dependencies)
- Public headers and binary interfaces

Use `scripts/audit_cpp_project.py` early to surface obvious gaps.

## Raise Safety Before Refactoring

Before large code movement:

- Enable strict warnings incrementally.
- Turn on `CMAKE_EXPORT_COMPILE_COMMANDS`.
- Add `clang-tidy` and at least ASan/UBSan configurations if supported.
- Add regression tests around parser logic, ownership-sensitive code, and crash-prone paths.

If warnings explode, group them:

- correctness and UB first
- narrowing/sign conversions second
- style or modernization warnings after the build is stable

## Replacing Raw Ownership

Typical migration sequence:

1. Identify raw pointers that actually own memory.
2. Convert leaf allocations to `std::unique_ptr`.
3. Remove manual `delete` paths.
4. Convert factory APIs to return owning smart pointers or values.
5. Leave observer pointers/references explicit and documented.

Watch for:

- custom deleters
- arrays allocated with `new[]`
- ownership hidden in containers
- shared lifetime disguised as raw pointer aliasing

## Moving From Old CMake

Legacy CMake usually has global flags and directory-scoped include/link state.

Prefer this modernization order:

1. Replace global include directories with `target_include_directories`.
2. Replace global compile flags with `target_compile_options`.
3. Replace `link_directories` with imported targets or proper `find_package`.
4. Add presets so local and CI builds use the same configuration.
5. Split executable logic from reusable library targets.

## Introducing Modern Language Features Safely

Use modern C++ where it reduces defects or complexity, not as a style trophy:

- `std::string_view` and `std::span` for clear borrowed views
- ranges for readable pipelines over containers
- concepts to constrain templates and improve diagnostics
- `std::optional` or `std::expected` style returns for explicit absence/failure
- `constexpr` when it removes runtime cost or strengthens invariants

Avoid changing everything at once:

- do not convert all loops to ranges in one diff
- do not replace every template utility with a metaprogramming abstraction
- do not switch error models without a boundary plan

## High-Risk Areas

Treat these as separate workstreams with extra validation:

- lock-free or atomics-heavy code
- custom allocators and memory pools
- plugin or ABI-facing interfaces
- serialization and on-disk formats
- code that crosses DLL/shared-library boundaries

## Practical Migration Checklist

- Add tests before touching old logic.
- Move side effects behind explicit interfaces.
- Make ownership visible in signatures.
- Shrink giant translation units into cohesive modules.
- Introduce presets and reproducible CI.
- Keep each migration slice reviewable and reversible.

## Good Commit Shapes

Prefer commits like:

- `build: convert parser target to target-based include paths`
- `test: add regression coverage for malformed frame decoding`
- `refactor: replace owning raw pointer with unique_ptr in session manager`
- `ci: add asan preset and sanitizer workflow`

Avoid commits that mix:

- build migration
- large API redesign
- algorithm changes
- style-only rewrites

That combination makes regressions much harder to isolate.
