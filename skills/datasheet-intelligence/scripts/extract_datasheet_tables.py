#!/usr/bin/env python3
"""Extract electrical characteristics tables from component datasheets.

Identifies and extracts parameter tables (those with columns like Parameter,
Symbol, Min, Typ, Max, Unit) from semiconductor datasheets in PDF format.
Each table is saved as a CSV with a section-header context line.

Usage examples:
  # Extract all parameter tables, print as Markdown
  python extract_datasheet_tables.py datasheet.pdf

  # Save per-table CSV files to ./tables/
  python extract_datasheet_tables.py datasheet.pdf --out-dir ./tables

  # Only search pages 5-20
  python extract_datasheet_tables.py datasheet.pdf --pages 5-20

  # Machine-readable JSON
  python extract_datasheet_tables.py datasheet.pdf --json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

def _require(module: str, install: str) -> Any:
    try:
        import importlib
        return importlib.import_module(module)
    except ImportError:
        print(f"ERROR: '{module}' not installed. Run: pip install {install}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Electrical characteristics table heuristics
# ---------------------------------------------------------------------------

# If ANY of these words appear in the header row, it's likely a parameter table
TABLE_HEADER_KEYWORDS = {
    "parameter", "symbol", "min", "typ", "max", "unit", "units",
    "condition", "conditions", "value", "limit", "limits", "test condition",
    "description", "characteristic",
}

# Section headings that typically precede parameter tables
SECTION_KEYWORDS = [
    "electrical characteristics", "absolute maximum", "dc characteristics",
    "ac characteristics", "timing", "switching characteristics", "static",
    "recommended operating", "thermal", "electrical specification",
    "output characteristics", "input characteristics", "power supply",
]


def _is_parameter_table(headers: list[str]) -> bool:
    """Return True if the header row looks like an electrical parameters table."""
    if not headers:
        return False
    normalised = {h.lower().strip() for h in headers if h}
    # Need at least 2 keyword matches
    matches = normalised & TABLE_HEADER_KEYWORDS
    return len(matches) >= 2


def _find_section_heading(page_text: str, table_top: float, page_height: float) -> str:
    """Find the nearest section heading above the table using text position heuristics."""
    # table_top is a fraction of page height (0 = top, 1 = bottom)
    # We scan the text for section keyword lines
    lines = page_text.splitlines()
    best = ""
    for line in lines:
        stripped = line.strip().lower()
        for kw in SECTION_KEYWORDS:
            if kw in stripped:
                best = line.strip()
                # Don't break: take the *last* matching section before the table
    return best


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ParameterTable:
    page: int
    table_index: int
    section: str          # nearest section heading
    headers: list[str]
    rows: list[list[str]]


@dataclass
class ExtractionReport:
    source: str
    total_pages: int
    tables_found: int
    pages: list[int] = field(default_factory=list)
    tables: list[ParameterTable] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_page_range(spec: str, total: int) -> list[int]:
    pages: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            pages.extend(range(int(start), int(end) + 1))
        else:
            pages.append(int(part))
    return [p for p in pages if 1 <= p <= total]


def _table_to_csv_text(tbl: ParameterTable) -> str:
    import io
    buf = io.StringIO()
    # Write section heading as a comment
    if tbl.section:
        buf.write(f"# Section: {tbl.section}\n")
    buf.write(f"# Page: {tbl.page}\n")
    writer = csv.writer(buf)
    if tbl.headers:
        writer.writerow(tbl.headers)
    writer.writerows(tbl.rows)
    return buf.getvalue()


def _table_to_markdown(tbl: ParameterTable) -> str:
    headers = tbl.headers or [f"col{i}" for i in range(len(tbl.rows[0]) if tbl.rows else 1)]
    def _cell(s: str) -> str:
        return (s or "").replace("|", "\\|").replace("\n", " ").strip()
    sep_row = " | ".join("---" for _ in headers)
    header_row = " | ".join(_cell(h) for h in headers)
    body_rows = "\n".join("| " + " | ".join(_cell(c) for c in row) + " |" for row in tbl.rows)
    section_prefix = f"**{tbl.section}** (page {tbl.page})\n\n" if tbl.section else f"Page {tbl.page}\n\n"
    return f"{section_prefix}| {header_row} |\n| {sep_row} |\n{body_rows}"


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def extract_parameter_tables(
    pdf_path: Path,
    page_nums: list[int] | None,
) -> ExtractionReport:
    pdfplumber = _require("pdfplumber", "pdfplumber")

    report = ExtractionReport(source=str(pdf_path), total_pages=0, tables_found=0)

    with pdfplumber.open(str(pdf_path)) as pdf:
        report.total_pages = len(pdf.pages)
        effective_pages = page_nums if page_nums else list(range(1, len(pdf.pages) + 1))
        report.pages = effective_pages

        for pnum in effective_pages:
            page = pdf.pages[pnum - 1]
            page_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""

            try:
                raw_tables = page.extract_tables()
            except Exception as exc:
                report.warnings.append(f"Page {pnum}: table extraction error — {exc}")
                continue

            # Try to get table vertical positions for section heading lookup
            try:
                finder_tables = page.find_tables()
                table_tops = [t.bbox[1] / page.height if page.height else 0.5 for t in finder_tables]
            except Exception:
                table_tops = [0.5] * len(raw_tables)

            for ti, tbl in enumerate(raw_tables):
                if not tbl:
                    continue

                # Determine headers
                if tbl and all(cell for cell in tbl[0]):
                    headers = [str(c).strip() for c in tbl[0]]
                    rows = [[str(c or "").strip() for c in row] for row in tbl[1:]]
                else:
                    headers = []
                    rows = [[str(c or "").strip() for c in row] for row in tbl]

                if not _is_parameter_table(headers):
                    continue

                top_frac = table_tops[ti] if ti < len(table_tops) else 0.5
                section = _find_section_heading(page_text, top_frac, 1.0)

                report.tables.append(ParameterTable(
                    page=pnum,
                    table_index=ti,
                    section=section,
                    headers=headers,
                    rows=rows,
                ))
                report.tables_found += 1

    return report


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_csv_files(report: ExtractionReport, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(report.source).stem
    for i, tbl in enumerate(report.tables):
        safe_section = (tbl.section or "table").lower()
        for ch in " /\\:":
            safe_section = safe_section.replace(ch, "_")
        safe_section = safe_section[:40]
        fname = out_dir / f"{stem}_p{tbl.page}_{safe_section}_{i + 1}.csv"
        fname.write_text(_table_to_csv_text(tbl), encoding="utf-8")
        print(f"  wrote {fname}")


def format_markdown_output(report: ExtractionReport) -> str:
    if not report.tables:
        return f"No electrical parameter tables found in {report.source}."
    parts = [f"# Extracted Parameter Tables from `{Path(report.source).name}`\n"]
    parts.append(f"Found **{report.tables_found}** table(s) across {report.total_pages} pages.\n\n---\n")
    for tbl in report.tables:
        parts.append(_table_to_markdown(tbl))
        parts.append("\n\n---\n")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract electrical parameter tables from a component datasheet PDF.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("pdf", help="Path to the datasheet PDF.")
    parser.add_argument("--pages", help="Page range, e.g. '5-20' or '1,3,5'.")
    parser.add_argument("--out-dir", help="Directory for per-table CSV output.")
    parser.add_argument("--json", action="store_true", help="Emit JSON report to stdout.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf)

    if not pdf_path.exists():
        print(f"ERROR: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    page_nums: list[int] | None = None
    if args.pages:
        pdfplumber = _require("pdfplumber", "pdfplumber")
        with pdfplumber.open(str(pdf_path)) as pdf:
            total = len(pdf.pages)
        page_nums = _parse_page_range(args.pages, total)

    report = extract_parameter_tables(pdf_path=pdf_path, page_nums=page_nums)

    if report.warnings:
        for w in report.warnings:
            print(f"WARNING: {w}", file=sys.stderr)

    if args.json:
        print(json.dumps(asdict(report), indent=2, ensure_ascii=False))
        return

    if args.out_dir:
        write_csv_files(report, Path(args.out_dir))
        print(f"\nExtracted {report.tables_found} table(s) to {args.out_dir}")
    else:
        print(format_markdown_output(report))

    if report.tables_found == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
