# Circuit Hierarchy and Multi-Page Schematic Design

## Flat vs. Hierarchical Multi-Sheet Designs

Altium Designer supports two styles of multi-sheet schematic:

### Flat Multi-Sheet
- Multiple `.SchDoc` files added to the same project.
- Sheets are independent; they share nets only through **global net labels** (same label name = same net across all sheets).
- Power symbols (VCC, GND) are automatically global.
- User-placed net labels are **sheet-local by default** in newer Altium versions — changing to global requires using a different label type (Global Label vs. Net Label).

### Hierarchical
- A **top-level sheet** contains **Sheet Symbols** — each represents a lower-level child sheet.
- Sheet symbols have **Sheet Entry** ports that correspond to **Power Ports** or **Ports** on the child sheet.
- Connections between parent and child are through Sheet Entry↔Port matching by name.
- This is the recommended approach for complex designs — each functional block (power supply, MCU, RF front-end) lives in its own sheet.

## Sheet Symbol and Sheet Entry

```
[Top-level sheet]
┌────────────────────────────────┐
│  Sheet Symbol: PowerSupply     │
│  ┌──────────┐                  │
│  │          │ ─► VCC_5V (out) ─┼──► other symbols on top sheet
│  │ PWR_SUPPLY│ ─► GND     (out) │
│  │          │ ─► VIN_12V (in) ─┼──◄ J1 (connector)
│  └──────────┘                  │
└────────────────────────────────┘

[Child sheet: PowerSupply.SchDoc]
  Contains: Buck converter, diode, capacitors
  Ports at sheet edge: VIN_12V, VCC_5V, GND
```

In the exported netlist: `VCC_5V` is a single net even though it appears in both the child and parent sheet.

## Reference Designator Prefixes

Standard IPC/IEEE reference designator prefixes:

| Prefix | Component type |
|---|---|
| `R` | Resistor (fixed) |
| `RN` | Resistor network |
| `C` | Capacitor |
| `L` | Inductor |
| `T` or `TR` | Transformer |
| `D` | Diode (any type including Zener, Schottky, TVS) |
| `Q` | Transistor (BJT, MOSFET, JFET) |
| `U` | Integrated Circuit (IC) |
| `J` or `P` | Connector (J = jack/socket, P = plug/header) |
| `SW` | Switch |
| `F` | Fuse |
| `FB` | Ferrite bead |
| `Y` or `XTAL` | Crystal / oscillator |
| `TP` | Test point |
| `ANT` | Antenna |
| `BT` | Battery |
| `LED` or `D` | LED (some designs use LED prefix) |

Multi-part ICs use suffix letters: `U1A`, `U1B`, `U1C` for gates/banks of the same package.

## Functional Block Identification

Group components into functional blocks using both ref-des prefix and net name analysis:

### By Power Rail Membership
Components sharing a supply net form a functional block:
- All components connected to `3V3_MCU` net → digital logic block
- All components connected to `VBAT` → battery-backed domain
- All components with `AGND` connection → analog circuitry

### By Net Name Prefix
Net names like `SPI1_`, `I2C_`, `UART1_`, `ADC_`, `ETH_` indicate bus membership. Components sharing a bus prefix form a block.

### By Reference Proximity in Netlist
Components that are densely interconnected (many nets in common) are functionally related. A simple metric: count shared nets between pairs of components.

## Power Distribution Analysis

Steps to map the power tree:
1. Identify all power supply outputs: regulators (`U` components with VIN, VOUT pins), voltage references, battery connectors.
2. For each supply rail net: list all consumers (components connected to that net).
3. Build a power tree: sources → distribution nets → loads.
4. Flag components without any recognized power supply connection (potential floating power).

### Power Net Detection Heuristics

A net is likely a power supply if:
- Its name matches a voltage pattern: `5V`, `3V3`, `VCC`, `VDD`, `12V`, `VBAT`, `AVDD`, etc.
- It appears as input to multiple filter capacitors (C components with one pin on the net, one pin on GND).
- It connects to more than 3 components.

A net is likely GND if:
- Its name is `GND`, `DGND`, `AGND`, `PGND`, `GNDD`, `GND_CHASSIS`, etc.
- It is the net with the highest pin count (usually true).

## Hierarchical Connector Recognition

Sheet connectors appear as `P?` RefDes (power port) or as labelled ports in the netlist. In the parsed netlist, they appear as component instances:

- `P?` → power symbol (VCC, GND) — no footprint, voltage reference only
- `J1`, `J2` entries with many pins → external connectors
- Components with RefDes matching `HI_*`, `HS_*` → hierarchical schematic instances (Altium uses this convention)

When analyzing a flat netlist from a hierarchical project, every inter-sheet connection has already been resolved — there is no explicit hierarchy marker in the Protel netlist. Use net names and sheet-based RefDes prefixes (if exported with `Sheet:RefDes` notation) to reconstruct hierarchy.
