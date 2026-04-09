# Altium Netlist Format Reference

## What Is a Netlist?

A netlist is a text file that describes the complete logical connectivity of a schematic: every component, every net, and every pin-to-net assignment. It is the primary artifact for transferring schematic information to PCB layout, SPICE simulation, and analysis tools.

Altium Designer can export netlists in several formats via `Design → Netlist → Generate Netlist Files`:

| Format | Extension | Use |
|---|---|---|
| Protel | `.NET` | Most common; plain text; two-section structure |
| EDIF | `.EDF` | IEEE standard; verbose XML-like |
| OrCAD Capture | `.NET` | Compatible with Cadence tools |
| SPICE | `.CIR` | Ready for LTspice/ngspice simulation |
| Multisim | `.NET` | NI Multisim format |
| Mentor | `.ASC` | PADS netlist |

The **Protel `.NET` format** is what `parse_netlist.py` targets — it is the most widely used for PCB and design review purposes.

## Protel Netlist Format Specification

The file has two main sections delimited by `[...]` and `(...)` at the top level:

### Component Section `[...]`

Lists all component instances. Each component is enclosed in `{...}` on separate lines:

```
[
{RefDes
Footprint
Value|Description
}
{RefDes2
Footprint2
Value2
}
]
```

- Line 1 in the block: **Reference Designator** (e.g., `R1`, `U3`, `C12`).
- Line 2: **Footprint** PCB land pattern name (e.g., `RES_0402`, `SOIC8`, `QFN48`).
- Line 3 (and beyond): **Value / Description** (e.g., `10K`, `100nF`, `STM32F4`). Some tools export only 3 lines; others export additional attributes.

### Net Section `(...)` 

Lists all nets. Each net is enclosed in `(...)`:

```
(
(GND
(R1-1)
(C1-2)
(U1-3)
)
(VCC
(R1-2)
(U1-1)
)
(NET_SPI_CLK
(U1-15)
(U2-3)
)
)
```

- First line inside: **Net name**.
- Subsequent lines: **Pin references** in format `REFDES-PINNUMBER`.

### Minimal Single-Line Variant

Some Altium versions export compact single-line pin lists:

```
(GND R1-1 C1-2 U1-3)
(VCC R1-2 U1-1)
```

The parser must handle both multi-line and single-line variants.

## Net Naming Conventions in Altium

| Net name pattern | Meaning |
|---|---|
| `GND`, `AGND`, `DGND`, `PGND` | Ground reference (analog, digital, power) |
| `VCC`, `VDD`, `VBAT`, `V3V3`, `3V3`, `5V`, `12V`, `24V` | Power supply rails |
| `Net(RefDes-PinNum)` | Auto-named net (Altium assigns when no label is placed) |
| `NetXXXX_NNNNN` | Older Altium auto-name format |
| `SPI_CLK`, `I2C_SDA`, `UART1_TX` | User-placed net labels — carry functional meaning |
| `MCU_GPIO_PA3` | Interface net with function-encoded name |

Auto-named nets (`Net(U1-14)`) are generally power or signal connections that the designer intentionally left unlabelled. They are not errors but their function must be inferred from the connected components.

## Hierarchical Designs

In multi-sheet hierarchical designs, Altium uses:
- **Sheet Symbol** with **Sheet Entry** ports — define hierarchical block interfaces.
- **Power Ports** (VCC, GND symbols) — automatically global; same net name on any sheet is connected.
- **Off-Page Connectors / Harness Connectors** — connect nets across flat multi-sheet designs.

In the exported netlist:
- All hierarchical connections are **flattened** — the netlist contains a single combined net list for the entire project.
- Sheet entry port names become net names if no other label overrides them.
- Component RefDes may include a sheet prefix in hierarchical mode (e.g., `U_MainBoard:U1`).

## Multi-Sheet Project Netlist Export

To export a complete project netlist from all sheets:
1. Open the project in Altium.
2. `Design → Netlist → Protel` — select the top-level `.SchDoc` or `.PrjPcb`.
3. Ensure "Flatten Hierarchy" is enabled if project uses hierarchical sheets.
4. The resulting `.NET` file covers all sheets.

## BOM Export

A Bill of Materials export from `Reports → Bill of Materials` as CSV typically contains:
- `Comment` (value/part number as shown on schematic)
- `Description`
- `Designator` (comma-separated list of RefDes sharing the same part)
- `Footprint`
- `Quantity`

Some templates also include `Manufacturer`, `Manufacturer Part Number`, `Supplier`, `Supplier Part Number`.

## Format Edge Cases

| Edge case | Notes |
|---|---|
| Empty net (no pins) | Can occur if a net label was placed but no component pin was connected |
| Duplicate RefDes | Indicates a design error; parser should warn |
| Pin number as string | Some connectors use `J1-A1`, `J1-B2` (row-column notation) |
| RefDes with special chars | Rare; e.g., `TP1`, `JP1`, `DNI_R3` (Do Not Install) — strip `DNI_` prefix from value parsing |
| Multi-part components | `U1A`, `U1B` represent gates A and B of the same IC package — group by prefix for component counting |
