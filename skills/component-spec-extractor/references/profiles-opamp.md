# Profile — Op-amp, Comparator, Instrumentation Amplifier

## Table of Contents

- [Subclasses](#subclasses)
- [Must-have parameters](#must-have-parameters)
- [Must-have curves](#must-have-curves)
- [Conditional parameters and curves](#conditional-parameters-and-curves)
- [Sanity checks](#sanity-checks)

## Subclasses

| Subclass | Defining trait |
|---|---|
| `vfb` (voltage-feedback) | Most general-purpose op-amps. Stable for unity gain. |
| `cfb` (current-feedback) | Higher slew rate at the expense of frequency-dependent feedback impedance. |
| `instrumentation` | Three-op-amp INA / two-op-amp INA. Differential input, CMRR > 100 dB. |
| `comparator` | Open-loop. Output is logic-level. Different parameter set (focus on response time + hysteresis). |
| `chopper` / `zero-drift` | µV-class offset and drift. Lower bandwidth. |

If `comparator`: skip the AC characteristics section below; use the
[Conditional](#conditional-parameters-and-curves) "Comparator-specific"
block.

## Must-have parameters

### DC characteristics (the analog precision)

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vos` (input offset voltage) | µV or mV | Vcm=Vs/2, Tj=25°C | DC accuracy floor |
| `Vos vs Tj` | µV/°C | — | Drift over temperature (extract the curve too) |
| `IB` (input bias current) | nA or pA | per input | Determines source-impedance constraint |
| `IOS` (input offset current) | nA or pA | — | Bias mismatch |
| `CMRR` (Common-Mode Rejection Ratio) | dB | Vcm sweep across Vcm range | Rejection of common-mode noise |
| `PSRR` (Power-Supply Rejection Ratio) | dB | Vs sweep | Rejection of supply ripple |
| `AOL` (open-loop gain) | dB or V/mV | DC, Rload=spec | Accuracy ceiling of closed-loop gain |
| `Vcm` (input common-mode range) | V | — | Input swing limits |
| `Vo(swing)` | V (above neg rail and below pos rail) | Rload=spec | Output swing limits — rail-to-rail vs not |
| `Iout(short)` | mA | Vout shorted to GND | Drive capability |
| `Is` (quiescent current) | µA or mA | Per amplifier | Power budget |
| `Vs(max)` | V (single or split) | — | Voltage rating |

### AC characteristics (the analog dynamics)

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `GBW` (gain-bandwidth product) | MHz | Av=unity, Rload=spec | Bandwidth at a given closed-loop gain |
| `SR` (slew rate) | V/µs | Large-signal step | Large-signal bandwidth |
| `Ts` (settling time to X%) | ns or µs | Step amplitude + accuracy spec | Settling for ADC drivers |
| `THD+N` (total harmonic distortion + noise) | % or dB | f, amplitude, Rload, Av | Audio / precision analog |
| `en` (input voltage noise density) | nV/√Hz | f=1 kHz (or 10 kHz) | Noise floor |
| `in` (input current noise density) | fA/√Hz or pA/√Hz | f=1 kHz | Noise via source impedance |
| `Vn(p-p)` (low-frequency noise) | µV p-p | f=0.1 Hz to 10 Hz | 1/f corner |
| `φm` (phase margin) | ° | Cload=spec | Stability for the load capacitance you actually use |

## Must-have curves

| ID | Axes | Scale | Why |
|---|---|---|---|
| `aol_phase_vs_frequency` (Bode) | x: f (Hz, log), y: |A| (dB) and phase (°) | log / linear | Stability analysis; required for closed-loop margin |
| `cmrr_vs_frequency` | x: f (Hz, log), y: CMRR (dB) | log / linear | High-frequency rejection often degrades 20 dB/decade above 1 kHz |
| `psrr_vs_frequency` | x: f (Hz, log), y: PSRR+ and PSRR- (dB) | log / linear | Switching-supply noise rejection |
| `vn_vs_frequency` (voltage noise density) | x: f (Hz, log), y: en (nV/√Hz, log) | log / log | 1/f corner and noise floor |
| `in_vs_frequency` (current noise density) | x: f (Hz, log), y: in (fA/√Hz, log) | log / log | Same, for current noise |
| `vos_vs_tj` | x: Tj (°C), y: Vos (µV) | linear / linear | Drift |
| `slew_rate_vs_vstep` | x: ΔVout (V), y: SR (V/µs) | linear / linear | Large-signal behavior — sometimes given as single number |
| `output_swing_vs_iload` | x: Iload (mA), y: ΔV from rail (V) | linear / linear | Rail-to-rail headroom |
| `step_response` | x: t (µs), y: Vout (mV) | linear / linear | Overshoot, ringing, settling |

## Conditional parameters and curves

### Comparator-specific

When the part is a comparator (open-loop, logic-level output), replace
the AC table with:

| Symbol | Unit | Why |
|---|---|---|
| `tpd` (propagation delay) | ns | Differential overdrive=spec (5–100 mV) | Response speed |
| `tpd vs overdrive` | ns vs mV | Family curve | Slower with smaller overdrive |
| `Vol` / `Voh` | V | Iload=spec | Output low / high |
| `Hysteresis` | mV | If internal | Switching threshold separation |
| Output type | push-pull / open-drain | — | Determines pull-up requirement |

### Instrumentation amplifier

- `Gain accuracy` and `Gain drift`
- `CMRR` at multiple gain settings — instrumentation amps often have
  gain-dependent CMRR
- `Vos drift` per gain — both `Vos_in` and `Vos_out` if available

### Audio op-amps

- `THD+N vs amplitude` for f=1 kHz and f=10 kHz
- `THD+N vs frequency` at fixed amplitude

### Chopper / zero-drift op-amps

- Chopping frequency (sometimes a spurious noise spike at Fchop)
- `EMI rejection ratio` (EMIRR) — newer parts publish this

## Sanity checks

- `GBW` from the table should equal the frequency at which `|AOL|` crosses
  unity (0 dB) on the Bode curve, within 20 %.
- Closed-loop bandwidth `BW_CL ≈ GBW / Av` for a stable VFB amp.
- `Vn(p-p)_0.1Hz_to_10Hz` should reconcile with the integral of `en(f)`
  over that band, including the 1/f contribution.
- For a rail-to-rail-output op-amp, `Vo(swing)` should asymptote to within
  ~50–200 mV of the rail at small `Iload` — anything worse than 500 mV is
  not RRO and should be flagged.
- `Vos drift` from the table at Tj=25 °C–125 °C should match the slope of
  the `Vos vs Tj` curve over the same range.
