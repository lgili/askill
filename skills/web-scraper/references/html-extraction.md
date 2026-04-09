# HTML Content Extraction Techniques

## How Static HTML Extraction Works

For pages rendered server-side (classic HTML), the full content is in the HTTP response body. Python's `urllib.request` + `html.parser` can handle this without any external dependency:

```python
import urllib.request
from html.parser import HTMLParser

req = urllib.request.Request(
    url,
    headers={"User-Agent": "MyScraper/1.0 (research purposes)"}
)
html_bytes = urllib.request.urlopen(req, timeout=15).read()
html_text = html_bytes.decode("utf-8", errors="replace")
```

## JavaScript-Rendered Pages (SPA)

Many modern sites (React, Vue, Angular) render content client-side in JavaScript. `urllib.request` will return an empty content shell.

Detection: if the `<body>` is nearly empty (< 200 chars of visible text) but the HTML is large, it's likely JS-rendered.

Options for JS-rendered pages:
1. **Find the API behind the page** — open browser DevTools → Network tab → filter XHR/Fetch → identify JSON API calls the page makes → call those directly.
2. **Use `playwright` or `selenium`** — headless browser automation (heavier dependency).
3. **Look for a public API** — most data-heavy sites have a documented API.

## Text Extraction (Noise Removal)

Raw HTML contains `<nav>`, `<header>`, `<footer>`, `<script>`, `<style>`, `<aside>` that pollute extracted text.

With BeautifulSoup:
```python
from bs4 import BeautifulSoup

soup = BeautifulSoup(html_text, "html.parser")
# Remove noise elements
for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
    tag.decompose()
# Get main content
text = soup.get_text(separator="\n", strip=True)
```

Without BeautifulSoup (stdlib only): use a custom `HTMLParser` subclass that ignores script/style tags and collects text from other elements.

## Table Extraction

HTML tables `<table>` → rows `<tr>` → cells `<td>` or `<th>`.

With BeautifulSoup:
```python
tables = soup.find_all("table")
for i, table in enumerate(tables):
    headers = [th.get_text(strip=True) for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
```

Beware: rowspan/colspan attributes create merged cells — a simple row/cell iterator will produce misaligned columns. For complex tables, note this limitation.

## Character Encoding

Always respect the page's declared encoding:
1. Check HTTP `Content-Type` header: `charset=utf-8`
2. Check HTML `<meta charset="UTF-8">` or `<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">`
3. Fall back to UTF-8 with `errors="replace"`.

```python
import re
charset_match = re.search(r'charset=["\']?([\w-]+)', html_text)
encoding = charset_match.group(1) if charset_match else "utf-8"
```

## Relative vs Absolute URLs

Links extracted from `<a href>` may be relative (`/page/123`, `../other`, `#section`).
Convert to absolute using `urllib.parse.urljoin`:

```python
from urllib.parse import urljoin
base_url = "https://example.com/articles/"
absolute = urljoin(base_url, "/page/123")  # → https://example.com/page/123
```

## HTTP Error Handling

| Status Code | Meaning | Action |
|---|---|---|
| 200 | OK | Proceed |
| 301/302 | Redirect | `urllib` follows automatically |
| 403 | Forbidden | Scraping blocked; try different User-Agent or stop |
| 404 | Not Found | Invalid URL; notify the user |
| 429 | Rate Limited | Sleep and retry with backoff |
| 500/503 | Server Error | Retry once after a few seconds |
