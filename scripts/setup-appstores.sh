#!/bin/sh
# ToyVerse Tab — set up every software source that actually works on this
# hardware (armv7 / 1 GB / no GPU). Run on the tablet via doas.
# Read APPSTORES.md for what's realistic and what isn't (Android stores!).
set -eu

log(){ echo "[appstores] $*"; }

# ---- 1. apk: the native store — enable all repo tiers ----
log "configuring apk repositories (main, community, testing)"
REPO=/etc/apk/repositories
# postmarketOS ships main+community; ensure Alpine edge testing is present too.
grep -q "/community" "$REPO" 2>/dev/null || log "note: add your release's community repo if missing"
if ! grep -q "/testing" "$REPO" 2>/dev/null; then
    echo "https://dl-cdn.alpinelinux.org/alpine/edge/testing" >> "$REPO"
fi
apk update
log "apk ready:  apk search <name> ;  apk add <name>"

# ---- 2. Flatpak + Flathub (works, but few armv7 apps — see APPSTORES.md) ----
if apk add --no-interactive flatpak >/dev/null 2>&1; then
    flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo || true
    log "flatpak + flathub added (CAVEAT: most Flathub apps are x86_64/aarch64, not armv7)"
else
    log "flatpak not available for armv7 — skipped"
fi

# ---- 3. Language 'stores' — these genuinely have huge catalogs that work ----
log "setting up language package managers (CLI app sources)"
apk add --no-interactive python3 py3-pip pipx 2>/dev/null && pipx ensurepath 2>/dev/null || true   # PyPI
apk add --no-interactive npm 2>/dev/null || true     # npm registry
apk add --no-interactive cargo 2>/dev/null || true   # crates.io
apk add --no-interactive ruby 2>/dev/null || true    # RubyGems
log "  PyPI:   pipx install <tool>"
log "  npm:    npm -g install <pkg>"
log "  cargo:  cargo install <crate>"
log "  gems:   gem install <gem>"

# ---- 4. AppImage runtime (optional; armv7 AppImages are rare) ----
# AppImages are self-contained; just need FUSE. Most are x86_64 though.
apk add --no-interactive fuse 2>/dev/null || true

cat <<'EOF'

==> Software sources ready.
    REAL stores on this device:  apk (native, thousands of armv7 pkgs),
    plus PyPI/npm/crates.io/RubyGems for CLI tools, plus Flathub (sparse on armv7).

    ANDROID app stores (Google Play, F-Droid, Aptoide, Amazon, Galaxy Store, …)
    need an Android runtime (Waydroid). That requires a working GPU/EGL and
    realistically aarch64 + >=2 GB RAM. This tablet has no GPU driver and 1 GB,
    so Waydroid — and therefore Android stores and APKs — will NOT run here.
    See APPSTORES.md for the full explanation and alternatives.
EOF
