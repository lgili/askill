# NCBI PubMed E-utilities API Reference

## Base URL

```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
```

## Key Endpoints

### ESearch — Search for Article IDs
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pubmed
  &term=your+query
  &retmax=20
  &retmode=json
  &sort=relevance
```
Returns: `{"esearchresult": {"idlist": ["12345678", "87654321", ...], "count": "1234", ...}}`

Response fields:
- `count` — total matching articles (not limited to `retmax`)
- `idlist` — list of PMIDs (strings)
- `querytranslation` — how NCBI interpreted your query

### EFetch — Retrieve Full Records
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
  ?db=pubmed
  &id=12345678,87654321
  &retmode=xml
  &rettype=abstract
```
Returns: PubMed XML (parse for `MedlineCitation`, `Article`, `Abstract`, `AuthorList`, `Journal`, etc.)

Key XML paths:
- `PubmedArticle > MedlineCitation > Article > ArticleTitle` — title
- `PubmedArticle > MedlineCitation > Article > Abstract > AbstractText` — abstract
- `PubmedArticle > MedlineCitation > Article > AuthorList > Author` — authors (`LastName`, `ForeName`)
- `PubmedArticle > MedlineCitation > Article > Journal > Title` — journal name
- `PubmedArticle > MedlineCitation > Article > Journal > JournalIssue > PubDate` — publication date
- `PubmedArticle > PubmedData > ArticleIdList > ArticleId[@IdType="doi"]` — DOI
- `PubmedArticle > MedlineCitation > PMID` — PubMed ID

### EInfo — Database Information
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?db=pubmed&retmode=json
```
Returns field names and indexed data — useful for discovering valid field tags.

### ELink — Find Related Articles
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi
  ?dbfrom=pubmed&db=pubmed&id=12345678&cmd=neighbor_score&retmode=json
```
Returns: related PMIDs with similarity scores.

## Rate Limits

- Without API key: **3 requests/second**.
- With free NCBI API key: **10 requests/second**.
- Get a free key at: [https://www.ncbi.nlm.nih.gov/account/](https://www.ncbi.nlm.nih.gov/account/)
- Use `email=your@email.com` parameter to identify your tool even without a key.

```
?term=...&email=your@email.com&tool=my_script
```

## Pagination

ESearch returns up to `retmax` IDs per call (default 20, max 10000).
To paginate:
```
?term=...&retmax=100&retstart=0   → first 100
?term=...&retmax=100&retstart=100 → next 100
```
Use `count` from the first response to know how many total results exist.

## Date and Publication Type Filtering

Date range filter (publication date):
```
&datetype=pdat&mindate=2020/01/01&maxdate=2024/12/31
```

Publication type filter via query term:
```
"Randomized Controlled Trial"[PT]
"Review"[PT]
"Meta-Analysis"[PT]
"Clinical Trial"[PT]
"Case Reports"[PT]
```
