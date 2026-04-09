---
name: "Datasheet Intelligence"
description: "Datasheet mining specialist for electronic components. Extracts parameter tables, digitizes I-V curves and transfer functions from graph images, and exports calibrated data to CSV for simulations. Activates when you say 'read datasheet', 'extract parameters from datasheet', 'digitize curve', 'get I-V curve data', 'extract electrical characteristics', 'get component specs', or 'parse component datasheet'."
---

# Datasheet Intelligence

## Overview

Use this skill when working with electronic component datasheets. A datasheet encodes three categories of information: **parameter tables** (min/typ/max values with test conditions), **characteristic curves** (graphs of I-V, gain-frequency, temperature derating, etc.), and **application information** (circuit diagrams, recommended land patterns, timing sequences).

This skill extracts all three in machine-usable form:
- Parameter tables → CSV or Markdown tables.
- Characteristic curves → calibrated (x, y) data point CSV extracted from graph images.
- Python-ready data → matplotlib plots or arrays for use in simulation/calculation scripts.

Default stance:

- Always identify component type, part number, and manufacturer before extracting — datasheet structure varies significantly between MOSFETs, op-amps, microcontrollers, and passives.
- Extract tables with original units — do not convert unless explicitly requested.
- Curve digitization accuracy is limited to ~2–3% of full scale; report estimated accuracy with every dataset.
- Use `pdf-reader` skill to get images from the PDF first, then pass image files to this skill's digitization pipeline.

## Core Workflow

1. **Identify the component and datasheet structure.**
   - Extract cover page: part number, manufacturer, datasheet revision date.
   - Identify major sections: Absolute Maximum Ratings, Electrical Characteristics, Typical Performance Characteristics (graphs), Application Circuits.
   - Load `references/datasheet-structure.md` for section layout by component type.

2. **Extract parameter tables.**
   - Run `scripts/extract_datasheet_tables.py --file datasheet.pdf`.
   - The script uses pdfplumber with tight table detection tuned for electrical characteristic tables (header recognition: "Parameter", "Symbol", "Min", "Typ", "Max", "Unit", "Condition").
   - Output: one CSV per table, plus a Markdown summary with table names inferred from surrounding text.
   - Load `references/datasheet-structure.md` for parameter naming conventions.

3. **Identify curves to digitize.**
   - First extract images with `pdf-reader` skill: `pdf_extract_images.py --file datasheet.pdf --output-dir ./figs/`.
   - Identify which PNG files contain characteristic curves (I-V, gain-bandwidth, thermal derating, etc.).
   - Note the axis labels, units, and scale (linear / log) from each graph.

4. **Digitize characteristic curves.**
   - Run `scripts/digitize_curve.py` with axis calibration for each graph image.
   - Calibration: provide two known points on each axis in both pixel and data coordinates.
   - The script detects curve pixels by color signature, maps pixel coordinates to data coordinates, and outputs a CSV.
   - For multi-curve graphs: run once per curve with different `--color` argument.
   - Load `references/curve-digitization.md` for calibration methodology and accuracy limits.

5. **Generate Python plots or export for simulation.**
   - Run `scripts/generate_curve_plot.py` to recreate the graph in matplotlib from the digitized CSV.
   - Annotate with axis labels, units, title, and optional standard limits.
   - Export CSV for direct use in simulation scripts (e.g., as lookup table in SPICE or Python solver).
   - Load `references/data-export-formats.md` for SPICE table format and numpy-ready CSV conventions.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Datasheet structure by component type | `references/datasheet-structure.md` | Locating parameter sections, understanding table layouts by device family |
| Curve digitization methodology | `references/curve-digitization.md` | Calibrating axes, detecting curve color, estimating digitization accuracy |
| Data export formats for simulation | `references/data-export-formats.md` | Formatting extracted data for SPICE, Python, or simulator lookup tables |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/extract_datasheet_tables.py` | Extract parameter tables from a component datasheet PDF with electrical-characteristics heuristics | `python skills/datasheet-intelligence/scripts/extract_datasheet_tables.py --file ds.pdf` |
| `scripts/digitize_curve.py` | Digitize a characteristic curve from a graph PNG image using axis calibration | `python skills/datasheet-intelligence/scripts/digitize_curve.py --image curve.png --x-cal 50,0.0,480,100.0 --y-cal 400,0.0,20,10.0` |
| `scripts/generate_curve_plot.py` | Generate a matplotlib plot from a digitized CSV, with axis labels and multiple curve support | `python skills/datasheet-intelligence/scripts/generate_curve_plot.py --file data.csv --xlabel "Vgs (V)" --ylabel "Id (A)" --title "Transfer Characteristic"` |

**Dependencies:** `pip install pdfplumber pillow matplotlib`

## Constraints

### MUST DO

- Preserve original units from the datasheet — report them in every output file header.
- Report estimated digitization accuracy (typically ±2–3% FS) when exporting curve data.
- Include source metadata (datasheet part number, page number, figure number) in output file headers.
- Validate that axis calibration points span an adequate range (at least 50% of image width/height) to minimize scale error.
- Warn when extracting from scanned datasheets — table extraction degrades significantly without a text layer.

### MUST NOT DO

- Convert units silently — always ask or annotate when unit conversion is applied.
- Use image-space (pixel) coordinates in output CSV — always map to data-space values.
- Assume graph scale is linear without confirming from axis labels — log scales require logarithmic mapping.
- Report digitized data without axis calibration metadata — calibration must be documented for reproducibility.
- Skip the source image validation — always confirm the graph image is readable and axes are visible before digitization.

## Output Template

For datasheet extraction tasks, report:

1. **Component:** part number, manufacturer, revision, datasheet page count.
2. **Parameter tables:** count, names (e.g., "Absolute Maximum Ratings"), pages, rows × columns.
3. **Curves digitized:** figure number/name, page, axis labels + units + scale (linear/log), number of data points extracted, estimated accuracy.
4. **Output files:** one CSV per table, one CSV per curve, plot PNG if generated.
5. **Data quality notes:** any tables with merged cells, any graphs with poor contrast or overlapping curves.

## Primary References

- pdfplumber — https://github.com/jsvine/pdfplumber
- Pillow (PIL Fork) — https://pillow.readthedocs.io
- matplotlib — https://matplotlib.org
- WebPlotDigitizer — rationale and algorithm reference for manual curve digitization
