#!/usr/bin/env python3
"""Fetch the summary and sections of a Wikipedia article.

Usage:
    python wikipedia_fetch.py "Quantum computing"
    python wikipedia_fetch.py "Alan Turing" --sections --lang en --json
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass


@dataclass
class ArticleSection:
    level: int
    title: str
    content: str


@dataclass
class Article:
    title: str
    description: str
    extract: str
    url: str
    last_modified: str
    sections: list[ArticleSection]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch a Wikipedia article summary and sections.")
    parser.add_argument("title", help="Article title (case-insensitive, spaces allowed).")
    parser.add_argument("--lang", default="en", help="Wikipedia language code (default: en).")
    parser.add_argument("--sections", action="store_true", help="Also fetch all article sections.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _make_request(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "skillex-wikipedia/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_summary(title: str, lang: str) -> dict:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    return _make_request(url)


def _fetch_sections(title: str, lang: str) -> list[ArticleSection]:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/mobile-sections/{encoded}"
    data = _make_request(url)

    sections: list[ArticleSection] = []
    import re

    def clean_html(html: str) -> str:
        text = re.sub(r"<[^>]+>", "", html or "")
        return " ".join(text.split())

    remaining = data.get("remaining", {}).get("sections", [])
    for sec in remaining:
        sections.append(ArticleSection(
            level=sec.get("toclevel", 1),
            title=sec.get("line", ""),
            content=clean_html(sec.get("text", ""))[:1000],
        ))
    return sections


def fetch_article(title: str, lang: str, include_sections: bool) -> Article:
    summary = _fetch_summary(title, lang)
    resolved_title = summary.get("title", title)
    sections = _fetch_sections(title, lang) if include_sections else []

    return Article(
        title=resolved_title,
        description=summary.get("description", ""),
        extract=summary.get("extract", ""),
        url=summary.get("content_urls", {}).get("desktop", {}).get("page", ""),
        last_modified=summary.get("timestamp", ""),
        sections=sections,
    )


def main() -> None:
    args = parse_args()
    article = fetch_article(args.title, args.lang, args.sections)

    if args.json:
        d = asdict(article)
        print(json.dumps(d, ensure_ascii=False, indent=2))
        return

    print(f"# {article.title}")
    if article.description:
        print(f"({article.description})")
    print(f"\n{article.url}\n")
    print(article.extract)

    if article.sections:
        print("\n" + "=" * 60)
        print("SECTIONS")
        print("=" * 60)
        for sec in article.sections:
            indent = "  " * (sec.level - 1)
            print(f"\n{indent}## {sec.title}")
            if sec.content:
                print(f"{indent}{sec.content[:300]}...")


if __name__ == "__main__":
    main()
