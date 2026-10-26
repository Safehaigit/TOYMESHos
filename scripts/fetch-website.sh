#!/usr/bin/env bash
# ToyMesh: build the ToyVerse website for the device (served at /web/) on your PC.
# Replaces the old single-file copy. Run before building/flashing, like fetch-fonts.sh.
#
#   bash scripts/fetch-website.sh                     # clones TOYfoundation/ToyVerse-web
#   bash scripts/fetch-website.sh ../ToyVerse-web     # uses an existing checkout
#
# Needs Node.js 22.12 or newer and git. While the repository is private, cloning
# needs your GitHub access (gh auth login or a credential helper).
# Result: overlay/srv/toyverse/web/ (not committed, see .gitignore) with VERSION.json.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/overlay/srv/toyverse/web"
REPO="https://github.com/TOYfoundation/ToyVerse-web"
SRC="${1:-}"

command -v node >/dev/null || { echo "Node.js fehlt (mindestens 22.12)." >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' \
  || { echo "Node.js $(node -v) ist zu alt, nötig ist 22.12 oder neuer." >&2; exit 1; }

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; return 0; }
trap cleanup EXIT

if [ -z "$SRC" ]; then
  TMP="$(mktemp -d)"
  echo "==> cloning $REPO"
  git clone --quiet --depth 1 "$REPO" "$TMP/web"
  SRC="$TMP/web"
fi
SRC="$(cd "$SRC" && pwd)"
[ -f "$SRC/astro.config.mjs" ] || { echo "$SRC ist kein Checkout von ToyVerse-web." >&2; exit 1; }

echo "==> installing exactly the locked versions"
(cd "$SRC" && npm ci --no-audit --no-fund)
echo "==> building for ToyMesh (base /web/)"
(cd "$SRC" && BASE_PATH=/web/ SITE_URL=http://127.0.0.1:8080 npm run build)
echo "==> checking internal links"
(cd "$SRC" && BASE_PATH=/web/ npm run check:links)

rev="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
built="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
rm -rf "$OUT.new"
cp -a "$SRC/dist" "$OUT.new"
printf '{"source":"TOYfoundation/ToyVerse-web","version":"%s","commit":"%s","built":"%s"}\n' \
  "$(date -u +%Y%m%d%H%M)" "$rev" "$built" > "$OUT.new/VERSION.json"
rm -rf "$OUT"
mv "$OUT.new" "$OUT"

pages=$(find "$OUT" -name index.html | wc -l)
echo "==> fertig: $pages Seiten in overlay/srv/toyverse/web (Commit $rev)"
