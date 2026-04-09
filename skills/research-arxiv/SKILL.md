---
name: "Research ArXiv"
description: "Search and summarize preprint papers from ArXiv.org using the free Atom API — no API key required. Retrieves paper titles, authors, abstracts, submission dates, and PDF links for any research query. Activates when you say 'search ArXiv', 'find papers about', 'what are recent papers on', 'search academic papers', 'find preprints about', or 'look up research on ArXiv'."
---

# Research ArXiv

## Overview

Use this skill when you need access to cutting-edge academic research before (or instead of) journal publication. ArXiv hosts preprint papers in physics, mathematics, computer science, electrical engineering, statistics, economics, and quantitative biology — freely accessible with no authentication.

This skill covers:
- **Full-text search** across titles, abstracts, and author names.
- **Category filtering** — narrow to cs.AI, eess.SP, physics.cond-mat, etc.
- **Author search** — find all papers by a specific researcher.
- **Date-range filtering** — only recent papers or a specific year.
- **Metadata extraction** — title, authors, abstract, categories, submission date, ArXiv ID, PDF URL.

Default stance:
- ArXiv papers are preprints — they have not necessarily been peer-reviewed. Note this when reporting findings.
- Always include the ArXiv ID (e.g., `2401.12345`) so results can be reproduced.
- For engineering and CS topics, ArXiv is often the fastest source of state-of-the-art information.

## Core Workflow

1. **Formulate the query.**
   - Think about key terms: use specific technical terms rather than natural language.
   - Load `references/arxiv-categories.md` to pick the right category filter.
   - Example: `"transformer attention" AND cat:cs.LG` for ML papers.

2. **Run the search.**
   - Run: `python scripts/arxiv_search.py --query "your query" --max 10`
   - Optional: `--category cs.AI` to restrict by subject area.
   - Optional: `--sort-by date` for most recent first (default: relevance).

3. **Review the results.**
   - Results include: ArXiv ID, title, authors, submission date, abstract, PDF URL.
   - Use `--abstract` flag to include full abstracts in output.
   - The script formats results as a Markdown list by default.

4. **Fetch a specific paper's full metadata.**
   - Run: `python scripts/arxiv_search.py --id 2401.12345`
   - Returns complete metadata for one paper identified by its ArXiv ID.

5. **Export for further processing.**
   - Use `--json` flag to get structured JSON output.
   - Use `--output papers.csv` to save results for later analysis.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| ArXiv Atom API endpoints and query syntax | `references/arxiv-api.md` | Constructing advanced queries, understanding response fields, pagination |
| ArXiv subject categories | `references/arxiv-categories.md` | Filtering by research domain (cs, eess, physics, math, stat, etc.) |

## Bundled Scripts

| Script | Purpose | Key Options |
|---|---|---|
| `scripts/arxiv_search.py` | Search ArXiv preprints | `--query TEXT`, `--id ARXIV_ID`, `--max N`, `--category CAT`, `--sort-by relevance\|date`, `--abstract`, `--json`, `--output FILE` |

## Constraints

### MUST DO
- Always report that ArXiv papers are unreviewed preprints unless the paper explicitly states peer-reviewed publication.
- Include the ArXiv ID and submission date with every paper reference.
- Use category filters when the scope is clear — they dramatically improve result precision.
- Limit `--max` to 10–20 results for interactive queries; use 50–100 only for bulk export.

### MUST NOT DO
- Do not confuse an ArXiv preprint with a published, peer-reviewed paper.
- Do not download PDFs automatically unless explicitly requested — use the PDF URL.
- Do not use vague queries like "machine learning" without additional filters.

## Output Template

```
## ArXiv Search: "{query}"
Found {N} papers. Sorted by {sort_by}.

### 1. {paper title}
**Authors:** {author1}, {author2}, ...
**ArXiv ID:** {id}  |  **Submitted:** {date}  |  **Category:** {primary_cat}
**PDF:** https://arxiv.org/pdf/{id}
**Abstract:** {first 2 sentences of abstract}...

### 2. ...
```

## Primary References
- `references/arxiv-api.md` — Atom API query syntax and response fields
- `references/arxiv-categories.md` — All subject area codes
