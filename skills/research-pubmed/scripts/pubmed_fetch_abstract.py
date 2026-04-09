#!/usr/bin/env python3
"""Fetch the full abstract and metadata for one or more PubMed articles by PMID.

Usage:
    python pubmed_fetch_abstract.py 12345678
    python pubmed_fetch_abstract.py 12345678 87654321 --json
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass


EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


@dataclass
class AbstractRecord:
    pmid: str
    title: str
    authors: list[str]
    journal: str
    volume: str
    issue: str
    pub_date: str
    doi: str
    abstract: str
    mesh_terms: list[str]
    abstract_url: str
    pdf_url: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch abstracts from PubMed by PMID.")
    parser.add_argument("pmids", nargs="+", help="One or more PubMed IDs.")
    parser.add_argument("--email", default="", help="Optional email to identify your tool to NCBI.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def _get_xml(pmids: list[str], email: str) -> bytes:
    params: dict = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
        "rettype": "abstract",
        "tool": "skillex-pubmed",
    }
    if email:
        params["email"] = email

    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{EFETCH_URL}?{query}",
        headers={"User-Agent": "skillex-pubmed/1.0 (educational research tool)"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def _parse_articles(xml_bytes: bytes) -> list[AbstractRecord]:
    root = ET.fromstring(xml_bytes)
    records: list[AbstractRecord] = []

    for article_node in root.findall(".//PubmedArticle"):
        mc = article_node.find("MedlineCitation")
        if mc is None:
            continue

        pmid = mc.findtext("PMID", "")
        article = mc.find("Article")
        if article is None:
            continue

        title = " ".join((article.findtext("ArticleTitle", "") or "").split())

        # Abstract (may have multiple AbstractText elements with Label attributes)
        abstract_parts: list[str] = []
        for at in article.findall(".//AbstractText"):
            label = at.attrib.get("Label", "")
            text = (at.text or "").strip()
            if label:
                abstract_parts.append(f"{label}: {text}")
            elif text:
                abstract_parts.append(text)
        abstract = " ".join(abstract_parts)

        # Authors
        authors: list[str] = []
        for author in article.findall(".//Author"):
            last = author.findtext("LastName", "")
            first = author.findtext("ForeName", author.findtext("Initials", ""))
            if last:
                authors.append(f"{last} {first}".strip())

        # Journal
        journal_node = article.find("Journal")
        journal = journal_node.findtext("Title", "") if journal_node is not None else ""
        ji = journal_node.find("JournalIssue") if journal_node is not None else None
        volume = ji.findtext("Volume", "") if ji is not None else ""
        issue = ji.findtext("Issue", "") if ji is not None else ""

        # Pub date
        pd = ji.find("PubDate") if ji is not None else None
        if pd is not None:
            year = pd.findtext("Year", pd.findtext("MedlineDate", ""))
            month = pd.findtext("Month", "")
            pub_date = f"{year} {month}".strip()
        else:
            pub_date = ""

        # DOI
        doi = ""
        for aid in article_node.findall(".//ArticleId"):
            if aid.attrib.get("IdType") == "doi":
                doi = aid.text or ""
                break

        # MeSH terms
        mesh_terms = [
            mh.findtext("DescriptorName", "")
            for mh in mc.findall(".//MeshHeading")
            if mh.findtext("DescriptorName")
        ]

        records.append(AbstractRecord(
            pmid=pmid,
            title=title,
            authors=authors,
            journal=journal,
            volume=volume,
            issue=issue,
            pub_date=pub_date,
            doi=doi,
            abstract=abstract,
            mesh_terms=mesh_terms,
            abstract_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            pdf_url=f"https://doi.org/{doi}" if doi else "",
        ))
    return records


def main() -> None:
    args = parse_args()
    xml_bytes = _get_xml(args.pmids, args.email)
    records = _parse_articles(xml_bytes)

    if args.json:
        print(json.dumps([asdict(r) for r in records], ensure_ascii=False, indent=2))
        return

    for r in records:
        print(f"\n{'=' * 60}")
        print(f"PMID: {r.pmid}")
        print(f"Title: {r.title}")
        print(f"Authors: {', '.join(r.authors[:5])}{' et al.' if len(r.authors) > 5 else ''}")
        print(f"Journal: {r.journal}")
        if r.volume or r.issue:
            print(f"Volume/Issue: {r.volume}/{r.issue}  ({r.pub_date})")
        if r.doi:
            print(f"DOI: https://doi.org/{r.doi}")
        print(f"URL: {r.abstract_url}")
        if r.abstract:
            print(f"\nAbstract:\n{r.abstract}")
        if r.mesh_terms:
            print(f"\nMeSH: {'; '.join(r.mesh_terms[:10])}")


if __name__ == "__main__":
    main()
