#!/usr/bin/env python3
"""Create C++ test templates with consistent structure."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold GoogleTest or Catch2 test templates.")
    parser.add_argument("--repo-root", default=".", help="Repository root where tests are created.")
    parser.add_argument("--name", required=True, help="Behavior name used in file and test naming.")
    parser.add_argument("--framework", choices=["gtest", "catch2"], default="gtest", help="Test framework template.")
    parser.add_argument("--kind", choices=["unit", "integration", "regression"], default="unit", help="Template kind.")
    parser.add_argument("--header", default="", help='Optional header include, for example: demo/statistics.hpp')
    parser.add_argument("--suite", default="", help="Optional explicit suite name.")
    parser.add_argument("--out", default="", help="Optional output file path.")
    parser.add_argument("--force", action="store_true", help="Overwrite destination if it exists.")
    return parser.parse_args()


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", lowered)
    collapsed = re.sub(r"_+", "_", cleaned).strip("_")
    return collapsed or "feature"


def to_pascal_case(value: str) -> str:
    return "".join(part.capitalize() for part in value.split("_")) or "Feature"


def render_include_block(framework: str, header: str) -> str:
    lines = ["#include <catch2/catch_test_macros.hpp>" if framework == "catch2" else "#include <gtest/gtest.h>"]
    if header:
        lines.append(f'#include "{header}"')
    return "\n".join(lines)


def render_gtest(kind: str, suite_name: str, slug: str, includes: str) -> str:
    if kind == "integration":
        test_name = "RunsEndToEndFlow"
        arrange = "    // Arrange: spin up collaborators, adapters, or fixture state.\n"
    elif kind == "regression":
        test_name = "PreservesFixedBehavior"
        arrange = "    // Arrange: reproduce the original failing input or state.\n"
    else:
        test_name = "HandlesHappyPath"
        arrange = "    // Arrange\n"

    return f"""{includes}

TEST({suite_name}, {test_name}) {{
{arrange}    // Act

    // Assert
    SUCCEED();
}}

TEST({suite_name}, RejectsInvalidInput) {{
    // Arrange / Act / Assert
    EXPECT_TRUE(true);
}}
"""


def render_catch2(kind: str, slug: str, includes: str) -> str:
    tag = f"[{kind}]"
    if kind == "integration":
        body = "    // Arrange: initialize collaborating components.\n"
    elif kind == "regression":
        body = "    // Arrange: encode the original bug reproduction steps.\n"
    else:
        body = "    // Arrange\n"

    return f"""{includes}

TEST_CASE("{slug} behavior", "{tag}") {{
{body}    // Act

    // Assert
    REQUIRE(true);
}}
"""


def default_output(repo_root: Path, slug: str) -> Path:
    return repo_root / "tests" / f"{slug}_test.cpp"


def render_template(framework: str, kind: str, slug: str, suite: str, header: str) -> str:
    includes = render_include_block(framework, header)
    if framework == "catch2":
        return render_catch2(kind, slug, includes)
    return render_gtest(kind, suite, slug, includes)


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(f"Refusing to overwrite existing file without --force: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    slug = slugify(args.name)
    suite = args.suite or f"{to_pascal_case(slug)}Test"
    out_path = Path(args.out).resolve() if args.out else default_output(repo_root, slug)
    content = render_template(args.framework, args.kind, slug, suite, args.header)
    write_text(out_path, content, args.force)
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
