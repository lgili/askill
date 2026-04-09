---
name: "PDF Reader"
description: "PDF extraction specialist for text, tables, and embedded images. Converts digital PDFs to clean Markdown, GFM tables, and PNG exports. Activates when you say 'read this PDF', 'extract text from PDF', 'get tables from PDF', 'export images from PDF', 'convert PDF to markdown', or 'parse PDF document'."
---

# PDF Reader

## Overview

Use this skill to extract clean, structured content from PDF files for downstream processing — by AI agents, simulation tools, or human review. The primary goal is fidelity: preserve the original document structure (paragraphs, headings, tables, figures) and output in formats that are easy to consume programmatically.

Default stance:

- **Digital PDFs** (text layer present) → direct extraction via pdfplumber; precise, no OCR needed.
- **Scanned PDFs** (image-only pages) → flag as requiring OCR before extraction; direct extraction produces garbage on scanned content; recommend `tesseract` or Adobe Acrobat OCR as preprocessing.
- Multi-column layouts need spatial sorting — pdfplumber handles this with word-level bounding boxes, but always verify the reading order in the output.
- Tables must be formatted as GFM markdown tables or CSV — never as raw text with whitespace alignment.
- Images should be saved as PNG at native resolution, one file per embedded image object, named by page and index.

## Core Workflow

1. **Classify the PDF.**
   - Open with pdfplumber: if `page.extract_text()` returns non-empty string → digital PDF.
   - If empty or near-empty on multiple pages → likely scanned; warn user before continuing.
   - Count pages, identify approximate layout (single-column, two-column, mixed).
   - Load `references/pdf-formats.md` for encoding issues and text layer structure.

2. **Extract full text with tables.**
   - Run `scripts/pdf_extract_text.py --file doc.pdf --output doc.md`.
   - The script processes each page: detects tables first (records their bounding boxes), extracts surrounding text, then formats detected tables as GFM pipe tables inline.
   - Pages are separated by `---` dividers with a page number header.
   - For two-column layouts use `--two-column` flag; words are sorted by column position before line assembly.
   - Load `references/table-extraction.md` for pdfplumber table strategy tuning.

3. **Extract tables as CSV (standalone).**
   - For tabular data only: `scripts/pdf_extract_text.py --tables-only --format csv --output-dir ./tables/`.
   - Each detected table is saved as a separate CSV with filename `page<N>_table<M>.csv`.
   - Inspect headers to verify column detection is correct.

4. **Extract images.**
   - Run `scripts/pdf_extract_images.py --file doc.pdf --output-dir ./images/`.
   - Uses PyMuPDF (fitz) to enumerate all embedded image objects per page.
   - Saves each image as PNG with name `page<N>_img<M>.png`.
   - CMYK images are auto-converted to RGB before saving.
   - Use `--min-width` and `--min-height` to skip decorative elements (default: 32×32 px).
   - Load `references/image-extraction.md` for color space handling and filtering.

5. **Validate output.**
   - Compare page count in output to original.
   - Spot-check tables: verify row/column counts visually.
   - Check image files open correctly and have expected dimensions.
   - Report any pages with empty output, encoding errors, or corrupt embedded objects.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| PDF format and text layer structure | `references/pdf-formats.md` | Encountering encoding issues, garbled text, wrong reading order, font-mapping failures |
| Table extraction strategies | `references/table-extraction.md` | Tuning pdfplumber table detection, handling borderless or merged-cell tables |
| Image extraction and color spaces | `references/image-extraction.md` | Handling CMYK, indexed, masked, or inline images; filtering decorative elements |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/pdf_extract_text.py` | Extract all text and tables from a PDF as Markdown (or tables-only as CSV) | `python skills/pdf-reader/scripts/pdf_extract_text.py --file doc.pdf --output doc.md` |
| `scripts/pdf_extract_images.py` | Extract all embedded images from a PDF and save as PNG files | `python skills/pdf-reader/scripts/pdf_extract_images.py --file doc.pdf --output-dir ./images` |

**Dependencies:** `pip install pdfplumber pymupdf`

## Constraints

### MUST DO

- Detect scanned vs. digital PDFs before extraction — warn the user clearly if no text layer is found.
- Preserve table structure: output tables as GFM markdown or CSV, never as raw whitespace-padded text.
- Include page numbers in table and image output file names to maintain traceability.
- Validate that required Python packages are installed before running; print clear `pip install` instructions if missing.
- Process all pages unless `--pages` range is specified.

### MUST NOT DO

- Silently output garbage text from scanned pages — always detect and warn.
- Flatten table cells into prose or collapse multi-row headers into a single row.
- Overwrite existing output files without `--overwrite` flag.
- Discard images smaller than `--min-width`/`--min-height` without reporting them in the summary.
- Ignore page-level extraction errors — log failures and continue with remaining pages.

## Output Template

For PDF extraction tasks, report:

1. **Classification:** digital / scanned / mixed; page count; layout type (single-column / two-column / mixed).
2. **Text extraction:** pages processed, characters extracted, any pages with empty or low-confidence output.
3. **Tables found:** count, page numbers, dimensions (rows × columns) for each, output file paths.
4. **Images found:** count, page numbers, dimensions (W×H px), color space, output file paths.
5. **Errors / warnings:** encoding failures, corrupt embedded objects, scanned pages detected.
6. **Recommended next step:** e.g., "Send extracted images to `datasheet-intelligence` for curve digitization."

## Primary References

- pdfplumber — https://github.com/jsvine/pdfplumber
- PyMuPDF (fitz) — https://pymupdf.readthedocs.io
- PDF Reference, ISO 32000-1 — Adobe Systems
