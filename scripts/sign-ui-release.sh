#!/bin/sh
# ToyMesh: erstellt ein UI-Release (auf dem PC, nicht auf dem Gerät).
#
#   sh scripts/sign-ui-release.sh VERSION AUSGABE [SIGNIERER.pem ...]
#
# Jeder übergebene Schlüssel unterschreibt das Manifest. Der Name ergibt sich aus der
# Datei (signer-a.pem -> signer-a). Ausgabe: manifest.json und manifest.sigs/<name>.sig.
# Ohne Schlüssel entsteht nur manifest.json (nur für lokale Tests, vom Gerät abgelehnt).
# UI_SRC kann einen anderen Quellordner angeben (Standard: overlay/srv/toyverse).
set -eu

VER="${1:?Version fehlt, z. B. 6.1.0}"
OUT="${2:?Ausgabeordner fehlt}"
[ "$#" -ge 2 ] && shift 2 || shift "$#"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${UI_SRC:-$HERE/overlay/srv/toyverse}"
FILES="index.html ui/shell.js ui/themes.css ui/toypost.js"

mkdir -p "$OUT"
{
  printf '{"version":"%s","channel":"stable","files":[' "$VER"
  first=1
  for f in $FILES; do
    [ -f "$SRC/$f" ] || { echo "fehlt: $SRC/$f" >&2; exit 1; }
    h=$(sha256sum "$SRC/$f" | awk '{print $1}')
    [ $first -eq 1 ] || printf ','
    first=0
    printf '{"path":"%s","sha256":"%s"}' "$f" "$h"
  done
  printf ']}\n'
} > "$OUT/manifest.json"

for f in $FILES; do
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$SRC/$f" "$OUT/$f"
done

if [ "$#" -gt 0 ]; then
  mkdir -p "$OUT/manifest.sigs"
  for key in "$@"; do
    name=$(basename "$key" .pem)
    openssl pkeyutl -sign -inkey "$key" -rawin -in "$OUT/manifest.json" -out "$OUT/manifest.sigs/$name.sig"
    echo "signiert von: $name"
  done
else
  echo "UNSIGNIERT (nur für lokale Tests): $OUT/manifest.json"
fi
echo "Version $VER: $(echo $FILES | wc -w) Dateien in $OUT"
