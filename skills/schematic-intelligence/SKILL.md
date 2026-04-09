---
name: "Schematic Intelligence"
description: "Electronic schematic understanding specialist for Altium Designer projects. Parses netlists and BOMs to extract components, nets, sheet hierarchy, and functional block topology — reasoning about the design like an experienced electronics engineer. Activates when you say 'analyze schematic', 'read Altium project', 'parse netlist', 'understand circuit', 'list components', 'trace net', 'find connections', 'analyze PCB design', 'review schematic hierarchy', or 'explain this circuit'."
---

# Schematic Intelligence

## Overview

Use this skill to understand multi-page Altium Designer schematics as a whole system — identifying every component, net, hierarchical connection, and functional block. The analysis works from **exported artifacts** that Altium can generate without a license: Protel netlist (`.NET`), bill of materials (BOM CSV/XLSX), and schematic PDF exports.

Default stance:

- Work from the netlist + BOM + schematic PDF export — do not attempt to parse binary `.SchDoc` files directly.
- A netlist fully encodes component identity and connectivity; the schematic PDF adds spatial context (sheet layout, annotation).
- Group components by reference designator prefix (R, C, U, Q…) and by functional proximity in the netlist (shared supply rail, shared data bus, shared net naming prefix).
- Power nets (GND, VCC, VDD, VBAT, 3V3, 5V, AGND, DGND…) are the backbone of any circuit — always map them first.
- A net with only one connection is a potential wiring error (floating net) — always flag these.

## Core Workflow

1. **Gather project artifacts.**
   - From Altium: `File → Export → Netlist → Protel` → exports `.NET` file.
   - From Altium: `Reports → Bill of Materials` → export as CSV or Excel.
   - Optionally: `File → Smart PDF` → exports multi-page schematic PDF.
   - Load `references/altium-netlist-format.md` for exact export format details and version variations.

2. **Parse the netlist.**
   - Run `scripts/parse_netlist.py --file project.NET --output netlist.json`.
   - Outputs JSON with two sections: `components` (RefDes → footprint, value, description) and `nets` (NetName → list of pin references `REFDES-PINNUM`).
   - Validates the file structure and reports parse errors (malformed blocks, duplicate RefDes).

3. **Parse the BOM (if available).**
   - BOM CSV adds component descriptions, manufacturer part numbers, and quantities that the netlist alone doesn't carry.
   - Pass `--bom bom.csv` to `analyze_circuit.py` to enrich the analysis.
   - Load `references/bom-analysis.md` for column mapping conventions across different Altium BOM templates.

4. **Analyze circuit topology.**
   - Run `scripts/analyze_circuit.py --netlist netlist.json`.
   - The script produces a structured report:
     - **Component inventory:** count by type (resistors, capacitors, ICs, connectors, etc.)
     - **Power distribution:** which components connect to each supply net.
     - **IC interconnections:** for each IC, which of its pins connect to which other ICs (via shared nets).
     - **Bus and signal groups:** nets sharing a common prefix (e.g., `SPI_MOSI`, `SPI_CLK`, `SPI_CS0`) are grouped as buses.
     - **Hierarchy:** sheet connector pins (`P?` / sheet entry ports) are identified and cross-referenced.
     - **Design rule warnings:** floating nets, unconnected pins (NC), duplicate net names across sheets.
   - Load `references/circuit-hierarchy.md` for hierarchical design conventions.

5. **Interpret functional blocks.**
   - Map the computed component groups to circuit functions: power supply, MCU core, communication interfaces, sensors, actuators, protection circuits.
   - For each functional block: list components, supply nets used, interface nets (e.g., I2C, SPI, UART), and connections to other blocks.
   - Present the result as a structured system diagram description in text.

6. **Answer specific questions.**
   - "Which components are on the 3.3V rail?" → query `analyze_circuit.py --query power-rail 3V3`.
   - "What does U4 connect to?" → query `--query connections U4`.
   - "Is there a path from J1 to U2?" → trace nets from J1 pins through the connectivity graph.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Altium netlist format | `references/altium-netlist-format.md` | Parsing `.NET` files, understanding format variations, handling edge cases |
| Circuit hierarchy and multi-page schematics | `references/circuit-hierarchy.md` | Understanding hierarchical blocks, sheet connectors, harness connectors, power ports |
| BOM analysis and component classification | `references/bom-analysis.md` | Parsing BOM exports, classifying components, identifying power tree and sourcing data |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/parse_netlist.py` | Parse an Altium Protel `.NET` netlist into structured JSON (components + nets) | `python skills/schematic-intelligence/scripts/parse_netlist.py --file project.NET --output netlist.json` |
| `scripts/analyze_circuit.py` | Analyze a parsed netlist JSON to produce component inventory, power distribution, IC interconnections, bus groups, and design rule warnings | `python skills/schematic-intelligence/scripts/analyze_circuit.py --netlist netlist.json` |

**Dependencies:** standard library only (no pip packages required)

## Constraints

### MUST DO

- Always work from the exported netlist — do not attempt to parse binary Altium `.SchDoc` files.
- Flag every net with only one connected pin as a potential floating net warning.
- Identify power nets by name pattern (GND, VCC, VDD, 3V3, 5V, VBAT, AGND, DGND, etc.) and report them separately.
- Group nets that share a name prefix into logical buses (e.g., all `SPI_*` nets form the SPI bus).
- Report component count by type using standard ref-des prefix conventions (R=resistor, C=capacitor, U=IC, Q=transistor, D=diode, J/P=connector, L=inductor, T=transformer, SW=switch).

### MUST NOT DO

- Infer component function from ref-des prefix alone — always cross-reference with value/description from netlist or BOM.
- Declare a net as an error without context — some single-pin nets are intentional (test points, guard rings).
- Assume net name uniqueness across sheets without checking for sheet-scope vs. global net declarations.
- Present raw net lists without grouping — always aggregate into functional blocks for readability.
- Confuse pin numbers with net names — a pin reference like `U1-14` means component U1, pin 14, not a net.

## Output Template

For schematic analysis tasks, report:

1. **Project summary:** component count (total and by type), net count, sheet count.
2. **Power distribution:** supply nets detected, components on each rail, estimated current paths.
3. **Functional blocks:** name, components, supply rail, external interfaces (nets connecting to other blocks).
4. **IC interconnections:** structured list of which ICs share nets and what functions those nets carry.
5. **Bus groups:** name, member nets, connected components.
6. **Design rule warnings:** floating nets, single-pin nets, unconnected pins (NC markers), duplicate RefDes.
7. **Hierarchy (if multi-page):** sheet names, hierarchical block instances, cross-sheet net connections via ports.

## Primary References

- Altium Designer Documentation — Netlist export and hierarchical design
- IEC 60617 — Graphical Symbols for Diagrams (standard component symbols)
- Cadence Allegro / OrCAD netlist format — comparison reference for net format variations
