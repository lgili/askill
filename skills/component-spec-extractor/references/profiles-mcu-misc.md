# Profile — Microcontroller, Gate Driver, Crystal, Misc

This file groups several component classes where the extraction set is
smaller than for power semiconductors. For each, only the high-level
parameters relevant to system-level integration are listed.

## Table of Contents

- [Microcontroller / MCU / FPGA / SoC](#microcontroller--mcu--fpga--soc)
- [Gate driver IC](#gate-driver-ic)
- [Crystal / Oscillator](#crystal--oscillator)
- [Connectors](#connectors)
- [Optocoupler / Digital Isolator](#optocoupler--digital-isolator)

## Microcontroller / MCU / FPGA / SoC

These datasheets are huge and most of their content (peripheral details,
register maps) is irrelevant to a power / signal-integrity / safety
analysis. Pull only the system-level parameters:

### Must-have parameters

| Symbol | Unit | Why |
|---|---|---|
| `Vdd` range | V | Power rail design |
| `Idd(run)` | mA | Average current at typical Fcore |
| `Idd(sleep)` | µA | Battery designs |
| `Vdd_io` levels | V | I/O voltage compatibility |
| `Vih / Vil` | V | Digital input thresholds |
| `Voh / Vol @ Iout` | V | Drive capability |
| `Iout(max)` per pin / per port | mA | Sourcing/sinking limits |
| `Tj(max)` and `Ta(max)` | °C | Industrial / automotive grade |
| `Reset thresholds (POR/BOR)` | V | Power-up sequencing |
| `Wake-up time` | µs | From which sleep mode |
| `ESD HBM/CDM` rating | kV/V | I/O ESD survivability |
| Package, pitch, ball/lead count | mm | PCB design |

### Curves usually worth digitizing

- `Idd vs Fcore` — power vs clock frequency at the operating Vdd
- `Idd vs Tj` (sleep mode) — often dominated by leakage at high Tj
- `Power-up sequence timing` — if the part needs strict Vdd-rail ordering

## Gate driver IC

### Must-have parameters

| Symbol | Unit | Why |
|---|---|---|
| `Vcc` range | V | Driver supply |
| `Iout(peak source / sink)` | A | Determines switching-time floor |
| `tpd(LH / HL)` | ns | Propagation delay — matched-pair drivers should have low skew |
| `tr / tf (Vout)` | ns | Output transition time at spec Cload |
| `UVLO` | V | Under-voltage lockout — protects the switch from partial enhancement |
| `Bootstrap V drop` | V | High-side rail headroom |
| `dv/dt (CMTI)` | V/ns | Common-mode transient immunity — **critical** for high-side drivers in fast switching |
| `Isolation rating` | Vrms / kV | If galvanically isolated |
| `Working voltage` | V | For isolated drivers — long-term insulation |
| `Propagation delay matching` | ns | For half-bridge drivers driving two switches |
| `Dead-time generator` | min/max ns | Internal or external |

### Curves usually worth digitizing

- `Iout(peak) vs Vout` — drive strength varies through the swing
- `tpd vs Tj` — drift
- `Iq vs Fsw` — driver supply current vs switching frequency

## Crystal / Oscillator

### Crystal (passive)

| Symbol | Unit | Why |
|---|---|---|
| `f0` (nominal) | MHz | — |
| `Tolerance @ 25 °C` | ppm | — |
| `Stability over Top` | ppm | — |
| `Aging` | ppm/year | Long-term drift |
| `ESR` (motional) | Ω | Determines drive level needed |
| `CL` (load capacitance) | pF | PCB / oscillator-stage cap selection |
| `Drive level (max)` | µW | Beyond this, aging accelerates |

### Oscillator (active, integrated)

| Symbol | Unit | Why |
|---|---|---|
| `f0` | MHz | — |
| `Tolerance + stability + aging` | ppm | Combined accuracy |
| `Vdd` range | V | Supply |
| `Idd` | mA | Power |
| `Output drive` | LVCMOS / LVDS / HCSL / sine | Receiver compatibility |
| `Phase noise / Jitter (RMS, integrated)` | fs or ps | Required for clocking ADCs, SerDes |

## Connectors

For mating connectors (signal or power):

| Symbol | Unit | Why |
|---|---|---|
| `Current rating per pin` | A | Continuous current |
| `Voltage rating` | V | Insulation rating |
| `Contact resistance` | mΩ | Voltage drop / I²R loss |
| `Insulation resistance` | MΩ | Leakage |
| `Insertion / withdrawal force` | N | Mechanical integration |
| `Mating cycles` | — | Lifetime |
| `Temperature range` | °C | Plastic / contact-plating limits |

## Optocoupler / Digital Isolator

### Optocoupler

| Symbol | Unit | Why |
|---|---|---|
| `CTR` (current transfer ratio) | % | LED current → transistor current |
| `CTR vs t (aging)` | % per 1000 h | Lifetime — LED dims over time |
| `Isolation Viso` | Vrms | Working voltage |
| `Vio(working)` | Vpk | Long-term working |
| `tplH / tphL` | µs | Propagation delay |
| `BW` | kHz | Bandwidth |
| `Vce(sat)` of output transistor | V | Output drop |

### Digital isolator (silicon-only, capacitive or magnetic)

| Symbol | Unit | Why |
|---|---|---|
| `Viso` | kVrms | Withstand |
| `Vio(working)` | Vrms | Continuous |
| `tpd / pulse-width distortion` | ns | High-speed transmission |
| `Common-mode transient immunity (CMTI)` | kV/µs | Surviving switch-node dv/dt |
| `Data rate` | Mbps | Bandwidth |
| `Vcc1 / Vcc2 ranges` | V | Both sides of the isolation |
| `Iq` per side | mA | Power budget |
