#!/usr/bin/env python3
"""Scaffold a modern C++ project with strong CMake defaults."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a C++ project with modern defaults.")
    parser.add_argument("--repo-root", default=".", help="Repository root to scaffold.")
    parser.add_argument("--project-name", required=True, help="Human-readable project name.")
    parser.add_argument(
        "--namespace",
        default="",
        help="C++ namespace, for example: demo or demo::core. Default: derived from project name.",
    )
    parser.add_argument(
        "--app-kind",
        choices=["library", "cli", "service"],
        default="library",
        help="Project archetype to scaffold.",
    )
    parser.add_argument(
        "--cxx-standard",
        choices=["20", "23"],
        default="20",
        help="C++ standard level to require.",
    )
    parser.add_argument(
        "--test-framework",
        choices=["gtest", "catch2", "none"],
        default="gtest",
        help="Test framework to wire into the scaffold.",
    )
    parser.add_argument(
        "--package-manager",
        choices=["none", "vcpkg", "conan"],
        default="none",
        help="Optional dependency-management file to generate.",
    )
    parser.add_argument("--with-presets", action="store_true", help="Generate CMakePresets.json.")
    parser.add_argument("--with-clang-tidy", action="store_true", help="Generate .clang-tidy.")
    parser.add_argument("--with-clang-format", action="store_true", help="Generate .clang-format.")
    parser.add_argument("--with-sanitizers", action="store_true", help="Enable sanitizer options and presets.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files.")
    return parser.parse_args()


def slugify_project_name(value: str) -> str:
    lowered = value.strip().lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    if not collapsed:
        raise SystemExit("Project name must contain at least one alphanumeric character.")
    return collapsed


def derive_namespace(project_slug: str, explicit: str) -> str:
    namespace = explicit.strip() if explicit else project_slug.replace("-", "_")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(::[A-Za-z_][A-Za-z0-9_]*)*", namespace):
        raise SystemExit(f"Invalid namespace: {namespace!r}")
    return namespace


def namespace_to_path(namespace: str) -> str:
    return namespace.replace("::", "/")


def target_id(project_slug: str) -> str:
    return project_slug.replace("-", "_")


def write_text(path: Path, content: str, force: bool) -> str:
    if path.exists() and not force:
        return "skipped"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return "written"


def render_cmake_lists(
    *,
    project_name: str,
    project_slug: str,
    namespace: str,
    app_kind: str,
    cxx_standard: str,
    test_framework: str,
    with_sanitizers: bool,
) -> str:
    target = target_id(project_slug)
    include_header = f"{namespace_to_path(namespace)}/statistics.hpp"
    executable_block = ""
    install_targets = [target]
    if app_kind == "cli":
        executable_block = f"""
add_executable({target}_cli apps/main.cpp)
target_link_libraries({target}_cli PRIVATE {target})
configure_project_target({target}_cli)
"""
        install_targets.append(f"{target}_cli")
    elif app_kind == "service":
        executable_block = f"""
add_executable({target}_service apps/main.cpp)
target_link_libraries({target}_service PRIVATE {target})
configure_project_target({target}_service)
"""
        install_targets.append(f"{target}_service")

    test_block = ""
    if test_framework != "none":
        if test_framework == "gtest":
            test_block = f"""
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.zip
)
FetchContent_MakeAvailable(googletest)

add_executable({target}_tests tests/{target}_test.cpp)
target_link_libraries({target}_tests PRIVATE {target} GTest::gtest_main)
configure_project_target({target}_tests)

include(GoogleTest)
gtest_discover_tests({target}_tests)
"""
        else:
            test_block = f"""
include(FetchContent)
FetchContent_Declare(
  Catch2
  URL https://github.com/catchorg/Catch2/archive/refs/tags/v3.6.0.zip
)
FetchContent_MakeAvailable(Catch2)

list(APPEND CMAKE_MODULE_PATH ${{catch2_SOURCE_DIR}}/extras)

add_executable({target}_tests tests/{target}_test.cpp)
target_link_libraries({target}_tests PRIVATE {target} Catch2::Catch2WithMain)
configure_project_target({target}_tests)

include(Catch)
catch_discover_tests({target}_tests)
"""

    sanitizer_options = ""
    if with_sanitizers:
        sanitizer_options = """
option(PROJECT_ENABLE_ASAN "Enable AddressSanitizer" OFF)
option(PROJECT_ENABLE_UBSAN "Enable UndefinedBehaviorSanitizer" OFF)
"""

    install_targets_block = " ".join(install_targets)

    return f"""cmake_minimum_required(VERSION 3.24)
project({target} VERSION 0.1.0 LANGUAGES CXX)

include(CTest)
include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD {cxx_standard})
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(PROJECT_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" ON)
option(PROJECT_ENABLE_CLANG_TIDY "Enable clang-tidy during build" OFF){sanitizer_options}

function(configure_project_target target_name)
  target_compile_features(${{target_name}} PUBLIC cxx_std_{cxx_standard})

  if(MSVC)
    target_compile_options(${{target_name}} PRIVATE /W4 /permissive-)
    if(PROJECT_WARNINGS_AS_ERRORS)
      target_compile_options(${{target_name}} PRIVATE /WX)
    endif()
  else()
    target_compile_options(${{target_name}} PRIVATE -Wall -Wextra -Wpedantic)
    if(PROJECT_WARNINGS_AS_ERRORS)
      target_compile_options(${{target_name}} PRIVATE -Werror)
    endif()
"""

    # The body above is intentionally split to keep the sanitizer block simple.


def render_cmake_lists_tail(*, with_sanitizers: bool, test_block: str, executable_block: str, install_targets_block: str, project_slug: str, namespace: str) -> str:
    target = target_id(project_slug)
    include_header = f"{namespace_to_path(namespace)}/statistics.hpp"
    sanitizer_block = ""
    if with_sanitizers:
        sanitizer_block = """
    if(PROJECT_ENABLE_ASAN)
      target_compile_options(${target_name} PRIVATE -fsanitize=address -fno-omit-frame-pointer)
      target_link_options(${target_name} PRIVATE -fsanitize=address -fno-omit-frame-pointer)
    endif()
    if(PROJECT_ENABLE_UBSAN)
      target_compile_options(${target_name} PRIVATE -fsanitize=undefined -fno-omit-frame-pointer)
      target_link_options(${target_name} PRIVATE -fsanitize=undefined -fno-omit-frame-pointer)
    endif()
"""

    return f"""{sanitizer_block}  endif()

  if(PROJECT_ENABLE_CLANG_TIDY)
    find_program(CLANG_TIDY_EXE NAMES clang-tidy)
    if(CLANG_TIDY_EXE)
      set_target_properties(${{target_name}} PROPERTIES CXX_CLANG_TIDY "${{CLANG_TIDY_EXE}}")
    endif()
  endif()
endfunction()

add_library({target}
  src/statistics.cpp
)

target_include_directories({target}
  PUBLIC
    $<BUILD_INTERFACE:${{CMAKE_CURRENT_SOURCE_DIR}}/include>
    $<INSTALL_INTERFACE:${{CMAKE_INSTALL_INCLUDEDIR}}>
)
configure_project_target({target})

{executable_block}
if(BUILD_TESTING)
{test_block}endif()

install(TARGETS {install_targets_block}
  RUNTIME DESTINATION ${{CMAKE_INSTALL_BINDIR}}
  LIBRARY DESTINATION ${{CMAKE_INSTALL_LIBDIR}}
  ARCHIVE DESTINATION ${{CMAKE_INSTALL_LIBDIR}}
)

install(DIRECTORY include/
  DESTINATION ${{CMAKE_INSTALL_INCLUDEDIR}}
)
"""


def build_cmake_lists(
    *,
    project_name: str,
    project_slug: str,
    namespace: str,
    app_kind: str,
    cxx_standard: str,
    test_framework: str,
    with_sanitizers: bool,
) -> str:
    head = render_cmake_lists(
        project_name=project_name,
        project_slug=project_slug,
        namespace=namespace,
        app_kind=app_kind,
        cxx_standard=cxx_standard,
        test_framework=test_framework,
        with_sanitizers=with_sanitizers,
    )
    target = target_id(project_slug)
    install_targets = [target]
    executable_block = ""
    if app_kind == "cli":
        executable_block = f"""
add_executable({target}_cli apps/main.cpp)
target_link_libraries({target}_cli PRIVATE {target})
configure_project_target({target}_cli)
"""
        install_targets.append(f"{target}_cli")
    elif app_kind == "service":
        executable_block = f"""
add_executable({target}_service apps/main.cpp)
target_link_libraries({target}_service PRIVATE {target})
configure_project_target({target}_service)
"""
        install_targets.append(f"{target}_service")

    if test_framework == "gtest":
        test_block = f"""  include(FetchContent)
  FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.zip
  )
  FetchContent_MakeAvailable(googletest)

  add_executable({target}_tests tests/{target}_test.cpp)
  target_link_libraries({target}_tests PRIVATE {target} GTest::gtest_main)
  configure_project_target({target}_tests)

  include(GoogleTest)
  gtest_discover_tests({target}_tests)
"""
    elif test_framework == "catch2":
        test_block = f"""  include(FetchContent)
  FetchContent_Declare(
    Catch2
    URL https://github.com/catchorg/Catch2/archive/refs/tags/v3.6.0.zip
  )
  FetchContent_MakeAvailable(Catch2)

  list(APPEND CMAKE_MODULE_PATH ${{catch2_SOURCE_DIR}}/extras)

  add_executable({target}_tests tests/{target}_test.cpp)
  target_link_libraries({target}_tests PRIVATE {target} Catch2::Catch2WithMain)
  configure_project_target({target}_tests)

  include(Catch)
  catch_discover_tests({target}_tests)
"""
    else:
        test_block = "  message(STATUS \"BUILD_TESTING enabled but no test framework scaffolded.\")\n"

    tail = render_cmake_lists_tail(
        with_sanitizers=with_sanitizers,
        test_block=test_block,
        executable_block=executable_block,
        install_targets_block=" ".join(install_targets),
        project_slug=project_slug,
        namespace=namespace,
    )
    return head + tail


def render_cmake_presets(project_slug: str, with_sanitizers: bool) -> str:
    configure_presets = [
        {
            "name": "dev",
            "displayName": "Development",
            "generator": "Ninja",
            "binaryDir": "${sourceDir}/build/dev",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Debug",
                "PROJECT_ENABLE_CLANG_TIDY": "OFF",
            },
        },
        {
            "name": "release",
            "displayName": "Release",
            "generator": "Ninja",
            "binaryDir": "${sourceDir}/build/release",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Release",
            },
        },
    ]
    build_presets = [
        {"name": "dev", "configurePreset": "dev"},
        {"name": "release", "configurePreset": "release"},
    ]
    test_presets = [
        {"name": "dev", "configurePreset": "dev", "output": {"outputOnFailure": True}},
        {"name": "release", "configurePreset": "release", "output": {"outputOnFailure": True}},
    ]
    if with_sanitizers:
        configure_presets.append(
            {
                "name": "asan",
                "displayName": "ASan + UBSan",
                "inherits": "dev",
                "binaryDir": "${sourceDir}/build/asan",
                "cacheVariables": {
                    "PROJECT_ENABLE_ASAN": "ON",
                    "PROJECT_ENABLE_UBSAN": "ON",
                },
            }
        )
        build_presets.append({"name": "asan", "configurePreset": "asan"})
        test_presets.append({"name": "asan", "configurePreset": "asan", "output": {"outputOnFailure": True}})

    payload = {
        "version": 6,
        "cmakeMinimumRequired": {"major": 3, "minor": 24, "patch": 0},
        "configurePresets": configure_presets,
        "buildPresets": build_presets,
        "testPresets": test_presets,
    }
    return json.dumps(payload, indent=2)


def render_gitignore() -> str:
    return """# Build directories
/build/
/out/

# Tooling
compile_commands.json
.cache/

# Editors and OS
.DS_Store
.idea/
.vscode/
"""


def render_clang_format() -> str:
    return """BasedOnStyle: LLVM
IndentWidth: 4
ColumnLimit: 100
PointerAlignment: Left
AllowShortFunctionsOnASingleLine: Empty
SortIncludes: CaseSensitive
"""


def render_clang_tidy() -> str:
    return """Checks: >
  bugprone-*,
  clang-analyzer-*,
  modernize-*,
  performance-*,
  portability-*,
  readability-*,
  -modernize-use-trailing-return-type,
  -readability-identifier-length
WarningsAsErrors: '*'
HeaderFilterRegex: '^(include|src|apps|tests)/'
"""


def render_readme(project_name: str, project_slug: str, app_kind: str, package_manager: str, with_presets: bool) -> str:
    quickstart = (
        "cmake --preset dev\ncmake --build --preset dev\nctest --preset dev"
        if with_presets
        else "cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug\ncmake --build build\nctest --test-dir build --output-on-failure"
    )

    package_note = ""
    if package_manager == "vcpkg":
        package_note = "\nDependency management: `vcpkg.json` manifest generated.\n"
    elif package_manager == "conan":
        package_note = "\nDependency management: `conanfile.txt` generated for `CMakeDeps` and `CMakeToolchain`.\n"

    executable_hint = ""
    if app_kind == "cli":
        executable_hint = f"\nRun the CLI with `./build/dev/{target_id(project_slug)}_cli` or the equivalent build output path.\n"
    elif app_kind == "service":
        executable_hint = f"\nRun the service stub with `./build/dev/{target_id(project_slug)}_service` or the equivalent build output path.\n"

    return f"""# {project_name}

Modern C++ scaffold generated by `cpp-pro`.

## Quickstart

```bash
{quickstart}
```
{package_note}{executable_hint}
## Repository shape

- `include/` for public headers
- `src/` for implementation
- `apps/` for entrypoints
- `tests/` for focused automated coverage
"""


def render_header(namespace: str) -> str:
    namespace_open = "\n".join(f"namespace {part} {{" for part in namespace.split("::"))
    namespace_close = "\n".join(f"}}  // namespace {part}" for part in reversed(namespace.split("::")))
    return f"""#pragma once

#include <cstddef>
#include <span>
#include <stdexcept>

{namespace_open}

class StatsError : public std::runtime_error {{
public:
    using std::runtime_error::runtime_error;
}};

struct Summary {{
    std::size_t count;
    double mean;
}};

[[nodiscard]] auto mean(std::span<const double> values) -> double;
[[nodiscard]] auto summarize(std::span<const double> values) -> Summary;

{namespace_close}
"""


def render_source(namespace: str, include_header: str) -> str:
    namespace_open = "\n".join(f"namespace {part} {{" for part in namespace.split("::"))
    namespace_close = "\n".join(f"}}  // namespace {part}" for part in reversed(namespace.split("::")))
    return f"""#include "{include_header}"

{namespace_open}

auto mean(std::span<const double> values) -> double {{
    if (values.empty()) {{
        throw StatsError("values must not be empty");
    }}

    double total = 0.0;
    for (double value : values) {{
        total += value;
    }}
    return total / static_cast<double>(values.size());
}}

auto summarize(std::span<const double> values) -> Summary {{
    return Summary{{
        .count = values.size(),
        .mean = mean(values),
    }};
}}

{namespace_close}
"""


def render_main(namespace: str, app_kind: str, include_header: str) -> str:
    call_prefix = "::".join(namespace.split("::"))
    body = (
        "    const auto summary = "
        f"{call_prefix}::summarize({{1.0, 2.0, 3.0, 4.0}});\n"
        '    std::cout << "mean=" << summary.mean << " count=" << summary.count << \'\\n\';\n'
    )
    if app_kind == "service":
        body = (
            "    const auto summary = "
            f"{call_prefix}::summarize({{10.0, 20.0, 30.0}});\n"
            '    std::cout << "[service] mean=" << summary.mean << " count=" << summary.count << \'\\n\';\n'
        )
    return f"""#include <iostream>

#include "{include_header}"

auto main() -> int {{
{body}    return 0;
}}
"""


def render_test(namespace: str, include_header: str, framework: str) -> str:
    qualified = "::".join(namespace.split("::"))
    if framework == "catch2":
        return f"""#include <catch2/catch_test_macros.hpp>

#include "{include_header}"

TEST_CASE("summary computes the arithmetic mean", "[summary]") {{
    const auto summary = {qualified}::summarize({{2.0, 4.0, 6.0}});

    REQUIRE(summary.count == 3);
    REQUIRE(summary.mean == 4.0);
}}

TEST_CASE("mean rejects empty input", "[summary]") {{
    REQUIRE_THROWS_AS({qualified}::mean({{}}), {qualified}::StatsError);
}}
"""

    return f"""#include <gtest/gtest.h>

#include "{include_header}"

TEST(StatisticsTest, ComputesTheArithmeticMean) {{
    const auto summary = {qualified}::summarize({{2.0, 4.0, 6.0}});

    EXPECT_EQ(summary.count, 3);
    EXPECT_DOUBLE_EQ(summary.mean, 4.0);
}}

TEST(StatisticsTest, RejectsEmptyInput) {{
    EXPECT_THROW({qualified}::mean({{}}), {qualified}::StatsError);
}}
"""


def render_vcpkg_manifest(project_slug: str) -> str:
    payload = {
        "name": project_slug,
        "version-string": "0.1.0",
        "dependencies": [],
    }
    return json.dumps(payload, indent=2)


def render_conanfile() -> str:
    return """[generators]
CMakeDeps
CMakeToolchain

[layout]
cmake_layout
"""


def build_file_map(args: argparse.Namespace) -> dict[Path, str]:
    project_slug = slugify_project_name(args.project_name)
    namespace = derive_namespace(project_slug, args.namespace)
    repo_root = Path(args.repo_root).resolve()
    include_header = f"{namespace_to_path(namespace)}/statistics.hpp"
    target = target_id(project_slug)

    files: dict[Path, str] = {
        repo_root / "CMakeLists.txt": build_cmake_lists(
            project_name=args.project_name,
            project_slug=project_slug,
            namespace=namespace,
            app_kind=args.app_kind,
            cxx_standard=args.cxx_standard,
            test_framework=args.test_framework,
            with_sanitizers=args.with_sanitizers,
        ),
        repo_root / ".gitignore": render_gitignore(),
        repo_root / "README.md": render_readme(
            args.project_name,
            project_slug,
            args.app_kind,
            args.package_manager,
            args.with_presets,
        ),
        repo_root / "include" / namespace_to_path(namespace) / "statistics.hpp": render_header(namespace),
        repo_root / "src" / "statistics.cpp": render_source(namespace, include_header),
    }

    if args.app_kind in {"cli", "service"}:
        files[repo_root / "apps" / "main.cpp"] = render_main(namespace, args.app_kind, include_header)

    if args.test_framework != "none":
        files[repo_root / "tests" / f"{target}_test.cpp"] = render_test(namespace, include_header, args.test_framework)

    if args.with_presets:
        files[repo_root / "CMakePresets.json"] = render_cmake_presets(project_slug, args.with_sanitizers)
    if args.with_clang_tidy:
        files[repo_root / ".clang-tidy"] = render_clang_tidy()
    if args.with_clang_format:
        files[repo_root / ".clang-format"] = render_clang_format()
    if args.package_manager == "vcpkg":
        files[repo_root / "vcpkg.json"] = render_vcpkg_manifest(project_slug)
    elif args.package_manager == "conan":
        files[repo_root / "conanfile.txt"] = render_conanfile()

    return files


def main() -> int:
    args = parse_args()
    files = build_file_map(args)
    root = Path(args.repo_root).resolve()
    print(f"Scaffolding in: {root}")
    written = 0
    skipped = 0
    for file_path, content in files.items():
        status = write_text(file_path, content, args.force)
        print(f"[{status.upper()}] {file_path}")
        if status == "written":
            written += 1
        else:
            skipped += 1

    print(f"\nDone. written={written}, skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
