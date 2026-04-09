# PubMed Query Syntax and Field Tags

## Basic Syntax

PubMed queries support Boolean logic and field-specific search tags.

### Boolean Operators (must be UPPERCASE)
```
diabetes AND insulin
diabetes OR "blood glucose"
cancer ANDNOT breast
(diabetes OR obesity) AND treatment
```

### Phrase Search
```
"type 2 diabetes mellitus"
"randomized controlled trial"
```

### Wildcard
```
cardio*    → cardiomyopathy, cardiovascular, cardiology, etc.
inflam*    → inflammation, inflammatory, inflammasome, etc.
```

## Field Tags

Append `[tag]` after a term to restrict to a specific field:

| Tag | Field | Example |
|---|---|---|
| `[TI]` | Title | `insulin resistance[TI]` |
| `[AB]` | Abstract | `MOSFET[AB]` |
| `[TIAB]` | Title or Abstract | `CRISPR[TIAB]` |
| `[AU]` | Author | `Smith J[AU]` |
| `[1AU]` | First Author | `Jones K[1AU]` |
| `[LASTAU]` | Last Author | `Tanaka M[LASTAU]` |
| `[TA]` | Journal Title Abbreviation | `NEJM[TA]` |
| `[MH]` | MeSH Term | `"Diabetes Mellitus, Type 2"[MH]` |
| `[PT]` | Publication Type | `"Review"[PT]` |
| `[DP]` | Date Published | `2020:2024[DP]` |
| `[PMID]` | PubMed ID | `12345678[PMID]` |
| `[LA]` | Language | `English[LA]` |
| `[SB]` | Subset | `medline[SB]` |

## MeSH (Medical Subject Headings)

MeSH terms are the canonical controlled vocabulary for biomedical concepts. Using them greatly improves recall.

Examples:
```
"Myocardial Infarction"[MH]         instead of   heart attack
"Neoplasms"[MH]                     instead of   cancer
"Diabetes Mellitus, Type 2"[MH]     instead of   type 2 diabetes
"Anti-Bacterial Agents"[MH]         instead of   antibiotics
```

Find the correct MeSH term at: [https://www.ncbi.nlm.nih.gov/mesh](https://www.ncbi.nlm.nih.gov/mesh)

### MeSH Subheadings
Add `/subheading` to narrow a MeSH term to a specific aspect:
```
"Neoplasms/therapy"[MH]
"Hypertension/drug therapy"[MH]
"Insulin/pharmacology"[MH]
```

## Publication Types

Most useful values for the `[PT]` field:

| Type | Description |
|---|---|
| `Randomized Controlled Trial` | Gold standard for interventions |
| `Meta-Analysis` | Pooled analysis of multiple studies |
| `Systematic Review` | Structured literature synthesis |
| `Review` | Narrative review |
| `Clinical Trial` | Any prospective clinical study |
| `Observational Study` | Cohort, case-control, cross-sectional |
| `Case Reports` | Individual case descriptions |
| `Letter` | Short correspondence |
| `Editorial` | Opinion/commentary |

## Example Queries

```
# All RCTs on metformin for type 2 diabetes, last 5 years
"Metformin"[MH] AND "Diabetes Mellitus, Type 2"[MH] AND "Randomized Controlled Trial"[PT] AND 2020:2026[DP]

# Reviews about CRISPR cancer therapy
CRISPR[TIAB] AND "Neoplasms/therapy"[MH] AND "Review"[PT]

# Papers by a specific author on a topic
Smith J[AU] AND neuroimaging[TIAB]

# High-impact journals only
"Nature"[TA] OR "Science"[TA] OR "New England Journal of Medicine"[TA]
```

## Query Translation

After an ESearch call, NCBI returns `querytranslation` showing how it interpreted your query. Always check this to verify your intended filter was applied correctly. If MeSH expansion happened unexpectedly, append `[NOEXP]` to disable it:
```
insulin[MH:NOEXP]
```
