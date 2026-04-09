# Web Scraping Ethics and Legal Considerations

## The Core Rule

Before scraping any site, ask:
1. **Is the content publicly accessible** without login or payment?
2. **Does `robots.txt` permit scraping** of this path?
3. **Do the site's Terms of Service** prohibit automated access?
4. **Are you collecting personal data?** (GDPR/LGPD/CCPA apply if so)

## robots.txt

Every well-managed site has a `robots.txt` at its root, which specifies scraping permissions.

```
# Example: robots.txt
User-agent: *
Disallow: /private/
Disallow: /user/
Allow: /public/
Crawl-delay: 5
```

How to read it programmatically:
```python
import urllib.robotparser

rp = urllib.robotparser.RobotFileParser()
rp.set_url("https://example.com/robots.txt")
rp.read()
allowed = rp.can_fetch("*", "https://example.com/blog/post-1")  # True/False
```

Always:
- Respect `Disallow` directives for your target path.
- Respect `Crawl-delay` — it means "wait N seconds between requests".
- Use `User-agent: *` rules if there's no specific rule for your agent.

## Rate Limiting and Polite Scraping

Even for allowed paths, excessive requests harm the site. Follow these defaults:

| Situation | Recommended delay |
|---|---|
| Single page lookup | No delay needed |
| Scraping 2–10 pages | 1–2 seconds between requests |
| Bulk scraping (>10 pages) | 3–5 seconds minimum + respect Crawl-delay |
| Large-scale crawl | Use official data export/API instead |

```python
import time
time.sleep(2)   # Always add a pause between sequential requests
```

## User-Agent Best Practice

Always set a descriptive `User-Agent`. Generic agents (empty or "python-requests") are often blocked.

```python
headers = {
    "User-Agent": "ResearchBot/1.0 (educational scraping; contact: you@email.com)"
}
```

## Personal Data (PII)

Do not collect, store, or process personal data (names, emails, phone numbers, IP addresses, etc.) without a legal basis under GDPR (EU), LGPD (Brazil), or CCPA (California).

Specifically for this skill:
- Do not extract email addresses from web pages.
- Do not build profiles of individuals from scraped data.
- Do not scrape health, financial, or employment data without explicit authorization.

## Terms of Service

Some sites explicitly prohibit automated scraping in their ToS. Notable examples:
- LinkedIn, Facebook, Twitter/X — explicitly prohibit scraping.
- Amazon — prohibits scraping product data for commercial use.
- Google Search results pages — explicitly prohibited (use their APIs instead).

**If ToS prohibits scraping**, stop and use the official API or data export instead.

## When NOT to Scrape

| Situation | Better alternative |
|---|---|
| Site has a public API | Use the API — more reliable, faster, sanctioned |
| Site has a data export / download | Use the direct download |
| Site is behind login | Do not scrape; respect authentication |
| Content is dynamically generated per-user | Do not scrape |
| Scientific data | Use the database's query API (PubMed, ArXiv, etc.) |

## Legal Jurisdiction Notes

In Brazil (LGPD context), scraping publicly available data for research or non-commercial use is generally permitted if it does not collect personal data and does not harm the data subject. However, always prefer official APIs when available.
