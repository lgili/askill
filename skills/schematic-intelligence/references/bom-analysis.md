# BOM Analysis and Component Classification

## What a BOM Contains

An Altium Bill of Materials exported as CSV contains at minimum:

| Column | Content | Notes |
|---|---|---|
| `Comment` | Schematic value/part number | E.g., `10K`, `100nF`, `STM32F411CEU6` |
| `Designator` | Comma-separated RefDes | E.g., `R1, R2, R5` |
| `Description` | Free-text component description | E.g., `RES 10K 0.1% 0402` |
| `Footprint` | PCB land pattern | E.g., `RES_0402`, `QFN-48` |
| `Quantity` | Count of identical components | Integer |

Extended templates may add: `Manufacturer`, `MFR Part#`, `Supplier`, `Supplier Part#`, `DNI` (Do Not Install flag), `Value`, `Tolerance`, `Voltage Rating`.

## Parsing Altium BOM CSV

The Designator column lists all RefDes sharing the same part value, comma-separated. To get a per-component list:

```python
import csv

def parse_bom(path: str) -> dict:
    """Returns {RefDes: {comment, description, footprint, ...}}"""
    components = {}
    with open(path, encoding="utf-8-sig") as f:  # utf-8-sig handles BOM marker
        reader = csv.DictReader(f)
        for row in reader:
            designators_raw = row.get("Designator", "") or row.get("designator", "")
            # Split and clean: "R1, R2, R5" → ["R1", "R2", "R5"]
            designators = [d.strip() for d in designators_raw.split(",") if d.strip()]
            for ref in designators:
                components[ref] = {
                    "comment":     row.get("Comment", "").strip(),
                    "description": row.get("Description", "").strip(),
                    "footprint":   row.get("Footprint", "").strip(),
                    "quantity":    1,
                    "mfr":         row.get("Manufacturer", "").strip(),
                    "mfr_pn":      row.get("Manufacturer Part Number", "").strip(),
                }
    return components
```

Note: Altium BOM CSVs sometimes use semicolons as delimiters in European locales — check `csv.Sniffer` or inspect the first line.

## Component Classification by Reference Designator

Parse the RefDes prefix to classify component type:

```python
import re

REF_TYPE_MAP = {
    r"^R\d":   "resistor",
    r"^RN\d":  "resistor_network",
    r"^C\d":   "capacitor",
    r"^L\d":   "inductor",
    r"^T(R)?\d": "transformer",
    r"^D\d":   "diode",
    r"^Q\d":   "transistor",
    r"^U\d":   "ic",
    r"^J\d":   "connector",
    r"^P\d":   "connector",
    r"^SW\d":  "switch",
    r"^F\d":   "fuse",
    r"^FB\d":  "ferrite_bead",
    r"^Y\d":   "crystal",
    r"^XTAL":  "crystal",
    r"^TP\d":  "test_point",
    r"^BT\d":  "battery",
    r"^ANT":   "antenna",
    r"^LED\d": "led",
}

def classify_refdes(ref: str) -> str:
    for pattern, ctype in REF_TYPE_MAP.items():
        if re.match(pattern, ref, re.IGNORECASE):
            return ctype
    return "unknown"
```

## Identifying DNI (Do Not Install) Components

DNI components are present in the BOM and schematic but not assembled on the board. Altium marks them with:
- A `DNI` column with value `Yes` / `True` / `1`
- A `DNF` column ("Do Not Fit") — same semantics, British convention
- Value field set to `DNI`, `DNF`, `NM` (Not Mounted), or `UNPOPULATED`

Always filter DNI components from power tree and connectivity analysis — they are not electrically active.

## Grouping Components into Functional Blocks

After classifying each component, group by functional area using a combination of:

### 1. Value-Based Classification (Passive Large Groups)

| RefDes prefix | Value pattern | Likely function |
|---|---|---|
| C | 100nF, 10uF | Bypass / decoupling |
| C | 100uF, 470uF, 1000uF | Bulk capacitor (power supply output filter) |
| R | 0R, 0Ω | 0-ohm jumper (configuration) |
| R | any | Pull-up / pull-down indicators, timing resistors |
| FB | any | EMI filter on power line |
| F | any | Overcurrent protection |

### 2. Net-Based Grouping

Components sharing a domain-specific net (e.g., `SPI_MOSI`, `I2C_SDA`) belong to the same interface block. Use the netlist to find which components are connected to these nets.

### 3. Footprint-Based Classification

| Footprint pattern | Likely component type |
|---|---|
| `SOT-23*`, `TO-92*`, `TO-220*` | Discrete transistor, regulator, or reference |
| `BGA*`, `QFN*`, `QFP*` | Microcontroller, FPGA, or high-pin-count IC |
| `USB*`, `RJ45*`, `D-SUB*` | Interface connector |
| `SMBUS*`, `DO214*` | Power diode, TVS, or Schottky |
| `TSOP*`, `SOP8*` | Memory, driver, or small IC |

## BOM Summary Statistics

A useful BOM report includes:

```
Component Summary
─────────────────────────────────────────────
 Resistors (R):          47  unique values
 Capacitors (C):         38  unique values  
 ICs (U):                12  unique parts
 Connectors (J/P):        8  footprints
 Transistors (Q):         6
 Diodes (D):             10  (incl. 4 TVS)
 Inductors/Transformers:  4
 Test points (TP):       22
 Crystals (Y):            2
─────────────────────────────────────────────
 Total unique parts:     149
 Total component count:  312  (excl. DNI)
 DNI components:          12
```

## Identifying the Power Tree from BOM + Netlist

Algorithm:
1. Find all voltage regulator ICs (U components with "REG", "LDO", "BUCK", "BOOST" in description or MFR PN).
2. For each regulator, find its output pin (net connected to regulator output + bulk capacitor).
3. Trace that output net to all consuming components.
4. Repeat recursively for multi-stage power trees (e.g., 12V → 5V → 3.3V → 1.8V).
