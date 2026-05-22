# Profile — Passive Components (Capacitor, Inductor, Resistor)

## Table of Contents

- [Capacitor](#capacitor)
- [Inductor](#inductor)
- [Resistor](#resistor)

For transformers and coupled inductors, the heavy lifting belongs to the
dedicated `magnetic-components` skill — this profile only covers
discrete two-terminal magnetic components.

## Capacitor

### Subclasses

| Subclass | Notes |
|---|---|
| `mlcc` (Multi-Layer Ceramic) | Class I (C0G/NP0) is linear and stable; Class II (X7R, X5R, Y5V) suffers DC-bias derating and tempco. |
| `electrolytic-aluminum` | Polarized. High capacitance, high ESR, lifetime-limited by ESR rise. |
| `polymer` / `solid-aluminum` | Lower ESR than wet aluminum; longer life. |
| `tantalum` (wet / polymer) | High volumetric efficiency; failure mode is short, derate Vrated heavily. |
| `film` | Polyester / polypropylene / PEN. Low ESR, very stable; bulky for high C. |
| `supercap` | EDLC. F-class capacitance; very low ESR at DC, high at higher frequencies. |

### Must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `C` (nominal capacitance) | µF / nF / pF | 1 kHz, 25 °C (Class II MLCC: also at Vdc=rated) | The DC-bias derating can be 50–80 % at rated voltage for Class II MLCCs |
| `Vrated` | V (DC) | — | Voltage rating — derate as appropriate for the subclass |
| `Vsurge` | V | — | Brief overvoltage (mainly aluminum / film) |
| `Tolerance` | ±% | — | Initial accuracy |
| `Tempco` (for film and Class II MLCC) | ppm/°C or % | Temperature range | Drift |
| `DF` (dissipation factor) | % | 1 kHz or 120 Hz | Loss tangent |
| `ESR` | mΩ | 100 Hz / 100 kHz typically — extract both | Switching ripple voltage, life of aluminums |
| `Irms` (ripple current rating) | A | f, Tc=spec | Heating limit — critical for input/output caps in switchers |
| `Leakage current` | µA | After 1 min at Vrated, Tj | Standby current |
| `ESL` (equivalent series inductance) | nH | — | Self-resonant frequency `FSRF = 1 / (2π √(L·C))` |
| `Lifetime` (electrolytic) | hours @ Tc, Vrated, ripple | Often Arrhenius extrapolated | Reliability budget |

### Must-have curves (capacitor)

| ID | Axes | Scale | Why |
|---|---|---|---|
| `c_vs_vdc` (MLCC Class II only) | x: Vdc (V), y: C / Cnom (—) | linear / linear | DC-bias derating — often dramatic |
| `c_vs_t` | x: T (°C), y: C / Cnom (—) | linear / linear | Tempco |
| `esr_vs_frequency` | x: f (Hz, log), y: ESR (mΩ, log) | log / log | Switching converters care about ESR at Fsw |
| `impedance_vs_frequency` | x: f (Hz, log), y: |Z| (Ω, log) | log / log | Self-resonance, decoupling effectiveness |
| `irms_derating_vs_tc` | x: Tc (°C), y: Irms (A) | linear / linear | High-temp derating |
| `lifetime_vs_tc` (electrolytic) | x: Tc (°C), y: lifetime (h, log) | linear / log | Reliability budget |

## Inductor

### Subclasses

| Subclass | Notes |
|---|---|
| `ferrite-core` | High AL, high µ. Saturates sharply; Bsat ~ 0.3–0.5 T. |
| `iron-powder` / `powdered-iron` | Soft saturation; lower µ, higher Bsat. |
| `mpp` / `kool-mu` / `xflux` | Various powder cores. Soft saturation, good DC bias performance. |
| `air-core` | No saturation. Used at very high frequency where core loss dominates. |
| `coupled-inductor` | Goes to `magnetic-components` skill — multiple windings. |

### Must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `L` (nominal inductance) | µH or nH | f=100 kHz (or 1 MHz for small), Idc=0 | Used by the converter equations |
| `Isat` (saturation current) | A | Tj=25°C; defined at L drop of either 10 %, 20 %, or 30 % (vendor-specific — **always note the L-drop threshold**) | Maximum DC current before L collapses |
| `Irms` (RMS current rating) | A | ΔT=spec (often 40 °C rise above ambient) | Heating limit |
| `DCR` (DC resistance) | mΩ | Tj=25°C | Conduction loss |
| `SRF` (self-resonant frequency) | MHz | Often the impedance peak | Above SRF the inductor looks like a cap |
| `Tempco of L` | ppm/°C or % | — | Drift; matters for resonant designs |
| `Bsat` (core flux density) | T or mT | — | When using core data sheets (Mn-Zn, ferrite materials) |
| `Core loss density` | mW/cm³ | At f, ΔB, Tj | Switching-frequency core loss |

### Must-have curves (inductor)

| ID | Axes | Scale | Why |
|---|---|---|---|
| `l_vs_idc` | x: Idc (A), y: L (µH) | linear / linear | Saturation curve — vendor's chosen "Isat" threshold is one point on this |
| `l_vs_frequency` | x: f (Hz, log), y: L (µH) | log / linear | Drops near SRF |
| `dcr_vs_tj` | x: Tj (°C), y: DCR (mΩ) | linear / linear | Copper has +0.39 %/°C TC |
| `temperature_rise_vs_idc` | x: Idc (A), y: ΔT (°C) | linear / linear | Thermal current rating |
| `impedance_vs_frequency` | x: f (Hz, log), y: |Z| (Ω, log) | log / log | EMC filter design |

## Resistor

Most discrete resistors do not need extensive datasheet mining beyond:

| Symbol | Unit | Why |
|---|---|---|
| `R` (nominal) | Ω | — |
| `Tolerance` | ±% | — |
| `TCR` (Temperature Coefficient of Resistance) | ppm/°C | Drift (50–200 ppm/°C typical thin/thick film; <25 ppm/°C precision) |
| `Pmax` | W | At Ta=spec |
| `Vmax (continuous)` | V | High-voltage parts only |
| `Vmax (overload)` | V | — |

When the part is a **high-power resistor**, also pull:

- `Derating curve P vs Tc` — almost always linear from a knee
- `Pulse withstand` curve — for inrush / snubber applications

When the part is a **shunt** (current sense):

- `TCR over self-heating` — at full power
- `Long-term drift` — ppm per 1000 h

When the part is an **NTC / PTC thermistor**:

- `R vs T` curve — the entire characteristic
- `B-constant` (for NTC) — used in the steinhart-hart approximation
