# Datasheet Structure by Component Type

## What a Datasheet Encodes

Every component datasheet contains four canonical sections (though order and naming vary by manufacturer):

| Section | What it contains | Extraction priority |
|---|---|---|
| **Absolute Maximum Ratings** | Hard limits (voltage, current, temperature, power) beyond which the device is destroyed | Highest — use for design safety validation |
| **Electrical Characteristics** | Min/Typ/Max values with test conditions | Highest — primary source for simulation parameters |
| **Typical Performance Characteristics** | Graphs of performance vs. operating conditions | High — needed for full model accuracy |
| **Application Information** | Recommended circuits, PCB layout guidelines, timing examples | Medium — design guidance |

## Section Layout by Device Family

### MOSFETs and IGBTs

Sections in order (most manufacturers):
1. Features / General Description
2. Schematic / Internal Diagram
3. Absolute Maximum Ratings (`V_DS`, `V_GS`, `I_D`, `T_J`, `P_D`)
4. Thermal Characteristics (`R_θJC`, `R_θJA`)
5. Electrical Characteristics (static: `R_DS(on)`, `V_GS(th)`, `BV_DSS`, `I_DSS`; dynamic: `C_iss`, `C_oss`, `C_rss`, `t_d(on)`, `t_r`, `t_d(off)`, `t_f`, `Q_g`)
6. Typical Performance: `R_DS(on)` vs `V_GS`, Output Characteristics (`I_D` vs `V_DS` at various `V_GS`), Transfer Characteristics (`I_D` vs `V_GS`)
7. Safe Operating Area (SOA)
8. Gate Charge Waveform, Body Diode Characteristics

**Key graph targets for simulation:** Output characteristics, Transfer characteristics, `R_DS(on)` vs temperature, C vs VDS.

### Diodes and Schottky Rectifiers

1. Absolute Maximum Ratings (`V_RRM`, `I_F(AV)`, `I_FSM`, `V_F`)
2. Electrical Characteristics (static: `V_F` at `I_F`, `I_R` at `V_R`; dynamic: `t_rr`, `Q_rr`, `C_j`)
3. Typical Performance: Forward Current vs Forward Voltage, Reverse Current vs Reverse Voltage, Junction Capacitance vs Reverse Voltage, Reverse Recovery

### Op-Amps and Linear ICs

1. Absolute Maximum Ratings (supply voltage, input range, output short-circuit duration)
2. Electrical Characteristics (open-loop gain `A_OL`, `V_OS`, `I_B`, `CMRR`, `PSRR`, GBW, slew rate, `I_Q`)
3. Frequency Response: Gain/Phase vs Frequency (Bode plot), Output Impedance vs Frequency

### Microcontrollers

1. Absolute Maximum Ratings
2. DC Characteristics (supply current vs frequency at `V_DD`, I/O levels, `V_IL`, `V_IH`, `V_OL`, `V_OH`)
3. AC Characteristics (SPI/I2C/UART timing, flash write times, ADC conversion time, interrupt latency)
4. Electrical characteristics are organized by peripheral (ADC, DAC, oscillator, PLL)

## Finding Section Boundaries Programmatically

Parameter tables are typically preceded by a bold section header. Look for text lines that:
- Are all-caps or Title Case
- Contain keywords: "Electrical Characteristics", "Absolute Maximum", "Thermal", "Static", "Dynamic"
- Are followed within 3 lines by a table with "Symbol", "Parameter", "Min", "Typ", "Max", "Unit" columns

```python
TABLE_HEADER_KEYWORDS = [
    "parameter", "symbol", "min", "typ", "max", "unit",
    "condition", "test condition", "notes"
]

def looks_like_electrical_table(header_row: list[str]) -> bool:
    row_lower = " ".join(str(c).lower() for c in header_row if c)
    return sum(1 for kw in TABLE_HEADER_KEYWORDS if kw in row_lower) >= 3
```

## Notes Field Parsing

Electrical characteristic tables often carry footnotes referenced by superscript numbers or symbols (¹²³ or */†). These notes carry critical test conditions.

Strategy:
1. Extract all footnotes from below the table (text lines starting with a digit, asterisk, or dagger).
2. Map footnote markers in the "Conditions" column to the full note text.
3. Include footnotes in the output CSV as an additional column.

## Common Pitfalls

| Problem | Solution |
|---|---|
| "Typ" column is blank | Manufacturer omits it if there is no guaranteed typical — use NaN in output |
| Units in column header but not per row | The header unit applies to all rows — replicate it in exported CSV |
| Multiple tables per page with different headers | Associate each table with the nearest preceding section header text |
| Parameters split across two pages | Detect continuation: if a page's first table has no header row, it is a continuation of the previous page's last table |
| Graph figures scattered across multiple pages | Use `pdf-reader` to extract all images; filter by aspect ratio (graphs are typically landscape) |
