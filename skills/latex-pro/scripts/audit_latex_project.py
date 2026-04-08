#!/usr/bin/env python3
"""Audit a LaTeX project for common structural and reference issues."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


INPUT_PATTERN = re.compile(r"\\(?:input|include)\{([^}]+)\}")
GRAPHICS_PATTERN = re.compile(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}")
IF_FILE_EXISTS_PATTERN = re.compile(r"\\IfFileExists\{([^}]+)\}")
ADD_BIB_PATTERN = re.compile(r"\\addbibresource\{([^}]+)\}")
LEGACY_BIB_PATTERN = re.compile(r"\\bibliography\{([^}]+)\}")
CITE_PATTERN = re.compile(r"\\(?:cite|parencite|textcite|autocite|citep|citet)(?:\[[^\]]*\])?\{([^}]+)\}")
BIB_KEY_PATTERN = re.compile(r"@\w+\{([^,]+),")


@dataclass
class AuditItem:
    name: str
    status: str
    detail: str
    recommendation: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit a LaTeX repository.")
    parser.add_argument("--repo-root", default=".", help="Repository root to inspect.")
    parser.add_argument("--main", default="main.tex", help="Main LaTeX file.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when warnings are found.")
    return parser.parse_args()


def resolve_input_path(repo_root: Path, current_dir: Path, target: str) -> Path:
    candidate = Path(target)
    if not candidate.suffix:
        candidate = candidate.with_suffix(".tex")
    if candidate.is_absolute():
        return candidate
    return (current_dir / candidate).resolve()


def resolve_graphic_path(repo_root: Path, current_dir: Path, target: str) -> bool:
    candidate = Path(target)
    candidates: list[Path] = []
    if candidate.suffix:
        candidates.append(candidate)
    else:
        for suffix in (".pdf", ".png", ".jpg", ".jpeg", ".eps", ".svg"):
            candidates.append(candidate.with_suffix(suffix))
    for possibility in candidates:
        actual = possibility if possibility.is_absolute() else (current_dir / possibility)
        if actual.exists():
            return True
    return False


def collect_bib_files(repo_root: Path, content: str) -> list[Path]:
    files: list[Path] = []
    for match in ADD_BIB_PATTERN.findall(content):
        path = Path(match)
        if not path.suffix:
            path = path.with_suffix(".bib")
        files.append((repo_root / path).resolve())
    for match in LEGACY_BIB_PATTERN.findall(content):
        for item in match.split(","):
            path = Path(item.strip())
            if not path.suffix:
                path = path.with_suffix(".bib")
            files.append((repo_root / path).resolve())
    return files


def collect_citation_keys(content: str) -> set[str]:
    keys: set[str] = set()
    for block in CITE_PATTERN.findall(content):
        for key in block.split(","):
            cleaned = key.strip()
            if cleaned:
                keys.add(cleaned)
    return keys


def collect_bib_keys(paths: list[Path]) -> set[str]:
    keys: set[str] = set()
    for path in paths:
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        keys.update(key.strip() for key in BIB_KEY_PATTERN.findall(content))
    return keys


def audit(repo_root: Path, main_file: str) -> list[AuditItem]:
    main_path = (repo_root / main_file).resolve()
    if not main_path.exists():
        return [
            AuditItem(
                name="main-file",
                status="warn",
                detail=f"Main file not found: {main_path}",
                recommendation="Pass the correct --main path or rename the document entrypoint to main.tex.",
            )
        ]

    content = main_path.read_text(encoding="utf-8", errors="ignore")
    current_dir = main_path.parent
    optional_file_targets = {target.strip() for target in IF_FILE_EXISTS_PATTERN.findall(content)}

    missing_inputs = []
    for target in INPUT_PATTERN.findall(content):
        candidate = resolve_input_path(repo_root, current_dir, target)
        if not candidate.exists():
            missing_inputs.append(target)

    missing_graphics = []
    for target in GRAPHICS_PATTERN.findall(content):
        if target.strip() in optional_file_targets:
            continue
        if not resolve_graphic_path(repo_root, current_dir, target):
            missing_graphics.append(target)

    bib_files = collect_bib_files(repo_root, content)
    missing_bib_files = [str(path.relative_to(repo_root)) for path in bib_files if not path.exists()]
    cite_keys = collect_citation_keys(content)
    bib_keys = collect_bib_keys(bib_files)
    missing_cites = sorted(cite_keys - bib_keys)

    items = [
        AuditItem(
            name="documentclass",
            status="pass" if "\\documentclass" in content else "warn",
            detail="documentclass found" if "\\documentclass" in content else "documentclass missing",
            recommendation="Ensure the main file declares a document class." if "\\documentclass" not in content else "",
        ),
        AuditItem(
            name="inputs",
            status="pass" if not missing_inputs else "warn",
            detail="All included files found" if not missing_inputs else f"Missing included files: {', '.join(missing_inputs)}",
            recommendation="Fix \\input or \\include paths and ensure missing section files exist." if missing_inputs else "",
        ),
        AuditItem(
            name="graphics",
            status="pass" if not missing_graphics else "warn",
            detail="All graphics resolved" if not missing_graphics else f"Missing graphics: {', '.join(missing_graphics)}",
            recommendation="Check figure paths, extensions, and the figures/ directory layout." if missing_graphics else "",
        ),
        AuditItem(
            name="bibliography-files",
            status="pass" if not missing_bib_files else "warn",
            detail="Bibliography files found" if not missing_bib_files else f"Missing bibliography files: {', '.join(missing_bib_files)}",
            recommendation="Create the missing .bib files or correct bibliography declarations." if missing_bib_files else "",
        ),
        AuditItem(
            name="citations",
            status="pass" if not missing_cites else "warn",
            detail="All citation keys resolved" if not missing_cites else f"Missing bibliography keys: {', '.join(missing_cites)}",
            recommendation="Add the missing keys to the bibliography or fix the citation names." if missing_cites else "",
        ),
        AuditItem(
            name="latexmkrc",
            status="pass" if (repo_root / "latexmkrc").exists() else "warn",
            detail="latexmkrc present" if (repo_root / "latexmkrc").exists() else "latexmkrc missing",
            recommendation="Add latexmkrc for a stable local build policy if this project is maintained over time." if not (repo_root / "latexmkrc").exists() else "",
        ),
    ]

    return items


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    results = audit(repo_root, args.main)
    if args.json:
        payload = {
            "repo_root": str(repo_root),
            "ok": all(item.status == "pass" for item in results),
            "results": [asdict(item) for item in results],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(f"Audit: {repo_root}")
        for item in results:
            symbol = "PASS" if item.status == "pass" else "WARN"
            print(f"- {item.name}: {symbol} - {item.detail}")
            if item.recommendation:
                print(f"  recommendation: {item.recommendation}")

    if args.strict and any(item.status != "pass" for item in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
