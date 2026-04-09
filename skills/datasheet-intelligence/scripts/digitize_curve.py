#!/usr/bin/env python3
"""Digitize a curve from a graph image by colour-tracing pixels.

Converts a graph image (PNG/JPEG) to a CSV of (x, y) data points by:
  1. Calibrating the pixel-to-value coordinate mapping using two calibration points.
  2. Scanning pixel columns for the target colour.
  3. Emitting data in the standard skillex curve CSV format.

Usage examples:
  # Digitize a red curve on linear axes
  python digitize_curve.py graph.png \\
      --x-cal 50,0 150,10 --y-cal 400,0 100,5 \\
      --color 220,30,30 --tolerance 40

  # Digitize with log X axis
  python digitize_curve.py graph.png \\
      --x-cal 80,100 580,100000 --y-cal 450,0 50,20 \\
      --color 30,80,200 --tolerance 35 --x-log

  # Auto-detect the most prominent non-black/non-white colour
  python digitize_curve.py graph.png \\
      --x-cal 80,0 480,100 --y-cal 400,0 50,5.0 \\
      --auto-detect

  # Machine-readable JSON
  python digitize_curve.py graph.png \\
      --x-cal 80,0 480,100 --y-cal 400,0 50,5.0 \\
      --color 200,50,50 --json
"""

from __future__ import annotations

import argparse
import csv
import json
import math
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
class CalPoint:
    px: int
    value: float


@dataclass
class AxisCalibration:
    cal1: CalPoint
    cal2: CalPoint
    log_scale: bool = False

    def px_to_value(self, px: float) -> float:
        """Map a pixel coordinate to a physical value."""
        px1, v1 = self.cal1.px, self.cal1.value
        px2, v2 = self.cal2.px, self.cal2.value
        if self.log_scale:
            if v1 <= 0 or v2 <= 0:
                raise ValueError("Log-scale calibration values must be > 0")
            log_v1, log_v2 = math.log10(v1), math.log10(v2)
            frac = (px - px1) / (px2 - px1)
            return 10 ** (log_v1 + frac * (log_v2 - log_v1))
        return v1 + (px - px1) * (v2 - v1) / (px2 - px1)


@dataclass
class DataPoint:
    x: float
    y: float


@dataclass
class DigitizationReport:
    source: str
    color_target: tuple[int, int, int]
    tolerance: int
    x_log: bool
    y_log: bool
    points: list[DataPoint] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    accuracy_note: str = ""


# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------

def _color_distance(r1: int, g1: int, b1: int, r2: int, g2: int, b2: int) -> float:
    """Euclidean RGB distance."""
    return math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)


def _auto_detect_color(pixels: Any, width: int, height: int) -> tuple[int, int, int]:
    """Find the most prominent non-black, non-white, non-grey colour."""
    color_counts: dict[tuple[int, int, int], int] = {}
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y][:3]
            # Skip near-grey (low saturation) and near-black/white
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            if max_c - min_c < 40:   # grey
                continue
            if max_c < 30:           # black
                continue
            if min_c > 220:          # white
                continue
            # Quantize to 32-step buckets to group similar colours
            bucket = (r // 32 * 32, g // 32 * 32, b // 32 * 32)
            color_counts[bucket] = color_counts.get(bucket, 0) + 1

    if not color_counts:
        return (200, 30, 30)  # fallback red

    best = max(color_counts, key=lambda k: color_counts[k])
    return best


def _find_target_pixels(
    pixels: Any, width: int, height: int,
    target_r: int, target_g: int, target_b: int,
    tolerance: int,
) -> dict[int, list[int]]:
    """Return {column_x: [y_pixel, ...]} for all pixels matching the target colour."""
    matches: dict[int, list[int]] = {}
    for x in range(width):
        for y in range(height):
            r, g, b = pixels[x, y][:3]
            if _color_distance(r, g, b, target_r, target_g, target_b) <= tolerance:
                matches.setdefault(x, []).append(y)
    return matches


# ---------------------------------------------------------------------------
# Core digitization
# ---------------------------------------------------------------------------

def digitize(
    image_path: Path,
    x_cal: AxisCalibration,
    y_cal: AxisCalibration,
    color: tuple[int, int, int] | None,
    tolerance: int,
    auto_detect: bool,
) -> DigitizationReport:
    Image = _require("PIL.Image", "pillow")

    img = Image.open(str(image_path)).convert("RGB")
    width, height = img.size
    pixels = img.load()

    if auto_detect or color is None:
        detected = _auto_detect_color(pixels, width, height)
        target_r, target_g, target_b = detected
    else:
        target_r, target_g, target_b = color

    report = DigitizationReport(
        source=str(image_path),
        color_target=(target_r, target_g, target_b),
        tolerance=tolerance,
        x_log=x_cal.log_scale,
        y_log=y_cal.log_scale,
    )

    col_matches = _find_target_pixels(pixels, width, height, target_r, target_g, target_b, tolerance)

    if not col_matches:
        report.warnings.append(
            f"No pixels matched color ({target_r},{target_g},{target_b}) ±{tolerance}. "
            "Try increasing --tolerance or use --auto-detect."
        )
        return report

    # For each column, take the median y of matching pixels (robust to noise)
    for x_px in sorted(col_matches.keys()):
        y_pixels = col_matches[x_px]
        median_y = sorted(y_pixels)[len(y_pixels) // 2]
        try:
            x_val = x_cal.px_to_value(x_px)
            y_val = y_cal.px_to_value(median_y)
            report.points.append(DataPoint(x=round(x_val, 6), y=round(y_val, 6)))
        except (ValueError, ZeroDivisionError) as exc:
            report.warnings.append(f"Column x={x_px}: mapping error — {exc}")

    # Accuracy estimate based on calibration span vs pixel span
    px_span_x = abs(x_cal.cal2.px - x_cal.cal1.px)
    px_span_y = abs(y_cal.cal2.px - y_cal.cal1.px)
    val_span_x = abs(x_cal.cal2.value - x_cal.cal1.value)
    val_span_y = abs(y_cal.cal2.value - y_cal.cal1.value)
    if px_span_x > 0 and px_span_y > 0:
        res_x = val_span_x / px_span_x
        res_y = val_span_y / px_span_y
        report.accuracy_note = (
            f"Resolution: ~{res_x:.4g} units/px (X), ~{res_y:.4g} units/px (Y). "
            f"Estimated accuracy ±1–2 px → ±{res_x * 2:.3g} (X), ±{res_y * 2:.3g} (Y)."
        )

    return report


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

CSV_HEADER_COMMENT = "# Generated by digitize_curve.py\n# Format: x,y\n"


def write_csv(report: DigitizationReport, out_path: Path) -> None:
    with out_path.open("w", newline="", encoding="utf-8") as f:
        f.write(f"# source: {report.source}\n")
        f.write(f"# color: {report.color_target[0]},{report.color_target[1]},{report.color_target[2]}\n")
        f.write(f"# tolerance: {report.tolerance}\n")
        f.write(f"# x_log: {report.x_log}\n")
        f.write(f"# y_log: {report.y_log}\n")
        if report.accuracy_note:
            f.write(f"# accuracy: {report.accuracy_note}\n")
        f.write("x,y\n")
        writer = csv.writer(f)
        for pt in report.points:
            writer.writerow([pt.x, pt.y])
    print(f"  wrote {out_path} ({len(report.points)} points)")


def print_csv_stdout(report: DigitizationReport) -> None:
    print(f"# source: {report.source}")
    print(f"# color: {report.color_target[0]},{report.color_target[1]},{report.color_target[2]}")
    if report.accuracy_note:
        print(f"# accuracy: {report.accuracy_note}")
    print("x,y")
    for pt in report.points:
        print(f"{pt.x},{pt.y}")


# ---------------------------------------------------------------------------
# Argument parsing helpers
# ---------------------------------------------------------------------------

def _parse_cal_point(s: str) -> CalPoint:
    """Parse 'px,value' string into a CalPoint."""
    parts = s.split(",")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(f"Calibration point must be 'px,value', got: {s!r}")
    return CalPoint(px=int(parts[0]), value=float(parts[1]))


def _parse_color(s: str) -> tuple[int, int, int]:
    parts = s.split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError(f"Color must be 'R,G,B', got: {s!r}")
    r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
    for v in (r, g, b):
        if not 0 <= v <= 255:
            raise argparse.ArgumentTypeError(f"Color channel values must be 0-255, got {v}")
    return (r, g, b)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Digitize a curve from a graph image.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("image", help="Path to the graph image (PNG, JPEG, etc.).")
    # Calibration
    cal_grp = parser.add_argument_group("Calibration (required unless --auto-detect)")
    cal_grp.add_argument("--x-cal", nargs=2, metavar="PX,VAL",
                         help="Two X-axis calibration points: 'px1,val1' 'px2,val2'.")
    cal_grp.add_argument("--y-cal", nargs=2, metavar="PX,VAL",
                         help="Two Y-axis calibration points: 'px1,val1' 'px2,val2'.")
    cal_grp.add_argument("--x-log", action="store_true", help="X axis is logarithmic.")
    cal_grp.add_argument("--y-log", action="store_true", help="Y axis is logarithmic.")
    # Colour
    color_grp = parser.add_argument_group("Colour detection")
    color_grp.add_argument("--color", metavar="R,G,B",
                           help="Target curve colour as R,G,B (0-255 each).")
    color_grp.add_argument("--tolerance", type=int, default=30,
                           help="Colour match tolerance (Euclidean RGB distance, default 30).")
    color_grp.add_argument("--auto-detect", action="store_true",
                           help="Auto-detect the most prominent non-grey colour (ignores --color).")
    # Output
    out_grp = parser.add_argument_group("Output")
    out_grp.add_argument("--output", help="Output CSV file path. If omitted, prints to stdout.")
    out_grp.add_argument("--json", action="store_true", help="Emit JSON report to stdout.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image_path = Path(args.image)

    if not image_path.exists():
        print(f"ERROR: File not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    # Validate calibration
    if not args.auto_detect and (not args.x_cal or not args.y_cal):
        print("ERROR: --x-cal and --y-cal are required unless --auto-detect is used.", file=sys.stderr)
        sys.exit(1)

    # Parse calibration
    if args.x_cal:
        x_cal = AxisCalibration(
            cal1=_parse_cal_point(args.x_cal[0]),
            cal2=_parse_cal_point(args.x_cal[1]),
            log_scale=args.x_log,
        )
    else:
        # Dummy calibration for auto-detect fallback (will warn if used wrong)
        x_cal = AxisCalibration(cal1=CalPoint(0, 0), cal2=CalPoint(100, 100))

    if args.y_cal:
        y_cal = AxisCalibration(
            cal1=_parse_cal_point(args.y_cal[0]),
            cal2=_parse_cal_point(args.y_cal[1]),
            log_scale=args.y_log,
        )
    else:
        y_cal = AxisCalibration(cal1=CalPoint(0, 0), cal2=CalPoint(100, 100))

    color: tuple[int, int, int] | None = None
    if args.color and not args.auto_detect:
        color = _parse_color(args.color)

    report = digitize(
        image_path=image_path,
        x_cal=x_cal,
        y_cal=y_cal,
        color=color,
        tolerance=args.tolerance,
        auto_detect=args.auto_detect,
    )

    if report.warnings:
        for w in report.warnings:
            print(f"WARNING: {w}", file=sys.stderr)

    if report.accuracy_note:
        print(f"INFO: {report.accuracy_note}", file=sys.stderr)

    if args.json:
        print(json.dumps(asdict(report), indent=2, ensure_ascii=False))
        return

    if args.output:
        write_csv(report, Path(args.output))
    else:
        print_csv_stdout(report)

    if not report.points:
        sys.exit(1)


if __name__ == "__main__":
    main()
