#!/usr/bin/env python3
"""Fetch full metadata for a single ArXiv paper by its ID.

Usage:
    python arxiv_fetch.py 2301.12345
    python arxiv_fetch.py "cs/0703072" --json
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
    primary_category: str
    categories: list[str]
    pdf_url: str
    abstract_url: str
    comment: str
    journal_ref: str
    doi: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch metadata for a single ArXiv paper by ID.")
    parser.add_argument("arxiv_id", help="ArXiv paper ID (e.g. 2301.12345 or cs/0703072).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def fetch_paper(arxiv_id: str) -> ArxivPaper | None:
    # Strip version suffix if present (v1, v2, ...)
    base_id = arxiv_id.split("v")[0] if arxiv_id[-2:-1] == "v" and arxiv_id[-1].isdigit() else arxiv_id

    params = urllib.parse.urlencode({"id_list": base_id})
    url = f"https://export.arxiv.org/api/query?{params}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "skillex-arxiv/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        xml_bytes = resp.read()

    root = ET.fromstring(xml_bytes)
    entries = root.findall("atom:entry", NS)
    if not entries:
        return None

    entry = entries[0]
    raw_id = (entry.findtext("atom:id", "", NS) or "").strip()
    resolved_id = raw_id.split("/abs/")[-1] if "/abs/" in raw_id else raw_id

    title = " ".join((entry.findtext("atom:title", "", NS) or "").split())
    abstract = " ".join((entry.findtext("atom:summary", "", NS) or "").split())
    published = (entry.findtext("atom:published", "", NS) or "")[:10]
    updated = (entry.findtext("atom:updated", "", NS) or "")[:10]
    comment = " ".join((entry.findtext("arxiv:comment", "", NS) or "").split())
    journal_ref = entry.findtext("arxiv:journal_ref", "", NS) or ""
    doi = entry.findtext("arxiv:doi", "", NS) or ""

    authors = [a.findtext("atom:name", "", NS) for a in entry.findall("atom:author", NS)]

    primary = entry.find("arxiv:primary_category", NS)
    primary_category = primary.attrib.get("term", "") if primary is not None else ""

    categories = [cat.attrib.get("term", "") for cat in entry.findall("atom:category", NS)]

    pdf_url = ""
    for link in entry.findall("atom:link", NS):
        if link.attrib.get("title") == "pdf":
            pdf_url = link.attrib.get("href", "")
            break

    time.sleep(3)

    return ArxivPaper(
        arxiv_id=resolved_id,
        title=title,
        authors=authors,
        abstract=abstract,
        published=published,
        updated=updated,
        primary_category=primary_category,
        categories=categories,
        pdf_url=pdf_url,
        abstract_url=f"https://arxiv.org/abs/{resolved_id}",
        comment=comment,
        journal_ref=journal_ref,
        doi=doi,
    )


def main() -> None:
    args = parse_args()
    paper = fetch_paper(args.arxiv_id)

    if paper is None:
        print(f"No paper found for ID '{args.arxiv_id}'.")
        raise SystemExit(1)

    if args.json:
        print(json.dumps(asdict(paper), ensure_ascii=False, indent=2))
        return

    print(f"# [{paper.arxiv_id}] {paper.title}")
    print(f"\nAuthors: {', '.join(paper.authors)}")
    print(f"Published: {paper.published}  |  Updated: {paper.updated}")
    print(f"Primary category: {paper.primary_category}  |  All: {', '.join(paper.categories)}")
    if paper.journal_ref:
        print(f"Journal: {paper.journal_ref}")
    if paper.doi:
        print(f"DOI: https://doi.org/{paper.doi}")
    print(f"\nAbstract URL: {paper.abstract_url}")
    print(f"PDF:          {paper.pdf_url}")
    print(f"\nAbstract:\n{paper.abstract}")
    if paper.comment:
        print(f"\nComment: {paper.comment}")


if __name__ == "__main__":
    main()
