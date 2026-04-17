# Generating the Report

> Reference for: `safety-circuit-appraisal`
> Load when: During Phase 4 to structure the final output.

## Overview

The final report is the deliverable of the safety appraisal. It must be clear, well-structured, and present all findings traceability. It should enable a human engineer to quickly understand the potential risks and the reasoning behind each conclusion.

The report should follow the `Output Template` defined in the main `SKILL.md`. This document provides additional detail on what to include in each section.

## Report Structure and Content

### 1. Header
- **Product Name:** The name of the product under evaluation.
- **Standard Used:** The safety standard cited for the analysis (e.g., IEC 62368-1).
- **Assumed Mains Voltage:** The mains voltage used for calculations and analysis (e.g., 230VAC, 120VAC).

### 2. Executive Summary
- **Purpose:** A 2-3 sentence summary of the key findings.
- **Content:** Start with a high-level statement (e.g., "The appraisal identified two critical non-compliances requiring mitigation."). Then, list the most severe findings directly.
- **Example:**
  > The appraisal identified two critical issues. The lack of secondary-side over-voltage protection could lead to a fire hazard in the event of a feedback failure. Additionally, the insulation class of transformer T1 could not be verified from the BOM and requires confirmation.

### 3. Safety-Critical Component List
- **Purpose:** To explicitly state which components were included in the scope of the analysis.
- **Content:** A bulleted list of component designators (R1, C1, T1) followed by a brief description of their function.
- **Example:**
  > - **F1:** Main input fuse.
  > - **T1:** Main isolation transformer.
  > - **OC1:** Optocoupler providing feedback across the isolation barrier.

### 4. Single-Fault Analysis (SFA) Table
- **Purpose:** This is the most important part of the report. It documents the core analysis.
- **Content:** A Markdown table with the following columns:
    - **Component:** The component designator.
    - **Fault Mode:** The simulated fault (e.g., "Short C-E", "Open").
    - **Predicted Effect:** The immediate electrical consequence of the fault.
    - **Hazard Analysis:** How the effect could lead to a hazard (fire, shock, energy).
    - **Outcome:** The final assessment:
        - **PASS:** A safeguard correctly mitigates the hazard, or no hazard is created.
        - **FAIL:** The fault leads to an uncontained hazard.
        - **INFO:** The fault is noteworthy but does not directly create a hazard (e.g., loss of function).

### 5. Component Rating Evaluation
- **Purpose:** To assess if the components specified in the BOM are appropriate for their role as safeguards.
- **Content:** A bulleted list evaluating critical component ratings.
- **Example:**
  > - **F1:** Rating appears appropriate for the declared max input current.
  > - **CX1:** Marked as a 275VAC X2-rated part, which is compliant for 230VAC mains.
  > - **T1:** **[INSUFFICIENT DATA]** Insulation class and working voltage rating could not be determined from BOM. Requires verification.

### 6. Recommendations
- **Purpose:** To provide clear, actionable steps to address the findings.
- **Content:** A numbered list of recommendations, prioritized by severity.
- **Prioritization Labels:**
    - **[CRITICAL]:** Must be fixed. Addresses a clear 'FAIL' in the SFA table that could cause serious injury or fire.
    - **[RECOMMENDED]:** Should be fixed. Addresses a weakness in the design that might become a hazard under corner-case conditions.
    - **[INFO]:** Requires investigation. Used for cases where data was insufficient to make a firm conclusion (e.g., verifying a component's rating).

### 7. Disclaimer
- **Purpose:** To manage liability and set correct expectations.
- **Content:** Always include the standard disclaimer at the very end of the report.
- **Text:**
  > `***Disclaimer:** This is an automated appraisal and not a substitute for a formal safety analysis and physical testing by a qualified engineer.*`

## Anti-Patterns
- **Ambiguous Language:** Be specific. Instead of "voltage increases," write "output voltage rises from 12V to an unregulated >40V."
- **Burying the Lead:** The most critical findings should be in the Executive Summary and at the top of the Recommendations list. Don't make the engineer hunt for them.
- **Mixing Findings and Recommendations:** The SFA table should state the *problem* (the failed outcome). The Recommendations section should state the *solution* (add a protection circuit). Don't mix them.
