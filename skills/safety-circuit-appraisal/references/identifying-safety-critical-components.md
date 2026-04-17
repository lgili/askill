# Identifying Safety-Critical Components

> Reference for: `safety-circuit-appraisal`
> Load when: During Phase 2 for hazard analysis.

## Overview

The first step in a Single-Fault Analysis is to identify which parts of the circuit are "safety-critical." A component is considered safety-critical if its failure could lead to a safety hazard OR if it is part of a safeguard designed to prevent a hazard.

The analysis should focus exclusively on these components.

## Identification Checklist

Systematically review the schematic and identify components that fall into the following categories.

### 1. Primary Circuit Components
Any component connected directly to the hazardous energy source (e.g., AC mains) before the main isolation barrier.
- **Examples:** Input filters, X and Y capacitors, MOVs, gas discharge tubes, fuses, fusible resistors, rectifier diodes, and the primary winding of the main transformer.
- **Why they are critical:** A failure here (like a shorted MOV) can draw excessive current, creating a fire hazard. A shorted Y-capacitor can make the chassis live, creating a shock hazard.

### 2. Isolation Components
Components that form the "isolation barrier" between hazardous voltages (primary side) and user-accessible, safe, low-voltage circuits (secondary side, often called SELV - Safety Extra-Low Voltage).
- **Examples:**
    - The **isolation transformer** itself (T1). Its construction and insulation are paramount.
    - **Optocouplers** (OC1) that cross the isolation boundary for feedback or signaling.
    - **Y-capacitors** (CY1) that bridge the barrier for EMI filtering.
    - The physical **creepage and clearance** distances on the PCB (though not a component, this is a critical aspect of the barrier).
- **Why they are critical:** A failure in the isolation barrier can directly expose a user to lethal voltages. A shorted optocoupler is a classic failure mode to analyze.

### 3. Protective Devices
Components whose explicit purpose is to interrupt or clamp energy during a fault condition.
- **Examples:**
    - **Fuses** (F1) and **fusible resistors**.
    - **Circuit breakers**.
    - **Over-voltage protection:** Metal Oxide Varistors (MOVs), TVS diodes, Zener "crowbar" circuits.
    - **Over-current protection:** Polyswitches (PTC thermistors).
- **Why they are critical:** These are the active safeguards. The analysis must verify that they operate correctly when another component fails. For example, if a capacitor shorts, does the fuse blow safely?

### 4. High-Energy Storage Components
Components that can store a hazardous amount of energy even after power is removed.
- **Examples:** Large bulk capacitors on the primary or secondary side.
- **Why they are critical:** They can pose a shock hazard to users or service personnel. They must have reliable **bleeder resistors** to discharge them to a safe level within a specified time after unplugging. A failure of the bleeder resistor (open-circuit) is a common fault to analyze.

### 5. Mechanical or Electromechanical Devices
- **Examples:** Power switches, relays, interlock switches.
- **Why they are critical:** A switch failing "on" could prevent shutdown. A relay's contacts welding shut could bypass a protection scheme. An interlock failing could energize a system when it should be off for service.

## Anti-Patterns

- **Listing Every Component:** Do not create a list of every resistor and capacitor. A resistor in a logic-level pull-up on the secondary side is almost never safety-critical. This will waste time and obscure the real risks.
- **Ignoring PCB Layout:** A component might be fine, but if the PCB traces to it are too close to other traces (violating creepage and clearance rules), the *layout itself* is the critical element that can fail. Use the schematic to identify components, but be aware that the physical implementation (PCB) is just as important.
- **Trusting Component Markings Blindly:** The BOM may say "Fuse", but the schematic analysis should confirm it's actually in a position to provide protection. Similarly, a capacitor might be used as a Y-capacitor across the barrier, but if the BOM doesn't specify a Y-rated part, that is a critical finding.
