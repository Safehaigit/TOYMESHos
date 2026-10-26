#!/bin/sh
# ToyMesh branding — run on the tablet via doas. Idempotent.
set -eu
log(){ echo "[brand] $*"; }

# 1. os-release (keep a backup of the original once)
if [ -f /home/*/toyverse-tab/overlay/usr/lib/os-release.toymesh ] 2>/dev/null; then :; fi
SRC="$(dirname "$0")/../overlay/usr/lib/os-release.toymesh"
if [ -f "$SRC" ]; then
    [ -f /etc/os-release.orig ] || cp -f /etc/os-release /etc/os-release.orig 2>/dev/null || true
    cp -f "$SRC" /etc/os-release
    log "os-release -> ToyMesh"
fi

# 2. hostname
echo "toymesh" > /etc/hostname
hostname toymesh 2>/dev/null || true
if grep -q "127.0.1.1" /etc/hosts 2>/dev/null; then
    sed -i 's/^127\.0\.1\.1.*/127.0.1.1\ttoymesh/' /etc/hosts
else
    echo "127.0.1.1	toymesh" >> /etc/hosts
fi
log "hostname -> toymesh"

# 3. login banners
cat > /etc/motd <<'EOF'

   ▟▙ ToyMesh — hardened postmarketOS for the ToyVerse
      apps: http://127.0.0.1:8080/   ·   browser: toysurf   ·   search: ToySearch
      firewall: nftables (default-deny)   ·   disk: LUKS   ·   updates: auto

EOF
echo "ToyMesh \\r (\\l)" > /etc/issue
log "motd/issue -> ToyMesh"

log "done. New shells show the ToyMesh banner."
