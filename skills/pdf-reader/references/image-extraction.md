# Image Extraction from PDFs with PyMuPDF

## How Images Are Embedded in PDFs

A PDF page may reference images through:

- **XObject images** — the most common type; independent image resources referenced by name in page content streams. Stored in the PDF cross-reference table with a unique `xref` number.
- **Inline images** — small images embedded directly in the content stream (rare in modern PDFs).
- **Form XObjects** — self-contained mini-pages that may contain nested images.
- **Soft masks** — transparency masks associated with an image (stored as a separate XObject).

PyMuPDF enumerates XObject images per page via `page.get_images(full=True)` and retrieves them by `xref`.

## Standard Extraction Workflow

```python
import fitz  # PyMuPDF

def extract_images(pdf_path: str, output_dir: str, min_w: int = 32, min_h: int = 32):
    doc = fitz.open(pdf_path)
    saved = []
    for page_num, page in enumerate(doc, start=1):
        for img_index, img_info in enumerate(page.get_images(full=True), start=1):
            xref = img_info[0]
            base_img = doc.extract_image(xref)
            width  = base_img["width"]
            height = base_img["height"]
            if width < min_w or height < min_h:
                continue  # skip decorative (icons, bullets, dividers)
            img_bytes = base_img["image"]
            ext = base_img["ext"]  # "png", "jpeg", "jp2", etc.

            # Convert non-PNG to PNG via Pixmap for uniformity
            if ext != "png":
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:           # CMYK or alpha
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_bytes = pix.tobytes("png")

            fname = f"page{page_num:03d}_img{img_index:02d}.png"
            out_path = f"{output_dir}/{fname}"
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            saved.append({"file": fname, "page": page_num, "width": width, "height": height})
    doc.close()
    return saved
```

## Color Space Handling

| PDF Color Space | `pix.n` value | Conversion needed |
|---|---|---|
| Device Gray | 1 | Convert to RGB if needed: `fitz.Pixmap(fitz.csRGB, pix)` |
| Device RGB | 3 | None |
| Device CMYK | 4 | Convert: `fitz.Pixmap(fitz.csRGB, pix)` — CMYK→RGB conversion |
| CMYK + alpha | 5 | Strip alpha first, then convert |
| Indexed (palette) | 1 | `pix.colorspace` is `None`; convert via `fitz.Pixmap(fitz.csRGB, pix)` |

Always check `pix.n > 3` before saving to ensure no CMYK artifacts in the PNG output.

## Soft Masks and Alpha Channels

Some PDF images have a separate soft mask (transparency channel). PyMuPDF merges the mask automatically when you call `fitz.Pixmap(doc, xref)` — the result includes an alpha channel (`pix.n == 4` for RGBA).

To flatten alpha onto white background before saving:
```python
if pix.alpha:
    pix_rgb = fitz.Pixmap(fitz.csRGB, pix)  # drops alpha
```

To preserve transparency in PNG:
```python
pix_bytes = pix.tobytes("png")  # PNG supports RGBA natively
```

## Filtering Decorative Images

Datasheets, technical reports, and slides commonly embed decorative elements: company logos, page dividers, section icons, watermarks. These should be filtered out before passing images to analysis pipelines.

Heuristics:

| Filter | Rationale |
|---|---|
| `width < 64 or height < 64` | Too small to be a meaningful figure |
| `width / height > 10 or height / width > 10` | Extreme aspect ratio → likely a divider or banner background |
| `width == page_width or height == page_height` | Full-page image → likely a scanned page background or watermark |
| Image too uniform (very low variance) | Solid-color fill or near-blank image |

Uniform-image detection with Pillow as post-process:
```python
from PIL import Image, ImageStat
img = Image.open(out_path)
stat = ImageStat.Stat(img)
stddev = max(stat.stddev)
if stddev < 5:
    os.remove(out_path)  # skip nearly uniform image
```

## Retrieving Images from Form XObjects

Some PDFs wrap images inside Form XObjects (vectors / diagrams). `page.get_images(full=True)` does NOT recurse into Form XObjects by default.

To get all images including nested ones:
```python
imgs = page.get_images(full=True)           # top-level
xobjs = page.get_xobjects()                # form xobjects
for xref, _, _ in xobjs:
    sub_page = doc.load_page(xref - 1)     # not always valid — use try/except
    # alternatively: parse the xobject stream manually
```

In practice, for datasheets and technical documents, `get_images(full=True)` captures the vast majority of relevant figures.

## Output Naming Convention

Use a consistent naming scheme to maintain traceability back to the source PDF:

```
<basename>_images/
    page001_img01.png       (page 1, first image)
    page001_img02.png       (page 1, second image)
    page004_img01.png       (page 4, first image)
```

Include a `manifest.csv` listing: `file, page, width, height, xref` — useful when passing images to downstream processing (e.g., `datasheet-intelligence` curve digitization).
