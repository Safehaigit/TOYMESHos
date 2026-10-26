#!/usr/bin/env bash
# ToyVerse Tab — build driver (runs on your Linux PC, NOT on the tablet).
#
# Wraps postmarketOS pmbootstrap to build a minimal image for the Galaxy Tab 2
# 10.1 (samsung-espresso10). It does NOT flash — see BUILD.md for flashing,
# which depends on whether you boot from internal storage or SD card.
#
# Prereqocess: python3, git. pmbootstrap pulls the rest itself.
set -euo pipefail

DEVICE="samsung-espresso10"
UI="sxmo-de-sway"          # matches postmarketos-ui-sxmo-de-sway; or "sway" / "none"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> ToyVerse Tab build for ${DEVICE} (UI: ${UI})"

# 1. Get pmbootstrap
if ! command -v pmbootstrap >/dev/null 2>&1; then
    if [ ! -d "$HOME/.local/pmbootstrap" ]; then
        echo "==> cloning pmbootstrap"
        git clone --depth=1 https://gitlab.postmarketos.org/postmarketOS/pmbootstrap.git \
            "$HOME/.local/pmbootstrap"
    fi
    export PATH="$HOME/.local/pmbootstrap:$PATH"
    alias pmbootstrap="$HOME/.local/pmbootstrap/pmbootstrap.py"
    PMB="$HOME/.local/pmbootstrap/pmbootstrap.py"
else
    PMB="pmbootstrap"
fi

cat <<EOF

==> Next: run the interactive init once, then this script continues.
    Answer the prompts like this:
      vendor               : samsung
      device               : espresso10
      username             : toy        (or your choice)
      user interface       : ${UI}
      additional packages  : paste the contents of packages/base.list
                             (comma-separated, no comments) — or add later
      full disk encryption : y   (recommended; see SECURITY.md)
    See pmbootstrap-init.txt for a copy-paste package string.

Press Enter to launch 'pmbootstrap init'...
EOF
read -r _

$PMB init

echo "==> building rootfs + kernel"
$PMB install --fde     # --fde = full-disk encryption; drop it if you declined above

echo "==> exporting flashable images to \$(pmbootstrap config work)/chroot_native/home/pmos/rootfs/"
$PMB export

cat <<EOF

==> Build done. Images are in the export dir printed above:
      ${DEVICE}.img            (rootfs)         -> FACTORYFS / data
      ${DEVICE}-boot.img       (kernel+initrd)  -> KERNEL
    Flash them per BUILD.md (heimdall for internal, or dd to SD card).

    After first boot, copy this kit to the tablet and run:
      doas sh scripts/install-overlay.sh
      doas sh scripts/harden.sh
EOF
