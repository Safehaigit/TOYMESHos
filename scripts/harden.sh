#!/bin/sh
# ToyVerse Tab — runs ON THE TABLET (as root / via doas) after install-overlay.sh.
# Enables repos, installs hardening + security-research tools (skipping any the
# armv7 repos lack), applies firewall/sysctl, and sets up safe auto-updates.
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"

# ---- 1. enable community + testing repos (testing has many security tools) ----
echo "==> enabling community + testing repos"
REL="$(. /etc/os-release 2>/dev/null; echo "${VERSION_ID:-edge}")"
MIRROR="https://dl-cdn.alpinelinux.org/alpine"
# postmarketOS already ships its own + alpine community; add testing if missing.
# Testing wird nur mit Tag "@testing" eingebunden: Pakete kommen nur dann aus testing,
# wenn sie ausdrücklich angefordert werden. apk upgrade zieht sonst keine Testversionen.
if ! grep -q "/testing" /etc/apk/repositories 2>/dev/null; then
    echo "@testing ${MIRROR}/edge/testing" >> /etc/apk/repositories
fi
apk update

# ---- 2. helper: try to install a package, skip if unavailable on armv7 ----
INSTALLED=""; MISSING=""
try_add() {
    for p in "$@"; do
        if apk add --no-interactive "$p" >/dev/null 2>&1; then
            INSTALLED="$INSTALLED $p"
        else
            MISSING="$MISSING $p"
        fi
    done
}

# ---- 3. read package lists, stripping comments/blank lines ----
pkglist() { sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "$1" | tr -s ' ' '\n' | sed '/^$/d'; }

echo "==> installing hardening packages"
# shellcheck disable=SC2046
try_add $(pkglist "$HERE/packages/hardening.list")

echo "==> installing security-research toolkit (missing ones are skipped)"
# shellcheck disable=SC2046
try_add $(pkglist "$HERE/packages/security-research.list")

echo "==> installing ToyChat relay runtime (nodejs)"
# shellcheck disable=SC2046
try_add $(pkglist "$HERE/packages/toychat.list")

echo "==> installing kiosk/app packages"
# shellcheck disable=SC2046
try_add $(pkglist "$HERE/packages/toyverse-kiosk.list")

# ---- 4. firewall ----
echo "==> enabling nftables firewall"
# point nftables at our ruleset
if [ -f /etc/nftables.nft ] && ! grep -q 'nftables.d/toyverse.nft' /etc/nftables.nft; then
    echo 'include "/etc/nftables.d/toyverse.nft"' >> /etc/nftables.nft
elif [ ! -f /etc/nftables.nft ]; then
    echo 'include "/etc/nftables.d/toyverse.nft"' > /etc/nftables.nft
fi
rc-update add nftables default
rc-service nftables restart || rc-service nftables start || true

# ---- 5. sysctl ----
echo "==> applying sysctl hardening"
sysctl -p /etc/sysctl.d/99-toyverse-hardening.conf || true

# ---- 6. time sync ----
rc-update add chronyd default 2>/dev/null || rc-update add chrony default 2>/dev/null || true
rc-service chronyd restart 2>/dev/null || true

# ---- 7. sshd: keep OFF unless you want it ----
echo "==> sshd left DISABLED by default (enable manually if you need remote shell)"
# To enable later (after adding your key to ~/.ssh/authorized_keys):
#   rc-update add sshd default && rc-service sshd start

# ---- 8. fail2ban ----
rc-update add fail2ban default 2>/dev/null || true
rc-service fail2ban start 2>/dev/null || true

# ---- 9. auto-update: weekly OS upgrades + daily ToyVerse app sync ----
echo "==> scheduling weekly signed OS updates + daily app sync"
mkdir -p /etc/periodic/weekly /etc/periodic/daily
ln -sf /usr/local/bin/toyverse-update   /etc/periodic/weekly/toyverse-update
ln -sf /usr/local/bin/toyverse-app-sync /etc/periodic/daily/toyverse-app-sync
ln -sf /usr/local/bin/toyui-update /etc/periodic/daily/toyui-update
ln -sf /usr/local/bin/toysafe-check /etc/periodic/daily/toysafe-check
# toysafe-warn-update ist bereits im Overlay (aktualisiert die Warnliste täglich)
rc-update add crond default 2>/dev/null || true
rc-service crond start 2>/dev/null || true
# run one app sync now (no-op offline, or for apps without a source yet)
/usr/local/bin/toyverse-app-sync || true

# ---- 10. report ----
echo
echo "==> INSTALLED:$INSTALLED"
echo
echo "==> NOT AVAILABLE for armv7 (skipped):$MISSING"
echo
echo "==> Hardening complete. Run 'lynis audit system' for a security score."
echo "    Firewall active, sysctls applied, weekly updates scheduled."
