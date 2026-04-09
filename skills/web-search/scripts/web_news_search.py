#!/usr/bin/env python3
"""Search recent news via DuckDuckGo (no API key required).

Requires: pip install duckduckgo-search

Usage:
    python web_news_search.py "AI regulation 2025" --num-results 5
    python web_news_search.py "semiconductor shortage" --time w --region us-en --json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass


@dataclass
class NewsResult:
    title: str
    url: str
    body: str
    date: str
    source: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search recent news via DuckDuckGo (no API key required)."
    )
    parser.add_argument("query", help="News search query.")
    parser.add_argument("--num-results", type=int, default=10, help="Number of results to return (default: 10).")
    parser.add_argument("--region", default="wt-wt", help="Region code, e.g. us-en, br-pt (default: wt-wt).")
    parser.add_argument(
        "--time",
        choices=["d", "w", "m", "y"],
        default="w",
        help="Time filter: d=day, w=week (default), m=month, y=year.",
    )
    parser.add_argument(
        "--safesearch",
        choices=["on", "moderate", "off"],
        default="moderate",
        help="SafeSearch level (default: moderate).",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def search_news(query: str, num_results: int, region: str, time_filter: str, safesearch: str) -> list[NewsResult]:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        print("Error: duckduckgo-search is not installed. Run: pip install duckduckgo-search", file=sys.stderr)
        raise SystemExit(1)

    results: list[NewsResult] = []
    try:
        for item in DDGS().news(
            keywords=query,
            region=region,
            safesearch=safesearch,
            timelimit=time_filter,
            max_results=num_results,
        ):
            results.append(NewsResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                body=item.get("body", ""),
                date=item.get("date", ""),
                source=item.get("source", ""),
            ))
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: DuckDuckGo news search error: {exc}", file=sys.stderr)

    return results


def main() -> None:
    args = parse_args()
    results = search_news(args.query, args.num_results, args.region, args.time, args.safesearch)

    if args.json:
        print(json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2))
        return

    if not results:
        print(f"No news results found for: {args.query}")
        return

    time_label = {"d": "last 24h", "w": "last week", "m": "last month", "y": "last year"}
    print(f"News search: '{args.query}' [{time_label.get(args.time, args.time)}]")
    print("=" * 60)
    for i, r in enumerate(results, 1):
        print(f"\n{i}. {r.title}")
        print(f"   Source: {r.source}  |  Date: {r.date}")
        print(f"   {r.url}")
        if r.body:
            print(f"   {r.body[:200]}...")


if __name__ == "__main__":
    main()
