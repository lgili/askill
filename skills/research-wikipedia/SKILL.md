---
name: "Research Wikipedia"
description: "Search and retrieve structured content from Wikipedia using the free REST API — no API key required. Fetches article summaries, full section text, infobox data, and related links. Activates when you say 'search Wikipedia', 'look up on Wikipedia', 'what does Wikipedia say about', 'get Wikipedia summary', 'find Wikipedia article', or 'research topic using Wikipedia'."
---

# Research Wikipedia

## Overview

Use this skill when you need encyclopedic reference information on any topic. Wikipedia provides reliable overviews, definitions, historical context, and structured facts with citations — backed by the free, unauthenticated Wikipedia REST API.

This skill covers:
- **Quick summary lookups** — title, thumbnail, extract (first paragraph), coordinates if applicable.
- **Full article text by section** — useful for deeper understanding.
- **Search suggestions** — find the canonical article name when spelling is uncertain.
- **Related articles and links** — discover connected topics.

Default stance:
- Wikipedia is a starting point, not the final source. For technical claims, follow the references and cite the original source.
- Always prefer the English Wikipedia (most complete) unless the topic is better covered in another language.
- Wikipedia summaries may be outdated; note the last-updated date when precision matters.

## Core Workflow

1. **Determine the search intent.**
   - Is this a quick fact lookup (use `summary` endpoint) or a deeper research read (use `sections` endpoint)?
   - Is the topic title known (use direct endpoint) or uncertain (use `opensearch` first)?

2. **Search for the article title.**
   - Run: `python scripts/wikipedia_search.py --query "your topic" --mode search`
   - Returns up to 5 candidate titles with brief descriptions. Confirm the best match.

3. **Fetch the article summary.**
   - Run: `python scripts/wikipedia_search.py --title "Article Title" --mode summary`
   - Returns: description, extract (intro paragraph), thumbnail URL, page URL.
   - For a one-liner fact, the summary is often sufficient.

4. **Fetch full section content if needed.**
   - Run: `python scripts/wikipedia_search.py --title "Article Title" --mode sections`
   - Returns the article split into named sections with plain text.
   - Use `--section "History"` to fetch a single section by name.

5. **Extract related links for deeper research.**
   - Run: `python scripts/wikipedia_search.py --title "Article Title" --mode links`
   - Returns internal Wikipedia links found in the article body.
   - Use as a map of adjacent topics to follow up on.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Wikipedia REST API endpoints | `references/wikipedia-api.md` | Calling the API manually, understanding rate limits, language variants |
| Search and disambiguation strategies | `references/search-strategies.md` | Handling ambiguous terms, redirect pages, disambiguation pages |

## Bundled Scripts

| Script | Purpose | Key Options |
|---|---|---|
| `scripts/wikipedia_search.py` | Search and retrieve Wikipedia content | `--query TEXT`, `--title TEXT`, `--mode search\|summary\|sections\|links`, `--lang en`, `--json`, `--section NAME` |

## Constraints

### MUST DO
- Run `--mode search` first when the exact article title is uncertain.
- Acknowledge when a Wikipedia article may be outdated (check `extract` for "as of YYYY" disclaimers).
- Include the Wikipedia URL in all cited facts.
- Use `--lang` when a non-English article would be more accurate (e.g., country-specific topics).

### MUST NOT DO
- Do not treat Wikipedia content as the primary citation for scientific or medical claims — follow the references.
- Do not hallucinate article titles; always search first if unsure.
- Do not call the API more than necessary; cache results within the same session.

## Output Template

```
## Wikipedia: {Article Title}
**URL:** https://en.wikipedia.org/wiki/{title}
**Summary:** {extract first paragraph}

### Key Points
- {point 1 from article}
- {point 2 from article}

### Further Reading (Related Wikipedia topics)
- [{link title}](https://en.wikipedia.org/wiki/{link})
```

## Primary References
- `references/wikipedia-api.md` — REST API endpoints and response structure
- `references/search-strategies.md` — disambiguation and search tactics
