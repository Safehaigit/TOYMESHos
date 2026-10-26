#!/bin/sh
# ToyVerse Tab — runs ON THE TABLET after first boot (as root / via doas).
# Copies the overlay into the live system, creates the kiosk user, and enables
# the ToyVerse app server. Safe to re-run (idempotent).
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"
OVERLAY="$HERE/overlay"

echo "==> installing overlay files"
# Copy everything under overlay/ to /, preserving paths.
cp -a "$OVERLAY/." /

echo "==> fixing modes"
chmod 0755 /etc/init.d/toyverse-web /etc/init.d/toyverse-kiosk
chmod 0755 /usr/local/bin/toyverse-update /usr/local/bin/toyverse-app-sync /usr/local/bin/toysurf /usr/local/bin/toyui-update /usr/local/bin/toysafe-check /usr/local/bin/toysafe-warn /etc/periodic/daily/toysafe-warn-update
chmod 0644 /etc/toymesh/ui-update.conf /etc/toymesh/web-update.conf
chmod 0755 /usr/local/bin/toyweb-update
mkdir -p /var/lib/toymesh/web-backup
if [ ! -f /srv/toyverse/web/de/index.html ]; then
    echo "!!  ToyVerse website missing in /srv/toyverse/web."
    echo "    On the PC run: bash scripts/fetch-website.sh, then run this installer again."
    echo "    Until then the ToyVerse entries in the launcher show an empty page."
fi
chmod 0755 /usr/local/bin/toymesh-profil /etc/init.d/toymesh-profil /etc/periodic/hourly/toymesh-profil
chmod -R a+rX /usr/local/lib/toyverse_diagnose
mkdir -p /etc/toymesh/keys /usr/local/lib/toymesh && chmod 0755 /etc/toymesh/keys /usr/local/lib/toymesh
chmod 0644 /usr/local/lib/toymesh/sigcheck.sh
chmod 0644 /etc/toymesh/warnliste.conf
mkdir -p /var/lib/toymesh/warnliste && chmod 0700 /var/lib/toymesh/warnliste
mkdir -p /var/lib/toymesh/ui-backup && chmod 0700 /var/lib/toymesh
chmod 0600 /etc/ssh/sshd_config.d/10-toyverse-hardening.conf 2>/dev/null || true
chmod 0644 /etc/sysctl.d/99-toyverse-hardening.conf
chmod 0644 /etc/nftables.d/toyverse.nft

echo "==> creating unprivileged 'kiosk' user (for appliance mode)"
if ! id kiosk >/dev/null 2>&1; then
    adduser -D -g "ToyVerse Kiosk" kiosk
    addgroup kiosk video 2>/dev/null || true
    addgroup kiosk input 2>/dev/null || true
    addgroup kiosk seat  2>/dev/null || true
fi

echo "==> creating ToyChat service user and data directory"
if ! id toychat >/dev/null 2>&1; then
    addgroup -S toychat 2>/dev/null || true
    adduser -S -D -H -G toychat -s /sbin/nologin toychat 2>/dev/null || true
fi
mkdir -p /var/lib/toychat && chown toychat:toychat /var/lib/toychat && chmod 0700 /var/lib/toychat
chmod 0755 /etc/init.d/toychat-server
chmod 0644 /etc/toychat/server.json

echo "==> device profile: classify hardware, adapt every hour"
rc-update add toymesh-profil boot
/usr/local/bin/toymesh-profil || true

echo "==> enabling the ToyVerse app server (loopback)"
rc-update add toyverse-web default
rc-service toyverse-web restart || rc-service toyverse-web start || true
rc-update add toychat-server default 2>/dev/null || true
rc-service toychat-server restart 2>/dev/null || rc-service toychat-server start 2>/dev/null || true

echo "==> applying ToyMesh branding"
sh "$HERE/scripts/brand-toymesh.sh" || true

cat <<EOF

==> Overlay installed.
    App server: http://127.0.0.1:8080/   (open it in cog/foot-launched browser)

    Workstation mode (default): your Sxmo/Sway desktop stays; launch the apps
      with:   cog http://127.0.0.1:8080/

    Appliance mode (locked kiosk): see overlay/etc/init.d/toyverse-kiosk header.

    Next: doas sh scripts/harden.sh
EOF
