#!/usr/bin/env python3
"""Search the ArXiv preprint database via the public Atom API.

Usage:
    python arxiv_search.py "transformer attention mechanism" --max-results 5
    python arxiv_search.py "MOSFET switching losses" --category eess.PE --json
    python arxiv_search.py "reinforcement learning robotics" --sort-by date --max-results 10
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass


NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


@dataclass
class ArxivPaper:
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    published: str
    updated: str
    categories: list[str]
    pdf_url: str
    abstract_url: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search ArXiv preprints via the free Atom API.")
    parser.add_argument("query", help="Search query. Supports field prefixes: ti:, au:, abs:, cat:.")
    parser.add_argument("--category", default="", help="Restrict to an ArXiv category (e.g. cs.LG, eess.SP).")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum results to return (default: 10).")
    parser.add_argument(
        "--sort-by",
        choices=["relevance", "lastUpdatedDate", "submittedDate"],
        default="relevance",
        help="Sort results by (default: relevance).",
    )
    parser.add_argument("--start", type=int, default=0, help="Pagination offset (default: 0).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _build_query(query: str, category: str) -> str:
    if category:
        return f"({query}) AND cat:{category}"
    return query


def search_arxiv(query: str, category: str, max_results: int, sort_by: str, start: int) -> list[ArxivPaper]:
    search_query = _build_query(query, category)
    params = urllib.parse.urlencode({
        "search_query": search_query,
        "start": start,
        "max_results": max_results,
        "sortBy": sort_by,
        "sortOrder": "descending",
    })
    url = f"https://export.arxiv.org/api/query?{params}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "skillex-arxiv/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        xml_bytes = resp.read()

    root = ET.fromstring(xml_bytes)
    papers: list[ArxivPaper] = []

    for entry in root.findall("atom:entry", NS):
        raw_id = (entry.findtext("atom:id", "", NS) or "").strip()
        arxiv_id = raw_id.split("/abs/")[-1] if "/abs/" in raw_id else raw_id

        title = " ".join((entry.findtext("atom:title", "", NS) or "").split())
        abstract = " ".join((entry.findtext("atom:summary", "", NS) or "").split())
        published = (entry.findtext("atom:published", "", NS) or "")[:10]
        updated = (entry.findtext("atom:updated", "", NS) or "")[:10]

        authors = [
            a.findtext("atom:name", "", NS)
            for a in entry.findall("atom:author", NS)
        ]

        categories = [
            cat.attrib.get("term", "")
            for cat in entry.findall("atom:category", NS)
        ]

        pdf_url = ""
        for link in entry.findall("atom:link", NS):
            if link.attrib.get("title") == "pdf":
                pdf_url = link.attrib.get("href", "")
                break

        papers.append(ArxivPaper(
            arxiv_id=arxiv_id,
            title=title,
            authors=authors,
            abstract=abstract[:500],
            published=published,
            updated=updated,
            categories=categories,
            pdf_url=pdf_url,
            abstract_url=f"https://arxiv.org/abs/{arxiv_id}",
        ))

    # ArXiv asks for at least 3 seconds between requests
    time.sleep(3)
    return papers


def main() -> None:
    args = parse_args()
    papers = search_arxiv(args.query, args.category, args.max_results, args.sort_by, args.start)

    if args.json:
        print(json.dumps([asdict(p) for p in papers], ensure_ascii=False, indent=2))
        return

    if not papers:
        print("No results found.")
        return

    print(f"ArXiv search: '{args.query}'")
    if args.category:
        print(f"Category: {args.category}")
    print("=" * 60)
    for i, p in enumerate(papers, 1):
        print(f"\n{i}. [{p.arxiv_id}] {p.title}")
        print(f"   Authors: {', '.join(p.authors[:3])}{' et al.' if len(p.authors) > 3 else ''}")
        print(f"   Published: {p.published}  |  Categories: {', '.join(p.categories[:3])}")
        print(f"   {p.abstract_url}")
        print(f"   {p.abstract[:200]}...")


if __name__ == "__main__":
    main()
