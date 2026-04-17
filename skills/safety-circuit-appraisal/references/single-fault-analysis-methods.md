# Single-Fault Analysis Methods

> Reference for: `safety-circuit-appraisal`
> Load when: During Phase 3 for detailed failure simulation.

## Overview

This phase is the core of the appraisal. For every component identified as safety-critical, you will simulate its failure in two modes (open and short) and analyze the consequences. The goal is to determine if the existing safeguards are sufficient to keep the product safe.

## Analysis Procedure

For each critical component, create an entry in the SFA table and follow these steps:

### 1. Identify the Component and Fault Mode
- **Component:** The component being analyzed (e.g., OC1, the feedback optocoupler).
- **Fault Mode:** The specific failure being simulated (e.g., Short-circuit of the phototransistor, collector-to-emitter).

### 2. Predict the Immediate Effect
- Use circuit analysis principles (and skills like `power-electronics`) to determine what happens immediately after the fault occurs.
- **Example:**
    - **Fault:** The feedback optocoupler (OC1) phototransistor shorts.
    - **Prediction:** The feedback signal to the SMPS controller is now permanently "on," tricking the controller into thinking the output voltage is too low. The controller will increase the duty cycle towards its maximum in an attempt to raise the output voltage.

### 3. Analyze the Hazard
- Determine if the predicted effect leads to a hazardous condition as defined by the safety standard.
- **Example (continued):**
    - **Hazard Analysis:** The uncontrolled increase in duty cycle will cause the secondary-side output voltage to rise far beyond its nominal value. This creates two potential hazards:
        1.  **Energy Hazard:** The output voltage could become high enough to be a shock risk.
        2.  **Fire Hazard:** Components on the secondary side, not rated for this high voltage, could overheat and ignite.

### 4. Determine the Final Outcome
- Assess whether another safeguard in the system contains the hazard.
- **Example (continued):**
    - **Outcome Scenarios:**
        - **Scenario A (Bad Design):** If there is no other protection, the output voltage rises uncontrollably. **Outcome: FAIL.**
        - **Scenario B (Good Design):f** The circuit includes a Zener diode (D5) and a fuse (F2) on the secondary output. When the voltage rises above the Zener's breakdown voltage, the Zener conducts heavily, drawing a large current and causing fuse F2 to blow, disconnecting the load and stopping the hazardous condition. **Outcome: PASS.**

## Common Components and Faults to Analyze

| Component Type | Fault: Short-Circuit | Fault: Open-Circuit |
| :--- | :--- | :--- |
| **Resistor** | Unlikely for standard resistors. For fusible resistors, this is not a valid fault. | Resistor becomes infinite impedance. This is a very common failure mode. |
| **Capacitor** | Capacitor becomes a low-impedance link. Very common failure mode, especially for electrolytics. | Capacitor becomes an open circuit. Less common, but possible. |
| **Diode / LED** | Becomes a short in both directions. | Becomes an open circuit. |
| **Zener Diode** | Becomes a short. | Becomes an open circuit. |
| **Transistor (BJT)** | All three terminals short together, or just C-E shorts. Analyze both if plausible. | One or more junctions fail open. |
| **MOSFET** | D-S short is the most common failure. G-S short is also possible. | Junctions fail open. |
| **Optocoupler** | Transistor C-E shorts (most critical). LED shorts or opens. | Transistor C-E opens. LED opens or shorts. |
| **Transformer** | Winding shorts to adjacent winding or to the core. This is a critical failure for the isolation barrier. | A winding fails open. This usually results in a loss of function, which is generally safe. |
| **Fuse / Breaker** | **Not a valid fault.** By definition, these devices are designed to open. | Device opens prematurely (nuisance trip) or fails to open under overcurrent (critical failure). The SFA assumes it *should* open when presented with a fault current. |

## Anti-Patterns

- **Not Considering the "Why":** Don't just say "R5 shorts." Think about *why* it might fail. Is it stressed? Is it underrated? This adds depth to the analysis. For the purpose of SFA, we assume the fault happens, but the "why" can inform better design recommendations.
- **Assuming Ideal Protection:** Don't just assume a fuse will blow. Consider the I²t rating of the fuse versus the energy let-through from the fault. A short on a big capacitor can create a huge current spike that a slow-blow fuse might not react to quickly enough, causing other damage first. While this level of detail may be out of scope for a purely schematic-based analysis, it's good to note as a point for physical verification.
- **Stopping at the First Effect:** Trace the fault's consequences through the entire system. A shorted resistor might cause a voltage to drop, which causes a microcontroller to reset, which causes a relay to chatter... Keep going until you reach a stable, safe state or an undeniable hazard.
