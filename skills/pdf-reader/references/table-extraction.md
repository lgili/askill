# Table Extraction Strategies with pdfplumber

## How pdfplumber Detects Tables

pdfplumber uses three primary strategies for table boundary detection:

| Strategy | Mechanism | Best for |
|---|---|---|
| `"lines"` | Detects horizontal/vertical ruling lines in the PDF | Most printed tables with visible borders |
| `"text"` | Infers column separators from whitespace gaps between word clusters | Tables without ruling lines (whitespace-delimited) |
| `"explicit"` | You supply exact pixel coordinates for separators | Tables with irregular or missing rules |

Default `extract_tables()` uses `"lines"` for both horizontal and vertical; falls back to text-gap inference if few lines are found.

## Standard Table Detection Call

```python
import pdfplumber

TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,        # px; merge lines within this distance
    "join_tolerance": 3,        # px; join gap in a line within this distance
    "edge_min_length": 3,       # minimum line segment length (pt) to count
    "min_words_vertical": 3,    # minimum words involved to infer a column sep
    "min_words_horizontal": 1,  # minimum words to infer a row sep
    "intersection_tolerance": 3,
    "text_tolerance": 3,
}

with pdfplumber.open("doc.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables(TABLE_SETTINGS)
        for table in tables:
            # table: list[list[str | None]]
            for row in table:
                print(row)
```

## Handling Borderless Tables

Many modern datasheets and reports use background-shaded rows without ruling lines.

Strategy: switch to `"text"` vertical strategy:

```python
BORDERLESS_SETTINGS = {
    "vertical_strategy": "text",
    "horizontal_strategy": "lines",
    "min_words_vertical": 3,
}
```

If the table still fails: use explicit column positions. Print `page.extract_words()` and identify approximate x-coordinates of column boundaries manually or programmatically.

## Merged Cells and Span Headers

pdfplumber does not reconstruct cell spans — it returns `None` for cells covered by a merge (the text appears in the first cell of the span and subsequent cells are `None`).

Post-processing pattern:

```python
def fill_merged(table):
    """Forward-fill None cells (horizontal merge)."""
    result = []
    for row in table:
        filled = []
        last = ""
        for cell in row:
            if cell is None:
                filled.append(last)
            else:
                last = cell
                filled.append(cell)
        result.append(filled)
    return result
```

For vertical merges (row spans): track `None` values in the same column across rows and fill downwards.

## Formatting a Table as GFM Markdown

```python
def table_to_gfm(rows: list[list[str | None]]) -> str:
    if not rows:
        return ""
    # Clean cells
    clean = [[str(c).strip() if c else "" for c in row] for row in rows]
    # Column widths
    col_w = [max(len(row[i]) for row in clean) for i in range(len(clean[0]))]
    def fmt_row(row):
        return "| " + " | ".join(cell.ljust(col_w[i]) for i, cell in enumerate(row)) + " |"
    header = fmt_row(clean[0])
    sep = "| " + " | ".join("-" * w for w in col_w) + " |"
    body = "\n".join(fmt_row(r) for r in clean[1:])
    return "\n".join([header, sep, body])
```

## Excluding Table Regions from Text Flow

When extracting body text, crop out table bounding boxes to avoid duplicating content:

```python
tables_bbox = [t.bbox for t in page.find_tables(TABLE_SETTINGS)]

def not_in_tables(char, bboxes):
    x, y = char["x0"], char["top"]
    return not any(bx0 <= x <= bx1 and by0 <= y <= by1 for bx0, by0, bx1, by1 in bboxes)

words_outside = [w for w in page.extract_words() if not_in_tables(w, tables_bbox)]
```

## Common Failure Modes

| Symptom | Likely Cause | Fix |
|---|---|---|
| Extra empty rows/columns in output | Stray ruling lines from decorative elements | Increase `edge_min_length`, inspect `page.lines` |
| Table split across two pages | pdfplumber processes one page at a time | Detect continuation tables by checking if first row lacks a header row; merge with previous page's last table |
| Table columns shifted/merged | Column separator gap too small | Switch to `"explicit"` strategy with manually measured x positions |
| Numbers as strings with newlines inside | Line breaks inside a cell encoded as separate text runs | Join cell content with a space when `\n` appears mid-cell |
| Thai/CJK/Arabic characters garbled | Font encoding without full Unicode CMap | Flag the table as requiring manual review; OCR may be needed |

## Inspecting Raw Table Debug Info

```python
# Draw table borders over the page for visual debugging
im = page.to_image()
im.debug_tablefinder(TABLE_SETTINGS)
im.save("page_debug.png")
```

This renders bounding boxes of all detected table cells over the page, making it easy to diagnose mis-detected boundaries.
