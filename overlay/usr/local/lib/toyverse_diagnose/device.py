"""Device diagnosis for ToyMesh: detect hardware, pick a performance class,
choose a profile for UI, browser, ToyChain stage and apps, and adapt it over
time from measured memory pressure, OOM kills and temperature.

All probes read files below a configurable root, so tests can run against a
fake /proc and /sys tree. Nothing here changes system settings: the result is
a JSON profile that the launcher, the updater and TOYPAY read.
"""

from __future__ import annotations

import json
import os
import platform
import re
import shutil
from dataclasses import dataclass, field, asdict
from pathlib import Path

CLASSES = ["K1", "K2", "K3", "K4"]
CLASS_NAMES = {"K1": "Minimal", "K2": "Leicht", "K3": "Standard", "K4": "Stark"}
ACCEL_DRIVERS = {"i915", "xe", "amdgpu", "radeon", "nouveau", "msm", "panfrost", "lima",
                 "etnaviv", "vc4", "v3d", "mali", "freedreno", "tegra", "virtio_gpu", "panthor"}
SOFT_DRIVERS = {"simpledrm", "efifb", "omapdrm", "vesafb", "bochs-drm", "vboxvideo"}

STRAIN_FULL_AVG60 = 5.0      # % of time all tasks stalled on memory
RELAX_SOME_AVG60 = 1.0
RELAX_RUNS_TO_STEP_UP = 5
HOT_CELSIUS = 75.0


@dataclass
class Hardware:
    arch: str = ""
    cpu_cores: int = 1
    cpu_max_mhz: int = 0
    cpu_flags: list = field(default_factory=list)
    ram_mb: int = 0
    gpu_driver: str = ""
    gpu_accel: bool = False
    display: str = ""
    touch: bool = False
    battery: bool = False
    on_ac: bool = True
    uefi: bool = False
    model: str = ""
    disk_free_mb: int = 0
    temp_c: float | None = None
    psi_some_avg60: float | None = None
    psi_full_avg60: float | None = None
    oom_kills: int | None = None


def _read(root: Path, rel: str) -> str | None:
    try:
        return (root / rel).read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None


def probe(root: Path = Path("/"), arch: str | None = None) -> Hardware:
    hw = Hardware(arch=arch or platform.machine())

    cpuinfo = _read(root, "proc/cpuinfo") or ""
    hw.cpu_cores = max(1, len(re.findall(r"^processor\s*:", cpuinfo, re.M)))
    flags = re.search(r"^(flags|Features)\s*:\s*(.+)$", cpuinfo, re.M)
    if flags:
        wanted = {"sse4_2", "avx", "avx2", "aes", "neon", "asimd", "vfpv4", "lpae", "pmull"}
        hw.cpu_flags = sorted(set(flags.group(2).split()) & wanted)
    freq = _read(root, "sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
    if freq and freq.strip().isdigit():
        hw.cpu_max_mhz = int(freq.strip()) // 1000

    mem = _read(root, "proc/meminfo") or ""
    m = re.search(r"^MemTotal:\s+(\d+)", mem, re.M)
    hw.ram_mb = int(m.group(1)) // 1024 if m else 0

    drm = root / "sys/class/drm"
    if drm.is_dir():
        for card in sorted(drm.glob("card[0-9]")):
            drv = card / "device/driver"
            name = os.path.basename(os.readlink(drv)) if drv.is_symlink() else (_read(card, "device/driver_name") or "").strip()
            if name:
                hw.gpu_driver = name
                break
        for conn in sorted(drm.glob("card*-*")):
            if (_read(conn, "status") or "").strip() == "connected":
                modes = (_read(conn, "modes") or "").split()
                if modes:
                    hw.display = modes[0]
                    break
    has_render = (root / "dev/dri/renderD128").exists()
    hw.gpu_accel = hw.gpu_driver in ACCEL_DRIVERS and has_render

    inputs = (_read(root, "proc/bus/input/devices") or "").lower()
    hw.touch = "touchscreen" in inputs or "touch" in inputs

    ps = root / "sys/class/power_supply"
    if ps.is_dir():
        for sup in ps.iterdir():
            typ = (_read(sup, "type") or "").strip()
            if typ == "Battery":
                hw.battery = True
                status = (_read(sup, "status") or "").strip()
                if status == "Discharging":
                    hw.on_ac = False

    hw.uefi = (root / "sys/firmware/efi").is_dir()
    hw.model = ((_read(root, "proc/device-tree/model") or "").strip("\x00\n ")
                or " ".join(filter(None, [(_read(root, "sys/class/dmi/id/sys_vendor") or "").strip(),
                                          (_read(root, "sys/class/dmi/id/product_name") or "").strip()])))
    try:
        hw.disk_free_mb = shutil.disk_usage(root).free // (1024 * 1024)
    except OSError:
        pass

    temps = []
    tz = root / "sys/class/thermal"
    if tz.is_dir():
        for z in tz.glob("thermal_zone*"):
            t = (_read(z, "temp") or "").strip()
            if t.lstrip("-").isdigit():
                temps.append(int(t) / 1000)
    hw.temp_c = max(temps) if temps else None

    psi = _read(root, "proc/pressure/memory") or ""
    s = re.search(r"some avg10=[\d.]+ avg60=([\d.]+)", psi)
    f = re.search(r"full avg10=[\d.]+ avg60=([\d.]+)", psi)
    hw.psi_some_avg60 = float(s.group(1)) if s else None
    hw.psi_full_avg60 = float(f.group(1)) if f else None
    vm = _read(root, "proc/vmstat") or ""
    o = re.search(r"^oom_kill (\d+)", vm, re.M)
    hw.oom_kills = int(o.group(1)) if o else None
    return hw


# ------------------------------------------------------------------ classification

def base_class(hw: Hardware) -> str:
    soft = not hw.gpu_accel
    if hw.ram_mb < 1536 or (hw.arch.startswith("armv7") and soft):
        return "K1"
    if hw.ram_mb < 3072 or soft:
        return "K2"
    if hw.ram_mb < 6144:
        return "K3"
    return "K4"


def install_path(hw: Hardware) -> dict:
    a, model = hw.arch, hw.model.lower()
    if a in ("x86_64", "amd64"):
        legacy = "sse4_2" not in hw.cpu_flags and hw.cpu_flags != []
        return {"weg": "ToyMesh PC (x86_64, " + ("UEFI" if hw.uefi else "BIOS") + ")",
                "hinweis": "Ältere CPU ohne SSE4.2: generisches x86_64-v1-Paket nötig." if legacy else ""}
    if a in ("i386", "i486", "i586", "i686", "x86"):
        return {"weg": "Kein eigenes ToyMesh", "hinweis": "32-Bit-x86 wird nicht unterstützt. ToyVerse-Apps laufen im Browser."}
    if a in ("aarch64", "arm64"):
        if "raspberry pi" in model:
            return {"weg": "ToyMesh Pi (aarch64)", "hinweis": ""}
        return {"weg": "ToyMesh mobil (aarch64, postmarketOS-Port)",
                "hinweis": "Gerät in der postmarketOS-Geräteliste prüfen. Ohne Port: ToyVerse-Apps als PWA unter Android."}
    if a.startswith("armv7") or a == "armhf":
        return {"weg": "ToyMesh armv7 (z. B. Galaxy Tab 2, Raspberry Pi 2/3)", "hinweis": "Nur 32-Bit-Pakete, keine 3D-Apps."}
    return {"weg": "Unbekannt", "hinweis": f"Architektur {a} nicht vorgesehen."}


APP_NEEDS = {
    # id: (min class for full, min class for light, needs 3D, note)
    "toysafe": ("K2", "K1", False, "Auf K1 Leicht-Modus: Engine aus, nur Werkzeuge im Browser."),
    "toyverse": ("K1", "K1", False, ""),
    "toysearch": ("K1", "K1", False, ""),
    "toychat": ("K2", "K1", False, "Videoanrufe ab K2, auf K1 nur Text."),
    "toypost": ("K2", "K1", False, "Auf K1 nur als Web-Ansicht in ToyDesk."),
    "toypay": ("K1", "K1", False, "Leicht-Knoten (Stufe 0) läuft überall, Voll-Knoten nach Profil."),
    "toyscan": ("K1", "K1", False, "Als Web-Ansicht, Server erst ab M11."),
    "toyquest": ("K3", "K2", True, "3D braucht GPU-Treiber. Sonst Lernwelt als 2D-Webversion."),
    "toycash": ("K1", "K1", False, "Konzept."),
}


def app_matrix(cls: str) -> dict:
    idx = CLASSES.index(cls)
    out = {}
    for app, (full, light, needs3d, note) in APP_NEEDS.items():
        if idx >= CLASSES.index(full):
            mode = "voll"
        elif idx >= CLASSES.index(light):
            mode = "leicht"
        else:
            mode = "web"
        out[app] = {"modus": mode, "hinweis": note if mode != "voll" else ""}
    return out


def profile_for(cls: str, hw: Hardware) -> dict:
    idx = CLASSES.index(cls)
    hot = hw.temp_c is not None and hw.temp_c >= HOT_CELSIUS
    full_node_ok = idx >= 3 and hw.disk_free_mb >= 2048
    stage = 3 if full_node_ok else min(idx, 2)
    return {
        "klasse": cls,
        "klasse_name": CLASS_NAMES[cls],
        "oberflaeche": ["toytiles" if hw.touch else "toyfocus", "toydroid" if hw.touch else "toyclassic",
                        "toyaqua", "toyaqua"][idx],
        "animationen": ["aus", "reduziert", "normal", "normal"][idx],
        "glas_effekte": idx >= 2,
        # Browser and parallel apps follow RAM, not the class: a VM without GPU
        # but with 8 GB is "light" for graphics, yet has room for Firefox.
        "browser": "firefox-esr" if hw.ram_mb >= 2048 else "cog",
        "parallele_apps": max(1, min(8, hw.ram_mb // 1024)),
        "zram_prozent": [50, 33, 25, 0][idx],
        "toychain_stufe": stage,
        "toychain_stufe_name": ["Leicht-Knoten", "Konto", "Attestierer", "Voll-Knoten"][stage],
        "toywork": "aus" if (hot or not hw.on_ac or idx == 0) else "nur am Ladekabel",
        "apps": app_matrix(cls),
    }


# ------------------------------------------------------------------ adaptation

def adapt(hw: Hardware, state: dict) -> tuple[str, dict, list[str]]:
    """Return (effective class, new state, reasons). Hysteresis prevents flapping:
    one bad run steps down at once, stepping up needs several calm runs."""
    base = base_class(hw)
    base_i = CLASSES.index(base)
    cur_i = min(CLASSES.index(state.get("klasse", base)), base_i)
    if state.get("basis") and CLASSES.index(state["basis"]) < base_i:
        cur_i = base_i  # hardware got better (e.g. RAM upgrade): start fresh at the top
    reasons = []

    new_oom = 0
    if hw.oom_kills is not None and state.get("oom_kills") is not None:
        new_oom = max(0, hw.oom_kills - state["oom_kills"])
    strain = new_oom > 0 or (hw.psi_full_avg60 is not None and hw.psi_full_avg60 > STRAIN_FULL_AVG60)
    calm = not strain and (hw.psi_some_avg60 is None or hw.psi_some_avg60 < RELAX_SOME_AVG60)
    calm_runs = state.get("ruhige_laeufe", 0)

    if strain:
        if cur_i > 0:
            cur_i -= 1
            reasons.append(f"Speicherdruck ({'OOM ' + str(new_oom) if new_oom else 'PSI full ' + str(hw.psi_full_avg60)}): eine Klasse herunter")
        else:
            reasons.append("Speicherdruck auf niedrigster Klasse: weniger Apps gleichzeitig öffnen")
        calm_runs = 0
    elif calm:
        calm_runs += 1
        if cur_i < base_i and calm_runs >= RELAX_RUNS_TO_STEP_UP:
            cur_i += 1
            calm_runs = 0
            reasons.append(f"{RELAX_RUNS_TO_STEP_UP} ruhige Läufe: eine Klasse hinauf")
    else:
        calm_runs = 0

    if hw.temp_c is not None and hw.temp_c >= HOT_CELSIUS:
        reasons.append(f"Temperatur {hw.temp_c:.0f} °C: ToyWork aus")

    cls = CLASSES[cur_i]
    new_state = {"basis": base, "klasse": cls, "ruhige_laeufe": calm_runs, "oom_kills": hw.oom_kills,
                 "verlauf": (state.get("verlauf", []) + [cls])[-30:]}
    return cls, new_state, reasons


def run(root: Path, state_file: Path, out_file: Path | None, arch: str | None = None) -> dict:
    hw = probe(root, arch)
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    cls, new_state, reasons = adapt(hw, state)
    result = {
        "schema": "toymesh-geraet/1",
        "hardware": asdict(hw),
        "basis_klasse": base_class(hw),
        "installationsweg": install_path(hw),
        "profil": profile_for(cls, hw),
        "anpassungen": reasons,
    }
    try:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps(new_state, indent=2), encoding="utf-8")
        if out_file:
            out_file.parent.mkdir(parents=True, exist_ok=True)
            out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    except OSError as e:
        result["anpassungen"].append(f"Zustand nicht gespeichert: {e}")
    return result
