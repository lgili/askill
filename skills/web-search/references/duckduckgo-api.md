# DuckDuckGo API and Library Reference

## Two Ways to Use DuckDuckGo Programmatically

### 1. Instant Answer API (JSON, zero dependencies)

```
GET https://api.duckduckgo.com/
  ?q=your+query
  &format=json
  &no_html=1
  &skip_disambig=1
```

Returns a structured JSON object best for:
- **Abstract** — a short factual answer from Wikipedia or another source
- **Definition** — word definitions from dictionaries
- **Calculation** — math expressions evaluated
- **Conversion** — unit or currency conversions
- **Related Topics** — list of related links

Key response fields:
```json
{
  "Abstract": "Short factual answer text...",
  "AbstractSource": "Wikipedia",
  "AbstractURL": "https://en.wikipedia.org/wiki/...",
  "Answer": "42",
  "AnswerType": "calc",
  "Definition": "...",
  "DefinitionSource": "...",
  "RelatedTopics": [{"Text": "...", "FirstURL": "..."}],
  "Results": [{"Text": "...", "FirstURL": "..."}]
}
```

**Limitation:** The Instant Answer API returns structured answers only for certain queries. For general search results (organic links), use the library below.

### 2. `duckduckgo-search` Python Library (organic results)

```bash
pip install duckduckgo-search
```

No API key required. Provides real organic search results, news, images, and videos.

```python
from duckduckgo_search import DDGS

# Text search
results = DDGS().text("python asyncio tutorial", max_results=10)
# Each result: {"title": ..., "href": ..., "body": ...}

# News search
news = DDGS().news("AI breakthroughs 2025", max_results=5)
# Each item: {"date": ..., "title": ..., "body": ..., "url": ..., "source": ...}

# Image search
images = DDGS().images("circuit diagram mosfet", max_results=10)
# Each item: {"title": ..., "image": ..., "url": ..., "thumbnail": ...}
```

## Rate Limits and Fair Use

- **No hard rate limit**, but DuckDuckGo may return `202` or `429` if queries come too fast.
- Recommended: add `time.sleep(1)` between searches in a loop.
- The library handles rate limit retries internally with exponential backoff.
- Do not run more than ~100 searches in a single session without pausing.

## `sortBy` / Time Filters

```python
# Only results from the past week
DDGS().text("quantum computing news", timelimit="w")
# timelimit values: "d" (day), "w" (week), "m" (month), "y" (year)
```

## Region Codes

```python
DDGS().text("local news", region="br-pt")   # Brazil Portuguese
DDGS().text("local news", region="us-en")   # United States English
DDGS().text("local news", region="wt-wt")   # No region filter
```

Common region codes: `br-pt`, `us-en`, `gb-en`, `de-de`, `fr-fr`, `jp-jp`, `es-es`.

## SafeSearch

```python
DDGS().text("query", safesearch="moderate")  # "on", "moderate", "off"
```

## Error Handling

The library raises `DuckDuckGoSearchException` on failures. Common causes:
- Network timeout → retry after `time.sleep(5)`
- 202/429 from DDG → slow down query rate
- Empty results → try a simpler or different query
