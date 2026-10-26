# ToyMesh

**ToyMesh** turns a **Samsung Galaxy Tab 2 10.1 (GT-P5110 / espresso10)** into a
dedicated, hardened **postmarketOS** appliance that runs your **ToyVerse** apps
(ToySafe Cockpit, the ecosystem site, TOYPAY/TOYQUEST/ToyChain/ToyCash/ToyScan),
with no bloatware, a hardened browser **ToySurf** + privacy search **ToySearch**,
and a built-in open-source **security-research toolkit**.

> This is a **build kit** — configs, scripts, package manifests and your apps,
> ready to run. It is not a pre-built flashable image: compiling the OS needs a
> Linux PC with disk/time that a chat sandbox doesn't have. Everything you run
> is here and documented.

## Why Linux (postmarketOS), not Android
On the P5110, Android stops at an unofficial 7.1 with **no security patches**
(backport attempts broke the UI). postmarketOS gives a maintained system with
**signed, ongoing updates** — the only honest route to "state of the art
security" on 2012 hardware. Device support is active (device package rebuilt
2026-03). Trade-off: **Android apps don't run** — but your ToyVerse apps are
HTML and run fine. Read `HARDWARE.md` for the full reality check (1 GB RAM, no
GPU driver, armv7).

## What you get
- **Minimal base + light UI** (Sxmo on Sway) — `packages/base.list`, `DEBLOAT.md`
- **Your apps**, served locally and offline — `overlay/srv/toyverse/`
  (launcher + `toysafe-cockpit.html` + the ToyVerse website in `web/`, built from
  `TOYfoundation/ToyVerse-web` by `scripts/fetch-website.sh`)
- **Hardening** — LUKS FDE, nftables default-deny, sysctl, ssh key-only,
  fail2ban, signed auto-updates, chrony — `packages/hardening.list`, `SECURITY.md`
- **Security-research toolkit** — recon, traffic, web, forensics, proxy, crypto,
  (optional) wireless; armv7-checked — `packages/security-research.list`

## Quick start
```sh
# on a Linux PC:
sh scripts/fetch-fonts.sh    # bundle web fonts for offline use (optional)
bash scripts/fetch-website.sh  # build the ToyVerse website into overlay/srv/toyverse/web
sh scripts/build.sh          # build with pmbootstrap (see pmbootstrap-init.txt)
# flash per BUILD.md (heimdall to internal, or dd to microSD for safe dual-boot)

# then on the tablet, first boot:
doas sh scripts/install-overlay.sh   # all apps + launcher + server + auto-updater + ToyMesh branding
doas sh scripts/harden.sh            # firewall + tools + sysctl + weekly OS + daily UI/app updates
doas sh scripts/setup-appstores.sh   # apk + flatpak + pipx/npm/cargo/gem
doas sh scripts/setup-toysurf.sh     # hardened browser ToySurf + ToySearch default
toysurf                              # open the hardened browser (ToySearch home)
```

## Acht Oberflächen
ToyClassic, ToyAqua, ToyQuest, ToyPlasma, ToySafe, ToyTiles, ToyGuide, ToyFocus —
wählbar oben rechts, mit Einrichtungs-Assistent. Details in `UI.md`.

## ToySurf + ToySearch
`toysurf` launches a hardened browser (Firefox ESR if available for armv7, else a
light WebKit engine for 1 GB RAM) with telemetry off, HTTPS-only, DoH, strict
tracking protection, uBlock, fingerprint resistance and a sandbox. **ToySearch**
(`/srv/toyverse/toysearch/`) is the default engine: it searches your ToyVerse
content **offline** first, then forwards web queries — only on your click — to a
privacy backend you choose. Full detail and customization in `TOYSURF.md`.

## All ToyVerse apps + auto-update
The launcher reads `overlay/srv/toyverse/apps.json` — ToySafe Cockpit and the
ToyVerse site are **live/local**; TOYPAY, TOYQUEST, ToyChain, ToyCash and
ToyScan appear as ecosystem entries with status badges
(In Entwicklung / In Planung / Konzept). To make any app **auto-update**, put
its GitHub repo or a raw HTML URL in that app's `source` field in `apps.json`;
`toyverse-app-sync` (daily cron) then pulls it in — atomically, offline-safe,
with optional SHA-256 check. Give me your repo URLs and I'll pre-fill them.

## Map of the kit
```
toyverse-tab/
├─ README.md            ← you are here
├─ HARDWARE.md          ← what the device can/can't do (read first)
├─ BUILD.md             ← build + flash, step by step
├─ SECURITY.md          ← hardening design + responsible-use rules
├─ COMPATIBILITY.md     ← audit of your apps: fixes done + gaps to align
├─ APPSTORES.md         ← which app stores work here (and why Android ones don't)
├─ UI.md               ← acht wählbare Oberflächen + Assistent
├─ TOYSURF.md           ← ToySurf browser + ToySearch: security, engines, customizing
├─ DEBLOAT.md           ← what's left out, how to trim more
├─ pmbootstrap-init.txt ← copy-paste answers for the installer
├─ packages/            ← base / hardening / security-research / kiosk lists
├─ scripts/             ← build.sh · fetch-fonts.sh (PC) · install-overlay.sh ·
│                          harden.sh · setup-appstores.sh · setup-toysurf.sh ·
│                          brand-toymesh.sh (tablet)
└─ overlay/             ← files copied onto the device
   ├─ etc/…             ← nftables, sshd, sysctl, OpenRC services, toysurf/ (policy+user.js+conf)
   ├─ usr/lib/…         ← os-release.toymesh (branding)
   ├─ usr/local/bin/…   ← toyverse-update · toyverse-app-sync · toysurf
   └─ srv/toyverse/     ← launcher · ui/ (10 Oberflächen, toypost.js)  · apps.json · fonts/ · toysearch/ · apps (127.0.0.1:8080)
```

## Two modes
- **Workstation** (default): real Sxmo/Sway desktop; tools usable in a terminal;
  apps one tap away.
- **Appliance/kiosk**: boots straight into the fullscreen ToyVerse launcher,
  locked down. One command to switch — see the `toyverse-kiosk` service header.

---
The security tools are standard dual-use software. Use them only on systems you
own or are authorised to test — see the responsible-use section in `SECURITY.md`.


## ToyChat — verschlüsselter Teamchat und Videoanrufe
Teamchat mit Kanälen, Aufgaben und Videoanrufen. Nachrichten sind Ende-zu-Ende verschlüsselt und
signiert. Der Server (`overlay/usr/local/lib/toychat/server.js`) sieht nur Chiffrat. Details,
Sicherheitsmodell und Grenzen in **TOYCHAT.md**.

## Lizenz

MIT, siehe `LICENSE`. Gilt für die Skripte, Konfigurationen und Apps in diesem Repository. postmarketOS, Alpine und alle Pakete aus `packages/` behalten ihre eigenen Lizenzen.
