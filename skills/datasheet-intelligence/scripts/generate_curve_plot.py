#!/usr/bin/env python3
"""Plot one or more digitized curves from CSV files.

Reads CSV files produced by digitize_curve.py (or any CSV with x,y columns)
and generates a publication-quality line plot.

Usage examples:
  # Single curve plot, save as PNG
  python generate_curve_plot.py --file vgs_id.csv --xlabel "V_GS (V)" --ylabel "I_D (A)" \\
      --title "Transfer Characteristics" --output transfer.png

  # Multiple curves on one chart with custom labels
  python generate_curve_plot.py \\
      --file curve_25c.csv --label "25°C" \\
      --file curve_85c.csv --label "85°C" \\
      --file curve_-40c.csv --label "-40°C" \\
      --xlabel "Voltage (V)" --ylabel "Current (A)" --title "IV vs Temperature" \\
      --output iv_temp.png

  # Bode plot (log X axis)
  python generate_curve_plot.py --file gain.csv --label "Gain (dB)" \\
      --xlabel "Frequency (Hz)" --ylabel "Gain (dB)" --log-x \\
      --title "Frequency Response" --output bode.png

  # Preview in a window (interactive mode)
  python generate_curve_plot.py --file data.csv --show
"""

from __future__ import annotations

import argparse
import csv
import sys
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
# Data loading
# ---------------------------------------------------------------------------

def _load_csv(path: Path) -> tuple[list[float], list[float]]:
    """Load (x, y) pairs from a CSV file.

    Lines starting with '#' are treated as comments and skipped.
    Expects either two columns (x, y) or a 'x,y' header row.
    """
    xs: list[float] = []
    ys: list[float] = []

    with path.open(encoding="utf-8") as f:
        # Skip comment lines
        lines = [l for l in f if not l.startswith("#")]

    reader = csv.reader(lines)
    header_skipped = False
    for row in reader:
        if len(row) < 2:
            continue
        try:
            xs.append(float(row[0]))
            ys.append(float(row[1]))
        except ValueError:
            # Likely a header row with column names
            if not header_skipped:
                header_skipped = True
                continue

    return xs, ys


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def build_plot(
    curves: list[tuple[list[float], list[float], str]],  # (xs, ys, label)
    xlabel: str,
    ylabel: str,
    title: str,
    log_x: bool,
    log_y: bool,
    output: Path | None,
    show: bool,
    dpi: int,
) -> None:
    matplotlib = _require("matplotlib", "matplotlib")
    plt = _require("matplotlib.pyplot", "matplotlib")

    # Use a clean, publication-friendly style
    try:
        plt.style.use("seaborn-v0_8-whitegrid")
    except Exception:
        try:
            plt.style.use("seaborn-whitegrid")
        except Exception:
            pass  # Fallback to default style

    fig, ax = plt.subplots(figsize=(9, 5), dpi=dpi)

    prop_cycle = plt.rcParams.get("axes.prop_cycle")
    colors = prop_cycle.by_key()["color"] if prop_cycle else ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]

    for i, (xs, ys, label) in enumerate(curves):
        color = colors[i % len(colors)]
        if label:
            ax.plot(xs, ys, label=label, color=color, linewidth=1.8)
        else:
            ax.plot(xs, ys, color=color, linewidth=1.8)

    if log_x:
        ax.set_xscale("log")
    if log_y:
        ax.set_yscale("log")

    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=13, fontweight="bold")
    ax.tick_params(labelsize=10)

    if any(label for _, _, label in curves):
        ax.legend(fontsize=10, loc="best")

    ax.grid(True, which="both", alpha=0.4)
    fig.tight_layout()

    if output:
        fig.savefig(str(output), dpi=dpi, bbox_inches="tight")
        print(f"  saved: {output}")

    if show:
        plt.show()
    else:
        plt.close(fig)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Plot digitized curves from CSV files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    # Multi-value: each --file can come with an optional --label
    # We collect them as action='append' pairs
    parser.add_argument("--file", dest="files", action="append", metavar="CSV",
                        help="CSV file to plot. Can be specified multiple times.")
    parser.add_argument("--label", dest="labels", action="append", metavar="LABEL",
                        help="Legend label for the corresponding --file. Can be specified multiple times. "
                             "Must appear in the same order as --file.")
    parser.add_argument("--xlabel", default="X", help="X-axis label.")
    parser.add_argument("--ylabel", default="Y", help="Y-axis label.")
    parser.add_argument("--title", default="", help="Plot title.")
    parser.add_argument("--log-x", action="store_true", help="Logarithmic X axis.")
    parser.add_argument("--log-y", action="store_true", help="Logarithmic Y axis.")
    parser.add_argument("--output", help="Output image file (PNG, SVG, PDF, etc.).")
    parser.add_argument("--show", action="store_true",
                        help="Display the plot in an interactive window.")
    parser.add_argument("--dpi", type=int, default=150,
                        help="Resolution for raster output (default: 150).")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.files:
        print("ERROR: At least one --file is required.", file=sys.stderr)
        sys.exit(1)

    if not args.output and not args.show:
        print("ERROR: Specify --output <file> and/or --show.", file=sys.stderr)
        sys.exit(1)

    # Align labels with files (fill missing labels with empty string)
    labels = args.labels or []
    while len(labels) < len(args.files):
        labels.append("")

    curves: list[tuple[list[float], list[float], str]] = []
    for fpath_str, label in zip(args.files, labels):
        fpath = Path(fpath_str)
        if not fpath.exists():
            print(f"ERROR: File not found: {fpath}", file=sys.stderr)
            sys.exit(1)
        xs, ys = _load_csv(fpath)
        if not xs:
            print(f"WARNING: No data points loaded from {fpath}", file=sys.stderr)
        curves.append((xs, ys, label))

    output_path = Path(args.output) if args.output else None

    build_plot(
        curves=curves,
        xlabel=args.xlabel,
        ylabel=args.ylabel,
        title=args.title,
        log_x=args.log_x,
        log_y=args.log_y,
        output=output_path,
        show=args.show,
        dpi=args.dpi,
    )


if __name__ == "__main__":
    main()
