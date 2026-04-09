---
name: "Web Scraper"
description: "Fetch and extract structured content from any public web page — no API key or external service required. Extracts clean text, tables (as CSV/Markdown), links, headings, and image metadata using Python stdlib plus optional beautifulsoup4. Activates when you say 'scrape this page', 'extract content from URL', 'fetch web page content', 'get data from website', 'parse HTML from URL', or 'extract table from web page'."
---

# Web Scraper

## Overview

Use this skill when you have a URL and need its content in a structured, readable form. Unlike a search engine (which gives snippets), this skill fetches the full page and extracts specific elements: clean text, HTML tables, all links, headings hierarchy, or image sources.

This skill covers:
- **Clean text extraction** — removes nav/footer/ads, returns only body text content.
- **HTML table extraction** — converts `<table>` elements to CSV or Markdown.
- **Link extraction** — all `<a href>` links with anchor text.
- **Heading structure** — H1–H6 hierarchy as an outline.
- **Metadata** — title, description, Open Graph tags, canonical URL.

Default stance:
- Only scrape pages that are publicly accessible and whose `robots.txt` allows scraping.
- Prefer structured APIs when available — scraping is a fallback for pages without an API.
- Respect rate limits: one page at a time, with a pause between multiple pages.
- Use `web-search` skill to find the right URL first, then pass it to this skill.

## Core Workflow

1. **Identify the target URL.**
   - Use `web-search` skill to find the right URL if not already known.
   - Verify the URL is publicly accessible (not behind login or paywall).
   - Check the site's `robots.txt` if scraping systematically: `https://example.com/robots.txt`.

2. **Fetch and extract.**
   - Run: `python scripts/scrape_page.py --url "https://example.com/page"`
   - Default output: page title + clean body text as Markdown.
   - Add `--tables` to extract HTML tables.
   - Add `--links` to list all hyperlinks.
   - Add `--headings` to extract the heading outline.
   - Add `--meta` to get page metadata (title, description, OG tags).

3. **Extract specific tables.**
   - Run: `python scripts/scrape_page.py --url URL --tables --format csv`
   - Outputs each `<table>` found on the page as a separate CSV.
   - Use `--table-index N` to extract only the Nth table (0-based).

4. **Follow links / crawl shallow.**
   - Run with `--links` to get all outbound links.
   - Manually select relevant URLs and re-run for each.
   - Do NOT automate deep crawls without explicit permission.

5. **Output and save.**
   - Use `--output FILE` to save result to a file.
   - Use `--json` for structured output (metadata + content + tables + links in one object).

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| HTML content extraction techniques | `references/html-extraction.md` | Understanding how text/table/link extraction works, handling JS-rendered pages, character encoding |
| Scraping ethics and robots.txt | `references/scraping-ethics.md` | Before scraping any site systematically, understanding polite scraping rules |

## Bundled Scripts

| Script | Purpose | Key Options |
|---|---|---|
| `scripts/scrape_page.py` | Fetch and extract web page content | `--url URL`, `--tables`, `--links`, `--headings`, `--meta`, `--format markdown\|csv`, `--table-index N`, `--timeout N`, `--json`, `--output FILE` |

## Constraints

### MUST DO
- Always check `robots.txt` when scraping more than a single page.
- Set a non-empty `User-Agent` header identifying your script.
- Handle HTTP errors gracefully (403 Forbidden = credentials needed or scraping blocked; 429 = rate limited).
- Use `--timeout` to prevent hanging on slow servers (default: 15 seconds).

### MUST NOT DO
- Do not scrape pages that require login credentials you don't have.
- Do not automate bulk scraping without explicit permission from the site owner.
- Do not use this skill to exfiltrate personal data (PII, emails, private content).
- Do not ignore `Crawl-delay` directives in `robots.txt`.

## Output Template

```
## Scraped: {URL}
**Title:** {page title}
**Fetched:** {timestamp}

### Content
{clean body text}

### Tables Found: {N}
#### Table 1
| col1 | col2 | col3 |
|------|------|------|
| val  | val  | val  |
```

## Primary References
- `references/html-extraction.md` — Extraction techniques, JS-rendered pages, encoding issues
- `references/scraping-ethics.md` — robots.txt, rate limiting, legal considerations
