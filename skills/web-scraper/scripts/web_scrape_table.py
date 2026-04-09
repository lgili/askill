#!/usr/bin/env python3
"""Extract a specific HTML table from a web page as CSV (zero dependencies).

Usage:
    python web_scrape_table.py https://example.com/data --table-index 0
    python web_scrape_table.py https://en.wikipedia.org/wiki/Python_(programming_language) --table-index 1 --json
    python web_scrape_table.py https://example.com/stats --list-tables
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract an HTML table from a web page as CSV (zero dependencies)."
    )
    parser.add_argument("url", help="URL of the page containing the table.")
    parser.add_argument("--table-index", type=int, default=0, help="Zero-based index of the table to extract (default: 0).")
    parser.add_argument("--list-tables", action="store_true", help="List all tables found on the page and exit.")
    parser.add_argument("--no-robots", action="store_true", help="Skip robots.txt check (use with caution).")
    parser.add_argument("--json", action="store_true", help="Emit table as JSON array instead of CSV.")
    return parser.parse_args()


class _TableParser(HTMLParser):
    """Extract all <table> elements from HTML as lists of rows."""

    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._in_table = 0
        self._current_rows: list[list[str]] = []
        self._current_row: list[str] | None = None
        self._current_cell: list[str] = []
        self._in_cell = False
        self._skip_depth = 0
        self._SKIP = {"script", "style"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP:
            self._skip_depth += 1
        if tag == "table":
            self._in_table += 1
            self._current_rows = []
        if self._in_table and tag == "tr":
            self._current_row = []
        if self._in_table and tag in ("td", "th"):
            self._current_cell = []
            self._in_cell = True

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)
        if self._in_table and tag in ("td", "th"):
            if self._current_row is not None:
                self._current_row.append(" ".join(self._current_cell).strip())
            self._current_cell = []
            self._in_cell = False
        if self._in_table and tag == "tr":
            if self._current_row:
                self._current_rows.append(self._current_row)
            self._current_row = None
        if tag == "table":
            self._in_table -= 1
            if self._in_table == 0 and self._current_rows:
                self.tables.append(self._current_rows)
            if self._in_table == 0:
                self._current_rows = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        if self._in_cell:
            self._current_cell.append(data)


def _check_robots(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        return rp.can_fetch("*", url)
    except Exception:  # noqa: BLE001
        return True


def _fetch_html(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "skillex-scraper/1.0 (educational research tool)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw_bytes = resp.read()
        content_type = resp.headers.get("Content-Type", "")

    charset_match = re.search(r"charset=([^\s;]+)", content_type)
    encoding = charset_match.group(1) if charset_match else "utf-8"
    return raw_bytes.decode(encoding, errors="replace")


def _table_to_csv(table: list[list[str]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in table:
        writer.writerow(row)
    return buf.getvalue()


def main() -> None:
    args = parse_args()

    if not args.no_robots and not _check_robots(args.url):
        print(f"Permission denied: robots.txt disallows scraping of: {args.url}", file=sys.stderr)
        raise SystemExit(1)

    html_text = _fetch_html(args.url)
    parser = _TableParser()
    parser.feed(html_text)
    tables = parser.tables

    if not tables:
        print("No tables found on this page.", file=sys.stderr)
        raise SystemExit(1)

    if args.list_tables:
        print(f"Found {len(tables)} table(s):")
        for i, table in enumerate(tables):
            ncols = max(len(row) for row in table) if table else 0
            header_preview = " | ".join(table[0][:5]) if table else ""
            print(f"  [{i}] {len(table)} rows × {ncols} cols  — {header_preview[:80]}")
        return

    idx = args.table_index
    if idx >= len(tables) or idx < 0:
        print(f"Error: table index {idx} out of range (0–{len(tables) - 1}).", file=sys.stderr)
        raise SystemExit(1)

    table = tables[idx]

    if args.json:
        if len(table) > 1:
            headers = table[0]
            rows = [dict(zip(headers, row)) for row in table[1:]]
        else:
            rows = [{"row": row} for row in table]
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return

    print(_table_to_csv(table), end="")


if __name__ == "__main__":
    main()
