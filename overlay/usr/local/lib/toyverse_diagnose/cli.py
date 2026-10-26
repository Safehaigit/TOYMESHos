"""Command line: `python -m toyverse_diagnose oekosystem|geraet …`."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import __version__, device, ecosystem, history, report


def cmd_ecosystem(a) -> int:
    rules = ecosystem.load_rules(Path(a.regeln) if a.regeln else None)
    root = Path(a.wurzel)
    findings, ws = ecosystem.diagnose(root, rules)
    if not ws.repos:
        print(f"Keine ToyVerse-Repositories unter {root} gefunden.")
        return 2
    if a.korrigieren:
        changed = ecosystem.apply_fixes(ws, findings)
        print(f"{len(changed)} Datei(en) automatisch korrigiert.")
        for c in changed:
            print("  " + c)
        findings, ws = ecosystem.diagnose(root, rules)

    state = Path(a.zustand)
    exceptions = history.load_json(state / "ausnahmen.json", [])
    findings, accepted, _expired = history.apply_exceptions(findings, exceptions)
    hist = history.load_json(state / "verlauf.json", {})
    delta = history.compare(findings, hist)
    scores = ecosystem.score(findings, ws.repos)
    steps = history.next_steps(findings)
    if not a.ohne_verlauf:
        state.mkdir(parents=True, exist_ok=True)
        hist = history.record(hist, findings, scores, delta)
        (state / "verlauf.json").write_text(json.dumps(hist, indent=1), encoding="utf-8")

    md = report.ecosystem_markdown(findings, scores, delta, steps, accepted, history.trend(hist), rules)
    if a.md:
        Path(a.md).write_text(md, encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps({
            "schema": "toyverse-diagnose/1", "index": scores,
            "befunde": [f.to_dict() for f in findings], "naechste_schritte": steps, "veraenderung": delta,
        }, indent=2, ensure_ascii=False), encoding="utf-8")
    if not a.md and not a.json:
        print(md)
    else:
        total = round(sum(scores.values()) / len(scores), 1)
        print(f"Kompatibilitäts-Index {total}/100, {len(findings)} Befunde.")
    if any(f.severity == "rot" for f in findings):
        return 2
    return 1 if any(f.severity == "gelb" for f in findings) else 0


def cmd_device(a) -> int:
    res = device.run(Path(a.wurzel), Path(a.zustand), Path(a.ausgabe) if a.ausgabe else None, a.arch)
    print(json.dumps(res, indent=2, ensure_ascii=False) if a.json else report.device_text(res))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="toyverse-diagnose", description="Diagnose für das ToyVerse")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("oekosystem", help="alle Repositories gegen toycoin prüfen")
    e.add_argument("--wurzel", default=".", help="Ordner, in dem toycoin, toypost, … nebeneinander liegen")
    e.add_argument("--zustand", default=".toyverse-diagnose", help="Ordner für Verlauf und Ausnahmen")
    e.add_argument("--regeln", help="eigene Regeldatei")
    e.add_argument("--korrigieren", action="store_true", help="sichere Korrekturen anwenden")
    e.add_argument("--ohne-verlauf", action="store_true", help="Verlauf nicht fortschreiben")
    e.add_argument("--md", help="Bericht als Markdown schreiben")
    e.add_argument("--json", help="Ergebnis als JSON schreiben")
    e.set_defaults(fn=cmd_ecosystem)

    d = sub.add_parser("geraet", help="dieses Gerät einstufen und Profil anpassen")
    d.add_argument("--wurzel", default="/", help="Systemwurzel (für Tests)")
    d.add_argument("--zustand", default="/var/lib/toymesh/profil-zustand.json")
    d.add_argument("--ausgabe", default="/srv/toyverse/geraet.json", help="Profil für Launcher und Apps")
    d.add_argument("--arch", help="Architektur vorgeben (für Tests)")
    d.add_argument("--json", action="store_true")
    d.set_defaults(fn=cmd_device)

    a = p.parse_args(argv)
    return a.fn(a)
