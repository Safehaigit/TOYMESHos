# ToySurf + ToySearch — ToyMesh's browser & search

## What they are (honestly)
- **ToySurf** is not a new browser engine — writing one is a multi-year effort by
  large teams, and nothing new could be more secure than the audited engines.
  ToySurf is a **hardened, locked-down, customizable wrapper** around a real
  engine, with a privacy profile, ad/track blocking, a sandbox, and ToySearch
  as default. You get "state-of-the-art security" by standing on a mature engine
  and configuring it aggressively — which is exactly how secure browser setups
  are built in practice.
- **ToySearch** is not a from-scratch web index (impossible on this device, and
  pointless to reinvent). It's a **local privacy search page** that searches your
  ToyVerse content **offline** and forwards web queries, only on your click, to a
  datensparsam backend you choose (DuckDuckGo/Startpage/Brave/Wikipedia, or your
  own self-hosted SearXNG).

## Two engines (pick in `/etc/toysurf/toysurf.conf`)
| Profile | Engine | Compatibility | Footprint | Hardening |
|---------|--------|---------------|-----------|-----------|
| **FULL** | Firefox ESR | Best (full modern web) | Heavy on 1 GB | policies.json + arkenfox-style user.js + uBlock Origin |
| **LITE** | badwolf / surf / cog (WebKitGTK/WPE) | Good-enough; some modern JS/CSS may differ | Tiny — right for this tablet | privacy defaults, ephemeral session, system blocklist, ToySearch home |

`TOYSURF_ENGINE=auto` uses FULL if Firefox ESR exists for armv7, else LITE.
> Reality on the GT-P5110: Firefox ESR may not be packaged for armv7, and even if
> it is, 1 GB RAM makes it sluggish. LITE (badwolf) is the recommended daily
> driver here; keep FULL for sites that genuinely need it.

## Security features
**FULL (Firefox) — enforced by `policies.json` + `user.js`:**
- Telemetry, Studies, Pocket, Accounts, crash reports: **off**
- **HTTPS-Only** forced (loopback exempt, so local apps still load)
- **DNS-over-HTTPS** (Quad9) · prefetch & speculative connections off
- **Total Cookie Protection** + first-party isolation + network partitioning
- **Strict tracking protection** (trackers, crypto-miners, fingerprinters)
- **resistFingerprinting** (letterboxing) · WebGL/WebRTC/geolocation off
- Referer trimming · disk cache off · no saved logins · sanitize sessions on close
- **uBlock Origin** force-installed · camera/mic/location/notifications blocked
- Default search locked to **ToySearch**
- Runs under **firejail/bubblewrap** sandbox when available

**LITE (WebKit):** no persistent cookies by default, ephemeral profile option,
ToySearch homepage, ads/trackers via a system hosts blocklist, sandbox wrap.

## Customize
Edit `/etc/toysurf/toysurf.conf` and relaunch `toysurf`:
- `TOYSURF_ENGINE` auto/full/lite · `TOYSURF_HOME` start page
- `TOYSEARCH_MODE` ddg/startpage/brave/local · `TOYSEARCH_BACKEND` (SearXNG URL)
- `TOYSURF_EPHEMERAL` forget-everything mode · `TOYSURF_TOR` route via Tor
- `TOYSURF_SANDBOX`, `TOYSURF_HTTPS_ONLY`, `TOYSURF_RESIST_FINGERPRINT`, …
Tune Firefox prefs further in `/etc/toysurf/user.js` (comment out anything that
breaks a site you need — fingerprint-resist and HTTPS-only are the usual culprits).

## Optional: your own search engine (self-hosted SearXNG)
For a real "ToySearch runs it all locally" setup, self-host **SearXNG** — a
privacy metasearch that queries upstream engines server-side and returns clean,
trackerless results:
```sh
doas apk add searxng || doas pipx install searxng   # whichever your repo offers
# configure it to listen on 127.0.0.1:8888, then:
#   in toysurf.conf set TOYSEARCH_MODE=local  (backend http://127.0.0.1:8888)
#   in ToySearch, pick "Nur lokal/SearXNG"
```
Note: even SearXNG relies on upstream engines for *results* — it removes the
tracking, it doesn't crawl the web itself. On 1 GB RAM it's usable but not fast.

## Launch
```sh
toysurf               # opens ToySearch
toysurf https://…     # opens a URL, hardened
```
Add it to your Sxmo/Sway menu, or set the kiosk service to run `toysurf` instead
of `cog` for a locked, hardened browsing appliance.
