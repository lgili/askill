# Profile — Diode (rectifier, Schottky, fast/ultrafast, SiC, TVS, Zener)

## Table of Contents

- [Subclasses](#subclasses)
- [Must-have parameters](#must-have-parameters)
- [Must-have curves](#must-have-curves)
- [Conditional parameters and curves](#conditional-parameters-and-curves)
- [Subclass-specific notes](#subclass-specific-notes)

## Subclasses

| Subclass | Conduction loss | Recovery loss | Notes |
|---|---|---|---|
| `silicon-pn-standard` | Vf ≈ 0.7–1.0 V | Slow (µs) | 50/60 Hz line rectifiers |
| `silicon-pn-fast` | Vf ≈ 0.9–1.4 V | Fast (50–200 ns) | General PWM |
| `silicon-pn-ultrafast` | Vf ≈ 1.0–1.5 V | < 50 ns | High-frequency PFC, hard-switched |
| `schottky-si` | Vf ≈ 0.3–0.55 V | None (majority-carrier) | Low-voltage (≤150 V) |
| `schottky-sic` | Vf ≈ 0.8–1.5 V | None | 600 V – 1700 V, dominant in PFC freewheel |
| `tvs` (Transient Voltage Suppressor) | n/a | n/a | Surge suppression; different parameter set |
| `zener` | n/a (voltage reference) | n/a | Voltage reference |

For TVS and Zener subclasses, see [Subclass-specific notes](#subclass-specific-notes)
because their parameter set diverges substantially.

## Must-have parameters

For PN, fast, ultrafast, and Schottky (rectifier / freewheel use):

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vrrm` (or `Vr`) | V | DC | Reverse blocking voltage |
| `If(avg)` | A | Tc=spec | DC current rating |
| `If(rms)` | A | Tc=spec | RMS rating (matters for line rectifier sizing) |
| `Ifsm` | A | Single half-cycle, 8.3 ms | Surge / inrush rating |
| `Vf` | V | If=rated, Tj=25°C and Tj=125°C | Conduction loss — extract both temperatures |
| `Ir` | µA or mA | Vr=rated, Tj=25°C and Tj=125°C | Leakage current; matters for cooling at high Tj |
| `Cj` | pF | Vr=spec (0V or 10V), f=1MHz | Junction capacitance — dominates Schottky behavior |
| `trr` | ns | Si only — If=rated, di/dt=spec, Tj=25°C and Tj=125°C | Reverse recovery time |
| `Qrr` | nC | Si only — same conditions | Total reverse charge — multiplied by Vbus gives recovery loss |
| `Irrm` | A | Si only — same conditions | Peak reverse current spike |
| `dV/dt(max)` | V/µs | Vr=rated | Required for safe commutation; specific to fast diodes |
| `Rth(JC)` | °C/W | Junction-to-case | Thermal sizing |
| `Tj(max)` | °C | — | Worst-case |

For **Schottky** (no minority-carrier storage):

- Drop `trr` / `Qrr` / `Irrm` from the list.
- Add `IF vs Tj` derating curve (Schottky leakage rises sharply with Tj).
- Add `Ir vs Vr vs Tj` reverse leakage map — it can dominate losses at high
  Tj and approach thermal runaway in some Si Schottkys.

## Must-have curves

| ID | Axes | Scale | Why |
|---|---|---|---|
| `if_vs_vf_forward` | x: Vf (V), y: If (A), parametrized by Tj | linear / linear OR linear / log | Forward characteristic — the most-used diode curve |
| `vf_vs_tj_at_If_rated` | x: Tj (°C), y: Vf (V) | linear / linear | Temperature drift of forward drop |
| `ir_vs_vr` | x: Vr (V), y: Ir (µA or mA, log), parametrized by Tj | linear / log | Reverse leakage |
| `cj_vs_vr` | x: Vr (V, log), y: Cj (pF, log) | log / log | Junction capacitance — needed for switching node ringing |
| `if_derating_vs_tc` | x: Tc (°C), y: If(avg) (A) | linear / linear | Continuous current vs case temperature |
| `qrr_vs_if` (Si only) | x: If (A), y: Qrr (nC), parametrized by Tj and di/dt | linear / linear | Recovery charge as function of operating point |
| `trr_vs_if` (Si only) | x: If (A), y: trr (ns), parametrized by Tj | linear / linear | Recovery time |
| `zth_vs_pulse_width` | x: t (s, log), y: Zth (°C/W, log) | log / log | Transient thermal — single-pulse / repetitive |

## Conditional parameters and curves

- **For PFC freewheel / hard-switched bridge:**
  - `Qrr vs di/dt` family — recovery loss is the dominant switching loss
  - `Qrr vs Tj` — recovery worsens with temperature
- **For high-frequency (≥100 kHz) bridge freewheel:**
  - Soft-recovery factor `S = ta / tb` (sometimes published)
- **For sync-rect or active-rectifier replacement:**
  - Direct comparison with a MOSFET in third-quadrant conduction —
    sometimes a separate "synchronous rectifier" page is provided
- **For solar / TVS-paralleled freewheels:**
  - Surge IFSM curve — single half-cycle and ten-cycle versions

## Subclass-specific notes

### Schottky (Si or SiC)

- `Qrr` does not apply (majority-carrier device).
- `Ir` is much higher than PN and rises ~2× per 10 °C — pull the
  `Ir vs Vr vs Tj` curve and verify thermal stability at the worst-case
  Tj.
- SiC Schottky: pull the `Cj vs Vr` curve and confirm it is *not* the
  same as a Si Schottky; SiC has a flatter Cj profile.

### TVS (Transient Voltage Suppressor)

Different parameter set entirely:

| Symbol | Unit | Why |
|---|---|---|
| `Vrwm` (working voltage) | V | Maximum normal-operation voltage |
| `Vbr` (breakdown voltage) | V | Onset of clamping |
| `Vc` (clamping voltage at Ipp) | V | Peak voltage during the surge — the relevant number for downstream protection |
| `Ipp` (peak pulse current) | A | Surge current at which Vc is specified, with waveform spec (e.g. 8/20 µs, 10/1000 µs) |
| `Ppk` (peak power) | W | Energy handling for the spec waveform |
| `Cj` | pF | Signal-line TVS only — limits bandwidth |

Curves to digitize:

- `Vc vs Ipp` (clamping characteristic) — the most important TVS curve
- `Ppk vs t_pulse` — derating for non-standard pulses

### Zener

| Symbol | Unit | Why |
|---|---|---|
| `Vz` | V | Zener voltage, at `Iz(test)` |
| `Iz(min)` / `Iz(max)` | mA | Operating range |
| `Zz` | Ω | Dynamic impedance at the test current |
| `αVz` | mV/°C or %/°C | Temperature coefficient of Vz |

Curves: `Iz vs Vz` and `Vz vs Tj`.
