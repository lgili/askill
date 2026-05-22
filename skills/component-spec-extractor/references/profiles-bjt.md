# Profile — Bipolar Junction Transistor (BJT)

## Table of Contents

- [Subclasses](#subclasses)
- [Must-have parameters](#must-have-parameters)
- [Must-have curves](#must-have-curves)
- [Conditional](#conditional)

## Subclasses

| Subclass | Notes |
|---|---|
| `small-signal-npn` / `small-signal-pnp` | 2N2222, BC547, etc. Low power, moderate gain. |
| `power-bjt-npn` / `power-bjt-pnp` | TIP family, MJL family, etc. High Vce, lower hFE. |
| `darlington` | Two-stage internal; hFE ≫ 1000 but Vce(sat) ≈ 1–2 V. |
| `digital-transistor` | Internal base resistors; treat as logic-level switch. |
| `rf` | Different parameter set (S-parameters, ft, NF) — not covered here. |

## Must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vceo` | V | Ib=0, Tj=25°C | Open-base Vce limit |
| `Vcer` / `Vces` | V | With base shorted or with Rbe | Stricter Vce ratings |
| `Vebo` | V | DC, Ic=0 | Emitter-base reverse rating (often only 5–7 V) |
| `Ic(cont)` | A | DC | Conduction limit |
| `Ic(pulsed)` | A | Single pulse | Surge sizing |
| `Ptot` | W | Tc=25°C | Power dissipation limit |
| `hFE` | — | Ic=several values, Vce=spec | DC current gain — almost always a *range* (e.g. 100–300) |
| `Vbe(on)` | V | Ic=rated | Base drive design |
| `Vce(sat)` | V | Ic=rated, Ib=Ic/10 | Switch-mode conduction loss (often 0.2–0.4 V for small signal) |
| `Vbe(sat)` | V | Ic=rated, Ib=Ic/10 | Total base-drive voltage |
| `ft` (transition frequency) | MHz | Vce=10V, Ic=spec | Bandwidth proxy; relevant for switching speed |
| `Cob` / `Cibo` | pF | Vcb=spec, f=1MHz | Output / input capacitance |
| `td / tr / ts / tf` | ns | Ic=rated, Ib=spec | Switching time fingerprint |
| `Rth(JC)` | °C/W | — | Thermal — power BJTs only |
| `Tj(max)` | °C | — | — |

## Must-have curves

| ID | Axes | Scale | Why |
|---|---|---|---|
| `hfe_vs_ic` | x: Ic (A or mA, log), y: hFE | log / linear OR log / log | hFE drops at low Ic AND at high Ic — bell-shape |
| `vce_sat_vs_ic` | x: Ic (A, log), y: Vce(sat) (V), parametrized by Ib (or Ic/Ib ratio) | log / linear | Conduction loss |
| `vbe_vs_ic` | x: Ic (A, log), y: Vbe (V) | log / linear | Base drive sizing |
| `safe_operating_area` (FBSOA / RBSOA) | x: Vce (V, log), y: Ic (A, log), parametrized by pulse width | log / log | Secondary breakdown! BJTs derate aggressively above ~Vce=Vceo/2 at long pulses — **critical** for linear-mode operation |
| `hfe_vs_tj` (or normalized) | x: Tj (°C), y: hFE (or normalized) | linear / linear | hFE rises with temperature for Si BJTs (positive tempco — opposite of MOSFET) |
| `cob_vs_vcb` | x: Vcb (V, log), y: Cob (pF, log) | log / log | Output capacitance |

## Conditional

- **For RF / high-frequency switching:**
  - `ft vs Ic` curve
  - `NF vs Ic` (noise figure) — small-signal only
- **For Darlington pairs:**
  - Internal base-emitter resistor values (rarely published; treat
    Vbe(on) as ≈ 1.4 V which already includes both junctions)
  - `Ib(off-leakage)` because internal resistor allows some leakage path
- **For linear-mode operation (audio output, regulators):**
  - SOA at multiple pulse widths — secondary-breakdown locus
- **For switching applications:**
  - `Storage time (ts)` is the dominant delay; if dataset specifies
    `Qb (stored base charge)` instead, pull that.
