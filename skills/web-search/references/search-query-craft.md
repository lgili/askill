# Search Query Construction Guide

## Core Principles

Good search queries are specific, not natural language.

| Weak (natural language) | Strong (search query) |
|---|---|
| "what is the best treatment for high blood pressure" | `hypertension treatment guidelines 2024` |
| "why is my Python code slow" | `python performance optimization asyncio bottleneck` |
| "how does a MOSFET work" | `MOSFET operation N-channel threshold voltage gate` |
| "latest news about AI" | `AI regulation 2025 EU act enforcement` |

## Essential Operators

| Operator | Syntax | Example |
|---|---|---|
| Exact phrase | `"..."` | `"transfer learning" NLP` |
| Exclude term | `-word` | `python -snake` |
| Site restrict | `site:domain` | `climate site:nasa.gov` |
| File type | `filetype:ext` | `datasheet PDF filetype:pdf` |
| Title must contain | `intitle:word` | `intitle:tutorial numpy` |
| URL must contain | `inurl:word` | `inurl:api documentation` |
| OR | `word1 OR word2` | `IGBT OR MOSFET switch` |

DuckDuckGo supports most of these operators. Note: not all search engines support all operators.

## Date/Recency Filters

Use `--time` in the script for DuckDuckGo results recency:
- `d` — last 24 hours (breaking news, incidents)
- `w` — last week (recent tutorials, announcements)
- `m` — last month (new library releases, events)
- `y` — last year (current standards, practices)

Embed dates in query terms for manual precision: `numpy 2025`, `"Python 3.12"`, `RFC 9110 HTTP`.

## Domain Authority Heuristics

For technical queries, prioritize results from:

| Domain pattern | Trust level | Best for |
|---|---|---|
| `.gov`, `.edu` | High | Official stats, regulations, research |
| `arxiv.org`, `doi.org` | High | Academic papers |
| `github.com` | Medium-High | Code, READMEs, issues |
| `stackoverflow.com` | Medium-High | Code Q&A (verified answers) |
| `docs.python.org`, `developer.mozilla.org` | High | Official docs |
| `medium.com`, `dev.to` | Low-Medium | Tutorials (check date and author) |
| Unknown blog | Low | Verify independently |

## Multi-Step Research Strategy

For complex topics, break the research into stages:

1. **Orientation search** — broad query to map the territory.
2. **Depth search** — specific sub-topic with domain filter.
3. **Verification search** — fact-check specific claims against authoritative sources.
4. **Recency search** — find latest developments with `--time w` or `--time m`.

Example for "best MOSFET driver IC in 2024":
1. `MOSFET gate driver IC overview` — understand the category
2. `MOSFET driver IC comparison high frequency site:ti.com OR site:diodes.com` — manufacturer data
3. `"UCC27517" specifications` — verify a specific candidate
4. `MOSFET driver new release 2024` with `--time y` — latest products

## Query Templates by Use Case

```
# Library documentation
{library_name} {version} documentation API reference

# Error debugging
{error_message} {language} fix site:stackoverflow.com

# Component selection
{component_type} comparison {key_spec} {year}

# Research paper
{specific_topic} review paper site:arxiv.org OR site:ieee.org

# Standard / specification
{standard_name} {year} PDF site:.gov OR site:.edu
```
