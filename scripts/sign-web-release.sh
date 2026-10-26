#!/bin/sh
# ToyMesh: create a signed website release for toyweb-update (on the PC, not on the device).
#
#   sh scripts/sign-web-release.sh AUSGABE [SIGNIERER.pem ...]
#
# Packs overlay/srv/toyverse/web (built by fetch-website.sh) into site.tar.gz and writes
# manifest.json with version, commit, SHA-256 and size. Every key given signs the manifest
# (signer-a.pem -> manifest.sigs/signer-a.sig). Without keys only an unsigned manifest is
# written, which every device rejects. WEB_SRC can point to another built site.
set -eu

OUT="${1:?Ausgabeordner fehlt}"
shift
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${WEB_SRC:-$HERE/overlay/srv/toyverse/web}"
[ -f "$SRC/de/index.html" ] && [ -f "$SRC/VERSION.json" ] || {
  echo "Keine gebaute Webseite in $SRC. Zuerst: bash scripts/fetch-website.sh" >&2; exit 1; }

mkdir -p "$OUT"
VER=$(sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$SRC/VERSION.json")
COMMIT=$(sed -n 's/.*"commit":"\([^"]*\)".*/\1/p' "$SRC/VERSION.json")
[ -n "$VER" ] || { echo "VERSION.json ohne Version" >&2; exit 1; }

# Reproducible archive: sorted names, fixed owner and time, no VERSION.json (the device writes it)
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='2026-01-01 00:00Z' \
    --exclude=./VERSION.json -C "$SRC" -cf - . | gzip -n -9 > "$OUT/site.tar.gz"
SHA=$(sha256sum "$OUT/site.tar.gz" | awk '{print $1}')
SIZE=$(wc -c < "$OUT/site.tar.gz" | tr -d ' ')
printf '{"version":"%s","commit":"%s","archive":"site.tar.gz","sha256":"%s","size":%s}\n' \
  "$VER" "$COMMIT" "$SHA" "$SIZE" > "$OUT/manifest.json"

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
echo "Webseite $VER (Commit $COMMIT), $SIZE Byte in $OUT"
