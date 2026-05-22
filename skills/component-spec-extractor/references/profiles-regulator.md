# Profile — Linear (LDO) and Switching Voltage Regulators

## Table of Contents

- [Subclasses](#subclasses)
- [LDO must-have parameters](#ldo-must-have-parameters)
- [LDO must-have curves](#ldo-must-have-curves)
- [Switching regulator IC must-have parameters](#switching-regulator-ic-must-have-parameters)
- [Switching regulator IC must-have curves](#switching-regulator-ic-must-have-curves)

## Subclasses

| Subclass | Notes |
|---|---|
| `ldo-fixed` | Fixed output voltage. 3-pin or 4-pin (with EN). |
| `ldo-adjustable` | Vout = Vref × (1 + R1/R2). Needs `Vref` parameter. |
| `ldo-low-noise` | RF-grade, low-noise. Adds `Vnoise` curves. |
| `switcher-integrated` | Buck / boost / buck-boost with integrated FET(s). |
| `switcher-controller` | Controller IC + external FETs. Adds gate-driver characteristics. |
| `multi-rail-pmic` | Several rails. Extract each rail with the matching subclass. |

## LDO must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vin(min)` / `Vin(max)` | V | — | Input voltage range |
| `Vout` (or `Vref` for adj) | V | Iout=Iload(typical), Tj=25°C | Output accuracy |
| `Vout accuracy` | % | Tj range, full Iout range | Worst-case Vout window |
| `Iout(max)` | A or mA | Tc=spec | Continuous current rating |
| `Vdo` (dropout voltage) | mV or V | Iout=rated, Tj=25°C | Headroom needed at full load |
| `Iq` (quiescent current) | µA | No load, Vin=typical | Power budget for battery designs |
| `PSRR` | dB | f=spec (typically 1 kHz and 10 kHz–1 MHz) | Supply-ripple rejection |
| `Line regulation` | mV/V or %/V | Vin sweep, Iout=spec | DC supply sensitivity |
| `Load regulation` | mV/A or %/A | Iout sweep, Vin=spec | DC load sensitivity |
| `Tj(max)` | °C | — | Thermal |
| `Rth(JA)` | °C/W | Recommended footprint | Thermal design |
| `Vnoise(int)` | µVrms | Bandwidth=10 Hz–100 kHz | Integrated noise (low-noise LDOs) |
| `Cout(min) / Cout(max)` | µF | Range that keeps the LDO stable | Output cap selection |
| `ESR(min) / ESR(max)` of Cout | mΩ | If specified | Stability window |

## LDO must-have curves

| ID | Axes | Scale | Why |
|---|---|---|---|
| `vdo_vs_iout_vs_tj` | x: Iout (A or mA), y: Vdo (mV), parametrized by Tj | linear / linear | Headroom budget |
| `psrr_vs_frequency` | x: f (Hz, log), y: PSRR (dB), parametrized by Iout | log / linear | PSRR collapses above the loop-bandwidth — important for switcher-postregulators |
| `iq_vs_iout` | x: Iout, y: Iq | linear / linear | Efficiency at light load (some LDOs have low-Iq mode triggered above a threshold) |
| `output_noise_density` | x: f (Hz, log), y: enout (nV/√Hz, log) | log / log | Low-noise LDOs only |
| `load_step_response` | x: t (µs), y: Vout deviation (mV) | linear / linear | Transient response |
| `line_step_response` | x: t (µs), y: Vout deviation (mV) | linear / linear | Transient rejection |
| `stability_region_of_Cout_ESR` | x: ESR (Ω, log), y: Cout (µF, log), with shaded "stable" region | log / log | Stability — picking a cap inside the region |

## Switching regulator IC must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vin(min)` / `Vin(max)` | V | — | Input voltage range |
| `Vout range` | V | — | Output voltage range (for adjustable) |
| `Iout(max)` | A | Tc=spec | Continuous current |
| `Vfb` (feedback reference) | V | Tj=25°C | Used for setting Vout via divider |
| `Fsw` | kHz or MHz | Default or programmable | Switching frequency |
| `η(max)` (peak efficiency) | % | At spec Vin / Vout / Iout | Quick efficiency check |
| `Rds(on)` HS and LS | mΩ | Integrated FETs only | Conduction loss |
| `Iq` (quiescent + switching) | µA or mA | No load | Light-load efficiency |
| `Vuvlo(rise) / Vuvlo(fall)` | V | — | Under-voltage lockout |
| `Iovp / Vovp` | — | — | Over-current / over-voltage thresholds |
| `Soft-start time` | ms | — | Inrush limiting at startup |
| `Compensation type` | type-II / type-III / internal | — | Loop-design constraint |
| `Tj(max)` | °C | — | — |
| `Rth(JA)` | °C/W | Recommended footprint | Thermal |

## Switching regulator IC must-have curves

| ID | Axes | Scale | Why |
|---|---|---|---|
| `efficiency_vs_iout` | x: Iout (A), y: η (%), parametrized by Vin | linear / linear | The single most-asked curve |
| `efficiency_vs_vout` | x: Vout (V), y: η (%), at fixed Vin and Iout | linear / linear | When Vout is adjustable |
| `fsw_vs_iout` | x: Iout (A), y: Fsw (kHz) | linear / linear | Some parts have PFM at light load — Fsw drops |
| `rds_on_vs_tj` | x: Tj (°C), y: Rds(on) (mΩ) | linear / linear | Both HS and LS FET |
| `bode_plot_loop_response` | x: f (Hz, log), y: |T| (dB) and phase (°) | log / linear | Loop stability — when published, **digitize it**; informs external compensation |
| `load_step_response` | x: t (µs), y: Vout (mV) and Iout (A) | linear / linear | Transient |
| `recommended_inductor_value_vs_iout` | x: Iout (A), y: L (µH) | linear / linear | Selection chart (if provided) |

For controller-only ICs (external FETs), also pull:

- Gate-drive sourcing / sinking current (`Ig_source`, `Ig_sink`)
- Gate-drive voltage (`Vgs_drive`)
- Dead-time (internal or programmable)
