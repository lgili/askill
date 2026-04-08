#!/usr/bin/env python3
"""Plan and optionally run LaTeX compilation with detected tool choices."""

from __future__ import annotations

import argparse
import json
import re
import shlex
import shutil
import subprocess
from pathlib import Path


ENGINE_DIRECTIVE_PATTERN = re.compile(r"^%\s*!TEX\s+program\s*=\s*(\w+)\s*$", re.MULTILINE)
COMMON_HINTS = [
    ("Missing $ inserted", "A math-only command or symbol is probably outside math mode."),
    ("Undefined control sequence", "A command is unknown, misspelled, or requires a missing package/engine."),
    ("Citation", "A citation key may be missing or the bibliography backend may not have run."),
    ("Reference", "A label may be missing or more LaTeX passes may be required."),
    ("File `", "An included file, bibliography, or graphic may be missing from the expected path."),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Plan and run LaTeX compilation.")
    parser.add_argument("--repo-root", default=".", help="Repository root where commands run.")
    parser.add_argument("--main", default="main.tex", help="Main LaTeX file.")
    parser.add_argument(
        "--engine",
        choices=["auto", "pdflatex", "xelatex", "lualatex"],
        default="auto",
        help="Compilation engine. Auto detects from the source.",
    )
    parser.add_argument(
        "--bibliography",
        choices=["auto", "none", "bibtex", "biber"],
        default="auto",
        help="Bibliography backend. Auto detects from the source.",
    )
    parser.add_argument("--max-runs", type=int, default=3, help="Maximum number of LaTeX engine passes.")
    parser.add_argument("--dry-run", action="store_true", help="Print the detected build plan without running commands.")
    parser.add_argument("--allow-missing-tools", action="store_true", help="Do not fail when required tools are missing.")
    parser.add_argument("--json", action="store_true", help="Emit the build plan as JSON.")
    return parser.parse_args()


def read_main_file(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"Main file not found: {path}")
    return path.read_text(encoding="utf-8")


def detect_engine(content: str, explicit: str) -> str:
    if explicit != "auto":
        return explicit

    directive = ENGINE_DIRECTIVE_PATTERN.search(content)
    if directive:
        return directive.group(1).lower()
    if "xeCJK" in content or "\\setCJKmainfont" in content:
        return "xelatex"
    if "\\directlua" in content or "luacode" in content:
        return "lualatex"
    if "fontspec" in content:
        return "xelatex"
    return "pdflatex"


def detect_bibliography_backend(content: str, explicit: str) -> str:
    if explicit != "auto":
        return explicit
    if "\\addbibresource" in content:
        return "biber"
    if "\\bibliography{" in content or "\\bibliographystyle{" in content:
        return "bibtex"
    return "none"


def needs_makeindex(content: str) -> bool:
    return "\\makeindex" in content


def needs_glossaries(content: str) -> bool:
    return "\\makeglossaries" in content


def latex_command(engine: str, main_file: str) -> list[str]:
    return [engine, "-interaction=nonstopmode", "-file-line-error", main_file]


def build_plan(content: str, args: argparse.Namespace) -> dict[str, object]:
    engine = detect_engine(content, args.engine)
    bibliography = detect_bibliography_backend(content, args.bibliography)
    make_index = needs_makeindex(content)
    glossaries = needs_glossaries(content)
    main_stem = Path(args.main).stem

    commands: list[list[str]] = [latex_command(engine, args.main)]
    if bibliography == "bibtex":
        commands.append(["bibtex", main_stem])
    elif bibliography == "biber":
        commands.append(["biber", main_stem])
    if make_index:
        commands.append(["makeindex", main_stem])
    if glossaries:
        commands.append(["makeglossaries", main_stem])

    for _ in range(max(1, args.max_runs - 1)):
        commands.append(latex_command(engine, args.main))

    return {
        "engine": engine,
        "bibliography": bibliography,
        "makeindex": make_index,
        "glossaries": glossaries,
        "commands": commands,
    }


def required_tools(plan: dict[str, object]) -> list[str]:
    tools = {command[0] for command in plan["commands"] if command}
    return sorted(tools)


def translate_log(log_path: Path) -> list[str]:
    if not log_path.exists():
        return []
    content = log_path.read_text(encoding="utf-8", errors="ignore")
    hints: list[str] = []
    for needle, explanation in COMMON_HINTS:
        if needle in content:
            hints.append(explanation)
    return hints


def print_plan(plan: dict[str, object], repo_root: Path, main_file: str, as_json: bool) -> None:
    if as_json:
        print(json.dumps(plan, indent=2))
        return
    print(f"Project: {repo_root}")
    print(f"Main file: {main_file}")
    print(f"Engine: {plan['engine']}")
    print(f"Bibliography: {plan['bibliography']}")
    print(f"Needs makeindex: {plan['makeindex']}")
    print(f"Needs glossaries: {plan['glossaries']}")
    print("Commands:")
    for command in plan["commands"]:
        print(f"  - {' '.join(shlex.quote(part) for part in command)}")


def run_plan(plan: dict[str, object], repo_root: Path, allow_missing_tools: bool) -> int:
    missing = [tool for tool in required_tools(plan) if shutil.which(tool) is None]
    if missing:
        if allow_missing_tools:
            print(f"Missing tools, skipping execution: {', '.join(missing)}")
            return 0
        print(f"Missing required tools: {', '.join(missing)}")
        return 1

    for command in plan["commands"]:
        print(f"$ {' '.join(shlex.quote(part) for part in command)}", flush=True)
        completed = subprocess.run(command, cwd=repo_root, check=False)
        if completed.returncode != 0:
            log_path = repo_root / f"{Path(command[-1]).stem}.log"
            hints = translate_log(log_path)
            for hint in hints:
                print(f"HINT: {hint}")
            return completed.returncode
    return 0


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    main_path = repo_root / args.main
    content = read_main_file(main_path)
    plan = build_plan(content, args)
    print_plan(plan, repo_root, args.main, args.json)
    if args.dry_run:
        return 0
    return run_plan(plan, repo_root, args.allow_missing_tools)


if __name__ == "__main__":
    raise SystemExit(main())
