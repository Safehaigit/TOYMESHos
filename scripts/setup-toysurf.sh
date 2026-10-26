#!/bin/sh
# ToySurf setup — run on the tablet via doas, after install-overlay.sh.
# Installs the best browser engine available for armv7, applies the hardened
# policy/profile, and wires ToySearch as the default engine.
set -eu
log(){ echo "[toysurf] $*"; }
has(){ command -v "$1" >/dev/null 2>&1; }

apk update || true

# --- 1. engine: try Firefox ESR (best compat); fall back to a light WebKit browser ---
FF_OK=0
if apk add --no-interactive firefox-esr 2>/dev/null || apk add --no-interactive firefox 2>/dev/null; then
    FF_OK=1; log "Firefox ESR installed (ToySurf FULL available)"
else
    log "Firefox not available for armv7 — using a light WebKit engine instead"
fi
# light engines (also used as the 'lite' profile on 1 GB RAM)
for e in badwolf surf cog; do
    apk add --no-interactive "$e" 2>/dev/null && { log "light engine: $e installed"; break; }
done

# --- 2. sandbox + tor wrappers (optional, best-effort) ---
apk add --no-interactive firejail 2>/dev/null || apk add --no-interactive bubblewrap 2>/dev/null || true
apk add --no-interactive tor torsocks 2>/dev/null || true

# --- 3. Firefox hardening: policies.json + user.js ---
if [ "$FF_OK" = 1 ]; then
    # distribution dir varies; cover the common locations
    for d in /usr/lib/firefox-esr/distribution /usr/lib/firefox/distribution /etc/firefox/policies; do
        if [ -d "$(dirname "$d")" ]; then
            mkdir -p "$d"
            cp -f /etc/toysurf/policies.json "$d/policies.json"
            log "policies.json -> $d"
        fi
    done
    log "user.js is applied per-profile by the 'toysurf' launcher on first run"
fi

# --- 4. uBlock Origin for light engines (Firefox gets it via policy ExtensionSettings) ---
# badwolf/surf use WebKit content filters, not .xpi; ship a hosts-style blocklist.
if ! [ "$FF_OK" = 1 ]; then
    log "light engine: ad/track blocking via system hosts + ToySearch; see TOYSURF.md"
fi

# --- 5. make launcher executable ---
chmod 0755 /usr/local/bin/toysurf 2>/dev/null || true

cat <<EOF

==> ToySurf ready.  Launch:  toysurf           (opens ToySearch)
                            toysurf <URL>
    Config: /etc/toysurf/toysurf.conf  (engine, search, hardening toggles)
    FULL engine (Firefox ESR): $( [ "$FF_OK" = 1 ] && echo yes || echo "no — lite only on this arch" )
    Default search: ToySearch at http://127.0.0.1:8080/toysearch/
    Details & customization: TOYSURF.md
EOF
