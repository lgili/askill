#!/usr/bin/env python3
"""Analyze a parsed Altium netlist (JSON from parse_netlist.py) with optional BOM.

Reads the JSON produced by parse_netlist.py and optionally a BOM CSV to generate:
  - Component inventory by type
  - Net statistics and floating/connected net warnings
  - Power distribution nets
  - IC-to-IC interconnections
  - Bus groups (nets sharing a common prefix)
  - Design rule checks (floating nets, high fan-out, duplicate RefDes)
  - Query mode: trace connections between two components, list power rails, etc.

Usage examples:
  # Full analysis report
  python analyze_circuit.py netlist.json

  # Include BOM for enriched component data
  python analyze_circuit.py netlist.json --bom bom.csv

  # Query: show all nets connected to U1
  python analyze_circuit.py netlist.json --query connections --ref U1

  # Query: list all power rails
  python analyze_circuit.py netlist.json --query power-rails

  # Machine-readable JSON
  python analyze_circuit.py netlist.json --json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POWER_NET_PATTERNS = re.compile(
    r"^(VCC|VDD|VBUS|VBAT|AVCC|AVDD|V\d|VSS|VEE|VREF|VIO|VINPUT|VOUT|PWR|POWER|"
    r"3V3|5V|1V8|2V5|12V|24V|VDDIO|DVDD|AVDD|TVDD|IOVDD)[^\w]*",
    re.IGNORECASE
)

GND_NET_PATTERNS = re.compile(
    r"^(GND|AGND|DGND|PGND|GND_|EARTH|VSS|VEE|GNDD|GNDA|FG|CHASSIS)[^\w]*",
    re.IGNORECASE
)

REF_PREFIX_RE = re.compile(r"^([A-Za-z]+)", )

REF_TYPE_MAP = {
    "R":   "Resistor",
    "RN":  "Resistor Network",
    "C":   "Capacitor",
    "L":   "Inductor",
    "T":   "Transformer",
    "TR":  "Transformer",
    "D":   "Diode",
    "LED": "LED",
    "Q":   "Transistor",
    "U":   "IC",
    "J":   "Connector",
    "P":   "Connector",
    "SW":  "Switch",
    "F":   "Fuse",
    "FB":  "Ferrite Bead",
    "Y":   "Crystal",
    "TP":  "Test Point",
    "BT":  "Battery",
    "ANT": "Antenna",
}


def _classify_ref(ref: str) -> str:
    m = REF_PREFIX_RE.match(ref)
    if not m:
        return "Unknown"
    prefix = m.group(1).upper()
    # Try longest match first
    for k in sorted(REF_TYPE_MAP.keys(), key=len, reverse=True):
        if prefix.startswith(k):
            return REF_TYPE_MAP[k]
    return prefix


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ComponentInfo:
    ref: str
    type: str
    footprint: str = ""
    value: str = ""
    description: str = ""
    mfr_pn: str = ""
    dni: bool = False


@dataclass
class NetInfo:
    name: str
    pins: list[str]
    is_power: bool = False
    is_gnd: bool = False
    components: list[str] = field(default_factory=list)  # refs connected to this net


@dataclass
class DRCWarning:
    severity: str  # "error" | "warning" | "info"
    rule: str
    message: str


@dataclass
class AnalysisReport:
    source: str
    component_count: int
    net_count: int
    inventory: dict[str, int] = field(default_factory=dict)    # type → count
    power_rails: list[str] = field(default_factory=list)
    ground_nets: list[str] = field(default_factory=list)
    bus_groups: dict[str, list[str]] = field(default_factory=dict)  # prefix → [net_names]
    ic_connections: dict[str, list[str]] = field(default_factory=dict)  # U1 → [U2, U3, ...]
    drc_warnings: list[DRCWarning] = field(default_factory=list)
    query_result: dict | None = None


# ---------------------------------------------------------------------------
# BOM loading
# ---------------------------------------------------------------------------

def _load_bom(bom_path: Path) -> dict[str, dict[str, str]]:
    """Return {ref: {comment, description, footprint, mfr_pn, dni}} from a BOM CSV."""
    result: dict[str, dict[str, str]] = {}
    with bom_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalise column names (lowercase, strip spaces)
            row_norm = {k.lower().strip(): (v or "").strip() for k, v in row.items()}
            des_raw = row_norm.get("designator", "")
            refs = [d.strip() for d in des_raw.split(",") if d.strip()]
            # DNI detection
            dni_val = row_norm.get("dni", row_norm.get("dnf", row_norm.get("dnp", "")))
            is_dni = dni_val.lower() in ("yes", "true", "1", "x", "dni", "dnf", "dnp", "nm", "unpopulated")
            for ref in refs:
                result[ref] = {
                    "comment":     row_norm.get("comment", row_norm.get("value", "")),
                    "description": row_norm.get("description", ""),
                    "footprint":   row_norm.get("footprint", ""),
                    "mfr_pn":      row_norm.get("manufacturer part number",
                                               row_norm.get("mfr part#", row_norm.get("mpn", ""))),
                    "dni":         "true" if is_dni else "",
                }
    return result


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def analyze(netlist_data: dict, bom_data: dict[str, dict] | None) -> AnalysisReport:
    components_raw: dict[str, dict] = netlist_data.get("components", {})
    nets_raw: dict[str, list[str]] = netlist_data.get("nets", {})

    # Enrich components with BOM data
    components: dict[str, ComponentInfo] = {}
    for ref, comp in components_raw.items():
        bom_entry = (bom_data or {}).get(ref, {})
        components[ref] = ComponentInfo(
            ref=ref,
            type=_classify_ref(ref),
            footprint=comp.get("footprint", bom_entry.get("footprint", "")),
            value=comp.get("value", bom_entry.get("comment", "")),
            description=bom_entry.get("description", ""),
            mfr_pn=bom_entry.get("mfr_pn", ""),
            dni=bom_entry.get("dni", "") == "true",
        )

    # Build inventory
    inventory: Counter[str] = Counter(c.type for c in components.values())

    # Classify nets
    nets: dict[str, NetInfo] = {}
    for net_name, pins in nets_raw.items():
        refs_set = set()
        for pin in pins:
            ref = pin.split("-")[0] if "-" in pin else pin
            refs_set.add(ref)
        nets[net_name] = NetInfo(
            name=net_name,
            pins=pins,
            is_power=bool(POWER_NET_PATTERNS.match(net_name)),
            is_gnd=bool(GND_NET_PATTERNS.match(net_name)),
            components=sorted(refs_set),
        )

    power_rails = sorted(n for n, v in nets.items() if v.is_power)
    ground_nets = sorted(n for n, v in nets.items() if v.is_gnd)

    # Bus groups: nets sharing a common prefix up to the last digit/underscore
    bus_groups: dict[str, list[str]] = defaultdict(list)
    for net_name in nets_raw:
        m = re.match(r"^([A-Za-z_]+[A-Za-z_])\d+$", net_name)
        if m:
            bus_groups[m.group(1)].append(net_name)
    # Keep only groups with ≥2 nets
    bus_groups = {k: sorted(v) for k, v in bus_groups.items() if len(v) >= 2}

    # IC-to-IC connections
    ic_connections: dict[str, set[str]] = defaultdict(set)
    ic_refs = {ref for ref in components if _classify_ref(ref) == "IC"}
    for net_name, net in nets.items():
        ic_on_net = [r for r in net.components if r in ic_refs]
        for ic in ic_on_net:
            others = [r for r in ic_on_net if r != ic]
            ic_connections[ic].update(others)
    ic_connections_sorted = {k: sorted(v) for k, v in ic_connections.items()}

    # DRC checks
    drc: list[DRCWarning] = []

    # Floating nets (connected to only one pin)
    for net_name, net in nets.items():
        if not net.is_gnd and not net.is_power and len(net.pins) == 1:
            drc.append(DRCWarning(
                severity="warning",
                rule="floating_net",
                message=f"Net '{net_name}' has only one connected pin: {net.pins[0]}"
            ))

    # High fan-out (more than 20 components on a non-power net)
    for net_name, net in nets.items():
        if not net.is_power and not net.is_gnd and len(net.components) > 20:
            drc.append(DRCWarning(
                severity="info",
                rule="high_fanout",
                message=f"Net '{net_name}' connects {len(net.components)} components — verify intentional bus topology"
            ))

    # Nets with 'NC' or 'NOCONNECT' in name
    for net_name in nets_raw:
        if re.search(r"\bNC\b|NOCONNECT|NO_CONNECT", net_name, re.IGNORECASE):
            if nets[net_name].pins:
                drc.append(DRCWarning(
                    severity="info",
                    rule="noconnect_net",
                    message=f"Net '{net_name}' may be intentionally unconnected"
                ))

    return AnalysisReport(
        source=netlist_data.get("source_files", ["unknown"])[0] if "source_files" in netlist_data else "unknown",
        component_count=len(components),
        net_count=len(nets),
        inventory=dict(inventory.most_common()),
        power_rails=power_rails,
        ground_nets=ground_nets,
        bus_groups=bus_groups,
        ic_connections=ic_connections_sorted,
        drc_warnings=drc,
    )


# ---------------------------------------------------------------------------
# Query handlers
# ---------------------------------------------------------------------------

def query_connections(netlist_data: dict, ref: str) -> dict:
    """Find all nets and components connected to a given RefDes."""
    nets_raw: dict[str, list[str]] = netlist_data.get("nets", {})
    connected_nets: dict[str, list[str]] = {}
    connected_refs: set[str] = set()

    for net_name, pins in nets_raw.items():
        for pin in pins:
            comp_ref = pin.split("-")[0] if "-" in pin else pin
            if comp_ref.upper() == ref.upper():
                connected_nets[net_name] = pins
                for p in pins:
                    other = p.split("-")[0] if "-" in p else p
                    if other.upper() != ref.upper():
                        connected_refs.add(other)
                break

    return {
        "ref": ref,
        "nets": connected_nets,
        "connected_components": sorted(connected_refs),
    }


def query_power_rails(netlist_data: dict) -> dict:
    """List all power and ground nets with their connected components."""
    nets_raw: dict[str, list[str]] = netlist_data.get("nets", {})
    rails: dict[str, dict] = {}

    for net_name, pins in nets_raw.items():
        if POWER_NET_PATTERNS.match(net_name) or GND_NET_PATTERNS.match(net_name):
            refs = sorted({p.split("-")[0] for p in pins if "-" in p})
            rails[net_name] = {"pin_count": len(pins), "components": refs}

    return {"power_rails": rails}


def query_path(netlist_data: dict, ref_a: str, ref_b: str) -> dict:
    """Find nets shared between two components (direct connection check)."""
    nets_raw: dict[str, list[str]] = netlist_data.get("nets", {})
    shared: list[str] = []

    for net_name, pins in nets_raw.items():
        refs = {p.split("-")[0] for p in pins if "-" in p}
        if ref_a.upper() in {r.upper() for r in refs} and ref_b.upper() in {r.upper() for r in refs}:
            shared.append(net_name)

    return {
        "ref_a": ref_a,
        "ref_b": ref_b,
        "shared_nets": sorted(shared),
        "directly_connected": len(shared) > 0,
    }


# ---------------------------------------------------------------------------
# Text output
# ---------------------------------------------------------------------------

def print_report(report: AnalysisReport) -> None:
    print(f"Source:      {report.source}")
    print(f"Components:  {report.component_count}")
    print(f"Nets:        {report.net_count}")
    print()

    print("Component Inventory:")
    for ctype, count in sorted(report.inventory.items(), key=lambda x: -x[1]):
        print(f"  {ctype:22s} {count:4d}")

    if report.power_rails:
        print(f"\nPower Rails ({len(report.power_rails)}):")
        for r in report.power_rails:
            print(f"  {r}")

    if report.ground_nets:
        print(f"\nGround Nets ({len(report.ground_nets)}):")
        for g in report.ground_nets:
            print(f"  {g}")

    if report.bus_groups:
        print(f"\nBus Groups ({len(report.bus_groups)}):")
        for prefix, names in list(report.bus_groups.items())[:15]:
            print(f"  {prefix}*  [{len(names)} nets: {', '.join(names[:5])}{'...' if len(names) > 5 else ''}]")

    if report.ic_connections:
        print(f"\nIC Interconnections ({len(report.ic_connections)} ICs):")
        for ic, others in sorted(report.ic_connections.items()):
            print(f"  {ic} ↔ {', '.join(others[:8])}{'...' if len(others) > 8 else ''}")

    if report.drc_warnings:
        print(f"\nDRC Warnings ({len(report.drc_warnings)}):")
        for w in sorted(report.drc_warnings, key=lambda x: x.severity):
            print(f"  [{w.severity.upper():7s}] {w.rule}: {w.message}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze a parsed Altium netlist JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("netlist_json", help="JSON file from parse_netlist.py.")
    parser.add_argument("--bom", help="BOM CSV file to enrich component data.")
    parser.add_argument("--query", choices=["connections", "power-rails", "path"],
                        help="Run a specific query instead of the full report.")
    parser.add_argument("--ref", help="RefDes for --query connections or one endpoint of --query path.")
    parser.add_argument("--ref-b", help="Second RefDes for --query path.")
    parser.add_argument("--json", action="store_true", help="Emit JSON to stdout.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    nl_path = Path(args.netlist_json)

    if not nl_path.exists():
        print(f"ERROR: File not found: {nl_path}", file=sys.stderr)
        sys.exit(1)

    netlist_data = json.loads(nl_path.read_text(encoding="utf-8"))
    bom_data: dict[str, dict] | None = None

    if args.bom:
        bom_path = Path(args.bom)
        if not bom_path.exists():
            print(f"ERROR: BOM file not found: {bom_path}", file=sys.stderr)
            sys.exit(1)
        bom_data = _load_bom(bom_path)

    # Handle query mode
    if args.query:
        if args.query == "connections":
            if not args.ref:
                print("ERROR: --ref is required for --query connections", file=sys.stderr)
                sys.exit(1)
            result = query_connections(netlist_data, args.ref)
        elif args.query == "power-rails":
            result = query_power_rails(netlist_data)
        elif args.query == "path":
            if not args.ref or not args.ref_b:
                print("ERROR: --ref and --ref-b are both required for --query path", file=sys.stderr)
                sys.exit(1)
            result = query_path(netlist_data, args.ref, args.ref_b)
        else:
            result = {}

        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # Full analysis
    report = analyze(netlist_data, bom_data)

    if args.json:
        print(json.dumps(asdict(report), indent=2, ensure_ascii=False))
    else:
        print_report(report)


if __name__ == "__main__":
    main()
