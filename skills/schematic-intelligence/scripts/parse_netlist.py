#!/usr/bin/env python3
"""Parse an Altium Designer Protel netlist (.NET) file into structured JSON.

Supports both multi-line and single-line Protel .NET format variants.
No third-party dependencies — uses only the Python standard library.

Output JSON structure:
  {
    "components": {
      "R1": {"footprint": "RES_0402", "value": "10K"},
      "U1": {"footprint": "QFN-48", "value": "STM32F411CEU6"},
      ...
    },
    "nets": {
      "GND": ["R1-1", "C1-2", "U1-43"],
      "VCC": ["L1-2", "C2-1"],
      ...
    }
  }

Usage examples:
  # Parse and print JSON
  python parse_netlist.py schematic.NET

  # Save to file
  python parse_netlist.py schematic.NET --output netlist.json

  # Print compact summary (no full JSON)
  python parse_netlist.py schematic.NET --summary

  # Multi-file hierarchical design (merge all sheets)
  python parse_netlist.py sheet1.NET sheet2.NET --output merged.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Component:
    ref: str
    footprint: str = ""
    value: str = ""


@dataclass
class Net:
    name: str
    pins: list[str] = field(default_factory=list)   # ["R1-1", "U1-5", ...]


@dataclass
class Netlist:
    source_files: list[str] = field(default_factory=list)
    components: dict[str, Component] = field(default_factory=dict)  # ref → Component
    nets: dict[str, Net] = field(default_factory=dict)              # net_name → Net
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

class ProtelNetParser:
    """State-machine parser for Protel/Altium .NET format.

    Component block example (multi-line):
      [
      R1
      RES_0402
      10K
      ]

    Net block example (multi-line):
      (
      GND
      R1-1
      C1-2
      )

    Single-line variant:
      (NET "GND" (NODE (COMPONENT "R1") (PIN "1")) (NODE (COMPONENT "C1") (PIN "2")))
    """

    def parse_file(self, path: Path) -> Netlist:
        """Parse a single .NET file and return a Netlist."""
        text = path.read_text(encoding="utf-8", errors="replace")
        return self._parse_text(text, source=str(path))

    def _parse_text(self, text: str, source: str) -> Netlist:
        nl = Netlist(source_files=[source])

        # Detect format: single-line vs multi-line based on whether '(NET ' appears
        if "(NET " in text or "(net " in text:
            self._parse_singleline(text, nl)
        else:
            self._parse_multiline(text, nl)

        return nl

    # ---- Multi-line format -----------------------------------------------

    def _parse_multiline(self, text: str, nl: Netlist) -> None:
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line == "[":
                i = self._parse_component_block(lines, i + 1, nl)
            elif line == "(":
                i = self._parse_net_block(lines, i + 1, nl)
            else:
                i += 1

    def _parse_component_block(self, lines: list[str], start: int, nl: Netlist) -> int:
        """Parse lines inside [...] block. Returns index after ']'."""
        content: list[str] = []
        i = start
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            if line == "]":
                break
            if line:
                content.append(line)

        # content = [RefDes, Footprint, Value, ...]
        if len(content) >= 1:
            ref = content[0]
            footprint = content[1] if len(content) > 1 else ""
            value = content[2] if len(content) > 2 else ""
            if ref in nl.components:
                nl.warnings.append(f"Duplicate component: {ref}")
            nl.components[ref] = Component(ref=ref, footprint=footprint, value=value)

        return i

    def _parse_net_block(self, lines: list[str], start: int, nl: Netlist) -> int:
        """Parse lines inside (...) block. Returns index after ')'."""
        content: list[str] = []
        i = start
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            if line == ")":
                break
            if line:
                content.append(line)

        # content = [NetName, pin1, pin2, ...] where pin = "RefDes-PinNum"
        if len(content) >= 1:
            net_name = content[0]
            pins = content[1:]
            # Validate pin format: should match "REFDES-PINNUM"
            valid_pins = []
            for pin in pins:
                if re.match(r"^[\w/\\]+-[\w]+$", pin):
                    valid_pins.append(pin)
                else:
                    nl.warnings.append(f"Net {net_name}: unexpected pin format: {pin!r}")
                    valid_pins.append(pin)  # include anyway

            if net_name in nl.nets:
                nl.nets[net_name].pins.extend(valid_pins)
            else:
                nl.nets[net_name] = Net(name=net_name, pins=valid_pins)

        return i

    # ---- Single-line / EDIF-like format ----------------------------------

    def _parse_singleline(self, text: str, nl: Netlist) -> None:
        """Parse PADS-like single-line netlist."""
        # Component pattern: (COMP "R1" (FOOTPRINT "RES_0402") (VALUE "10K"))
        comp_pattern = re.compile(
            r'\(COMP\s+"?(\w+)"?\s+\(FOOTPRINT\s+"?([^")\s]+)"?\)\s*\(VALUE\s+"?([^")]*)"?\)',
            re.IGNORECASE,
        )
        for m in comp_pattern.finditer(text):
            ref, fp, val = m.group(1), m.group(2), m.group(3)
            nl.components[ref] = Component(ref=ref, footprint=fp, value=val)

        # Net pattern: (NET "GND" (NODE ...) ...)
        net_pattern = re.compile(r'\(NET\s+"?([^")]+)"?\s+((?:\(NODE[^)]*\)\s*)*)\)', re.IGNORECASE)
        node_pattern = re.compile(r'\(NODE\s+\(COMPONENT\s+"?(\w+)"?\)\s+\(PIN\s+"?(\w+)"?\)\)', re.IGNORECASE)
        for m in net_pattern.finditer(text):
            net_name = m.group(1)
            nodes_text = m.group(2)
            pins = [f"{nm.group(1)}-{nm.group(2)}" for nm in node_pattern.finditer(nodes_text)]
            if net_name in nl.nets:
                nl.nets[net_name].pins.extend(pins)
            else:
                nl.nets[net_name] = Net(name=net_name, pins=pins)


# ---------------------------------------------------------------------------
# Merge multiple netlists
# ---------------------------------------------------------------------------

def merge_netlists(netlists: list[Netlist]) -> Netlist:
    merged = Netlist(source_files=[])
    for nl in netlists:
        merged.source_files.extend(nl.source_files)
        for ref, comp in nl.components.items():
            if ref in merged.components:
                merged.warnings.append(f"Duplicate component {ref} from {nl.source_files[-1]}")
            merged.components[ref] = comp
        for net_name, net in nl.nets.items():
            if net_name in merged.nets:
                merged.nets[net_name].pins.extend(net.pins)
            else:
                merged.nets[net_name] = Net(name=net_name, pins=net.pins[:])
        merged.warnings.extend(nl.warnings)
    return merged


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def netlist_to_dict(nl: Netlist) -> dict:
    return {
        "source_files": nl.source_files,
        "components": {ref: {"footprint": c.footprint, "value": c.value} for ref, c in nl.components.items()},
        "nets": {name: net.pins for name, net in nl.nets.items()},
        "warnings": nl.warnings,
    }


def print_summary(nl: Netlist) -> None:
    print(f"Sources:    {', '.join(nl.source_files)}")
    print(f"Components: {len(nl.components)}")
    print(f"Nets:       {len(nl.nets)}")
    if nl.warnings:
        print(f"Warnings:   {len(nl.warnings)}")
        for w in nl.warnings[:10]:
            print(f"  ! {w}")
        if len(nl.warnings) > 10:
            print(f"  ... and {len(nl.warnings) - 10} more")

    # Quick breakdown by ref-des prefix
    from collections import Counter
    prefix_count: Counter[str] = Counter()
    for ref in nl.components:
        prefix = re.match(r"^([A-Za-z]+)", ref)
        if prefix:
            prefix_count[prefix.group(1).upper()] += 1
    print("\nComponent breakdown:")
    for prefix, count in sorted(prefix_count.items(), key=lambda x: -x[1]):
        print(f"  {prefix:8s} {count:4d}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse Altium Protel .NET netlist file(s) into JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("netlist", nargs="+", help="One or more .NET files to parse.")
    parser.add_argument("--output", help="Save JSON to this file (default: print to stdout).")
    parser.add_argument("--summary", action="store_true", help="Print a human-readable summary instead of JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    parser = ProtelNetParser()
    netlists: list[Netlist] = []

    for fpath_str in args.netlist:
        fpath = Path(fpath_str)
        if not fpath.exists():
            print(f"ERROR: File not found: {fpath}", file=sys.stderr)
            sys.exit(1)
        try:
            nl = parser.parse_file(fpath)
            netlists.append(nl)
        except Exception as exc:
            print(f"ERROR: Failed to parse {fpath}: {exc}", file=sys.stderr)
            sys.exit(1)

    merged = merge_netlists(netlists) if len(netlists) > 1 else netlists[0]

    if args.summary:
        print_summary(merged)
        return

    result = netlist_to_dict(merged)
    json_str = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(json_str, encoding="utf-8")
        print(f"Saved netlist JSON to {args.output}", file=sys.stderr)
    else:
        print(json_str)


if __name__ == "__main__":
    main()
