#!/usr/bin/env python3
"""Extract content from a public web page using Python stdlib only (zero dependencies).

Usage:
    python web_scrape.py https://example.com
    python web_scrape.py https://example.com/article --extract text
    python web_scrape.py https://example.com/page --extract links --json
    python web_scrape.py https://example.com/data --extract tables
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import asdict, dataclass
from html.parser import HTMLParser


@dataclass
class ScrapeResult:
    url: str
    title: str
    text: str
    links: list[dict[str, str]]
    tables: list[list[list[str]]]
    status_code: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract content from a public web page (zero dependencies)."
    )
    parser.add_argument("url", help="URL to scrape.")
    parser.add_argument(
        "--extract",
        choices=["text", "links", "tables", "all"],
        default="text",
        help="What to extract (default: text).",
    )
    parser.add_argument("--max-text-chars", type=int, default=5000, help="Maximum text characters to return (default: 5000).")
    parser.add_argument("--no-robots", action="store_true", help="Skip robots.txt check (use with caution).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


class _ContentParser(HTMLParser):
    """Minimal HTML parser that extracts title, text, links, and tables."""

    _SKIP_TAGS = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript"}

    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.title = ""
        self._in_title = False
        self._skip_depth = 0
        self._text_parts: list[str] = []
        self.links: list[dict[str, str]] = []
        # Table state
        self.tables: list[list[list[str]]] = []
        self._current_table: list[list[str]] = []
        self._current_row: list[str] = []
        self._current_cell: list[str] = []
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = dict(attrs)
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "a" and "href" in attr_dict and self._skip_depth == 0:
            href = attr_dict.get("href") or ""
            abs_url = urllib.parse.urljoin(self.base_url, href)
            self.links.append({"href": abs_url, "text": ""})
        if tag == "table":
            self._current_table = []
        if tag == "tr":
            self._current_row = []
        if tag in ("td", "th"):
            self._current_cell = []
            self._in_cell = True

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        if tag == "title":
            self._in_title = False
        if tag == "table":
            if self._current_table:
                self.tables.append(self._current_table)
            self._current_table = []
        if tag == "tr":
            if self._current_row:
                self._current_table.append(self._current_row)
            self._current_row = []
        if tag in ("td", "th"):
            self._current_row.append(" ".join(self._current_cell).strip())
            self._current_cell = []
            self._in_cell = False
        if tag in ("p", "h1", "h2", "h3", "h4", "li", "br", "div") and self._skip_depth == 0:
            self._text_parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._skip_depth > 0:
            return
        if self._in_cell:
            self._current_cell.append(data)
        if self.links and not self._in_cell:
            self.links[-1]["text"] += data
        self._text_parts.append(data)

    @property
    def text(self) -> str:
        raw = "".join(self._text_parts)
        # Collapse whitespace while preserving meaningful newlines
        lines = [" ".join(line.split()) for line in raw.split("\n")]
        return "\n".join(line for line in lines if line)


def _check_robots(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        return rp.can_fetch("*", url)
    except Exception:  # noqa: BLE001
        return True  # If robots.txt is unreachable, assume allowed


def scrape(url: str, no_robots: bool, max_text_chars: int) -> tuple[ScrapeResult, int]:
    if not no_robots and not _check_robots(url):
        raise PermissionError(f"robots.txt disallows scraping of: {url}")

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "skillex-scraper/1.0 (educational research tool)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        status = resp.status
        raw_bytes = resp.read()

    # Detect encoding
    content_type = resp.headers.get("Content-Type", "")
    charset_match = re.search(r"charset=([^\s;]+)", content_type)
    encoding = charset_match.group(1) if charset_match else "utf-8"
    html_text = raw_bytes.decode(encoding, errors="replace")

    parser = _ContentParser(base_url=url)
    parser.feed(html_text)

    return ScrapeResult(
        url=url,
        title=parser.title.strip(),
        text=parser.text[:max_text_chars],
        links=parser.links,
        tables=parser.tables,
        status_code=status,
    ), status


def main() -> None:
    args = parse_args()
    extract = args.extract

    try:
        result, _ = scrape(args.url, args.no_robots, args.max_text_chars)
    except PermissionError as e:
        print(f"Permission denied: {e}", file=__import__("sys").stderr)
        raise SystemExit(1)

    if args.json:
        out: dict = {"url": result.url, "title": result.title, "status_code": result.status_code}
        if extract in ("text", "all"):
            out["text"] = result.text
        if extract in ("links", "all"):
            out["links"] = result.links
        if extract in ("tables", "all"):
            out["tables"] = result.tables
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return

    print(f"URL: {result.url}")
    print(f"Title: {result.title}")
    print("=" * 60)

    if extract in ("text", "all"):
        print("\n[TEXT]")
        print(result.text[:args.max_text_chars])

    if extract in ("links", "all"):
        print(f"\n[LINKS] ({len(result.links)} found)")
        for link in result.links[:20]:
            text = link["text"].strip()[:60]
            print(f"  {link['href']}" + (f"  ({text})" if text else ""))

    if extract in ("tables", "all"):
        print(f"\n[TABLES] ({len(result.tables)} found)")
        for t_idx, table in enumerate(result.tables):
            print(f"\nTable {t_idx + 1}:")
            for row in table:
                print("  | " + " | ".join(cell[:30] for cell in row))


if __name__ == "__main__":
    main()
