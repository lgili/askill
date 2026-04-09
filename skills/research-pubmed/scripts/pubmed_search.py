#!/usr/bin/env python3
"""Search PubMed biomedical literature via NCBI E-utilities.

Usage:
    python pubmed_search.py "CRISPR cancer therapy" --max-results 5
    python pubmed_search.py '"type 2 diabetes"[TIAB] AND "metformin"[TIAB]' --json
    python pubmed_search.py "COVID-19 vaccine" --max-results 10 --min-date 2023/01/01
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass


ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


@dataclass
class PubMedResult:
    pmid: str
    title: str
    authors: list[str]
    journal: str
    year: str
    abstract_url: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search PubMed via NCBI E-utilities (no API key required).")
    parser.add_argument("query", help="PubMed search query. Supports field tags like [TIAB], [MH], [AU].")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum results to return (default: 10).")
    parser.add_argument(
        "--sort",
        choices=["relevance", "pub_date"],
        default="relevance",
        help="Sort order (default: relevance).",
    )
    parser.add_argument("--min-date", default="", help="Filter from date in YYYY/MM/DD format.")
    parser.add_argument("--max-date", default="", help="Filter to date in YYYY/MM/DD format.")
    parser.add_argument("--email", default="", help="Optional email to identify your tool to NCBI.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _get(url: str, params: dict) -> bytes:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v != ""})
    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "skillex-pubmed/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def _esearch(query: str, max_results: int, sort: str, min_date: str, max_date: str, email: str) -> list[str]:
    params: dict = {
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "sort": sort,
        "tool": "skillex-pubmed",
    }
    if min_date:
        params["datetype"] = "pdat"
        params["mindate"] = min_date
    if max_date:
        params.setdefault("datetype", "pdat")
        params["maxdate"] = max_date
    if email:
        params["email"] = email

    data = json.loads(_get(ESEARCH_URL, params))
    return data.get("esearchresult", {}).get("idlist", [])


def _esummary(pmids: list[str]) -> list[PubMedResult]:
    if not pmids:
        return []
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
        "tool": "skillex-pubmed",
    }
    xml_bytes = _get(ESUMMARY_URL, params)
    root = ET.fromstring(xml_bytes)

    results: list[PubMedResult] = []
    for doc_sum in root.findall(".//DocSum"):
        pmid = doc_sum.findtext("Id", "")
        items: dict[str, str] = {}
        for item in doc_sum.findall("Item"):
            name = item.attrib.get("Name", "")
            items[name] = (item.text or "").strip()

        authors: list[str] = [
            a.text.strip()
            for a in doc_sum.findall(".//Item[@Name='Author']")
            if a.text
        ]

        results.append(PubMedResult(
            pmid=pmid,
            title=items.get("Title", ""),
            authors=authors,
            journal=items.get("FullJournalName", items.get("Source", "")),
            year=items.get("PubDate", "")[:4],
            abstract_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        ))
    return results


def search_pubmed(
    query: str,
    max_results: int,
    sort: str,
    min_date: str,
    max_date: str,
    email: str,
) -> list[PubMedResult]:
    pmids = _esearch(query, max_results, sort, min_date, max_date, email)
    time.sleep(0.4)  # Stay well under 3 req/s limit
    return _esummary(pmids)


def main() -> None:
    args = parse_args()
    results = search_pubmed(
        args.query,
        args.max_results,
        args.sort,
        args.min_date,
        args.max_date,
        args.email,
    )

    if args.json:
        print(json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2))
        return

    if not results:
        print(f"No results found for: {args.query}")
        return

    print(f"PubMed search: '{args.query}'")
    print("=" * 60)
    for i, r in enumerate(results, 1):
        print(f"\n{i}. PMID {r.pmid} — {r.title}")
        authors_str = ", ".join(r.authors[:3])
        if len(r.authors) > 3:
            authors_str += " et al."
        print(f"   {authors_str}")
        print(f"   {r.journal} ({r.year})")
        print(f"   {r.abstract_url}")


if __name__ == "__main__":
    main()
