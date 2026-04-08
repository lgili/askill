#!/usr/bin/env python3
"""Create pytest test templates with consistent structure."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold pytest test templates.")
    parser.add_argument("--repo-root", default=".", help="Repository root where tests are created.")
    parser.add_argument("--name", required=True, help="Feature or behavior name used in file/test naming.")
    parser.add_argument(
        "--kind",
        choices=["unit", "integration", "regression", "async", "api-contract"],
        default="unit",
        help="Template type to generate.",
    )
    parser.add_argument("--package", default="", help="Optional package import path used in template imports.")
    parser.add_argument(
        "--target-import",
        default="",
        help="Optional raw import line, for example: from mypkg.service import target_function",
    )
    parser.add_argument(
        "--fixture",
        action="append",
        default=[],
        help="Fixture names to pre-populate in the template. Can be repeated.",
    )
    parser.add_argument("--out", default="", help="Optional explicit output file path.")
    parser.add_argument("--force", action="store_true", help="Overwrite destination if it exists.")
    return parser.parse_args()


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", lowered)
    collapsed = re.sub(r"_+", "_", cleaned).strip("_")
    return collapsed or "feature"


def default_output(repo_root: Path, kind: str, slug: str) -> Path:
    if kind in {"unit", "async"}:
        return repo_root / "tests" / f"test_{slug}.py"
    if kind == "integration":
        return repo_root / "tests" / "integration" / f"test_{slug}.py"
    if kind == "api-contract":
        return repo_root / "tests" / "contract" / f"test_{slug}.py"
    return repo_root / "tests" / "regression" / f"test_{slug}.py"


def render_import_block(package: str, target_import: str) -> str:
    if target_import:
        return f"import pytest\n\n{target_import}\n"
    if not package:
        return "import pytest\n"
    return (
        "import pytest\n\n"
        f"# from {package} import target_function\n"
        f"# from {package}.errors import AppError\n"
    )


def render_fixture_block(fixtures: list[str]) -> str:
    if not fixtures:
        return ""
    blocks: list[str] = []
    for fixture_name in fixtures:
        blocks.append(
            f"""@pytest.fixture
def {fixture_name}() -> object:
    # TODO: return a real fixture value.
    return object()
"""
        )
    return "\n".join(blocks)


def render_unit_template(name_slug: str, imports: str, fixtures: str) -> str:
    return f'''from __future__ import annotations

{imports.rstrip()}

{fixtures}
def test_{name_slug}_happy_path() -> None:
    # Arrange
    input_data = {{"value": 1}}

    # Act
    # result = target_function(input_data)

    # Assert
    # assert result == expected_value
    assert input_data["value"] == 1


def test_{name_slug}_rejects_invalid_input() -> None:
    # Arrange
    bad_input = None

    # Act / Assert
    with pytest.raises((TypeError, ValueError)):
        if bad_input is None:
            raise TypeError("placeholder")
'''


def render_integration_template(name_slug: str, imports: str, fixtures: str) -> str:
    return f'''from __future__ import annotations

{imports.rstrip()}

{fixtures}
@pytest.mark.integration
def test_{name_slug}_integration_flow() -> None:
    # Arrange
    # Start required collaborators (db, queue, service client, etc.).

    # Act
    # response = integration_client.call(...)

    # Assert
    # assert response.status == "ok"
    assert True
'''


def render_regression_template(name_slug: str, imports: str, fixtures: str) -> str:
    return f'''from __future__ import annotations

{imports.rstrip()}

{fixtures}
def test_{name_slug}_regression_case() -> None:
    """Pin behavior for a previously reported bug."""
    # Arrange: reproduce the original failure inputs.

    # Act
    # result = target_function(bug_payload)

    # Assert: encode the expected fixed behavior.
    # assert result == expected
    assert True
'''


def render_async_template(name_slug: str, imports: str, fixtures: str) -> str:
    return f'''from __future__ import annotations

{imports.rstrip()}

{fixtures}
@pytest.mark.asyncio
async def test_{name_slug}_async_flow() -> None:
    # Arrange
    # payload = ...

    # Act
    # result = await target_function(payload)

    # Assert
    assert True
'''


def render_api_contract_template(name_slug: str, imports: str, fixtures: str) -> str:
    return f'''from __future__ import annotations

{imports.rstrip()}

{fixtures}
def test_{name_slug}_contract() -> None:
    # Arrange
    # client = ...

    # Act
    # response = client.get("/endpoint")

    # Assert
    # assert response.status_code == 200
    # assert response.json() == {{"status": "ok"}}
    assert True
'''


def render_template(kind: str, name_slug: str, package: str, target_import: str, fixtures: list[str]) -> str:
    imports = render_import_block(package, target_import)
    fixture_block = render_fixture_block(fixtures)
    if kind == "unit":
        return render_unit_template(name_slug, imports, fixture_block)
    if kind == "integration":
        return render_integration_template(name_slug, imports, fixture_block)
    if kind == "async":
        return render_async_template(name_slug, imports, fixture_block)
    if kind == "api-contract":
        return render_api_contract_template(name_slug, imports, fixture_block)
    return render_regression_template(name_slug, imports, fixture_block)


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(f"Refusing to overwrite existing file without --force: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    name_slug = slugify(args.name)
    out_path = Path(args.out).resolve() if args.out else default_output(repo_root, args.kind, name_slug)
    content = render_template(args.kind, name_slug, args.package, args.target_import, args.fixture)
    write_text(out_path, content, args.force)
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
