# ArXiv API Reference

## Base URL and Format

```
https://export.arxiv.org/api/query?{parameters}
```
Returns: Atom XML feed (parse with `xml.etree.ElementTree` or `feedparser` library).

## Query Parameters

| Parameter | Values | Description |
|---|---|---|
| `search_query` | string | Search expression (see below) |
| `id_list` | comma-separated ArXiv IDs | Fetch specific papers by ID |
| `start` | int (default 0) | Pagination offset |
| `max_results` | int (default 10, max 2000) | Results per request |
| `sortBy` | `relevance`, `lastUpdatedDate`, `submittedDate` | Sort order |
| `sortOrder` | `ascending`, `descending` | Direction |

## Search Query Syntax

### Field Prefixes

| Prefix | Searches in |
|---|---|
| `ti:` | Title |
| `au:` | Author name |
| `abs:` | Abstract |
| `cat:` | Subject category |
| `all:` | All of the above |
| `rn:` | Report number |
| `co:` | Comment field |

### Boolean Operators
- `AND` — both terms required (default between terms)
- `OR` — either term
- `ANDNOT` — exclude term
- `()` — grouping

### Examples
```
# Papers about transformers in NLP
ti:transformer AND cat:cs.CL

# Papers by a specific author on a topic
au:lecun AND ti:convolutional

# Recent MOSFET power device papers
abs:MOSFET AND cat:eess.PE

# Control systems OR signal processing
cat:eess.SY OR cat:eess.SP
```

## Response XML Structure

Each `<entry>` in the Atom feed contains:

```xml
<entry>
  <id>http://arxiv.org/abs/2401.12345v1</id>
  <title>Paper Title Here</title>
  <summary>Full abstract text...</summary>
  <author><name>First Last</name></author>  <!-- may repeat -->
  <published>2024-01-15T12:00:00Z</published>
  <updated>2024-01-16T08:00:00Z</updated>
  <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  <link title="pdf" href="https://arxiv.org/pdf/2401.12345" type="application/pdf"/>
  <arxiv:primary_category term="cs.LG"/>
</entry>
```

Extract ArXiv ID: take the last path segment of the `<id>` URL, strip version suffix (`v1`, `v2`, etc.).

## Rate Limits

- **3 seconds** minimum between consecutive API calls.
- For bulk queries, use the `--max` limit and paginate via `start` parameter.
- Large-scale harvesting should use the S3 bulk data access: [https://info.arxiv.org/help/bulk_data_s3.html](https://info.arxiv.org/help/bulk_data_s3.html).

## PDF Download URLs

- HTML page: `https://arxiv.org/abs/{id}`
- PDF download: `https://arxiv.org/pdf/{id}`
- Source files: `https://arxiv.org/src/{id}`

## ArXiv ID Format

- Current format: `YYMM.NNNNN` (e.g., `2401.12345`)
- Old format (pre-April 2007): `cat/YYMMNNN` (e.g., `cs/0703072`)
- Version suffix: `v1`, `v2`, ... (latest = no suffix or query without version)
