#!/usr/bin/env python3
"""Scaffold a LaTeX project from built-in templates."""

from __future__ import annotations

import argparse
from pathlib import Path


TEMPLATE_SECTION_MAP: dict[str, list[tuple[str, str]]] = {
    "article": [
        ("background", "\\section{Background}\n\nContext and prior work.\n"),
        ("method", "\\section{Method}\n\nDescribe the main approach.\n"),
        ("results", "\\section{Results}\n\nSummarize the findings.\n"),
        ("conclusion", "\\section{Conclusion}\n\nClose with the main takeaway.\n"),
    ],
    "report": [
        ("background", "\\chapter{Background}\n\nExplain the operating context.\n"),
        ("analysis", "\\chapter{Analysis}\n\nDiscuss evidence and reasoning.\n"),
        ("recommendations", "\\chapter{Recommendations}\n\nList actionable next steps.\n"),
    ],
    "thesis": [
        ("literature-review", "\\chapter{Literature Review}\n\nSummarize the field and gaps.\n"),
        ("methodology", "\\chapter{Methodology}\n\nExplain methods, data, and assumptions.\n"),
        ("results", "\\chapter{Results}\n\nPresent and interpret the results.\n"),
        ("discussion", "\\chapter{Discussion}\n\nDiscuss limitations and implications.\n"),
    ],
    "beamer": [
        (
            "motivation",
            "\\section{Motivation}\n\\begin{frame}{Motivation}\n  \\begin{itemize}\n    \\item Why this matters\n    \\item Key challenge\n  \\end{itemize}\n\\end{frame}\n",
        ),
        (
            "results",
            "\\section{Results}\n\\begin{frame}{Results}\n  \\begin{itemize}\n    \\item Main result\n    \\item Evidence or comparison\n  \\end{itemize}\n\\end{frame}\n",
        ),
    ],
}

DEFAULT_REPORT_TITLE_PRIMARY = "Laboratory"
DEFAULT_REPORT_TITLE_SECONDARY = "Report"
DEFAULT_CONFIDENTIALITY_NOTE = (
    "This document contains proprietary project information. Unauthorized reproduction or distribution is prohibited."
)
GREEN_REPORT_TEMPLATES = {
    "lab-report-green",
    "test-report-green",
    "validation-report-green",
    "design-report-green",
    "failure-analysis-green",
}
GREEN_REPORT_DEFAULT_TITLES: dict[str, tuple[str, str]] = {
    "lab-report-green": ("Laboratory", "Report"),
    "test-report-green": ("Test", "Report"),
    "validation-report-green": ("Validation", "Report"),
    "design-report-green": ("Design", "Report"),
    "failure-analysis-green": ("Failure Analysis", "Report"),
}
TEMPLATE_CHOICES = [
    "article",
    "report",
    "thesis",
    "beamer",
    "poster",
    "resume",
    "lab-report-green",
    "test-report-green",
    "validation-report-green",
    "design-report-green",
    "failure-analysis-green",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a LaTeX project from built-in templates.")
    parser.add_argument("--repo-root", default=".", help="Target directory for the generated project.")
    parser.add_argument(
        "--template",
        choices=TEMPLATE_CHOICES,
        default="article",
        help="Template family to scaffold.",
    )
    parser.add_argument("--title", default="Untitled Document", help="Document title.")
    parser.add_argument("--author", default="Your Name", help="Document author.")
    parser.add_argument("--date", default="\\today", help="Date expression used in the template.")
    parser.add_argument("--brand-name", default="Your Brand", help="Brand text used when no logo file is present.")
    parser.add_argument("--document-number", default="DOC-0001", help="Document number shown in the cover and header.")
    parser.add_argument("--project-number", default="PRJ-0001", help="Project number shown in the cover and header.")
    parser.add_argument("--revision", default="A", help="Document revision.")
    parser.add_argument("--status", default="Draft", help="Document status.")
    parser.add_argument("--reviewer", default="Reviewer Name", help="Document reviewer.")
    parser.add_argument("--brand-logo-path", default="img/brand-logo.png", help="Relative path to the optional logo image.")
    parser.add_argument(
        "--report-title-primary",
        default=DEFAULT_REPORT_TITLE_PRIMARY,
        help="Primary title line used by branded report templates.",
    )
    parser.add_argument(
        "--report-title-secondary",
        default=DEFAULT_REPORT_TITLE_SECONDARY,
        help="Secondary title line used by branded report templates.",
    )
    parser.add_argument(
        "--confidentiality-note",
        default=DEFAULT_CONFIDENTIALITY_NOTE,
        help="Confidentiality note used on branded title pages.",
    )
    parser.add_argument("--main-file", default="main.tex", help="Main LaTeX file name.")
    parser.add_argument(
        "--engine",
        choices=["auto", "pdflatex", "xelatex", "lualatex"],
        default="auto",
        help="Preferred engine used when generating latexmkrc.",
    )
    parser.add_argument("--with-bibliography", action="store_true", help="Create references.bib and bibliography hooks.")
    parser.add_argument("--with-sections", action="store_true", help="Generate section files for multi-file templates.")
    parser.add_argument("--with-latexmkrc", action="store_true", help="Generate latexmkrc with the selected engine.")
    parser.add_argument("--force", action="store_true", help="Overwrite files that already exist.")
    return parser.parse_args()


def write_text(path: Path, content: str, force: bool) -> str:
    if path.exists() and not force:
        return "skipped"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return "written"


def resolve_skill_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def load_template_files(template_name: str) -> dict[Path, str]:
    templates_root = resolve_skill_dir() / "assets" / "templates"
    template_dir = templates_root / template_name
    if not template_dir.exists():
        raise SystemExit(f"Template not found: {template_name}")

    files: dict[Path, str] = {}
    include_dirs: list[Path] = []
    if template_name in GREEN_REPORT_TEMPLATES:
        include_dirs.append(templates_root / "_shared" / "green-report")
    include_dirs.append(template_dir)

    for include_dir in include_dirs:
        for path in sorted(include_dir.rglob("*")):
            if path.is_dir():
                continue
            if path.name == "template.json":
                continue
            files[path.relative_to(include_dir)] = path.read_text(encoding="utf-8")
    return files


def template_default_titles(template_name: str) -> tuple[str, str]:
    return GREEN_REPORT_DEFAULT_TITLES.get(
        template_name,
        (DEFAULT_REPORT_TITLE_PRIMARY, DEFAULT_REPORT_TITLE_SECONDARY),
    )


def bibliography_setup(enabled: bool) -> tuple[str, str]:
    if not enabled:
        return "", ""
    return (
        "\\usepackage[backend=biber,style=authoryear]{biblatex}\n\\addbibresource{references.bib}",
        "\\printbibliography",
    )


def render_section_inputs(template_name: str, enabled: bool) -> tuple[str, dict[str, str]]:
    if not enabled or template_name not in TEMPLATE_SECTION_MAP:
        return "", {}

    lines: list[str] = []
    files: dict[str, str] = {}
    for stem, content in TEMPLATE_SECTION_MAP[template_name]:
        lines.append(f"\\input{{sections/{stem}}}")
        files[f"sections/{stem}.tex"] = content
    return "\n\n".join(lines), files


def render_latexmkrc(engine: str) -> str:
    resolved_engine = "pdflatex" if engine == "auto" else engine
    lines = [
        "$pdf_mode = 1;",
        "$pdflatex = 'pdflatex -interaction=nonstopmode -file-line-error %O %S';",
        "$xelatex = 'xelatex -interaction=nonstopmode -file-line-error %O %S';",
        "$lualatex = 'lualatex -interaction=nonstopmode -file-line-error %O %S';",
    ]
    if resolved_engine == "xelatex":
        lines.append("$pdf_mode = 5;")
    elif resolved_engine == "lualatex":
        lines.append("$pdf_mode = 4;")
    return "\n".join(lines)


def render_bib_stub() -> str:
    return """@article{Example2026,
  author  = {Doe, Jane},
  title   = {Example Reference Title},
  journal = {Journal of Useful Examples},
  year    = {2026}
}
"""


def build_file_map(args: argparse.Namespace) -> dict[Path, str]:
    repo_root = Path(args.repo_root).resolve()
    template_files = load_template_files(args.template)
    bib_setup, bib_print = bibliography_setup(args.with_bibliography)
    section_inputs, section_files = render_section_inputs(args.template, args.with_sections)
    report_title_primary, report_title_secondary = template_default_titles(args.template)
    if args.report_title_primary != DEFAULT_REPORT_TITLE_PRIMARY:
        report_title_primary = args.report_title_primary
    if args.report_title_secondary != DEFAULT_REPORT_TITLE_SECONDARY:
        report_title_secondary = args.report_title_secondary
    replacements = {
        "{{{TITLE}}}": args.title,
        "{{{AUTHOR}}}": args.author,
        "{{{DATE}}}": args.date,
        "{{{BRAND_NAME}}}": args.brand_name,
        "{{{DOCUMENT_NUMBER}}}": args.document_number,
        "{{{PROJECT_NUMBER}}}": args.project_number,
        "{{{REVISION}}}": args.revision,
        "{{{STATUS}}}": args.status,
        "{{{REVIEWER}}}": args.reviewer,
        "{{{BRAND_LOGO_PATH}}}": args.brand_logo_path,
        "{{{REPORT_TITLE_PRIMARY}}}": report_title_primary,
        "{{{REPORT_TITLE_SECONDARY}}}": report_title_secondary,
        "{{{CONFIDENTIALITY_NOTE}}}": args.confidentiality_note,
        "%% BIBLIOGRAPHY_SETUP %%": bib_setup,
        "%% BIBLIOGRAPHY_PRINT %%": bib_print,
        "%% SECTION_INPUTS %%": section_inputs,
    }

    files: dict[Path, str] = {}
    for relative_path, content in template_files.items():
        rendered = content
        for marker, value in replacements.items():
            rendered = rendered.replace(marker, value)
        destination = repo_root / (args.main_file if relative_path == Path("main.tex") else relative_path)
        files[destination] = rendered

    files.setdefault(repo_root / "figures" / ".gitkeep", "")
    files.setdefault(repo_root / "tables" / ".gitkeep", "")

    for relative_path, content in section_files.items():
        files[repo_root / relative_path] = content

    if args.with_bibliography:
        files[repo_root / "references.bib"] = render_bib_stub()

    if args.with_latexmkrc:
        files[repo_root / "latexmkrc"] = render_latexmkrc(args.engine)

    return files


def main() -> int:
    args = parse_args()
    file_map = build_file_map(args)
    print(f"Scaffolding in: {Path(args.repo_root).resolve()}")
    written = 0
    skipped = 0
    for path, content in file_map.items():
        status = write_text(path, content, args.force)
        print(f"[{status.upper()}] {path}")
        if status == "written":
            written += 1
        else:
            skipped += 1

    print(f"\nDone. written={written}, skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
