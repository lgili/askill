---
name: "Web Search"
description: "General-purpose web search using DuckDuckGo — no API key, no registration, no payment required. Returns organic search results with titles, URLs, and snippets for any query. Activates when you say 'search the web for', 'look this up online', 'find current information about', 'search for recent news on', 'web search for', or 'find on the internet'."
---

# Web Search

## Overview

Use this skill for general-purpose web search when you need current, real-world information that isn't available in a specialized database. Powered by DuckDuckGo's free search API and the `duckduckgo-search` Python library — no API key, no account, no payment.

This skill covers:
- **Organic web search** — titles, URLs, and snippets for any query.
- **Instant Answers** — DuckDuckGo's structured answer for factual queries (definitions, calculations, conversions).
- **News search** — recent articles from major news sources.
- **Image search** — image URLs and metadata for visual queries.

Default stance:
- Web search results vary in quality. Always evaluate the source domain before trusting the content.
- For authoritative answers, prefer government (.gov), academic (.edu), or well-known reference sites.
- Combine with `web-scraper` skill to fetch full page content after finding the right URL.
- DuckDuckGo does not track searches and provides globally unfiltered results (no filter bubble).

## Core Workflow

1. **Formulate the query.**
   - Load `references/search-query-craft.md` for query construction techniques.
   - Use specific terms, quotes for exact phrases, and site: or filetype: operators when relevant.
   - For fact-checking: add `site:wikipedia.org` or `site:gov` as needed.

2. **Run the search.**
   - Run: `python scripts/web_search.py --query "your query" --max 10`
   - Returns: title, URL, snippet for each result in Markdown format.
   - Add `--news` for news-focused results, `--images` for image search.

3. **Get an Instant Answer.**
   - Run: `python scripts/web_search.py --query "your query" --instant`
   - Returns DuckDuckGo's structured answer for factual queries.
   - Best for: definitions, unit conversions, calculations, famous person summaries.

4. **Refine if needed.**
   - Add `--region` for region-specific results (e.g., `--region wt-wt` for no region filter).
   - Add `--time d` (day), `w` (week), `m` (month), `y` (year) to filter by recency.

5. **Follow up with web-scraper.**
   - Once you have the right URL, use the `web-scraper` skill to fetch the full page content.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| DuckDuckGo API and library | `references/duckduckgo-api.md` | Understanding search modes, rate limits, response fields, region codes |
| Search query construction | `references/search-query-craft.md` | Building effective queries, advanced operators, Boolean search, quote/exclusion |

## Bundled Scripts

| Script | Purpose | Key Options |
|---|---|---|
| `scripts/web_search.py` | Web search via DuckDuckGo | `--query TEXT`, `--max N`, `--news`, `--images`, `--instant`, `--time d\|w\|m\|y`, `--region CODE`, `--json`, `--output FILE` |

## Constraints

### MUST DO
- Always include the source URL for every result returned.
- Evaluate result quality before presenting: prefer authoritative domains.
- Use `--time` filter for queries where recency matters (news, software versions, prices).
- Respect robots.txt and DuckDuckGo's terms when scraping result pages.

### MUST NOT DO
- Do not present DuckDuckGo snippets as verified facts without following the source URL.
- Do not run hundreds of queries in a loop — DuckDuckGo may rate-limit.
- Do not use web search as a substitute for specialized databases (see `research-arxiv`, `research-pubmed`, `research-wikipedia` for those).

## Output Template

```
## Web Search: "{query}"
{N} results via DuckDuckGo.

### 1. {Title}
**URL:** {url}
{snippet}

### 2. {Title}
**URL:** {url}
{snippet}

---
*Via DuckDuckGo. Verify results at source URLs.*
```

## Primary References
- `references/duckduckgo-api.md` — API modes, library usage, response structure
- `references/search-query-craft.md` — Query building techniques and advanced operators
