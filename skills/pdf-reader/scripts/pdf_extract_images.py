#!/usr/bin/env python3
"""Extract embedded images from a PDF file and save them as PNG.

Usage examples:
  # Extract all images from a PDF
  python pdf_extract_images.py document.pdf

  # Save to a specific directory, minimum 100×100 px, skip decorative images
  python pdf_extract_images.py document.pdf --out-dir ./images --min-width 100 --min-height 100

  # Include a manifest CSV listing every extracted image
  python pdf_extract_images.py document.pdf --manifest

  # Machine-readable JSON report
  python pdf_extract_images.py document.pdf --json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

def _require(module: str, install: str) -> Any:
    try:
        import importlib
        return importlib.import_module(module)
    except ImportError:
        print(f"ERROR: '{module}' not installed. Run: pip install {install}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ImageRecord:
    page: int
    index: int            # image number on the page (0-based)
    filename: str
    width: int
    height: int
    colorspace: str
    size_bytes: int
    skipped: bool = False
    skip_reason: str = ""


@dataclass
class ExtractionReport:
    source: str
    total_pages: int
    images_found: int
    images_saved: int
    images_skipped: int
    out_dir: str
    records: list[ImageRecord] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Color space conversion helpers
# ---------------------------------------------------------------------------

_COLORSPACE_NAMES = {
    # fitz / PyMuPDF colorspace constants
    "DeviceGray": "GRAY",
    "DeviceRGB":  "RGB",
    "DeviceCMYK": "CMYK",
    "Indexed":    "INDEXED",
}

def _cs_name(cs_str: str) -> str:
    for key, val in _COLORSPACE_NAMES.items():
        if key in cs_str:
            return val
    return cs_str or "UNKNOWN"


def _to_png_bytes(img_dict: dict[str, Any], fitz: Any) -> tuple[bytes, str]:
    """Convert a PyMuPDF image dict to PNG bytes, handling CMYK and masks.

    Returns (png_bytes, colorspace_name).
    """
    xref = img_dict.get("xref", 0)
    cs = _cs_name(str(img_dict.get("colorspace", "")))

    # Extract raw image bytes via pixmap for reliable color conversion
    # Use the image's smask (soft mask / transparency) if available
    smask = img_dict.get("smask", 0)

    try:
        pix = fitz.Pixmap(fitz.open.__class__)  # placeholder; overwritten below
    except Exception:
        pass

    # Build pixmap directly from the cross-reference
    try:
        pix = fitz.Pixmap(fitz.csRGB, fitz.Pixmap(fitz.Document(), xref))
    except Exception:
        pix = fitz.Pixmap(fitz.Document(), xref)

    # Convert CMYK → RGB
    if pix.n > 4:  # CMYK has 4 channels; >4 means extra alpha
        pix = fitz.Pixmap(fitz.csRGB, pix)
    elif pix.colorspace and pix.colorspace.name in ("DeviceCMYK",):
        pix = fitz.Pixmap(fitz.csRGB, pix)

    # Apply soft mask as alpha channel if present
    if smask > 0:
        try:
            mask_pix = fitz.Pixmap(fitz.Document(), smask)
            pix = fitz.Pixmap(pix, mask_pix)
        except Exception:
            pass

    return pix.tobytes("png"), _cs_name(pix.colorspace.name if pix.colorspace else "")


def _is_decorative(png_bytes: bytes) -> tuple[bool, str]:
    """Return (is_decorative, reason) using Pillow stddev heuristic.

    Images with very low colour variance are likely solid fills or hairlines.
    """
    try:
        from PIL import Image, ImageStat
        import io
        img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        stat = ImageStat.Stat(img)
        # stddev averaged across R, G, B channels
        avg_std = sum(stat.stddev) / len(stat.stddev)
        if avg_std < 5.0:
            return True, f"low colour variance (stddev={avg_std:.1f})"
    except Exception:
        pass
    return False, ""


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def extract_images(
    pdf_path: Path,
    out_dir: Path,
    min_width: int,
    min_height: int,
    skip_decorative: bool,
    overwrite: bool,
) -> ExtractionReport:
    fitz = _require("fitz", "pymupdf")

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = pdf_path.stem

    report = ExtractionReport(
        source=str(pdf_path),
        total_pages=0,
        images_found=0,
        images_saved=0,
        images_skipped=0,
        out_dir=str(out_dir),
    )

    doc = fitz.open(str(pdf_path))
    report.total_pages = doc.page_count

    for page_num in range(doc.page_count):
        page = doc[page_num]
        image_list = page.get_images(full=True)
        # image_list items: (xref, smask, width, height, bpc, colorspace, ...)

        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            width = img_info[2]
            height = img_info[3]
            colorspace_raw = str(img_info[5])
            report.images_found += 1

            fname = f"{stem}_p{page_num + 1}_img{img_idx + 1:03d}.png"
            fpath = out_dir / fname
            record = ImageRecord(
                page=page_num + 1,
                index=img_idx,
                filename=fname,
                width=width,
                height=height,
                colorspace=_cs_name(colorspace_raw),
                size_bytes=0,
            )

            # Size filter
            if width < min_width or height < min_height:
                record.skipped = True
                record.skip_reason = f"size {width}×{height} below threshold {min_width}×{min_height}"
                report.images_skipped += 1
                report.records.append(record)
                continue

            # Skip existing
            if fpath.exists() and not overwrite:
                record.skipped = True
                record.skip_reason = "file already exists (use --overwrite)"
                report.images_skipped += 1
                report.records.append(record)
                continue

            # Extract and convert to PNG
            try:
                # Simpler extraction: use extract_image which returns dict with "image", "ext", etc.
                img_data = doc.extract_image(xref)
                img_bytes = img_data.get("image", b"")
                ext = img_data.get("ext", "png").lower()

                # Convert non-PNG formats via Pillow if available
                if ext != "png":
                    try:
                        from PIL import Image
                        import io
                        pil_img = Image.open(io.BytesIO(img_bytes))
                        # Convert CMYK to RGB
                        if pil_img.mode == "CMYK":
                            pil_img = pil_img.convert("RGB")
                        buf = io.BytesIO()
                        pil_img.save(buf, format="PNG")
                        img_bytes = buf.getvalue()
                    except ImportError:
                        # Pillow not available; try writing raw bytes regardless
                        pass

                # Decorative check
                if skip_decorative:
                    is_dec, reason = _is_decorative(img_bytes)
                    if is_dec:
                        record.skipped = True
                        record.skip_reason = reason
                        report.images_skipped += 1
                        report.records.append(record)
                        continue

                fpath.write_bytes(img_bytes)
                record.size_bytes = len(img_bytes)
                record.colorspace = _cs_name(img_data.get("colorspace", colorspace_raw) or colorspace_raw)
                report.images_saved += 1

            except Exception as exc:
                record.skipped = True
                record.skip_reason = f"extraction error: {exc}"
                report.images_skipped += 1
                report.warnings.append(f"Page {page_num + 1} image {img_idx}: {exc}")

            report.records.append(record)

    doc.close()
    return report


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_manifest(report: ExtractionReport, out_dir: Path) -> None:
    manifest_path = out_dir / "manifest.csv"
    fieldnames = ["filename", "page", "index", "width", "height", "colorspace", "size_bytes", "skipped", "skip_reason"]
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in report.records:
            writer.writerow({k: getattr(rec, k) for k in fieldnames})
    print(f"  manifest written: {manifest_path}")


def print_summary(report: ExtractionReport) -> None:
    print(f"PDF:           {report.source}")
    print(f"Pages:         {report.total_pages}")
    print(f"Images found:  {report.images_found}")
    print(f"Images saved:  {report.images_saved}")
    print(f"Images skipped:{report.images_skipped}")
    print(f"Output dir:    {report.out_dir}")
    if report.warnings:
        print("Warnings:")
        for w in report.warnings:
            print(f"  ! {w}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract embedded images from a PDF and save as PNG.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("pdf", help="Path to the PDF file.")
    parser.add_argument("--out-dir", default="./extracted_images",
                        help="Directory for output PNG files (default: ./extracted_images).")
    parser.add_argument("--min-width", type=int, default=50,
                        help="Minimum image width in pixels (default: 50).")
    parser.add_argument("--min-height", type=int, default=50,
                        help="Minimum image height in pixels (default: 50).")
    parser.add_argument("--skip-decorative", action="store_true",
                        help="Skip low-variance images (solid fills, hairlines). Requires Pillow.")
    parser.add_argument("--manifest", action="store_true",
                        help="Write a manifest.csv to the output directory.")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing output files.")
    parser.add_argument("--json", action="store_true",
                        help="Emit machine-readable JSON report to stdout.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf)

    if not pdf_path.exists():
        print(f"ERROR: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    report = extract_images(
        pdf_path=pdf_path,
        out_dir=Path(args.out_dir),
        min_width=args.min_width,
        min_height=args.min_height,
        skip_decorative=args.skip_decorative,
        overwrite=args.overwrite,
    )

    if args.manifest:
        write_manifest(report, Path(args.out_dir))

    if args.json:
        print(json.dumps(asdict(report), indent=2, ensure_ascii=False))
    else:
        print_summary(report)

    if report.images_found == 0:
        print("NOTE: No embedded XObject images found. The PDF may use rasterised pages or vector graphics only.", file=sys.stderr)


if __name__ == "__main__":
    main()
