#!/usr/bin/env python3
"""Search the web via DuckDuckGo (no API key required).

Requires: pip install duckduckgo-search

Usage:
    python web_search.py "python asyncio tutorial" --num-results 5
    python web_search.py "MOSFET gate driver 2024" --region us-en --json
    python web_search.py "climate change solutions" --time w --num-results 10
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="General web search via DuckDuckGo (no API key required)."
    )
    parser.add_argument("query", help="Search query.")
    parser.add_argument("--num-results", type=int, default=10, help="Number of results to return (default: 10).")
    parser.add_argument("--region", default="wt-wt", help="Region code, e.g. us-en, br-pt (default: wt-wt).")
    parser.add_argument(
        "--time",
        choices=["d", "w", "m", "y"],
        default=None,
        help="Time filter: d=day, w=week, m=month, y=year.",
    )
    parser.add_argument(
        "--safesearch",
        choices=["on", "moderate", "off"],
        default="moderate",
        help="SafeSearch level (default: moderate).",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _search_with_library(query: str, num_results: int, region: str, time_filter: str | None, safesearch: str) -> list[SearchResult]:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        print("Error: duckduckgo-search is not installed. Run: pip install duckduckgo-search", file=sys.stderr)
        raise SystemExit(1)

    kwargs: dict = {
        "keywords": query,
        "region": region,
        "safesearch": safesearch,
        "max_results": num_results,
    }
    if time_filter:
        kwargs["timelimit"] = time_filter

    results: list[SearchResult] = []
    try:
        for item in DDGS().text(**kwargs):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("href", ""),
                snippet=item.get("body", ""),
            ))
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: DuckDuckGo search error: {exc}", file=sys.stderr)

    return results


def _search_instant_answer(query: str) -> list[SearchResult]:
    """Fallback: DDG Instant Answer API (structured answers only, no organic results)."""
    import urllib.parse
    import urllib.request

    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "no_html": 1,
        "skip_disambig": 1,
    })
    url = f"https://api.duckduckgo.com/?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "skillex-websearch/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception:  # noqa: BLE001
        return []

    results: list[SearchResult] = []
    if data.get("AbstractText"):
        results.append(SearchResult(
            title=data.get("Heading", query),
            url=data.get("AbstractURL", ""),
            snippet=data["AbstractText"],
        ))
    for topic in data.get("RelatedTopics", [])[:5]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append(SearchResult(
                title=topic.get("Text", "")[:80],
                url=topic.get("FirstURL", ""),
                snippet=topic.get("Text", ""),
            ))
    return results


def main() -> None:
    args = parse_args()

    try:
        results = _search_with_library(args.query, args.num_results, args.region, args.time, args.safesearch)
    except SystemExit:
        # Library not installed — fall back to Instant Answer API
        results = _search_instant_answer(args.query)

    if args.json:
        print(json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2))
        return

    if not results:
        print(f"No results found for: {args.query}")
        return

    print(f"Web search: '{args.query}'")
    print("=" * 60)
    for i, r in enumerate(results, 1):
        print(f"\n{i}. {r.title}")
        print(f"   {r.url}")
        if r.snippet:
            print(f"   {r.snippet[:200]}...")


if __name__ == "__main__":
    main()
