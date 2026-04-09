# PDF Formats and Text Layer Structure

## What Is a PDF Text Layer?

A PDF file encodes page content as a stream of operators. Text content uses the `BT`/`ET` (Begin Text / End Text) operator pairs. Each text element carries:
- A **font reference** (mapped to an embedded font program or a standard PDF font).
- A **character code** sequence that maps through the font's `ToUnicode` CMap to Unicode codepoints.
- A **transformation matrix** (position, size, rotation).

A **digital PDF** (created by Word, LaTeX, Illustrator, CAD tools) has a full text layer. A **scanned PDF** is a sequence of rasterized page images with no text layer — PDF viewers display them but pdfplumber extracts nothing meaningful.

## Detecting the Text Layer

```python
import pdfplumber

with pdfplumber.open("doc.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        chars = len(text.strip())
        print(f"Page {i+1}: {chars} chars extracted")
```

Heuristic: if fewer than 50 characters are extracted from a page that visually contains text, it is likely scanned. Do not trust the output — warn the user.

## Common Encoding Problems

### Wrong Character Mapping (`????` or garbled output)
- Cause: embedded font without a `ToUnicode` CMap, or a custom encoding not covered by the CMap.
- Workaround: try `page.extract_words()` and inspect the `fontname` field — if it is a Type3 or custom font, extraction will be unreliable.
- Last resort: OCR the page even if a text layer exists.

### Ligatures Decoded as Separate Characters
- `fi`, `fl`, `ffi` ligatures are frequently encoded as a single glyph; some CMaps handle this, others do not.
- pdfplumber returns them as is — post-process with a simple substitution if needed.

### Reversed Reading Order
- Multi-column PDFs sometimes have text streams ordered by creation time, not reading order.
- Use `page.extract_words()` (returns words with bounding boxes) and sort by `(top, x0)` to recover reading order.
- For two-column: split page vertically at midpoint, sort each half separately.

### Text Rendered as Paths
- Some PDFs convert text to vector paths (outlines) for visual presentation. These have no text layer.
- Symptoms: pdfplumber returns empty, but the visual PDF appears to have text.
- Solution: OCR the page — tesseract works well for this.

## Multi-Column Layout Reconstruction

```python
words = page.extract_words()
width = page.width
mid = width / 2

left_words  = [w for w in words if w["x0"] < mid]
right_words = [w for w in words if w["x0"] >= mid]

# Sort each column top-to-bottom
left_words.sort(key=lambda w: (w["top"], w["x0"]))
right_words.sort(key=lambda w: (w["top"], w["x0"]))
```

Join word `text` fields with spaces; break lines when vertical gap exceeds ~1.2× font size.

## PDF Versions and Features

| Feature | Impact on Extraction |
|---|---|
| PDF 1.4+ transparency | Transparent text may be in a separate layer (OCG) — enable all optional content groups |
| Tagged PDF (PDF/UA) | Tags encode reading order explicitly; pdfplumber ignores tags but they can help with word ordering |
| XFA/AcroForms | Dynamic PDF forms store field values separately; extract with `page.annots` |
| Password-protected PDF | pdfplumber accepts a `password` argument: `pdfplumber.open(path, password="pw")` |
| Linearized/web-optimized | No extraction impact; pdfplumber processes normally |

## Page Size Reference

Common page sizes in PDF user-space units (1 pt = 1/72 inch):

| Format | Width × Height (pt) |
|---|---|
| A4 | 595 × 842 |
| A3 | 842 × 1191 |
| Letter | 612 × 792 |
| Tabloid/Ledger | 792 × 1224 |

Use `page.width` and `page.height` to determine page size programmatically.

## Character Bounding Box Access

```python
for char in page.chars:
    print(char["text"], char["x0"], char["top"], char["fontname"], char["size"])
```

`char["top"]` is measured from the top of the page (not the bottom as in PDF spec coordinates). pdfplumber normalizes this for you.
