# Profile — IGBT (single switch, modules, co-pack with diode)

## Table of Contents

- [Subclasses](#subclasses)
- [Must-have parameters](#must-have-parameters)
- [Must-have curves](#must-have-curves)
- [Conditional parameters and curves](#conditional-parameters-and-curves)
- [Common symbol aliases](#common-symbol-aliases)
- [Sanity checks](#sanity-checks)

## Subclasses

| Subclass | Notes |
|---|---|
| `pt` (Punch-Through) | Older planar IGBT, positive Vce(sat) tempco at low current. |
| `npt` (Non-Punch-Through) | Negative tempco on tail current; harder to parallel. |
| `field-stop` / `trench-fs` | Modern IGBT (most current parts). Designed for parallelability. |
| `rc-igbt` (Reverse-Conducting) | Integrated freewheel diode in the same die. |
| `co-pack` | Discrete IGBT + freewheel diode in the same package — extract BOTH dies' profiles separately. |

When extracting from a co-pack or module datasheet, run this profile for
the IGBT die and `profiles-diode.md` for the freewheel die.

## Must-have parameters

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vces` | V | Vge=0V, Ic=1mA | Voltage rating |
| `Ic(nom)` | A | Tc=25°C and Tc=80–100°C | Continuous collector current |
| `Ic(pulsed)` | A | t_p=1ms typical | Surge sizing |
| `Vge(max)` | V | DC | Gate drive headroom (usually ±20V) |
| `Vge(th)` | V | Ic=spec (1–4mA typ), Vce=Vge | Channel onset |
| `Vce(sat)` | V | Ic=rated, Vge=15V, Tj=25°C and Tj=125°C | Conduction loss — extract **both temperatures** |
| `Qg` (Q_G) | nC | Vce=Vbus, Vge=-Vge(min)→+15V | Driver sizing |
| `Cies / Coes / Cres` | pF | Vce=25V, Vge=0V, f=1MHz | Input / output / reverse transfer capacitance |
| `td(on) / tr / td(off) / tf` | ns | Ic=rated, Vbus=rated, Rg=spec, Vge swing spec | Switching time fingerprint |
| `Eon / Eoff` | mJ | Ic=rated, Vbus=rated, Rg=spec, Tj | **Switching loss is the dominant IGBT loss**; usually given at Tj=125°C |
| `Tail current duration` | ns | At Tj=125°C | The tail dominates Eoff |
| `Vf` (body / freewheel diode) | V | If=rated, Tj=25°C and 125°C | Conduction loss of the freewheel die |
| `Qrr / Irrm / trr` (freewheel diode) | nC, A, ns | If=rated, di/dt=spec, Vbus, Tj | Reverse-recovery loss in hard-switching |
| `Rth(JC)` | °C/W | IGBT die and diode die separately | Thermal — modules often have two values |
| `Tj(max) / Tvj(op)` | °C | — | Worst-case derating |

## Must-have curves

IGBT datasheets are typically richer in curves than MOSFETs because the
non-linearity of Vce(sat) vs Ic matters strongly. Digitize at least:

| ID | Axes | Scale | Why |
|---|---|---|---|
| `ic_vs_vce_output` | x: Vce (V), y: Ic (A), parametrized by Vge | linear / linear | Output characteristic; saturation onset |
| `vce_sat_vs_ic` | x: Ic (A), y: Vce(sat) (V), at Vge=15V, parametrized by Tj=25°C and 125°C | linear / linear | The dominant conduction-loss curve |
| `transfer_vge_to_ic` | x: Vge (V), y: Ic (A), at Vce=10–20V | linear / linear OR linear / log | Threshold and transconductance |
| `eon_eoff_vs_ic` | x: Ic (A), y: Eon, Eoff (mJ), at Vbus=rated, Tj=125°C, Rg=spec | linear / linear | Switching loss per pulse |
| `eon_eoff_vs_rg` | x: Rg (Ω), y: Eon, Eoff (mJ), at Ic=rated | linear / linear | Rg trade-off; rarely available but useful |
| `vf_vs_if_diode` (freewheel diode) | x: If (A), y: Vf (V), parametrized by Tj | linear / linear | Freewheel conduction loss |
| `qrr_vs_di_dt` (freewheel diode) | x: di/dt (A/µs), y: Qrr (nC), at Vbus, Tj | linear / linear | Recovery loss in hard-switching bridge legs |
| `coes_vs_vce` | x: Vce (V, log), y: Coes (pF, log) | log / log | Required when computing dv/dt or ZVS conditions |
| `safe_operating_area_FBSOA / RBSOA` | x: Vce (V, log), y: Ic (A, log), parametrized by pulse width | log / log | Forward / reverse bias SOA — IGBT-specific |
| `zth_vs_pulse_width` | x: pulse width (s, log), y: Zth(JC) (°C/W, log), parametrized by duty | log / log | Transient thermal impedance |

## Conditional parameters and curves

- **For active-clamp or short-circuit-prone applications (motor drives,
  traction inverters):**
  - `tsc` (short-circuit withstand time, usually 5–10 µs at Vbus, Vge=15V)
  - `Ic(SC)` (short-circuit collector current)
  - `RBSOA` (Reverse-Bias SOA) — turn-off under inductive load
- **For paralleling IGBTs:**
  - `Vce(sat) vs Tj` mismatch from typical to worst-case
  - `tail current vs Tj`
- **For high-frequency IGBTs (≥40 kHz):**
  - `Eon` at multiple `di/dt` values, if published
- **For modules:**
  - Per-die `Rth(JC)` (IGBT die ≠ diode die)
  - Module `Rth(case-to-heatsink)` (Rth_CH)
  - Stray inductance `L_sigma` of internal bus bars

## Common symbol aliases

- `Vce(sat)`, `V_CE(sat)`, `V_CEsat`, `Vce_on`
- `Vge(th)`, `V_GE(th)`, `V_T`
- `Eon`, `E_on`, `E_sw_on`
- `Eoff`, `E_off`, `E_sw_off` — sometimes broken into `Eoff_t` (tail) +
  `Eoff_0` (initial)
- `Coes`, `C_oss` (some vendors borrow MOSFET notation)
- `Qrr` is on the **diode** die, not the IGBT die

## Sanity checks

- `Vce(sat)` from the table at Tj=125°C and Ic=rated should equal the
  `Vce(sat) vs Ic` curve reading at the same Ic+Tj within 5 %.
- `Eon` + `Eoff` from the table should sum to roughly `Etotal` from the
  total-switching-energy curve, if both are given.
- For an RC-IGBT, the diode `Vf` should be within ~0.3 V of a standalone
  fast-recovery diode at the same If — flag any wild discrepancy.
- `Rth(JC)` × `P_dissipation` should give a Tj rise consistent with the
  derating curve; mismatches usually indicate the table value is for a
  smaller die area than assumed.
