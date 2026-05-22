#!/usr/bin/env python3
"""
Emit a canonical extraction plan for a given component type.

The plan is a JSON document that downstream automation (Skillex
`datasheet-intelligence`, custom scripts, or the operator manually) can
walk through to extract every important parameter and curve from the
component's datasheet.

Usage:
    python plan_extraction.py --type mosfet --part IPB60R190P7 \\
        --manufacturer Infineon --output plan.json

    python plan_extraction.py --type igbt --print
    python plan_extraction.py --list-types
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from typing import List, Optional

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ParameterSpec:
    symbol: str
    unit: str
    test_condition: str
    expected_section: str
    priority: str  # "must-have" | "conditional"
    downstream_use: str


@dataclass
class CurveAxis:
    label: str
    unit: str
    scale: str  # "linear" | "log"


@dataclass
class CurveSpec:
    id: str
    x_axis: CurveAxis
    y_axis: CurveAxis
    expected_figure: str
    priority: str
    downstream_use: str


@dataclass
class ExtractionPlan:
    component: dict
    parameters: List[ParameterSpec] = field(default_factory=list)
    curves: List[CurveSpec] = field(default_factory=list)
    gaps_to_check: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Profile registry — keep tight; the deep references live in references/
# Markdown files. This Python view is the machine-readable summary.
# ---------------------------------------------------------------------------


def _mosfet_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "mosfet"})
    plan.parameters = [
        ParameterSpec("Vds(max)", "V", "DC, Tj=25C", "Absolute Maximum Ratings", "must-have", "voltage stress; safety-circuit-appraisal"),
        ParameterSpec("Id(cont)", "A", "Tc=25C and Tc=100C", "Absolute Maximum Ratings", "must-have", "current rating; power-electronics"),
        ParameterSpec("Vgs(max)", "V", "DC", "Absolute Maximum Ratings", "must-have", "gate-drive headroom; semiconductor-models"),
        ParameterSpec("Vgs(th)", "V", "Id=250uA, Vds=Vgs", "Electrical Characteristics - On-State", "must-have", "switching model; semiconductor-models"),
        ParameterSpec("Rds(on)", "Ohm", "Vgs=10V (Si) or 15-18V (SiC), Id=rated, Tj=25C", "Electrical Characteristics - On-State", "must-have", "conduction loss; semiconductor-models"),
        ParameterSpec("gfs", "S", "Vds=10V, Id=rated", "Electrical Characteristics - Dynamic", "must-have", "switching slope; semiconductor-models"),
        ParameterSpec("Qg", "nC", "Vgs=0V->rated, Vds=Vbus", "Switching Characteristics", "must-have", "driver sizing; semiconductor-models"),
        ParameterSpec("Qgs", "nC", "as Qg", "Switching Characteristics", "must-have", "switching model first plateau"),
        ParameterSpec("Qgd", "nC", "as Qg", "Switching Characteristics", "must-have", "Miller; dominates dv/dt"),
        ParameterSpec("Ciss", "pF", "Vds=0V or 25V, Vgs=0V, f=1MHz", "Dynamic Characteristics", "must-have", "gate drive bandwidth"),
        ParameterSpec("Coss", "pF", "Vds=25V or 100V, Vgs=0V, f=1MHz", "Dynamic Characteristics", "must-have", "ZVS energy; need curve too"),
        ParameterSpec("Crss", "pF", "Vds=25V, Vgs=0V, f=1MHz", "Dynamic Characteristics", "must-have", "dv/dt gate disturbance"),
        ParameterSpec("tr / tf", "ns", "Vbus=rated, Id=rated, Rg=spec", "Switching Characteristics", "must-have", "behavioral E_on/E_off"),
        ParameterSpec("td(on) / td(off)", "ns", "as tr/tf", "Switching Characteristics", "must-have", "dead-time sizing"),
        ParameterSpec("Eon / Eoff", "uJ", "Vbus, Id, Tj, Rg specified", "Switching Characteristics", "must-have", "switching loss preferred over t_r/t_f"),
        ParameterSpec("Vsd", "V", "Body diode, Isd=rated, Vgs=0V", "Body Diode", "must-have", "body diode loss in synchronous dead-time"),
        ParameterSpec("Qrr", "nC", "Isd=rated, di/dt=spec, Vbus=rated", "Body Diode", "conditional", "hard-switching bridge legs only"),
        ParameterSpec("trr", "ns", "as Qrr", "Body Diode", "conditional", "hard-switching bridge legs only"),
        ParameterSpec("Rth(JC)", "C/W", "Junction-to-case", "Thermal Characteristics", "must-have", "thermal sizing"),
        ParameterSpec("Tj(max)", "C", "-", "Absolute Maximum Ratings", "must-have", "worst-case derating"),
    ]
    plan.curves = [
        CurveSpec("id_vs_vds", CurveAxis("Vds", "V", "linear"), CurveAxis("Id", "A", "linear"), "Output Characteristic (Id vs Vds, parametric in Vgs)", "must-have", "saturation onset"),
        CurveSpec("id_vs_vgs", CurveAxis("Vgs", "V", "linear"), CurveAxis("Id", "A", "linear"), "Transfer Characteristic (Id vs Vgs at Vds=rated)", "must-have", "threshold; transconductance"),
        CurveSpec("rds_on_vs_id", CurveAxis("Id", "A", "linear"), CurveAxis("Rds(on)", "Ohm", "linear"), "Rds(on) vs Id at Vgs=rated", "must-have", "real conduction loss vs current"),
        CurveSpec("rds_on_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("Rds(on)/Rds(on@25C)", "-", "linear"), "Normalized Rds(on) vs Tj", "must-have", "conduction loss vs temperature"),
        CurveSpec("coss_vs_vds", CurveAxis("Vds", "V", "log"), CurveAxis("Coss", "pF", "log"), "Capacitance vs Vds (Coss curve)", "must-have", "ZVS energy integral"),
        CurveSpec("qg_vs_vgs", CurveAxis("Qg", "nC", "linear"), CurveAxis("Vgs", "V", "linear"), "Gate Charge Characteristic", "must-have", "Miller plateau; driver sizing"),
        CurveSpec("safe_operating_area", CurveAxis("Vds", "V", "log"), CurveAxis("Id", "A", "log"), "Safe Operating Area (SOA), parametric in pulse width", "must-have", "linear-mode / inrush safety"),
        CurveSpec("vsd_vs_isd", CurveAxis("Isd", "A", "linear"), CurveAxis("Vsd", "V", "linear"), "Body Diode Forward Characteristic", "must-have", "body diode conduction loss"),
        CurveSpec("eon_eoff_vs_id", CurveAxis("Id", "A", "linear"), CurveAxis("E_on/E_off", "uJ", "linear"), "Switching Energy vs Id at Vbus=rated", "must-have", "switching loss"),
    ]
    return plan


def _igbt_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "igbt"})
    plan.parameters = [
        ParameterSpec("Vces", "V", "Vge=0V, Ic=1mA", "Absolute Maximum Ratings", "must-have", "voltage rating"),
        ParameterSpec("Ic(nom)", "A", "Tc=25C and Tc=80-100C", "Absolute Maximum Ratings", "must-have", "current rating"),
        ParameterSpec("Vge(max)", "V", "DC", "Absolute Maximum Ratings", "must-have", "gate-drive headroom"),
        ParameterSpec("Vge(th)", "V", "Ic=1-4mA, Vce=Vge", "Electrical Characteristics", "must-have", "channel onset"),
        ParameterSpec("Vce(sat)", "V", "Ic=rated, Vge=15V, Tj=25C and 125C", "Electrical Characteristics", "must-have", "conduction loss; extract BOTH Tj values"),
        ParameterSpec("Qg", "nC", "Vce=Vbus, Vge=-spec->+15V", "Switching Characteristics", "must-have", "driver sizing"),
        ParameterSpec("Cies / Coes / Cres", "pF", "Vce=25V, Vge=0V, f=1MHz", "Dynamic Characteristics", "must-have", "switching"),
        ParameterSpec("td(on) / tr / td(off) / tf", "ns", "Ic=rated, Vbus, Rg=spec", "Switching Characteristics", "must-have", "switching fingerprint"),
        ParameterSpec("Eon / Eoff", "mJ", "Ic, Vbus, Rg, Tj=125C", "Switching Characteristics", "must-have", "switching loss; dominant"),
        ParameterSpec("Vf (freewheel diode)", "V", "If=rated, Tj=25C and 125C", "Diode Characteristics", "must-have", "freewheel conduction"),
        ParameterSpec("Qrr (freewheel diode)", "nC", "If=rated, di/dt, Vbus, Tj", "Diode Characteristics", "must-have", "recovery loss"),
        ParameterSpec("Rth(JC) IGBT die", "C/W", "-", "Thermal Characteristics", "must-have", "thermal"),
        ParameterSpec("Rth(JC) diode die", "C/W", "-", "Thermal Characteristics", "must-have", "module-specific"),
        ParameterSpec("Tj(max)", "C", "-", "Absolute Maximum Ratings", "must-have", "worst-case"),
    ]
    plan.curves = [
        CurveSpec("ic_vs_vce_output", CurveAxis("Vce", "V", "linear"), CurveAxis("Ic", "A", "linear"), "Output Characteristic (Ic vs Vce, parametric in Vge)", "must-have", "saturation"),
        CurveSpec("vce_sat_vs_ic", CurveAxis("Ic", "A", "linear"), CurveAxis("Vce(sat)", "V", "linear"), "Vce(sat) vs Ic at Vge=15V (parametric in Tj=25C and 125C)", "must-have", "dominant conduction-loss curve"),
        CurveSpec("transfer_vge_to_ic", CurveAxis("Vge", "V", "linear"), CurveAxis("Ic", "A", "linear"), "Transfer Characteristic", "must-have", "threshold; transconductance"),
        CurveSpec("eon_eoff_vs_ic", CurveAxis("Ic", "A", "linear"), CurveAxis("E_on/E_off", "mJ", "linear"), "Switching Energy vs Ic at Vbus, Tj=125C", "must-have", "switching loss per pulse"),
        CurveSpec("vf_vs_if_diode", CurveAxis("If", "A", "linear"), CurveAxis("Vf", "V", "linear"), "Freewheel Diode Vf vs If, parametric in Tj", "must-have", "freewheel conduction"),
        CurveSpec("qrr_vs_di_dt", CurveAxis("di/dt", "A/us", "linear"), CurveAxis("Qrr", "nC", "linear"), "Freewheel Diode Qrr vs di/dt", "conditional", "hard-switching only"),
        CurveSpec("coes_vs_vce", CurveAxis("Vce", "V", "log"), CurveAxis("Coes", "pF", "log"), "Output Capacitance vs Vce", "conditional", "dv/dt or ZVS only"),
        CurveSpec("safe_operating_area_FBSOA_RBSOA", CurveAxis("Vce", "V", "log"), CurveAxis("Ic", "A", "log"), "FBSOA / RBSOA", "must-have", "IGBT-specific safe area"),
        CurveSpec("zth_vs_pulse_width", CurveAxis("t", "s", "log"), CurveAxis("Zth(JC)", "C/W", "log"), "Transient Thermal Impedance Zth vs pulse width, parametric in duty", "must-have", "thermal transient"),
    ]
    return plan


def _diode_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "diode"})
    plan.parameters = [
        ParameterSpec("Vrrm", "V", "DC", "Absolute Maximum Ratings", "must-have", "reverse blocking"),
        ParameterSpec("If(avg)", "A", "Tc=spec", "Absolute Maximum Ratings", "must-have", "DC current rating"),
        ParameterSpec("Ifsm", "A", "8.3 ms single half-cycle", "Absolute Maximum Ratings", "must-have", "surge"),
        ParameterSpec("Vf", "V", "If=rated, Tj=25C and 125C", "Electrical Characteristics", "must-have", "conduction loss"),
        ParameterSpec("Ir", "uA-mA", "Vr=rated, Tj=25C and 125C", "Electrical Characteristics", "must-have", "leakage; matters for thermal"),
        ParameterSpec("Cj", "pF", "Vr=spec, f=1MHz", "Dynamic Characteristics", "must-have", "junction capacitance"),
        ParameterSpec("trr", "ns", "Si only - If, di/dt, Tj=25C and 125C", "Dynamic Characteristics", "conditional", "Si PN/fast/ultrafast only"),
        ParameterSpec("Qrr", "nC", "Si only - same as trr", "Dynamic Characteristics", "conditional", "recovery loss"),
        ParameterSpec("Rth(JC)", "C/W", "-", "Thermal Characteristics", "must-have", "thermal"),
        ParameterSpec("Tj(max)", "C", "-", "Absolute Maximum Ratings", "must-have", "worst-case"),
    ]
    plan.curves = [
        CurveSpec("if_vs_vf_forward", CurveAxis("Vf", "V", "linear"), CurveAxis("If", "A", "linear"), "Forward Characteristic (If vs Vf, parametric in Tj)", "must-have", "most-used diode curve"),
        CurveSpec("vf_vs_tj_at_If_rated", CurveAxis("Tj", "C", "linear"), CurveAxis("Vf", "V", "linear"), "Vf vs Tj at If=rated", "must-have", "forward drop drift"),
        CurveSpec("ir_vs_vr", CurveAxis("Vr", "V", "linear"), CurveAxis("Ir", "uA", "log"), "Reverse Leakage Current vs Vr, parametric in Tj", "must-have", "leakage map"),
        CurveSpec("cj_vs_vr", CurveAxis("Vr", "V", "log"), CurveAxis("Cj", "pF", "log"), "Junction Capacitance vs Vr", "must-have", "switching-node ringing"),
        CurveSpec("if_derating_vs_tc", CurveAxis("Tc", "C", "linear"), CurveAxis("If(avg)", "A", "linear"), "Current Derating vs Case Temperature", "must-have", "continuous-current vs Tc"),
        CurveSpec("qrr_vs_if", CurveAxis("If", "A", "linear"), CurveAxis("Qrr", "nC", "linear"), "Qrr vs If (Si only)", "conditional", "PN/fast/ultrafast only"),
        CurveSpec("zth_vs_pulse_width", CurveAxis("t", "s", "log"), CurveAxis("Zth", "C/W", "log"), "Transient Thermal Impedance", "must-have", "single-pulse and repetitive"),
    ]
    return plan


def _opamp_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "opamp"})
    plan.parameters = [
        ParameterSpec("Vos", "uV-mV", "Vcm=Vs/2, Tj=25C", "DC Characteristics", "must-have", "DC accuracy"),
        ParameterSpec("Vos drift", "uV/C", "Tj range", "DC Characteristics", "must-have", "drift over Tj"),
        ParameterSpec("IB", "nA-pA", "per input", "DC Characteristics", "must-have", "source-impedance constraint"),
        ParameterSpec("IOS", "nA-pA", "-", "DC Characteristics", "must-have", "bias mismatch"),
        ParameterSpec("CMRR", "dB", "Vcm sweep", "DC Characteristics", "must-have", "common-mode rejection"),
        ParameterSpec("PSRR", "dB", "Vs sweep", "DC Characteristics", "must-have", "supply ripple rejection"),
        ParameterSpec("AOL", "dB or V/mV", "DC, Rload=spec", "DC Characteristics", "must-have", "closed-loop accuracy ceiling"),
        ParameterSpec("Vcm", "V", "input common-mode range", "DC Characteristics", "must-have", "input swing"),
        ParameterSpec("Vo(swing)", "V from rail", "Rload=spec", "DC Characteristics", "must-have", "output swing"),
        ParameterSpec("Iout(short)", "mA", "Vout shorted", "DC Characteristics", "must-have", "drive capability"),
        ParameterSpec("Is", "uA-mA", "per amplifier", "DC Characteristics", "must-have", "quiescent current"),
        ParameterSpec("GBW", "MHz", "Av=unity, Rload=spec", "AC Characteristics", "must-have", "bandwidth"),
        ParameterSpec("SR", "V/us", "Large-signal step", "AC Characteristics", "must-have", "large-signal bandwidth"),
        ParameterSpec("en", "nV/sqrt(Hz)", "f=1 kHz", "Noise", "must-have", "voltage noise density"),
        ParameterSpec("in", "fA-pA/sqrt(Hz)", "f=1 kHz", "Noise", "must-have", "current noise density"),
        ParameterSpec("phi_m", "deg", "Cload=spec", "AC Characteristics", "must-have", "phase margin"),
    ]
    plan.curves = [
        CurveSpec("aol_phase_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("|A| and phase", "dB / deg", "linear"), "Open-Loop Gain and Phase vs Frequency (Bode)", "must-have", "stability analysis"),
        CurveSpec("cmrr_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("CMRR", "dB", "linear"), "CMRR vs Frequency", "must-have", "HF rejection"),
        CurveSpec("psrr_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("PSRR+/PSRR-", "dB", "linear"), "PSRR vs Frequency", "must-have", "switching-supply noise rejection"),
        CurveSpec("vn_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("en", "nV/sqrt(Hz)", "log"), "Voltage Noise Density vs Frequency", "must-have", "1/f corner; noise floor"),
        CurveSpec("vos_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("Vos", "uV", "linear"), "Input Offset Voltage vs Temperature", "must-have", "drift"),
        CurveSpec("output_swing_vs_iload", CurveAxis("Iload", "mA", "linear"), CurveAxis("V from rail", "V", "linear"), "Output Swing vs Iload", "must-have", "rail-to-rail headroom"),
    ]
    return plan


def _bjt_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "bjt"})
    plan.parameters = [
        ParameterSpec("Vceo", "V", "Ib=0, Tj=25C", "Absolute Maximum Ratings", "must-have", "open-base Vce limit"),
        ParameterSpec("Vcer/Vces", "V", "base shorted / Rbe", "Absolute Maximum Ratings", "must-have", "stricter Vce ratings"),
        ParameterSpec("Vebo", "V", "DC, Ic=0", "Absolute Maximum Ratings", "must-have", "EB reverse rating"),
        ParameterSpec("Ic(cont)", "A", "DC", "Absolute Maximum Ratings", "must-have", "current"),
        ParameterSpec("Ptot", "W", "Tc=25C", "Absolute Maximum Ratings", "must-have", "power dissipation"),
        ParameterSpec("hFE", "-", "Ic spread, Vce=spec", "Electrical Characteristics", "must-have", "DC gain (always a range)"),
        ParameterSpec("Vbe(on)", "V", "Ic=rated", "Electrical Characteristics", "must-have", "base drive design"),
        ParameterSpec("Vce(sat)", "V", "Ic=rated, Ib=Ic/10", "Electrical Characteristics", "must-have", "switch-mode conduction"),
        ParameterSpec("ft", "MHz", "Vce=10V, Ic=spec", "Dynamic Characteristics", "must-have", "switching speed proxy"),
        ParameterSpec("Cob", "pF", "Vcb=spec, f=1MHz", "Dynamic Characteristics", "must-have", "output capacitance"),
        ParameterSpec("td/tr/ts/tf", "ns", "Ic=rated, Ib=spec", "Switching Characteristics", "must-have", "switching fingerprint"),
        ParameterSpec("Rth(JC)", "C/W", "-", "Thermal", "must-have", "power BJTs only"),
        ParameterSpec("Tj(max)", "C", "-", "Absolute Maximum Ratings", "must-have", "worst-case"),
    ]
    plan.curves = [
        CurveSpec("hfe_vs_ic", CurveAxis("Ic", "A", "log"), CurveAxis("hFE", "-", "linear"), "hFE vs Ic (bell curve)", "must-have", "current-gain shape"),
        CurveSpec("vce_sat_vs_ic", CurveAxis("Ic", "A", "log"), CurveAxis("Vce(sat)", "V", "linear"), "Vce(sat) vs Ic, parametric in Ib", "must-have", "conduction loss"),
        CurveSpec("vbe_vs_ic", CurveAxis("Ic", "A", "log"), CurveAxis("Vbe", "V", "linear"), "Vbe vs Ic", "must-have", "base drive sizing"),
        CurveSpec("safe_operating_area", CurveAxis("Vce", "V", "log"), CurveAxis("Ic", "A", "log"), "FBSOA / RBSOA, parametric in pulse width", "must-have", "secondary breakdown - critical"),
        CurveSpec("hfe_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("hFE", "-", "linear"), "hFE vs Tj", "must-have", "Si BJT has +tempco on hFE"),
        CurveSpec("cob_vs_vcb", CurveAxis("Vcb", "V", "log"), CurveAxis("Cob", "pF", "log"), "Output Capacitance vs Vcb", "must-have", "output capacitance"),
    ]
    return plan


def _ldo_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "ldo"})
    plan.parameters = [
        ParameterSpec("Vin range", "V", "-", "Recommended Operating Conditions", "must-have", "input range"),
        ParameterSpec("Vout (or Vref)", "V", "Iout=spec, Tj=25C", "Electrical Characteristics", "must-have", "output accuracy"),
        ParameterSpec("Vout accuracy", "%", "Tj and Iout sweep", "Electrical Characteristics", "must-have", "worst-case Vout window"),
        ParameterSpec("Iout(max)", "A-mA", "Tc=spec", "Electrical Characteristics", "must-have", "current rating"),
        ParameterSpec("Vdo (dropout)", "mV-V", "Iout=rated, Tj=25C", "Electrical Characteristics", "must-have", "headroom"),
        ParameterSpec("Iq", "uA", "No load, Vin=typ", "Electrical Characteristics", "must-have", "battery designs"),
        ParameterSpec("PSRR", "dB", "f=1kHz and 10kHz-1MHz", "Electrical Characteristics", "must-have", "supply rejection"),
        ParameterSpec("Line reg", "mV/V or %/V", "Vin sweep, Iout=spec", "Electrical Characteristics", "must-have", "DC supply sensitivity"),
        ParameterSpec("Load reg", "mV/A or %/A", "Iout sweep, Vin=spec", "Electrical Characteristics", "must-have", "DC load sensitivity"),
        ParameterSpec("Cout range", "uF", "Stable range", "Application Information", "must-have", "stability window"),
        ParameterSpec("ESR range", "mOhm", "If specified", "Application Information", "conditional", "old LDOs sensitive to ESR"),
    ]
    plan.curves = [
        CurveSpec("vdo_vs_iout_vs_tj", CurveAxis("Iout", "A", "linear"), CurveAxis("Vdo", "mV", "linear"), "Dropout Voltage vs Iout, parametric in Tj", "must-have", "headroom budget"),
        CurveSpec("psrr_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("PSRR", "dB", "linear"), "PSRR vs Frequency, parametric in Iout", "must-have", "rejection bandwidth"),
        CurveSpec("iq_vs_iout", CurveAxis("Iout", "A", "linear"), CurveAxis("Iq", "uA", "linear"), "Iq vs Iout", "conditional", "low-Iq LDOs only"),
        CurveSpec("load_step_response", CurveAxis("t", "us", "linear"), CurveAxis("Vout deviation", "mV", "linear"), "Load Transient Response", "must-have", "transient"),
        CurveSpec("line_step_response", CurveAxis("t", "us", "linear"), CurveAxis("Vout deviation", "mV", "linear"), "Line Transient Response", "must-have", "transient rejection"),
    ]
    return plan


def _switcher_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "switching-regulator"})
    plan.parameters = [
        ParameterSpec("Vin range", "V", "-", "Recommended Operating Conditions", "must-have", "input range"),
        ParameterSpec("Vout range", "V", "Adjustable", "Electrical Characteristics", "must-have", "output range"),
        ParameterSpec("Iout(max)", "A", "Tc=spec", "Electrical Characteristics", "must-have", "current rating"),
        ParameterSpec("Vfb", "V", "Tj=25C", "Electrical Characteristics", "must-have", "feedback reference"),
        ParameterSpec("Fsw", "kHz-MHz", "Default or programmable", "Electrical Characteristics", "must-have", "switching frequency"),
        ParameterSpec("Rds(on) HS", "mOhm", "Integrated FET", "Electrical Characteristics", "must-have", "conduction loss"),
        ParameterSpec("Rds(on) LS", "mOhm", "Integrated FET", "Electrical Characteristics", "must-have", "conduction loss"),
        ParameterSpec("Iq", "uA-mA", "No load", "Electrical Characteristics", "must-have", "light-load eff"),
        ParameterSpec("Vuvlo rise/fall", "V", "-", "Electrical Characteristics", "must-have", "UVLO"),
        ParameterSpec("Soft-start time", "ms", "-", "Electrical Characteristics", "must-have", "inrush limiting"),
        ParameterSpec("Compensation type", "type-II/III/internal", "-", "Application Information", "must-have", "loop design"),
    ]
    plan.curves = [
        CurveSpec("efficiency_vs_iout", CurveAxis("Iout", "A", "linear"), CurveAxis("eta", "%", "linear"), "Efficiency vs Iout, parametric in Vin", "must-have", "most-asked curve"),
        CurveSpec("efficiency_vs_vout", CurveAxis("Vout", "V", "linear"), CurveAxis("eta", "%", "linear"), "Efficiency vs Vout, at fixed Vin", "conditional", "adjustable Vout only"),
        CurveSpec("fsw_vs_iout", CurveAxis("Iout", "A", "linear"), CurveAxis("Fsw", "kHz", "linear"), "Switching Frequency vs Iout", "conditional", "parts with PFM at light load"),
        CurveSpec("rds_on_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("Rds(on)", "mOhm", "linear"), "Rds(on) vs Tj (HS and LS)", "must-have", "thermal-drift"),
        CurveSpec("bode_plot_loop_response", CurveAxis("f", "Hz", "log"), CurveAxis("|T| and phase", "dB / deg", "linear"), "Loop Bode Plot (when published)", "conditional", "loop stability"),
        CurveSpec("load_step_response", CurveAxis("t", "us", "linear"), CurveAxis("Vout / Iout", "mV / A", "linear"), "Load Transient Response", "must-have", "transient"),
    ]
    return plan


def _capacitor_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "capacitor"})
    plan.parameters = [
        ParameterSpec("C (nominal)", "uF-pF", "1 kHz, 25 C", "Electrical Characteristics", "must-have", "nominal value"),
        ParameterSpec("Vrated", "V (DC)", "-", "Absolute Maximum Ratings", "must-have", "voltage rating"),
        ParameterSpec("Tolerance", "%", "-", "Electrical Characteristics", "must-have", "initial accuracy"),
        ParameterSpec("ESR", "mOhm", "100 Hz / 100 kHz", "Electrical Characteristics", "must-have", "switching loss; aluminum life"),
        ParameterSpec("Irms", "A", "f, Tc=spec", "Electrical Characteristics", "must-have", "heating limit"),
        ParameterSpec("Leakage current", "uA", "After 1 min at Vrated, Tj", "Electrical Characteristics", "conditional", "standby current"),
        ParameterSpec("ESL", "nH", "-", "Electrical Characteristics", "conditional", "self-resonant frequency"),
        ParameterSpec("Lifetime (electrolytic)", "h @ Tc, V, ripple", "-", "Reliability", "conditional", "electrolytic only"),
    ]
    plan.curves = [
        CurveSpec("c_vs_vdc", CurveAxis("Vdc", "V", "linear"), CurveAxis("C/Cnom", "-", "linear"), "Capacitance vs DC Bias (Class II MLCC only)", "conditional", "MLCC Class II only"),
        CurveSpec("c_vs_t", CurveAxis("T", "C", "linear"), CurveAxis("C/Cnom", "-", "linear"), "Capacitance vs Temperature", "must-have", "tempco"),
        CurveSpec("esr_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("ESR", "mOhm", "log"), "ESR vs Frequency", "must-have", "switching converters at Fsw"),
        CurveSpec("impedance_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("|Z|", "Ohm", "log"), "Impedance vs Frequency", "must-have", "self-resonance"),
        CurveSpec("irms_derating_vs_tc", CurveAxis("Tc", "C", "linear"), CurveAxis("Irms", "A", "linear"), "Ripple-Current Derating vs Tc", "must-have", "high-temp derating"),
    ]
    return plan


def _inductor_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "inductor"})
    plan.parameters = [
        ParameterSpec("L (nominal)", "uH-nH", "f=100kHz or 1MHz, Idc=0", "Electrical Characteristics", "must-have", "nominal inductance"),
        ParameterSpec("Isat", "A", "Tj=25C; ALWAYS note L-drop threshold (10%/20%/30%)", "Electrical Characteristics", "must-have", "saturation onset"),
        ParameterSpec("Irms", "A", "delta-T=spec (40 C rise typ)", "Electrical Characteristics", "must-have", "heating limit"),
        ParameterSpec("DCR", "mOhm", "Tj=25C", "Electrical Characteristics", "must-have", "conduction loss"),
        ParameterSpec("SRF", "MHz", "Impedance peak", "Electrical Characteristics", "must-have", "above SRF behaves as a cap"),
        ParameterSpec("Tempco of L", "ppm/C or %", "-", "Electrical Characteristics", "conditional", "resonant designs"),
    ]
    plan.curves = [
        CurveSpec("l_vs_idc", CurveAxis("Idc", "A", "linear"), CurveAxis("L", "uH", "linear"), "L vs Idc (saturation curve)", "must-have", "saturation; the chosen Isat is one point"),
        CurveSpec("l_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("L", "uH", "linear"), "L vs Frequency", "must-have", "drops near SRF"),
        CurveSpec("dcr_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("DCR", "mOhm", "linear"), "DCR vs Tj", "must-have", "copper +0.39%/C"),
        CurveSpec("temperature_rise_vs_idc", CurveAxis("Idc", "A", "linear"), CurveAxis("delta-T", "C", "linear"), "Temperature Rise vs Idc", "must-have", "thermal current rating"),
        CurveSpec("impedance_vs_frequency", CurveAxis("f", "Hz", "log"), CurveAxis("|Z|", "Ohm", "log"), "Impedance vs Frequency", "must-have", "EMC filter design"),
    ]
    return plan


def _resistor_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "resistor"})
    plan.parameters = [
        ParameterSpec("R (nominal)", "Ohm", "-", "Electrical Characteristics", "must-have", "nominal value"),
        ParameterSpec("Tolerance", "%", "-", "Electrical Characteristics", "must-have", "initial accuracy"),
        ParameterSpec("TCR", "ppm/C", "-", "Electrical Characteristics", "must-have", "drift"),
        ParameterSpec("Pmax", "W", "Ta=spec", "Electrical Characteristics", "must-have", "power"),
        ParameterSpec("Vmax (continuous)", "V", "-", "Electrical Characteristics", "conditional", "HV parts only"),
        ParameterSpec("Vmax (overload)", "V", "-", "Electrical Characteristics", "conditional", "HV parts only"),
        ParameterSpec("TCR over self-heating", "ppm/C", "Shunt only", "Electrical Characteristics", "conditional", "current-sense shunts"),
        ParameterSpec("Long-term drift", "ppm / 1000h", "Shunt / precision only", "Reliability", "conditional", "precision parts"),
    ]
    plan.curves = [
        CurveSpec("derating_p_vs_tc", CurveAxis("Tc", "C", "linear"), CurveAxis("P", "W", "linear"), "Power Derating vs Case Temperature", "must-have", "high-power resistors"),
        CurveSpec("pulse_withstand", CurveAxis("t pulse", "s", "log"), CurveAxis("P pulse", "W", "log"), "Pulse Withstand Curve", "conditional", "inrush / snubber apps"),
    ]
    return plan


def _gate_driver_plan() -> ExtractionPlan:
    plan = ExtractionPlan(component={"class": "gate-driver"})
    plan.parameters = [
        ParameterSpec("Vcc range", "V", "-", "Recommended Operating", "must-have", "driver supply"),
        ParameterSpec("Iout(peak source/sink)", "A", "-", "Electrical Characteristics", "must-have", "switching-time floor"),
        ParameterSpec("tpd(LH/HL)", "ns", "-", "Switching Characteristics", "must-have", "propagation delay"),
        ParameterSpec("tr / tf (Vout)", "ns", "Cload=spec", "Switching Characteristics", "must-have", "output transition"),
        ParameterSpec("UVLO", "V", "-", "Electrical Characteristics", "must-have", "under-voltage lockout"),
        ParameterSpec("Bootstrap V drop", "V", "If applicable", "Electrical Characteristics", "conditional", "high-side rail headroom"),
        ParameterSpec("dv/dt (CMTI)", "V/ns", "-", "Electrical Characteristics", "must-have", "critical for high-side fast switching"),
        ParameterSpec("Isolation rating", "Vrms / kV", "Isolated drivers only", "Insulation Characteristics", "conditional", "isolated parts"),
        ParameterSpec("Working voltage", "V", "Isolated drivers only", "Insulation Characteristics", "conditional", "long-term insulation"),
        ParameterSpec("Propagation delay matching", "ns", "Half-bridge only", "Switching Characteristics", "conditional", "half-bridge"),
    ]
    plan.curves = [
        CurveSpec("iout_peak_vs_vout", CurveAxis("Vout", "V", "linear"), CurveAxis("Iout(peak)", "A", "linear"), "Peak Drive Current vs Vout", "conditional", "varies through swing"),
        CurveSpec("tpd_vs_tj", CurveAxis("Tj", "C", "linear"), CurveAxis("tpd", "ns", "linear"), "Propagation Delay vs Tj", "must-have", "drift"),
        CurveSpec("iq_vs_fsw", CurveAxis("Fsw", "Hz", "log"), CurveAxis("Iq", "mA", "linear"), "Driver Supply Current vs Switching Frequency", "must-have", "thermal at high Fsw"),
    ]
    return plan


PROFILES = {
    "mosfet": _mosfet_plan,
    "igbt": _igbt_plan,
    "diode": _diode_plan,
    "opamp": _opamp_plan,
    "comparator": _opamp_plan,  # subset, see profiles-opamp.md
    "bjt": _bjt_plan,
    "ldo": _ldo_plan,
    "switching-regulator": _switcher_plan,
    "switcher": _switcher_plan,
    "capacitor": _capacitor_plan,
    "inductor": _inductor_plan,
    "resistor": _resistor_plan,
    "gate-driver": _gate_driver_plan,
}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_plan(
    component_type: str,
    part_number: Optional[str],
    manufacturer: Optional[str],
    subclass: Optional[str],
) -> ExtractionPlan:
    key = component_type.lower()
    if key not in PROFILES:
        raise ValueError(
            f"Unknown component type: {component_type}. "
            f"Known: {', '.join(sorted(PROFILES))}"
        )
    plan = PROFILES[key]()
    if part_number:
        plan.component["part_number"] = part_number
    if manufacturer:
        plan.component["manufacturer"] = manufacturer
    if subclass:
        plan.component["subclass"] = subclass
    return plan


def plan_to_json(plan: ExtractionPlan) -> str:
    return json.dumps(asdict(plan), indent=2)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Emit an extraction plan for a component type.")
    parser.add_argument("--type", "-t", help="Component class (e.g. mosfet, igbt, diode, opamp, ldo, capacitor, inductor)")
    parser.add_argument("--part", "-p", default=None, help="Part number (e.g. IPB60R190P7)")
    parser.add_argument("--manufacturer", "-m", default=None, help="Manufacturer (e.g. Infineon)")
    parser.add_argument("--subclass", default=None, help="Subclass tag (e.g. si-superjunction, schottky-sic, mlcc)")
    parser.add_argument("--output", "-o", default=None, help="Output JSON file path (default: stdout)")
    parser.add_argument("--print", action="store_true", help="Print to stdout even when --output is given")
    parser.add_argument("--list-types", action="store_true", help="List known component types and exit")
    args = parser.parse_args(argv)

    if args.list_types:
        for key in sorted(PROFILES):
            print(key)
        return 0

    if not args.type:
        parser.error("--type is required (or use --list-types)")

    try:
        plan = build_plan(args.type, args.part, args.manufacturer, args.subclass)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    payload = plan_to_json(plan)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(payload)
            fh.write("\n")
        print(f"Wrote extraction plan ({len(plan.parameters)} params, {len(plan.curves)} curves) to {args.output}", file=sys.stderr)
        if args.print:
            print(payload)
    else:
        print(payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
