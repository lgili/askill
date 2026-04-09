#!/usr/bin/env python3
"""Extract text and tables from a PDF file.

Usage examples:
  # Extract all text, tables formatted as Markdown
  python pdf_extract_text.py document.pdf

  # Only tables, as CSV files in ./output/
  python pdf_extract_text.py document.pdf --tables-only --format csv --out-dir ./output

  # Pages 3-7, two-column layout reflow
  python pdf_extract_text.py document.pdf --pages 3-7 --two-column

  # Machine-readable JSON (for piping to other scripts)
  python pdf_extract_text.py document.pdf --json
"""

from __future__ import annotations

import argparse
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
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TableResult:
    page: int
    index: int          # table number on the page (0-based)
    headers: list[str]
    rows: list[list[str]]
    bbox: tuple[float, float, float, float]   # (x0, top, x1, bottom)


@dataclass
class PageResult:
    page: int
    text: str
    tables: list[TableResult] = field(default_factory=list)


@dataclass
class ExtractionReport:
    source: str
    total_pages: int
    extracted_pages: list[int]
    pages: list[PageResult] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_page_range(spec: str, total: int) -> list[int]:
    """Parse '3-7' or '3,5,7' or '1' into a list of 1-based page numbers."""
    pages: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            pages.extend(range(int(start), int(end) + 1))
        else:
            pages.append(int(part))
    invalid = [p for p in pages if p < 1 or p > total]
    if invalid:
        raise ValueError(f"Page numbers out of range (1-{total}): {invalid}")
    return pages


def _table_to_markdown(table: TableResult) -> str:
    """Format a TableResult as a GitHub-Flavoured Markdown table."""
    if not table.headers and not table.rows:
        return ""
    headers = table.headers if table.headers else [f"col{i}" for i in range(len(table.rows[0]) if table.rows else 0)]
    # Escape pipes inside cells
    def _cell(s: str) -> str:
        return (s or "").replace("|", "\\|").replace("\n", " ").strip()

    sep = " | ".join("---" for _ in headers)
    header_row = " | ".join(_cell(h) for h in headers)
    body = "\n".join(" | ".join(_cell(c) for c in row) for row in table.rows)
    return f"| {header_row} |\n| {sep} |\n" + "\n".join(f"| {' | '.join(_cell(c) for c in row)} |" for row in table.rows)


def _table_to_csv(table: TableResult) -> str:
    import csv, io
    buf = io.StringIO()
    writer = csv.writer(buf)
    if table.headers:
        writer.writerow(table.headers)
    writer.writerows(table.rows)
    return buf.getvalue()


def _reflow_two_column(text: str, page_width: float) -> str:
    """Best-effort reflow for two-column PDFs.

    pdfplumber extracts text left-to-right across the full page width, which
    mixes left and right columns. This heuristic splits lines at the mid-point
    and reconstructs reading order.
    """
    # This is a heuristic — true two-column reflow requires bbox-aware extraction
    # done in extract_page_text() below.  This function handles fallback plain text.
    lines = text.splitlines()
    mid = page_width / 2
    left_lines: list[str] = []
    right_lines: list[str] = []
    for line in lines:
        # No coordinate info available here; return unmodified
        left_lines.append(line)
    return "\n".join(left_lines)


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def extract_page(page: Any, two_column: bool, warnings: list[str]) -> PageResult:
    """Extract text and tables from a single pdfplumber Page object."""
    page_num = page.page_number  # 1-based in pdfplumber

    # --- Table extraction -------------------------------------------------
    tables_raw = page.extract_tables(table_settings={})
    table_bboxes: list[tuple[float, float, float, float]] = []
    results: list[TableResult] = []

    for i, tbl in enumerate(tables_raw):
        if not tbl:
            continue
        # Attempt to get table bounding box from pdfplumber's table finder
        try:
            finder_tables = page.find_tables()
            bbox = finder_tables[i].bbox if i < len(finder_tables) else (0, 0, 0, 0)
        except Exception:
            bbox = (0.0, 0.0, 0.0, 0.0)

        # Treat first row as headers if it looks like a header (all non-empty strings)
        if tbl and all(cell for cell in tbl[0]):
            headers = [str(c).strip() for c in tbl[0]]
            rows = [[str(c or "").strip() for c in row] for row in tbl[1:]]
        else:
            headers = []
            rows = [[str(c or "").strip() for c in row] for row in tbl]

        results.append(TableResult(page=page_num, index=i, headers=headers, rows=rows, bbox=bbox))
        table_bboxes.append(bbox)

    # --- Text extraction --------------------------------------------------
    if two_column and page.width:
        mid = page.width / 2
        left = page.within_bbox((0, 0, mid, page.height))
        right = page.within_bbox((mid, 0, page.width, page.height))
        left_text = left.extract_text(x_tolerance=3, y_tolerance=3) or ""
        right_text = right.extract_text(x_tolerance=3, y_tolerance=3) or ""
        text = left_text + ("\n\n" if left_text and right_text else "") + right_text
    else:
        text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""

    return PageResult(page=page_num, text=text.strip(), tables=results)


def run_extraction(
    pdf_path: Path,
    page_nums: list[int] | None,
    two_column: bool,
    tables_only: bool,
) -> ExtractionReport:
    pdfplumber = _require("pdfplumber", "pdfplumber")

    report = ExtractionReport(
        source=str(pdf_path),
        total_pages=0,
        extracted_pages=[],
    )

    with pdfplumber.open(str(pdf_path)) as pdf:
        report.total_pages = len(pdf.pages)
        effective_pages = page_nums if page_nums else list(range(1, len(pdf.pages) + 1))
        report.extracted_pages = effective_pages

        for pnum in effective_pages:
            page = pdf.pages[pnum - 1]  # pdfplumber pages are 0-indexed in the list
            try:
                page_result = extract_page(page, two_column=two_column, warnings=report.warnings)
                if tables_only:
                    page_result.text = ""
                report.pages.append(page_result)
            except Exception as exc:
                report.warnings.append(f"Page {pnum}: extraction error — {exc}")

    return report


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_csv_tables(report: ExtractionReport, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(report.source).stem
    for page_result in report.pages:
        for tbl in page_result.tables:
            fname = out_dir / f"{stem}_p{page_result.page}_t{tbl.index + 1}.csv"
            fname.write_text(_table_to_csv(tbl), encoding="utf-8")
            print(f"  wrote {fname}")


def format_text_output(report: ExtractionReport, fmt: str) -> str:
    parts: list[str] = []
    for pr in report.pages:
        parts.append(f"\n\n<!-- Page {pr.page} -->\n")
        if pr.text:
            parts.append(pr.text)
        for tbl in pr.tables:
            parts.append(f"\n**Table {tbl.index + 1} (page {pr.page}):**\n")
            if fmt == "csv":
                parts.append("```csv\n" + _table_to_csv(tbl) + "```")
            else:
                parts.append(_table_to_markdown(tbl))
    return "\n".join(parts).strip()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract text and tables from a PDF.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("pdf", help="Path to the PDF file.")
    parser.add_argument("--pages", help="Page range/list, e.g. '3-7' or '1,3,5'.")
    parser.add_argument("--two-column", action="store_true",
                        help="Treat each page as a two-column layout and reflow text.")
    parser.add_argument("--tables-only", action="store_true",
                        help="Extract tables only; suppress body text.")
    parser.add_argument("--format", choices=["markdown", "csv"], default="markdown",
                        help="Table output format (default: markdown).")
    parser.add_argument("--out-dir", help="Directory to write per-table CSV files (implies --tables-only --format csv).")
    parser.add_argument("--overwrite", action="store_true",
                        help="Allow overwriting existing output files.")
    parser.add_argument("--json", action="store_true",
                        help="Emit machine-readable JSON to stdout.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf)

    if not pdf_path.exists():
        print(f"ERROR: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if not pdf_path.suffix.lower() == ".pdf":
        print(f"WARNING: File does not have .pdf extension: {pdf_path}", file=sys.stderr)

    # Resolve page range
    page_nums: list[int] | None = None
    if args.pages:
        # Need to open the PDF to know total pages for validation
        pdfplumber = _require("pdfplumber", "pdfplumber")
        with pdfplumber.open(str(pdf_path)) as pdf:
            total = len(pdf.pages)
        page_nums = _parse_page_range(args.pages, total)

    tables_only = args.tables_only or bool(args.out_dir)

    report = run_extraction(
        pdf_path=pdf_path,
        page_nums=page_nums,
        two_column=args.two_column,
        tables_only=tables_only,
    )

    if report.warnings:
        for w in report.warnings:
            print(f"WARNING: {w}", file=sys.stderr)

    if args.json:
        print(json.dumps(asdict(report), indent=2, ensure_ascii=False))
        return

    if args.out_dir:
        out_dir = Path(args.out_dir)
        if not args.overwrite and any(out_dir.glob("*.csv")):
            print(f"ERROR: {out_dir} already contains CSV files. Use --overwrite to proceed.", file=sys.stderr)
            sys.exit(1)
        write_csv_tables(report, out_dir)
    else:
        print(format_text_output(report, fmt=args.format))


if __name__ == "__main__":
    main()
