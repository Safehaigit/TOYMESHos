#!/usr/bin/env bash
# ToyVerse Tab — fetch the web fonts ONCE on your Linux PC (where network works)
# so the appliance can render them fully offline. Run before building/flashing.
# Puts woff2 files next to overlay/srv/toyverse/fonts/fonts.css.
#
# Fonts: Amiri (OFL) and Chakra Petch (OFL) — both open-licensed for bundling.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/overlay/srv/toyverse/fonts"
mkdir -p "$OUT"

# Google Fonts serves woff2 directly; these css2 endpoints return @font-face
# blocks with the file URLs. We parse the URLs out and download them.
ua="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

grab() { # <css-url> <outfile-prefix>
  local css url i=0
  css=$(curl -sfL -A "$ua" "$1")
  echo "$css" | grep -oE "https://[^ )]+\.woff2" | while read -r url; do
    i=$((i+1))
    curl -sfL -A "$ua" "$url" -o "$OUT/$2-$i.woff2" && echo "  saved $2-$i.woff2"
  done
}

echo "==> fetching Amiri"
grab "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" amiri-raw
echo "==> fetching Chakra Petch"
grab "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&display=swap" chakra-raw

cat <<'EOF'

==> Downloaded. Now rename to the names fonts.css expects, e.g.:
      amiri-raw-1.woff2  -> amiri-400.woff2
      amiri-raw-2.woff2  -> amiri-700.woff2
      chakra-raw-1.woff2 -> chakra-400.woff2   (weights in request order 400,600,700)
      chakra-raw-2.woff2 -> chakra-600.woff2
      chakra-raw-3.woff2 -> chakra-700.woff2
    (order can vary; open each in a viewer if unsure. If you skip this step the
     pages still render with Georgia / system fonts — just not the exact faces.)
EOF
