#!/usr/bin/env python3
"""Convert CSV files into LaTeX table environments."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


SPECIAL_CHARS = {
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert CSV to a LaTeX table.")
    parser.add_argument("--input", required=True, help="Input CSV path.")
    parser.add_argument("--output", default="", help="Optional output .tex file path.")
    parser.add_argument("--caption", default="", help="Table caption.")
    parser.add_argument("--label", default="", help="Table label.")
    parser.add_argument("--alignment", default="auto", help="Column alignment string or auto.")
    parser.add_argument(
        "--environment",
        choices=["table", "longtable"],
        default="table",
        help="Table wrapper environment.",
    )
    parser.add_argument("--no-header", action="store_true", help="Treat the first row as data instead of header.")
    return parser.parse_args()


def escape_latex(value: str) -> str:
    result = []
    for char in value:
        result.append(SPECIAL_CHARS.get(char, char))
    return "".join(result)


def load_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return [row for row in csv.reader(handle)]


def infer_alignment(rows: list[list[str]], has_header: bool) -> str:
    sample_rows = rows[1:] if has_header and len(rows) > 1 else rows
    column_count = len(rows[0]) if rows else 0
    alignments: list[str] = []
    for column_index in range(column_count):
        numeric = True
        for row in sample_rows:
            if column_index >= len(row):
                numeric = False
                break
            value = row[column_index].strip()
            if not value:
                continue
            try:
                float(value.replace(",", ""))
            except ValueError:
                numeric = False
                break
        alignments.append("r" if numeric else "l")
    return "".join(alignments)


def render_tabular(rows: list[list[str]], alignment: str, has_header: bool) -> str:
    lines = [f"\\begin{{tabular}}{{{alignment}}}", "  \\toprule"]
    data_rows = rows
    if has_header and rows:
        header = " & ".join(escape_latex(cell) for cell in rows[0]) + r" \\"
        lines.append(f"  {header}")
        lines.append("  \\midrule")
        data_rows = rows[1:]
    for row in data_rows:
        lines.append("  " + " & ".join(escape_latex(cell) for cell in row) + r" \\")
    lines.append("  \\bottomrule")
    lines.append("\\end{tabular}")
    return "\n".join(lines)


def render_longtable(rows: list[list[str]], alignment: str, has_header: bool) -> str:
    lines = [f"\\begin{{longtable}}{{{alignment}}}", "  \\toprule"]
    data_rows = rows
    if has_header and rows:
        header = " & ".join(escape_latex(cell) for cell in rows[0]) + r" \\"
        lines.extend([f"  {header}", "  \\midrule", "  \\endfirsthead", "  \\toprule", f"  {header}", "  \\midrule", "  \\endhead"])
        data_rows = rows[1:]
    for row in data_rows:
        lines.append("  " + " & ".join(escape_latex(cell) for cell in row) + r" \\")
    lines.extend(["  \\bottomrule", "\\end{longtable}"])
    return "\n".join(lines)


def wrap_environment(body: str, environment: str, caption: str, label: str) -> str:
    if environment == "longtable":
        lines = body.splitlines()
        caption_line = ""
        if caption:
            caption_line += f"  \\caption{{{escape_latex(caption)}}}"
        if label:
            caption_line += f"\\label{{{escape_latex(label)}}}"
        if caption_line:
            caption_line += r" \\"
            lines.insert(1, caption_line)
        return "% Requires: \\usepackage{longtable}\n% Requires: \\usepackage{booktabs}\n" + "\n".join(lines)

    lines = ["% Requires: \\usepackage{booktabs}", "\\begin{table}[htbp]", "  \\centering"]
    if caption:
        lines.append(f"  \\caption{{{escape_latex(caption)}}}")
    if label:
        lines.append(f"  \\label{{{escape_latex(label)}}}")
    lines.extend("  " + line if line else "" for line in body.splitlines())
    lines.append("\\end{table}")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    rows = load_rows(input_path)
    if not rows:
        raise SystemExit("CSV is empty.")

    has_header = not args.no_header
    alignment = infer_alignment(rows, has_header) if args.alignment == "auto" else args.alignment
    body = render_longtable(rows, alignment, has_header) if args.environment == "longtable" else render_tabular(rows, alignment, has_header)
    rendered = wrap_environment(body, args.environment, args.caption, args.label)

    if args.output:
        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
        print(f"Wrote {output_path}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
