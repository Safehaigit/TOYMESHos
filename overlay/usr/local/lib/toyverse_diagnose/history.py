"""History and self-optimisation for ecosystem findings.

What "self-optimising" means here, concretely and without magic:

1. Memory: every run is stored with the fingerprints of its findings, so the
   next run knows what is new, what was fixed and what came back (regression).
2. Escalation: a yellow finding that stays open for ESCALATE_AFTER_DAYS is
   raised to red, so nothing quietly rots.
3. Exceptions with expiry: a finding can be accepted with a reason and an end
   date (ausnahmen.json). Expired exceptions bring the finding back.
4. Ranking: next steps are ordered by severity, number of repos affected and
   whether an automatic fix exists, so the cheapest big wins come first.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from .ecosystem import Finding

ESCALATE_AFTER_DAYS = 14
KEEP_RUNS = 60


def _today() -> dt.date:
    return dt.date.today()


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def apply_exceptions(findings: list[Finding], exceptions: list[dict], today: dt.date | None = None):
    """Drop accepted findings; report expired exceptions as findings of their own."""
    today = today or _today()
    kept, accepted, expired = [], [], []
    for f in findings:
        exc = next((e for e in exceptions if e.get("fingerprint") == f.fingerprint
                    or (e.get("regel") == f.rule and e.get("repo") in (f.repo, "*")
                        and e.get("pfad", f.path) == f.path)), None)
        if exc is None:
            kept.append(f)
            continue
        until = dt.date.fromisoformat(exc.get("bis", "9999-12-31"))
        if until >= today:
            accepted.append((f, exc))
        else:
            f.extra["ausnahme_abgelaufen"] = exc.get("bis")
            f.title += " (Ausnahme abgelaufen)"
            kept.append(f)
            expired.append(exc)
    return kept, accepted, expired


def compare(findings: list[Finding], history: dict, today: dt.date | None = None) -> dict:
    """Classify findings against earlier runs and escalate long-open ones."""
    today = today or _today()
    runs = history.get("runs", [])
    prev = set(runs[-1]["fingerprints"]) if runs else set()
    ever_fixed = set(history.get("fixed", {}))
    first_seen: dict = history.setdefault("first_seen", {})
    now = {f.fingerprint for f in findings}

    for f in findings:
        seen = first_seen.setdefault(f.fingerprint, today.isoformat())
        age = (today - dt.date.fromisoformat(seen)).days
        f.extra["offen_seit_tagen"] = age
        if f.severity == "gelb" and age >= ESCALATE_AFTER_DAYS:
            f.severity = "rot"
            f.extra["eskaliert"] = True

    return {
        "neu": sorted(now - prev) if runs else [],
        "behoben": sorted(prev - now),
        "rueckfall": sorted(now & ever_fixed),
        "bestand": sorted(now & prev),
    }


def record(history: dict, findings: list[Finding], scores: dict, delta: dict,
           today: dt.date | None = None) -> dict:
    today = today or _today()
    history.setdefault("runs", []).append({
        "datum": today.isoformat(),
        "fingerprints": [f.fingerprint for f in findings],
        "index": scores,
    })
    history["runs"] = history["runs"][-KEEP_RUNS:]
    fixed = history.setdefault("fixed", {})
    for fp in delta["behoben"]:
        fixed[fp] = today.isoformat()
    for fp in delta["rueckfall"]:
        fixed.pop(fp, None)
    alive = {fp for r in history["runs"] for fp in r["fingerprints"]}
    history["first_seen"] = {k: v for k, v in history.get("first_seen", {}).items() if k in alive}
    return history


def next_steps(findings: list[Finding], limit: int = 8) -> list[dict]:
    """Group findings by rule and rank: severity, spread, then fixable first."""
    groups: dict[str, dict] = {}
    for f in findings:
        g = groups.setdefault(f.rule, {"regel": f.rule, "titel": f.title.replace(" (Ausnahme abgelaufen)", ""),
                                       "stufe": f.severity, "repos": set(), "anzahl": 0,
                                       "automatisch": f.fixable, "hinweis": f.hint, "entscheidung": f.decision})
        g["repos"].add(f.repo)
        g["anzahl"] += 1
        if f.severity == "rot":
            g["stufe"] = "rot"
    rank = {"rot": 0, "gelb": 1, "info": 2}
    ordered = sorted(groups.values(), key=lambda g: (rank[g["stufe"]], -len(g["repos"]),
                                                     not g["automatisch"], -g["anzahl"]))
    for g in ordered:
        g["repos"] = sorted(g["repos"])
    return ordered[:limit]


def trend(history: dict) -> list[tuple[str, float]]:
    out = []
    for r in history.get("runs", []):
        vals = [v for k, v in r.get("index", {}).items()]
        if vals:
            out.append((r["datum"], round(sum(vals) / len(vals), 1)))
    return out
