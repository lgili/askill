---
name: "Research PubMed"
description: "Search peer-reviewed biomedical and scientific literature from the NCBI PubMed database using the free E-utilities API — no API key required. Returns article titles, authors, journal, abstract, DOI, and PubMed IDs. Activates when you say 'search PubMed', 'find medical research on', 'look up clinical studies about', 'search biomedical literature', 'find scientific papers on', or 'get NCBI articles about'."
---

# Research PubMed

## Overview

Use this skill when you need peer-reviewed biomedical, clinical, or life-science literature. PubMed indexes over 37 million citations from MEDLINE, life science journals, and online books — freely searchable via the NCBI E-utilities API with no API key required for reasonable use.

This skill covers:
- **Full-text search** across titles, abstracts, MeSH terms, and author names.
- **Structured query syntax** — boolean operators, field tags, date ranges, publication types.
- **Article metadata** — PMID, title, authors, journal, year, volume, pages, abstract, DOI.
- **Batch fetch** — retrieve full records for a list of PMIDs.
- **Citations and related articles** — eLink service to find related work.

Default stance:
- PubMed indexes peer-reviewed publications — higher evidence quality than ArXiv preprints.
- Use MeSH (Medical Subject Headings) terms for clinical queries when available — they improve recall.
- For systematic review evidence hierarchies: RCT > cohort > case-control > case series > expert opinion.

## Core Workflow

1. **Formulate the query.**
   - Load `references/pubmed-query-syntax.md` for field tags and boolean operators.
   - Use MeSH terms for canonical disease/drug names: e.g., `"Diabetes Mellitus, Type 2"[MeSH]` instead of `"type 2 diabetes"`.
   - Add filters: `[PT]` for publication type (e.g., `"Randomized Controlled Trial"[PT]`), date range (`2020:2026[DP]`).

2. **Search for articles.**
   - Run: `python scripts/pubmed_search.py --query "your query" --max 20`
   - Returns: PMID list with titles and authors.
   - Use `--abstract` to include full abstracts in first output.

3. **Fetch detailed records.**
   - Run: `python scripts/pubmed_search.py --pmids 12345678,87654321`
   - Returns full metadata for specific PMIDs: title, authors, journal, abstract, DOI.

4. **Filter and refine results.**
   - Add `--filter "Randomized Controlled Trial"` to restrict to RCTs.
   - Add `--date-from 2020` for recent literature only.
   - Add `--sort relevance` (default) or `--sort date` for most recent first.

5. **Export results.**
   - Use `--json` for machine-readable output.
   - Use `--output refs.csv` to save a reference list.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| NCBI E-utilities API endpoints | `references/pubmed-api.md` | Direct API use, understanding XML response fields, rate limits |
| PubMed query syntax and field tags | `references/pubmed-query-syntax.md` | Building precise queries with MeSH, boolean operators, publication type filters |

## Bundled Scripts

| Script | Purpose | Key Options |
|---|---|---|
| `scripts/pubmed_search.py` | Search PubMed and fetch article metadata | `--query TEXT`, `--pmids ID1,ID2`, `--max N`, `--abstract`, `--filter PUBTYPE`, `--date-from YEAR`, `--sort relevance\|date`, `--json`, `--output FILE` |

## Constraints

### MUST DO
- Always include PMIDs and DOIs in output so results are reproducible.
- Use MeSH terms for medical concepts — they significantly improve query recall.
- Note the publication type (RCT, Review, Case Report, etc.) for every article.
- Report evidence level when recommending clinical or pharmacological actions.

### MUST NOT DO
- Do not make medical recommendations based solely on a literature search — always defer to clinical judgment.
- Do not exceed 3 requests/second to NCBI E-utilities without an API key (NCBI rate limit).
- Do not use lay terms when MeSH controlled vocabulary is available.

## Output Template

```
## PubMed Search: "{query}"
Found {N} results. Showing top {shown}.

### 1. {Title}
**Authors:** {author1}, {author2} et al.
**Journal:** {journal}, {year};{volume}({issue}):{pages}
**PMID:** {pmid}  |  **DOI:** {doi}
**Abstract:** {abstract first 3 sentences}...

### 2. ...

---
*Results from NCBI PubMed. Always verify abstracts via full-text access.*
```

## Primary References
- `references/pubmed-api.md` — E-utilities endpoints and XML schema
- `references/pubmed-query-syntax.md` — Query language, MeSH, field tags, boolean operators
