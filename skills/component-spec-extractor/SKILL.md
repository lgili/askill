---
name: component-spec-extractor
description: Component-aware datasheet extraction planner for electronic parts. Given a part number (or a component type — MOSFET, IGBT, diode, BJT, op-amp, LDO, switching regulator, capacitor, inductor, etc.), produces the canonical list of parameters to pull from the datasheet and the canonical list of characteristic curves to digitize, with their axes, scale (linear/log), and the conditions that matter for each. Orchestrates `datasheet-intelligence` (table + curve extraction) and feeds `semiconductor-models`, `circuit-solver`, `magnetic-components`, and `simulation-verification` with the right data. Trigger for asks like "extract MOSFET specs", "key parameters of this IGBT", "main curves of this diode", "what to digitize from this datasheet", "datasheet extraction plan", "build a SPICE model from this datasheet", "extract Rds_on vs Tj", "I-V curve of this diode", "Coss vs Vds", or "transfer characteristic of this MOSFET".
---

# Component Spec Extractor

## Overview

Use this skill before pointing `datasheet-intelligence` at a datasheet. This
skill answers the question **"for a part of *this* type, what do I actually
need?"** — i.e. the canonical set of parameters and characteristic curves
that downstream skills (`semiconductor-models`, `circuit-solver`,
`magnetic-components`, `simulation-verification`, `safety-circuit-appraisal`)
need to do their job.

`datasheet-intelligence` knows **how** to extract tables and digitize curves.
This skill knows **what** to extract, **at what test conditions**, and **why
it matters**.

Default stance:

- Identify the component class first. The right extraction plan for a
  MOSFET is wrong for an IGBT and useless for an op-amp.
- Prefer the **typical** values for simulation, but always pull min/max
  too — worst-case analysis and parameter-sensitivity studies need them.
- Always pull test conditions (Vds, Vgs, Tj, Id, frequency, etc.) along
  with the value. A datasheet number without its conditions is noise.
- Always pull temperature-dependent curves. Most devices behave very
  differently at Tj = 125 °C than the typical Tj = 25 °C table values.
- Defer simulation modelling choices to `semiconductor-models` /
  `power-electronics` / `control-loop` — this skill stops once the data
  is extracted and tagged.

## Core Workflow

1. **Classify the component.**
   - Ask the user for part number + manufacturer if not provided.
   - From the cover page of the datasheet (or `pdf-reader` extract),
     identify the component class:
     `mosfet | igbt | diode | bjt | opamp | comparator | ldo |
     switching-regulator | gate-driver | capacitor | inductor | resistor |
     transformer | crystal | microcontroller | other`.
   - For dual-role parts (e.g. a MOSFET in a SiC half-bridge module,
     or a diode-rectifier inside a power module), treat each die
     separately.

2. **Load the matching profile.**
   - Open the corresponding file from the Reference Guide table.
   - Each profile lists:
     - **Must-have parameters** — symbol, unit, typical test condition,
       why it matters.
     - **Must-have curves** — axes (with units + scale), typical range,
       which simulation step needs them.
     - **Conditional parameters** — only relevant when the user has a
       specific topology / use case (e.g. body-diode `Q_rr` only matters
       for hard-switched bridge legs).

3. **Emit an extraction plan.**
   - Format: a JSON object containing the component identity, the
     parameter list (with target test conditions), and the curve list
     (with axes and the digitization hints — color, expected range).
   - The plan is the input contract for `datasheet-intelligence` —
     each `parameters[i]` becomes a row to find in a table; each
     `curves[i]` becomes a `digitize_curve.py` call.
   - Use `scripts/plan_extraction.py` to produce the plan from a
     component-type string.

4. **Run the extraction (delegated).**
   - For each parameter row in the plan: use
     `datasheet-intelligence/scripts/extract_datasheet_tables.py`,
     then grep the produced CSV for the symbol and matching test
     condition.
   - For each curve: use `datasheet-intelligence/scripts/digitize_curve.py`
     with the axis calibration from the datasheet figure.
   - Output one CSV per parameter group and one CSV per digitized curve.

5. **Validate the result.**
   - Cross-check: the typical values you extracted should match the
     reading on the curves at the same operating point (e.g. `Rds_on`
     from the table at Tj = 25 °C should match the curve `Rds_on vs Tj`
     at 25 °C).
   - Flag any discrepancy > 5 % as a likely extraction error to revisit.
   - Note any **must-have** field that was not found in the datasheet
     (some manufacturers omit `Q_rr` or `C_oss(tr)` — capture that
     gap explicitly so downstream modelling does not silently default).

6. **Hand off to the downstream skill.**
   - For semiconductor switching loss / model fidelity →
     `semiconductor-models`.
   - For passive component selection / loss → `power-electronics` and
     `magnetic-components`.
   - For SPICE / behavioral model assembly → `semiconductor-models`
     produces the model; this skill just produces the data.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Power MOSFET (Si, SiC) | `references/profiles-mosfet.md` | Component is a discrete power MOSFET or SiC MOSFET — including synchronous-rectifier MOSFETs |
| IGBT (single, co-pack with diode) | `references/profiles-igbt.md` | Component is an IGBT module, single-switch IGBT, or co-pack |
| Diode (rectifier, Schottky, fast recovery, SiC, TVS, Zener) | `references/profiles-diode.md` | Any diode — flag the subtype (Schottky vs PN, etc.) at the start |
| Bipolar transistor (small-signal, power BJT) | `references/profiles-bjt.md` | Discrete BJTs and Darlington pairs |
| Op-amp and comparator | `references/profiles-opamp.md` | Op-amp, current-feedback amplifier, instrumentation amp, comparator |
| Linear regulator (LDO) and switching regulator IC | `references/profiles-regulator.md` | LDOs, buck/boost ICs, buck-boost ICs, controller ICs |
| Passive components (capacitor, inductor, resistor) | `references/profiles-passive.md` | Discrete C / L / R when their non-ideal behavior matters for the simulation |
| Magnetic components (transformer, coupled inductor) | `references/profiles-passive.md` (Inductor section) + `magnetic-components` skill | When the user asks for transformer extraction — that's mostly the dedicated `magnetic-components` skill territory |
| Gate driver IC | `references/profiles-mcu-misc.md` (Gate driver section) | When sizing gate-loop layout or analyzing dv/dt immunity |
| Microcontroller / MCU / FPGA / mixed-signal | `references/profiles-mcu-misc.md` | When the user only needs power numbers + GPIO ratings, not full functional spec |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/plan_extraction.py` | Given a component type + optional part number, emits a JSON extraction plan ready to feed to `datasheet-intelligence`. | `python skills/component-spec-extractor/scripts/plan_extraction.py --type mosfet --part IPB60R190P7 --output plan.json` |

## Constraints

### MUST DO

- Always identify the component class before producing a plan. Ask the
  user when in doubt — wrong class produces wrong plan.
- For every parameter, capture the test condition (Vds, Vgs, Tj, Id,
  frequency, etc.). Numbers without conditions are unsafe to use in
  simulation.
- Pull min / typ / max when the datasheet provides all three. Many
  worst-case studies use min/max, not typ.
- For temperature-sensitive parameters (Rds_on, V_f, V_th, V_be,
  V_offset, leakage), pull both the table value and the temperature
  curve.
- Mark any **must-have** field that was not found as
  `"status": "missing"` in the extraction plan output — never silently
  default.

### MUST NOT DO

- Do not produce a generic "any datasheet" extraction plan. The whole
  value of this skill is in component-type-specific guidance.
- Do not extract more than what the downstream task needs. A pure
  conduction-loss study does not need `Q_g`, `C_oss(tr)`, or `t_rr`.
  Keep the plan tight unless the user asks for the full sweep.
- Do not assume the datasheet uses the canonical symbols (some use `Rds`
  or `R_DS` instead of `Rds(on)`; some use `Vf` instead of `V_F`).
  Match by symbol AND by description.
- Do not perform unit conversion silently. If the datasheet uses kΩ and
  the downstream skill expects Ω, do the conversion at the export step
  and annotate it.
- Do not duplicate `datasheet-intelligence`'s work. This skill plans;
  the other extracts. They are a pair.

## When NOT to use this skill

Defer when the request is narrower or in a different stage:

- **You already know exactly what to extract** (specific parameter, one
  curve) → go straight to `datasheet-intelligence`. This skill is for
  defining the canonical set.
- **You need to build the actual SPICE / behavioral simulation model**
  → `semiconductor-models` consumes the extracted data and turns it
  into a model.
- **You are doing single-fault hazard analysis** of a finished circuit
  → `safety-circuit-appraisal` orchestrates several skills (including
  this one) but the entry point should be the safety skill.
- **You need to lay out a converter topology / pick a switch class** →
  `power-electronics` covers topology selection; this skill is data
  capture only.
- **You need the math of a transformer / coupled inductor** →
  `magnetic-components` and `circuit-solver`. This skill can extract
  the inductance and DC resistance from a magnetic datasheet, but the
  modelling lives elsewhere.

## Output Template

When producing an extraction plan, return:

```json
{
  "component": {
    "part_number": "IPB60R190P7",
    "manufacturer": "Infineon",
    "class": "mosfet",
    "subclass": "si-superjunction",
    "datasheet_revision": "2.0, 2018-10-12"
  },
  "parameters": [
    {
      "symbol": "Rds(on)",
      "unit": "Ω",
      "test_condition": "Vgs=10V, Id=15A, Tj=25°C",
      "expected_section": "Electrical Characteristics — On-State",
      "priority": "must-have",
      "downstream_use": "conduction loss; semiconductor-models"
    }
    // ...
  ],
  "curves": [
    {
      "id": "rds_on_vs_tj",
      "x_axis": { "label": "Tj", "unit": "°C", "scale": "linear", "range": [-40, 175] },
      "y_axis": { "label": "Rds(on) / Rds(on@25°C)", "unit": "—", "scale": "linear", "range": [0.5, 2.5] },
      "expected_figure": "Figure 4 — Normalized Drain-Source On-Resistance vs. Junction Temperature",
      "priority": "must-have",
      "downstream_use": "conduction loss vs temperature; semiconductor-models"
    }
    // ...
  ],
  "gaps_to_check": [
    "Q_rr only specified at Tj=25°C; downstream hard-switching loss estimate will be optimistic at 125°C."
  ]
}
```

When reporting back to the user after running the plan, summarize:

1. **Component identity** — part, manufacturer, class, subclass.
2. **Parameters extracted** — count + list, with any `missing` flagged.
3. **Curves digitized** — count + list, with figure number and accuracy.
4. **Cross-check status** — did table values match curve readings at
   the same operating point?
5. **Downstream handoff** — which skill should pick this up next.

## Primary References

- Infineon Technologies — *Power MOSFET Selection Guide* and individual
  device datasheets
- ON Semiconductor — *MOSFET Basics* (AN-9010)
- STMicroelectronics — *Power MOSFET key parameters* (AN4742)
- Wolfspeed / Cree — *SiC MOSFET application notes*
- Texas Instruments — *Op-Amp Specifications* (SBOA092) and
  *LDO Datasheet Guide*
- JEDEC JESD24 — Standard definitions for switching parameters
- Mohan, Undeland & Robbins — *Power Electronics: Converters,
  Applications and Design*
- Erickson & Maksimović — *Fundamentals of Power Electronics*
