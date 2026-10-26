#!/usr/bin/env bash
# ToyMesh PC-Version: baut ein x86_64-Image als virtuelle Festplatte (qemu-amd64).
# Läuft unter Linux oder in WSL2 (Ubuntu) auf einem Windows-PC. NICHT für das Tablet.
#
# Ergebnis: ~/toymesh-pc/toymesh-pc.img (roh, startbar in VirtualBox, QEMU oder VMware).
# Nicht geprüft: echte Hardware-Installation per USB. Das ist ein eigener Schritt.
set -euo pipefail

DEVICE="qemu-amd64"          # postmarketOS-Gerät für x86_64 (Paket device-qemu-amd64)
OUT="$HOME/toymesh-pc"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

case "$(uname -m)" in
  x86_64) ;;
  *) echo "FEHLER: dieses Skript braucht einen x86_64-Rechner (gefunden: $(uname -m))." >&2; exit 1 ;;
esac
command -v git >/dev/null || { echo "FEHLER: git fehlt (sudo apt install git python3)." >&2; exit 1; }
command -v python3 >/dev/null || { echo "FEHLER: python3 fehlt." >&2; exit 1; }

if ! command -v pmbootstrap >/dev/null 2>&1; then
  if [ ! -d "$HOME/.local/pmbootstrap" ]; then
    echo "==> pmbootstrap holen"
    git clone --depth=1 https://gitlab.postmarketos.org/postmarketOS/pmbootstrap.git "$HOME/.local/pmbootstrap"
  fi
  PMB="$HOME/.local/pmbootstrap/pmbootstrap.py"
else
  PMB="pmbootstrap"
fi

cat <<EOM

==> Einrichtung (einmalig). Antworte so:
      vendor               : die Auswahl, die zu "qemu" passt
      device               : ${DEVICE}
      username             : toy
      user interface       : none     (Oberfläche später per Overlay)
      full disk encryption : y
    Eine Paketliste ist in packages/base.list. Sie wird nach dem ersten Start eingespielt.

Enter drücken, um 'pmbootstrap init' zu starten.
EOM
read -r _
$PMB init

echo "==> System bauen (kann eine Stunde dauern)"
$PMB install

echo "==> Image exportieren"
$PMB export
EXPORT="$($PMB config work)/chroot_native/home/pmos/rootfs"
mkdir -p "$OUT"
IMG=$(ls -1 "$EXPORT"/*.img 2>/dev/null | grep -v -- '-boot' | head -n1 || true)
if [ -z "$IMG" ]; then
  echo "FEHLER: kein .img gefunden in $EXPORT. Prüfe 'pmbootstrap export' und die Ausgabe oben." >&2
  exit 1
fi
cp "$IMG" "$OUT/toymesh-pc.img"
sha256sum "$OUT/toymesh-pc.img" > "$OUT/toymesh-pc.img.sha256"

cat <<EOM

==> Fertig: $OUT/toymesh-pc.img
    Starten mit QEMU (Linux/WSL, oder mit QEMU für Windows):
      qemu-system-x86_64 -m 2048 -smp 2 -drive file=$OUT/toymesh-pc.img,format=raw -nic user
    Oder in VirtualBox: neue VM (Linux, 64 Bit, 2 GB RAM), vorhandene Festplatte als RAW-Datei einhängen.
    Nach dem ersten Start: ToyMesh-Overlay einspielen (scripts/install-overlay.sh), dann scripts/harden.sh.
EOM
