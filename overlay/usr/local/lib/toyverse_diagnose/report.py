"""Reports in Markdown (people) and JSON (ToyPost, ToySafe, CI)."""

from __future__ import annotations

import datetime as dt

from .ecosystem import Finding

ICON = {"rot": "🔴", "gelb": "🟡", "info": "🔵"}


def ecosystem_markdown(findings: list[Finding], scores: dict, delta: dict, steps: list[dict],
                       accepted: list, trend: list, rules: dict) -> str:
    total = round(sum(scores.values()) / len(scores), 1) if scores else 0
    counts = {s: sum(1 for f in findings if f.severity == s) for s in ("rot", "gelb", "info")}
    L = [f"# ToyVerse-Diagnose · {dt.date.today().strftime('%d.%m.%Y')}", "",
         f"**Kompatibilitäts-Index: {total} von 100** · {ICON['rot']} {counts['rot']} rot · "
         f"{ICON['gelb']} {counts['gelb']} gelb · {ICON['info']} {counts['info']} Hinweise", ""]
    if delta.get("neu") or delta.get("behoben") or delta.get("rueckfall"):
        L.append(f"Seit dem letzten Lauf: {len(delta['neu'])} neu, {len(delta['behoben'])} behoben, "
                 f"{len(delta['rueckfall'])} Rückfälle.")
        L.append("")
    if len(trend) > 1:
        L.append("Verlauf: " + " → ".join(f"{v}" for _, v in trend[-8:]))
        L.append("")
    L += ["## Index je Repository", "", "| Repository | Rolle | Index |", "|---|---|---|"]
    for repo, s in sorted(scores.items(), key=lambda x: x[1]):
        L.append(f"| {rules['repos'].get(repo, {}).get('github', repo)} | {rules['repos'].get(repo, {}).get('rolle', '')} | {s} |")
    L += ["", "## Nächste Schritte (nach Wirkung sortiert)", ""]
    for i, s in enumerate(steps, 1):
        auto = " · **automatisch korrigierbar** (`--korrigieren`)" if s["automatisch"] else ""
        L.append(f"{i}. {ICON[s['stufe']]} **{s['titel']}** ({s['regel']}, {s['entscheidung'] or '–'}): "
                 f"{s['anzahl']} Fund(e) in {', '.join(s['repos'])}{auto}"
                 + (f"  \n   {s['hinweis']}" if s["hinweis"] else ""))
    L += ["", "## Alle Befunde", ""]
    cur = None
    for f in findings:
        if f.rule != cur:
            cur = f.rule
            L += ["", f"### {ICON[f.severity]} {f.rule} {f.title}", ""]
            if f.why:
                L += [f"_{f.why}_", ""]
        loc = f"`{f.repo}/{f.path}" + (f":{f.line}`" if f.line else "`") if f.path else f"`{f.repo}`"
        extra = []
        if f.extra.get("eskaliert"):
            extra.append(f"eskaliert, offen seit {f.extra['offen_seit_tagen']} Tagen")
        L.append(f"- {loc}" + (f": {f.excerpt}" if f.excerpt else "") + (f" ({'; '.join(extra)})" if extra else ""))
    if accepted:
        L += ["", "## Akzeptierte Ausnahmen", ""]
        for f, exc in accepted:
            L.append(f"- {f.rule} `{f.repo}/{f.path}` bis {exc.get('bis')}: {exc.get('grund', '')}")
    return "\n".join(L) + "\n"


def device_text(res: dict) -> str:
    hw, p = res["hardware"], res["profil"]
    L = [f"ToyMesh-Gerätediagnose · Klasse {p['klasse']} ({p['klasse_name']})",
         f"  Gerät: {hw['model'] or 'unbekannt'} · {hw['arch']} · {hw['cpu_cores']} Kerne"
         + (f" bis {hw['cpu_max_mhz']} MHz" if hw['cpu_max_mhz'] else "")
         + f" · {hw['ram_mb']} MB RAM · GPU {hw['gpu_driver'] or 'keine'} ({'beschleunigt' if hw['gpu_accel'] else 'Software'})",
         f"  Installationsweg: {res['installationsweg']['weg']}"
         + (f" ({res['installationsweg']['hinweis']})" if res['installationsweg']['hinweis'] else ""),
         f"  Oberfläche {p['oberflaeche']}, Animationen {p['animationen']}, Browser {p['browser']}, "
         f"höchstens {p['parallele_apps']} Apps gleichzeitig",
         f"  ToyChain: Stufe {p['toychain_stufe']} ({p['toychain_stufe_name']}), ToyWork {p['toywork']}",
         "  Apps: " + ", ".join(f"{k} {v['modus']}" for k, v in p["apps"].items())]
    for r in res["anpassungen"]:
        L.append(f"  Anpassung: {r}")
    return "\n".join(L)
