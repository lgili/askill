#!/usr/bin/env python3
"""Search Wikipedia articles by keyword.

Usage:
    python wikipedia_search.py "quantum computing" --limit 5
    python wikipedia_search.py "Alan Turing" --lang pt --json
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass


@dataclass
class SearchResult:
    title: str
    snippet: str
    pageid: int
    url: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search Wikipedia articles by keyword.")
    parser.add_argument("query", help="Search query.")
    parser.add_argument("--lang", default="en", help="Wikipedia language code (default: en).")
    parser.add_argument("--limit", type=int, default=5, help="Maximum results to return (default: 5).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _make_request(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "skillex-wikipedia/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def search_wikipedia(query: str, lang: str, limit: int) -> list[SearchResult]:
    params = urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": 0,
        "srlimit": limit,
        "format": "json",
    })
    url = f"https://{lang}.wikipedia.org/w/api.php?{params}"
    data = _make_request(url)

    results: list[SearchResult] = []
    for item in data.get("query", {}).get("search", []):
        title = item["title"]
        encoded = urllib.parse.quote(title.replace(" ", "_"))
        results.append(SearchResult(
            title=title,
            snippet=_strip_tags(item.get("snippet", "")),
            pageid=item["pageid"],
            url=f"https://{lang}.wikipedia.org/wiki/{encoded}",
        ))
    return results


def _strip_tags(text: str) -> str:
    """Remove HTML tags from a snippet string."""
    import re
    return re.sub(r"<[^>]+>", "", text)


def main() -> None:
    args = parse_args()
    results = search_wikipedia(args.query, args.lang, args.limit)

    if args.json:
        print(json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2))
        return

    if not results:
        print(f"No results found for '{args.query}' on {args.lang}.wikipedia.org")
        return

    print(f"Wikipedia search: '{args.query}' [{args.lang}]")
    print("=" * 60)
    for i, r in enumerate(results, 1):
        print(f"\n{i}. {r.title}")
        print(f"   {r.url}")
        if r.snippet:
            print(f"   {r.snippet[:200]}...")


if __name__ == "__main__":
    main()
