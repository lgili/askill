# Introduction to Safety Appraisal

> Reference for: `safety-circuit-appraisal`
> Load when: At the beginning of the task to understand the goals.

## Overview

A Safety Circuit Appraisal is a systematic engineering analysis performed to identify potential hazards in electronic circuits. Its primary goal is to ensure that a product is safe for users and its environment, even when a single component fails.

This process is a cornerstone of designing products to meet safety standards like **IEC 62368-1** (Hazard-Based Safety Engineering), which has replaced older standards like IEC 60950-1 and IEC 60065.

The core of the appraisal is the **Single-Fault Condition (SFC)** analysis.

## Key Concepts

### 1. Hazard-Based Safety Engineering (HBSE)
The modern approach to safety. Instead of following prescriptive rules, HBSE focuses on:
- **Identifying** energy sources that could be hazardous (e.g., mains voltage, high-capacitance banks).
- **Characterizing** them (e.g., Class 1, 2, or 3 energy source).
- **Defining** a "safeguard" to protect users from that energy source.
- **Evaluating** the effectiveness of that safeguard, even under fault conditions.

### 2. Single-Fault Condition (SFC)
A single-fault condition is a state where **one, and only one,** safety-critical component fails. The safety appraisal process analyzes the circuit's behavior under such faults. The equipment must remain safe after the occurrence of any single fault.

- **"Safe" means:** No electric shock hazard, no fire hazard, and no other energy-related hazard is created.
- **Common Faults Simulated:**
    - **Short-circuit:** A component fails into a low-impedance state.
    - **Open-circuit:** A component fails into a high-impedance state.

### 3. Safeguards
A safeguard is a device or scheme intended to protect against a hazard. Standards define multiple levels:

- **Basic Safeguard:** The primary means of protection (e.g., the insulation on a wire).
- **Supplementary Safeguard:** A second, independent safeguard that takes over if the basic one fails (e.g., a plastic enclosure around the electronics).
- **Reinforced Safeguard:** A single safeguard that provides the equivalent protection of a Basic + Supplementary safeguard (e.g., the special triple-insulated winding wire in a transformer).

The SFA process is designed to prove that safeguards are effective.

## Anti-Patterns

- **Declaring a Product "Safe":** The output of this analysis is a report of potential non-compliances. Never state that a product is "safe" or "certified." That status can only be granted by official certification bodies after extensive physical testing.
- **Ignoring Component Ratings:** The analysis is meaningless if the components used are not rated for the application. A 100V capacitor used on a 230V mains input is a failure waiting to happen, even if the circuit topology *looks* correct.
- **Analyzing Non-Critical Circuits:** Do not waste time analyzing faults in circuits that pose no safety risk (e.g., a fault in a low-voltage logic circuit that is already protected by an isolation barrier). Focus on the components that act as safeguards.
- **Forgetting the Disclaimer:** Always end the report with a disclaimer stating that this is an automated analysis and requires verification by a qualified engineer.
