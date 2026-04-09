# Wikipedia REST API Reference

## Base URLs

| Endpoint Type | Base URL |
|---|---|
| REST API (summaries, sections) | `https://en.wikipedia.org/api/rest_v1/` |
| Action API (search, parse) | `https://en.wikipedia.org/w/api.php` |
| Other languages | Replace `en` with language code: `de`, `pt`, `fr`, `es`, `ja`, etc. |

## REST API Endpoints

### Article Summary
```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```
Returns: `title`, `displaytitle`, `description`, `extract` (plain text intro), `thumbnail`, `originalimage`, `content_urls`, `coordinates` (for geographic articles), `lastrevid`.

Notes:
- Encode spaces as `_` or `%20` in the title.
- Returns HTTP 404 if the exact title is not found — use Action API search first.
- Max response size is typically <5 KB.

### All Page Sections (HTML)
```
GET https://en.wikipedia.org/api/rest_v1/page/html/{title}
```
Returns: full article HTML, including section tags. Parse with BeautifulSoup for structured extraction.

### Mobile Sections (JSON, structured)
```
GET https://en.wikipedia.org/api/rest_v1/page/mobile-sections/{title}
```
Returns a JSON object with:
- `lead.sections[0]` — intro section
- `remaining.sections[]` — remaining sections, each with `toclevel`, `anchor`, `title`, `content` (HTML)

### Related Pages
```
GET https://en.wikipedia.org/api/rest_v1/page/related/{title}
```
Returns: array of related article summaries.

## Action API — OpenSearch (Autocomplete)
```
GET https://en.wikipedia.org/w/api.php
  ?action=opensearch
  &search=quantum+computing
  &limit=5
  &namespace=0
  &format=json
```
Returns: `["query", [titles], [descriptions], [urls]]`

## Action API — Full-text Search
```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &list=search
  &srsearch=quantum+computing&srnamespace=0
  &srlimit=10
  &format=json
```
Returns: `query.search[]` with `title`, `snippet`, `size`, `timestamp`.

## Rate Limits and Etiquette
- No API key required.
- No hard rate limit, but Wikipedia asks for reasonable use: avoid >200 req/min.
- Set a descriptive `User-Agent`: `User-Agent: MyScript/1.0 (your@email.com)`.
- Respect `Cache-Control` headers; cache results when possible.
- Production systems making heavy use should use [https://dumps.wikimedia.org](https://dumps.wikimedia.org) instead.

## Response Field Notes

| Field | Type | Notes |
|---|---|---|
| `extract` | string | First paragraph(s) in plain text. May end with ellipsis if truncated. |
| `description` | string | Short Wikidata description, e.g. "42nd President of the United States" |
| `thumbnail.source` | string | URL for largest available thumbnail image |
| `content_urls.desktop.page` | string | Full Wikipedia URL |
| `lastrevid` | int | Revision ID; append to URL as `?oldid={id}` to pin a specific version |

## Handling Disambiguation Pages
- If the article type is `disambiguation`, the `extract` will say "may refer to:".
- In that case, re-search with a more specific term or browse `content_urls` to pick the right article.
