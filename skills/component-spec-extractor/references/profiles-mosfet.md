# Profile — Power MOSFET (Si, SiC)

## Table of Contents

- [Subclasses](#subclasses)
- [Must-have parameters](#must-have-parameters)
- [Must-have curves](#must-have-curves)
- [Conditional parameters and curves](#conditional-parameters-and-curves)
- [Common datasheet symbol aliases](#common-datasheet-symbol-aliases)
- [Sanity checks](#sanity-checks)

## Subclasses

Identify the subclass at the start. The extraction plan differs:

| Subclass | Notes |
|---|---|
| `si-planar` | Older planar Si MOSFET, large Coss tail. |
| `si-trench` | Trench Si MOSFET, lower Rds(on) for the same area. |
| `si-superjunction` | Charge-balance Si (CoolMOS-class). Strongly non-linear Coss; ZVS modelling needs the Coss(tr) curve. |
| `sic` | SiC MOSFET. Negative temperature coefficient on threshold, low Coss tail, high dv/dt capability. Gate drive ranges differ (typically +15/-4 V or +18/-3 V). |
| `gan-enhancement` | GaN HEMT in MOSFET-replacement mode. Note Vgs range is narrow (max often 6–7 V), no body diode (third-quadrant conduction via reverse channel). |

For GaN, see also `references/profiles-passive.md` for the GaN body-diode-less
conduction notes — many fields below do not apply.

## Must-have parameters

For switching converter design (conduction loss, switching loss, thermal):

| Symbol | Unit | Typical test condition | Why it matters |
|---|---|---|---|
| `Vds(max)` | V | DC, Tj=25°C | Voltage stress limit |
| `Id(cont)` | A | Tc=25°C and Tc=100°C | Conduction current limit |
| `Id(pulsed)` | A | t_p=10µs, single pulse | Surge / inrush sizing |
| `Vgs(max)` | V | DC | Gate drive headroom |
| `Vgs(th)` | V | Id=250µA (typical), Vds=Vgs | Onset of channel; needed for switching model |
| `Rds(on)` | Ω | Vgs=10V (Si), Vgs=15-18V (SiC), Id=rated, Tj=25°C | Conduction loss |
| `gfs` | S | Vds=10V, Id=rated | Linear-region gain; switching slope |
| `Qg` | nC | Vgs=0→10V (or rated), Vds=Vds_typical | Gate drive sizing, switching time |
| `Qgs` | nC | as above | First plateau in gate charge |
| `Qgd` | nC | "Miller charge"; as above | Dominates dv/dt during switching |
| `Ciss` | pF | Vds=0V (or 25V), Vgs=0V, f=1MHz | Gate drive bandwidth |
| `Coss` | pF | Vds=25V (or 100V), Vgs=0V, f=1MHz | ZVS energy and tail; **must also pull Coss vs Vds curve** |
| `Crss` | pF | Vds=25V, Vgs=0V, f=1MHz | dv/dt-induced gate disturbance |
| `tr / tf` | ns | Vbus=rated, Id=rated, Rg=spec | Switching time; for behavioral E_on/E_off model |
| `td(on) / td(off)` | ns | as above | Dead-time sizing in synchronous topologies |
| `Eon / Eoff` | µJ | Vbus, Id, Tj, Rg specified | Switching loss — preferred over t_r/t_f when available |
| `Vsd` | V | Body diode, Isd=rated, Vgs=0V | Body diode forward drop (matters in synchronous dead-time) |
| `Qrr` | nC | Isd=rated, di/dt=specified, Vbus=rated | Hard-switching loss in bridge legs |
| `trr` | ns | as above | Reverse-recovery time |
| `Rth(JC)` | °C/W | Junction-to-case | Thermal sizing |
| `Tj(max)` | °C | — | Worst-case derating |

For Si and SiC, all of the above are normally available. For GaN, many
items don't apply (no body diode, no Qrr, gate is voltage-driven not
charge-driven in the same way).

## Must-have curves

The minimum set every MOSFET datasheet provides — digitize all of these
when modelling for power-converter simulation:

| ID | Axes | Scale | Why |
|---|---|---|---|
| `id_vs_vds` (output characteristic) | x: Vds (V), y: Id (A), parametrized by Vgs | linear / linear | Saturation onset, linear-region check |
| `id_vs_vgs` (transfer characteristic) | x: Vgs (V), y: Id (A), at Vds=rated | linear / linear OR linear / log | Threshold, transconductance |
| `rds_on_vs_id` | x: Id (A), y: Rds(on) (Ω or mΩ), at Vgs=rated | linear / linear | Real conduction loss vs current |
| `rds_on_vs_tj` | x: Tj (°C), y: Rds(on) / Rds(on@25°C) (—) | linear / linear | Conduction loss vs temperature; often normalized |
| `coss_vs_vds` | x: Vds (V, often log), y: Coss (pF, often log) | log / log | ZVS energy: `E_oss = ∫Coss(Vds) Vds dVds` |
| `ciss_crss_vs_vds` | x: Vds (V, log), y: Ciss & Crss (pF, log) | log / log | Combined capacitance plot from same figure |
| `qg_vs_vgs` (gate charge) | x: Qg (nC), y: Vgs (V), parametrized by Vds | linear / linear | Miller plateau height & width → driver sizing |
| `safe_operating_area (SOA)` | x: Vds (V, log), y: Id (A, log), parametrized by pulse width | log / log | Linear-mode / inrush safety |
| `vsd_vs_isd` (body diode forward) | x: Isd (A), y: Vsd (V), parametrized by Tj | linear / linear | Body diode conduction loss |
| `eon_eoff_vs_id` | x: Id (A), y: E_on / E_off (µJ), at Vbus=rated | linear / linear | Switching loss — usually one curve per E_on and E_off, sometimes per Rg |

## Conditional parameters and curves

Only pull these when relevant:

- **For hard-switching bridge legs (boost, buck-boost, full-bridge, totem-pole PFC):**
  - `Qrr vs di/dt` curve — if available
  - `Qrr vs Tj` curve — body diode reverse recovery worsens with temperature
- **For ZVS / resonant topologies (LLC, phase-shift, ACF):**
  - `Coss(tr)` (time-related output capacitance) — equivalent capacitance for ZVS energy
  - `Coss(er)` (energy-related output capacitance) — equivalent capacitance for stored energy
  - These are two integrals of the same `Coss vs Vds` curve and are sometimes given as constants
- **For high-frequency designs (>500 kHz):**
  - `Rg(internal)` from the gate-charge section
  - Gate-loop inductance recommendations from the package outline page
- **For SiC specifically:**
  - `Vgs(th)` temperature coefficient (SiC has negative tempco)
  - Threshold drift after stress (some vendors publish, most don't)
- **For thermal design:**
  - `Rth(JC) vs pulse width` (thermal impedance curve, Zth) — needed for non-steady-state
  - `Rth(JA)` (junction-to-ambient) only if no heatsink

## Common datasheet symbol aliases

Different vendors use different notations. Match by description, not just
by symbol:

- `Rds(on)`, `Rds_on`, `R_DS(on)`, `R_DSon`, `Ron`
- `Vgs(th)`, `V_GS(th)`, `Vt`, `Vth`, `V_T`
- `Coss`, `C_OSS`, `Co`
- `Qg`, `Q_G`, `Qg(tot)` — sometimes broken into `Qgs` + `Qgd` only
- `Vsd`, `V_SD`, `Vf` (when discussing the body diode)
- `Tj`, `T_J`, `T_junction`

## Sanity checks

Before handing the data off to `semiconductor-models`:

- `Rds(on)` from the table at Tj=25°C should equal the curve `Rds(on) vs Tj`
  reading at 25°C within 3 %.
- `Qg` at Vgs=10V from the gate-charge table should match the gate-charge
  curve reading at 10 V within 5 %.
- `Coss(er)` (when given as a number) should reconcile with the integral
  of the `Coss vs Vds` curve up to the relevant Vbus.
- `Eon` + `Eoff` from the table should not contradict the
  `E vs Id` curves at the same Vbus.
- If `Vgs(th)` is positive and large, the part is **not** a depletion-mode
  device — flag any decoration in the datasheet that suggests
  depletion-mode (mostly RF parts).
