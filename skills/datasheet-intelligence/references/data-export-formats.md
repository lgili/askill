# Data Export Formats for Simulation and Calculation

## Overview

Extracted datasheet data may feed downstream tools directly. The format depends on the consumer:

| Consumer | Preferred format | Key requirements |
|---|---|---|
| Python numerical scripts | CSV with header | Column names match variable names; units in header; no merged cells |
| SPICE simulators | PWL or TABLE syntax | Specific column ordering; no spaces in identifiers |
| Power electronics simulator (C++) | Lookup table CSV | Fixed columns: `x,y` or `x,y0,y1,...`; no quotes |
| matplotlib / pandas | CSV with header | Any standard CSV; pandas reads it directly |
| Excel / LibreOffice | CSV or XLSX | UTF-8 encoding; decimal point (not comma) |

## Standard Extracted CSV Format

All CSV files produced by this skill use this format:

```csv
# Source: IRLZ44N_datasheet.pdf, Page 7, Figure 4 - Transfer Characteristics
# X-axis: Vgs [V], linear scale
# Y-axis: Id [A], linear scale
# Calibration: x(68px)=1.0V, x(518px)=10.0V; y(12px)=10.0A, y(392px)=0.0A
# Estimated accuracy: ±0.22 A (±2.2% FS)
# Date: 2026-01-15
x,y
1.00,0.00
1.45,0.12
2.01,0.55
2.48,1.23
...
```

Rules:
- Comment lines start with `#`; metadata goes here, not in data rows.
- First data row is the header: lowercase, alphanumeric and underscore only.
- Decimal separator: `.` (dot), not comma.
- Units documented in comments, not in data rows.
- One file per curve; multi-curve exports use one file per curve.

## SPICE PWL (Piecewise Linear) Syntax

For use as a voltage/current source waveform, SPICE uses PWL:

```spice
V1 net+ GND PWL(0 0 1.0u 3.3 2.0u 3.3 3.0u 0)
```

For lookup tables in behavioral models (e.g., MOSFET `Rds_on(T)`), LTspice uses `TABLE`:

```spice
.func Rds_on(temp) = TABLE(temp, -40,50m, 25,35m, 100,80m, 150,130m)
```

Conversion from CSV to SPICE TABLE:
```python
import csv

def csv_to_spice_table(csv_path: str, func_name: str, x_col: str, y_col: str) -> str:
    pairs = []
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            pairs.extend([row[x_col], row[y_col]])
    args = ",".join(pairs)
    return f".func {func_name}(x) = TABLE(x, {args})"
```

## numpy-Compatible CSV

For Python numerical work with numpy arrays:

```python
import csv

def load_curve(path: str) -> tuple[list[float], list[float]]:
    xs, ys = [], []
    with open(path) as f:
        for row in csv.DictReader(row for row in f if not row.startswith("#")):
            xs.append(float(row["x"]))
            ys.append(float(row["y"]))
    return xs, ys
```

If numpy is available:
```python
import numpy as np

data = np.genfromtxt(path, delimiter=",", comments="#", names=True)
x = data["x"]
y = data["y"]
```

Since the comment character in `genfromtxt` is handled by the `comments="#"` argument, metadata lines are skipped automatically.

## Multi-Curve Export Convention

When a graph contains multiple curves (e.g., `I_D` vs `V_DS` at different `V_GS` values), each curve is exported to a separate CSV file with a descriptive name:

```
idvds_vgs1v0.csv     # Vgs = 1.0 V
idvds_vgs2v0.csv     # Vgs = 2.0 V
idvds_vgs3v0.csv     # Vgs = 3.0 V
```

An index file `curves_index.json` records the metadata:
```json
{
  "figure": "Fig. 4 – Output Characteristics",
  "x_axis": {"label": "Vds", "unit": "V", "scale": "linear"},
  "y_axis": {"label": "Id",  "unit": "A", "scale": "linear"},
  "curves": [
    {"file": "idvds_vgs1v0.csv", "label": "Vgs = 1.0 V"},
    {"file": "idvds_vgs2v0.csv", "label": "Vgs = 2.0 V"}
  ]
}
```

## Parameter Table CSV Format

Extracted parameter tables (electrical characteristics) are exported as:

```csv
# Source: IRLZ44N_datasheet.pdf, Page 5 – Electrical Characteristics
# Component: IRLZ44N N-Channel MOSFET
parameter,symbol,min,typ,max,unit,condition
Drain-to-Source Breakdown Voltage,BV_DSS,55,,, V,Vgs=0V Id=250uA
Gate Threshold Voltage,Vgs(th),1.0,2.0,3.0,V,Vds=Vgs Id=250uA
On-State Drain Current,ID(on),,47,,A,Vgs=10V Vds=Vds(on)
Drain-to-Source On-Resistance,Rds(on),,22,28,mΩ,Vgs=10V Id=25A
```

Values left blank when not specified in the datasheet (blank = not guaranteed).

## Lookup Table for C++ Simulator

For power electronics simulators using C++ lookup tables:

```cpp
// Auto-generated from datasheet extraction
// Source: IRLZ44N, Fig.4, Transfer Characteristics at Tj=25C
static const double VGS_DATA[] = {1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0};
static const double ID_DATA[]  = {0.0, 0.1, 0.5, 1.2, 2.3, 5.5, 9.2, 12.3, 16.0, 18.5};
static const int N_POINTS = 10;
```

The `generate_curve_plot.py` script can optionally output a C++ header file with this format via `--output-cpp header.h`.
