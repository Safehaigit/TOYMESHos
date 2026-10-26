"""Ecosystem diagnosis: checks all ToyVerse repositories against the single
source of truth (toycoin: shared/toyverse.json, decisions, i18n, STATUS.md).

Every finding carries a stable fingerprint so the history module can tell
new, fixed, persistent and regressed findings apart.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

RULES_FILE = Path(__file__).with_name("regeln.json")
SEVERITY_WEIGHT = {"rot": 15, "gelb": 5, "info": 1}
MAX_FILE_BYTES = 2_000_000


@dataclass
class Finding:
    rule: str
    title: str
    severity: str  # rot | gelb | info
    repo: str
    path: str = ""
    line: int = 0
    excerpt: str = ""
    why: str = ""
    decision: str = ""
    hint: str = ""
    fixable: bool = False
    extra: dict = field(default_factory=dict)

    @property
    def fingerprint(self) -> str:
        # Line numbers move with every edit; the excerpt is the stable part.
        raw = f"{self.rule}|{self.repo}|{self.path}|{self.excerpt.strip()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["fingerprint"] = self.fingerprint
        return d


def load_rules(path: Path | None = None) -> dict:
    return json.loads((path or RULES_FILE).read_text(encoding="utf-8"))


def _match(rel: str, patterns: Iterable[str]) -> bool:
    """Glob match where "**/" may also stand for no directory at all."""
    expanded = []
    for pat in patterns:
        expanded.append(pat)
        if "/**/" in pat:
            expanded.append(pat.replace("/**/", "/"))
    for pat in expanded:
        if fnmatch.fnmatch(rel, pat):
            return True
        if pat.startswith("**/") and fnmatch.fnmatch(rel, pat[3:]):
            return True
    return False


def iter_text_files(repo: Path, ignore: list[str]):
    for p in sorted(repo.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(repo).as_posix()
        if _match(rel, ignore):
            continue
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                continue
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        yield rel, text


class Workspace:
    """All repositories side by side under one root directory."""

    def __init__(self, root: Path, rules: dict):
        self.root = root
        self.rules = rules
        self.repos = {
            name: root / name for name in rules["repos"] if (root / name).is_dir()
        }
        self._files: dict[str, list[tuple[str, str]]] = {}

    def files(self, repo: str) -> list[tuple[str, str]]:
        if repo not in self._files:
            self._files[repo] = list(
                iter_text_files(self.repos[repo], self.rules["ignorieren"])
            )
        return self._files[repo]

    def read(self, repo: str, rel: str) -> str | None:
        p = self.repos.get(repo)
        if not p or not (p / rel).is_file():
            return None
        return (p / rel).read_text(encoding="utf-8")


# ---------------------------------------------------------------- pattern rules

def check_patterns(ws: Workspace) -> list[Finding]:
    out: list[Finding] = []
    for rule in ws.rules["muster"]:
        rx = re.compile(rule["regex"])
        for repo in ws.repos:
            for rel, text in ws.files(repo):
                if not _match(rel, rule["dateien"]) or _match(rel, rule.get("ohne", [])):
                    continue
                for m in rx.finditer(text):
                    line = text.count("\n", 0, m.start()) + 1
                    start = text.rfind("\n", 0, m.start()) + 1
                    end = text.find("\n", m.end())
                    excerpt = text[start: end if end != -1 else len(text)].strip()
                    if len(excerpt) > 160:
                        a = max(0, m.start() - start - 60)
                        excerpt = "…" + excerpt[a: a + 150] + "…"
                    out.append(Finding(
                        rule=rule["id"], title=rule["titel"], severity=rule["stufe"],
                        repo=repo, path=rel, line=line, excerpt=excerpt,
                        why=rule["warum"], decision=rule.get("entscheidung", ""),
                        hint=rule.get("vorschlag", ""), fixable="korrektur" in rule,
                    ))
    return out


# ---------------------------------------------------------------- built-in checks

def _manifest(ws: Workspace) -> dict | None:
    raw = ws.read("toycoin", "shared/toyverse.json")
    return json.loads(raw) if raw else None


def check_manifest_copies(ws: Workspace) -> list[Finding]:
    """V1: every copy of toyverse.json must equal the source."""
    src = _manifest(ws)
    out: list[Finding] = []
    if src is None:
        return [Finding("B01", "Quelle shared/toyverse.json fehlt", "rot", "toycoin",
                        "shared/toyverse.json", why="Ohne Quelle kann nichts abgeglichen werden.",
                        decision="Nr. 135")]
    for repo in ws.repos:
        if repo == "toycoin":
            continue
        for rel, text in ws.files(repo):
            if not rel.endswith("toyverse.json"):
                continue
            try:
                copy = json.loads(text)
            except json.JSONDecodeError:
                out.append(Finding("B01", "Kopie von toyverse.json ist kein gültiges JSON", "rot",
                                   repo, rel, decision="Nr. 135"))
                continue
            if copy.get("schema") != "toyverse/1":
                continue
            diff = sorted(k for k in set(src) | set(copy) if src.get(k) != copy.get(k))
            if diff:
                out.append(Finding("B01", "Kopie von toyverse.json weicht von der Quelle ab", "gelb",
                                   repo, rel, excerpt=", ".join(diff[:8]),
                                   why="Feste Werte dürfen nur eine Quelle haben (V1).",
                                   decision="Nr. 135", hint="Abgleich-Workflow ausführen.",
                                   extra={"felder": diff}))
    return out


CHAIN_ID_RX = re.compile(r"\b76307\d{2}\b")


def check_chain_ids(ws: Workspace) -> list[Finding]:
    src = _manifest(ws) or {}
    valid = {str(v) for v in src.get("chainIds", {}).values()}
    out: list[Finding] = []
    for repo in ws.repos:
        for rel, text in ws.files(repo):
            for m in CHAIN_ID_RX.finditer(text):
                if m.group(0) not in valid:
                    line = text.count("\n", 0, m.start()) + 1
                    out.append(Finding("B02", "Unbekannte Chain-ID", "rot", repo, rel, line,
                                       excerpt=m.group(0),
                                       why="Gültig sind nur Mainnet, Testnet und Devnet aus toyverse.json.",
                                       decision="Nr. 116"))
    return out


ADDR_RX = re.compile(r"0x[0-9a-fA-F]{40}\b")


def check_legacy_tokens(ws: Workspace) -> list[Finding]:
    """Legacy token addresses must use exactly the EIP-55 spelling of the source."""
    src = _manifest(ws) or {}
    canon = {t["address"].lower(): t["address"] for t in src.get("legacyTokens", [])}
    out: list[Finding] = []
    for repo in ws.repos:
        for rel, text in ws.files(repo):
            for m in ADDR_RX.finditer(text):
                a = m.group(0)
                if a.lower() in canon and a != canon[a.lower()] and a != a.lower():
                    out.append(Finding("B03", "Alte Token-Adresse falsch geschrieben", "gelb", repo, rel,
                                       text.count("\n", 0, m.start()) + 1, excerpt=a,
                                       why="Prüfsumme nach EIP-55 weicht ab, Wallets können warnen.",
                                       decision="Nr. 63", hint=f"Richtig: {canon[a.lower()]}"))
    return out


def check_i18n(ws: Workspace) -> list[Finding]:
    out: list[Finding] = []
    src_lang = ws.read("toycoin", "i18n/sprachen.tsv")
    src_gloss = ws.read("toycoin", "i18n/begriffe.tsv")
    target = (_manifest(ws) or {}).get("i18n", {}).get("languages", 45)
    copies = {"toyverse-web": ("src/i18n/sprachen.tsv", "src/i18n/begriffe.tsv")}
    for repo, (lang, gloss) in copies.items():
        if repo not in ws.repos:
            continue
        for name, rel, src in (("Sprachliste", lang, src_lang), ("Begriffsliste", gloss, src_gloss)):
            cur = ws.read(repo, rel)
            if src and cur is not None and cur.strip() != src.strip():
                src_rows = {r.split("|")[0] for r in src.strip().splitlines()}
                cur_rows = {r.split("|")[0] for r in cur.strip().splitlines()}
                missing = sorted(src_rows - cur_rows)
                out.append(Finding("B04", f"{name} weicht von toycoin ab", "gelb", repo, rel,
                                   excerpt=("fehlt: " + ", ".join(missing[:10])) if missing else "Inhalt geändert",
                                   why="Alle Oberflächen nutzen dieselben Begriffe in 45 Sprachen.",
                                   decision="Nr. 103", hint="Abgleich-Workflow ausführen.",
                                   extra={"fehlend": missing}))
    loc = ws.repos.get("toyverse-web")
    if loc and (loc / "src/i18n/locales").is_dir():
        n = len(list((loc / "src/i18n/locales").glob("*.json")))
        if n < target:
            out.append(Finding("B05", "Übersetzungen der Webseite unvollständig", "info", "toyverse-web",
                               "src/i18n/locales", excerpt=f"{n} von {target} Sprachen",
                               decision="Nr. 103, 133", extra={"fertig": n, "ziel": target}))
    return out


STATUS_ROW = re.compile(r"^\|\s*(Start|M\d+[a-z]?)\s*\|[^|]*\|\s*(.+?)\s*\|\s*$", re.M)


def check_status_sync(ws: Workspace) -> list[Finding]:
    src = ws.read("toycoin", "docs/STATUS.md")
    web = ws.read("toyverse-web", "src/data/status.json")
    if not src or not web:
        return []
    want = {m.group(1): ("✅" in m.group(2)) for m in STATUS_ROW.finditer(src) if m.group(1) != "Start"}
    data = json.loads(web)
    have = {}
    for item in data.get("milestones", data.get("meilensteine", [])):
        key = item.get("id") or item.get("milestone") or item.get("meilenstein")
        if key:
            have[str(key)] = bool(item.get("done", item.get("fertig", False)))
    missing = [k for k in want if k not in have]
    wrong = [k for k in want if k in have and have[k] != want[k]]
    if not have:
        return [Finding("B06", "Meilensteine der Webseite nicht lesbar", "info", "toyverse-web",
                        "src/data/status.json", why="Unbekanntes Format, Prüfung übersprungen.")]
    out = []
    if missing or wrong:
        out.append(Finding("B06", "Roadmap der Webseite hinkt STATUS.md hinterher", "gelb", "toyverse-web",
                           "src/data/status.json",
                           excerpt=f"fehlt: {', '.join(missing) or '–'}; anderer Status: {', '.join(wrong) or '–'}",
                           why="Die Webseite soll den echten Projektstand zeigen.", decision="V2",
                           hint="npm run sync:toycoin oder Abgleich-Workflow."))
    return out


def check_registry(ws: Workspace) -> list[Finding]:
    """Every product must be known everywhere the ecosystem is presented."""
    out: list[Finding] = []
    products = {k: re.compile(v) for k, v in ws.rules["produkte"].items()}
    for reg in ws.rules["register"]:
        text = ws.read(reg["repo"], reg["datei"])
        if text is None:
            continue
        missing = [k for k, rx in products.items() if not rx.search(text)]
        if missing:
            out.append(Finding("B07", f"Produkte fehlen in: {reg['name']}", "gelb", reg["repo"], reg["datei"],
                               excerpt=", ".join(missing),
                               why="Ein Universum wirkt nur geschlossen, wenn jede Oberfläche alle Teile kennt.",
                               decision="Nr. 122, 134", extra={"fehlend": missing}))
    return out


def check_licenses(ws: Workspace) -> list[Finding]:
    out = []
    for repo, path in ws.repos.items():
        lic = next((p for p in path.iterdir() if p.name.upper().startswith(("LICENSE", "LICENCE"))), None)
        if lic is None:
            out.append(Finding("B08", "Lizenzdatei fehlt", "gelb", repo, "LICENSE",
                               why="Ohne Lizenz ist Code rechtlich nicht quelloffen, auch wenn er öffentlich ist.",
                               decision="Nr. 12", hint="MIT-Lizenz wie in toycoin ergänzen."))
        elif "MIT" not in lic.read_text(encoding="utf-8", errors="ignore")[:400]:
            out.append(Finding("B08", "Lizenz ist nicht MIT", "info", repo, lic.name, decision="Nr. 12"))
    return out


def check_runtimes(ws: Workspace) -> list[Finding]:
    engines = {}
    for repo in ws.repos:
        for rel, text in ws.files(repo):
            if rel.endswith("package.json") and "node_modules" not in rel:
                try:
                    e = json.loads(text).get("engines", {}).get("node")
                except json.JSONDecodeError:
                    continue
                if e:
                    engines[f"{repo}/{rel}"] = e
    if len(set(engines.values())) > 1:
        return [Finding("B09", "Unterschiedliche Node-Mindestversionen", "info", "*", "",
                        excerpt="; ".join(f"{k}: {v}" for k, v in sorted(engines.items())),
                        why="Eine gemeinsame Mindestversion vereinfacht Builds auf ToyMesh und in der CI.",
                        hint="Auf die höchste gemeinsame Version angleichen (z. B. >=22.18).",
                        extra=engines)]
    return []


BUILTIN = [check_manifest_copies, check_chain_ids, check_legacy_tokens, check_i18n,
           check_status_sync, check_registry, check_licenses, check_runtimes]


def diagnose(root: Path, rules: dict | None = None) -> tuple[list[Finding], Workspace]:
    rules = rules or load_rules()
    ws = Workspace(root, rules)
    findings = check_patterns(ws)
    for fn in BUILTIN:
        findings.extend(fn(ws))
    order = {"rot": 0, "gelb": 1, "info": 2}
    findings.sort(key=lambda f: (order[f.severity], f.rule, f.repo, f.path, f.line))
    return findings, ws


def score(findings: list[Finding], repos: Iterable[str]) -> dict[str, int]:
    """Compatibility index per repo, 100 = no findings."""
    # Penalty per distinct rule, so 90 copies of one outdated link weigh
    # like one problem that needs one fix, at most twice its base weight.
    res = {}
    for repo in repos:
        groups: dict[str, list[Finding]] = {}
        for f in findings:
            if f.repo in (repo, "*"):
                groups.setdefault(f.rule, []).append(f)
        penalty = 0.0
        for fs in groups.values():
            worst = max(SEVERITY_WEIGHT[f.severity] for f in fs)
            penalty += worst * min(2.0, 1 + (len(fs) - 1) / 10)
        res[repo] = max(0, round(100 - penalty))
    return res


def apply_fixes(ws: Workspace, findings: list[Finding]) -> list[str]:
    """Apply safe, declared replacements. Returns the list of changed files."""
    rules = {r["id"]: r for r in ws.rules["muster"] if "korrektur" in r}
    changed: set[Path] = set()
    for f in findings:
        rule = rules.get(f.rule)
        if not rule:
            continue
        p = ws.repos[f.repo] / f.path
        text = p.read_text(encoding="utf-8")
        new = text
        for a, b in rule["korrektur"]["ersetze"].items():
            new = re.sub(re.escape(a) + r"\b", b, new)
        if new != text:
            p.write_text(new, encoding="utf-8")
            changed.add(p)
    return sorted(str(p) for p in changed)
