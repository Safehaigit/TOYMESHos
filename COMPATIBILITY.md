# ToyVerse apps — compatibility & consistency audit

Checked the two real apps (ToySafe Cockpit, ToyVerse site) against each other
and against this device. Facts below come from grepping the actual files.

## ✅ Good
- **Shared design language.** Both use the same fonts (Amiri + Chakra Petch)
  and the same ecosystem naming — they read as one product.
- **No external script dependencies.** Neither app loads JS from a CDN; the
  Cockpit's React is **inlined**, so it runs fully offline. (`react.dev` only
  appears inside React's built-in error messages, not as a network call.)
- **`toypay-verify.xyz` is safe.** It's not a live endpoint — it's a scripted
  **phishing-training example** inside the Cockpit ("confirm your 12 words …
  install AnyDesk … tell no one"). The Cockpit doubles as anti-scam education.
  Left as-is on purpose.

## 🔧 Fixed in this kit
- **Website pulled fonts from Google's CDN** → broke offline use and leaked a
  request to Google on every load. **Fixed:** the website copy now loads
  `fonts/fonts.css` (local). Run `scripts/fetch-fonts.sh` on your PC to bundle
  the real woff2 files; without them it falls back to Georgia/system cleanly.
  (The Cockpit already had no CDN font dependency — nothing to change.)

## ⚠️ Content gaps to align (your call — I didn't rewrite your app content)
- **ToyCash is missing from the Cockpit** (0 mentions) although the website
  lists it as one of the five pillars (TOYPAY, TOYQUEST, ToyChain, ToyCash,
  ToyScan). Either add a ToyCash view/row to the Cockpit, or mark it
  "Konzept – noch nicht im Cockpit" so the two agree. The launcher already
  shows ToyCash with a **Konzept** badge so the ecosystem view stays complete.
- **Token contract addresses live only on the website**, not in the Cockpit.
  If the Cockpit is your supply/wallet dashboard, surfacing the Polygon +
  Ethereum ToyCoin addresses there would make the two consistent.
- **Supply wording differs cosmetically:** Cockpit "100 Millionen" vs website
  "100.000.000". Same number — pick one phrasing for polish.

## 🔎 Worth a manual check
- The Cockpit makes **3 `fetch()` calls.** Nothing in the audit points them at
  an external host, so they're almost certainly relative/local or guarded — but
  confirm they resolve locally (or fail gracefully) so the Cockpit stays 100%
  offline on the tablet. If any targets a remote API, either bundle that data
  or gate it behind an explicit online action.

## 📱 Hardware-compatibility of the apps on this tablet
- Both are **web apps → they run** (that's why the HTML path matters; an Android
  APK of TOYPAY would not — see `APPSTORES.md`).
- The **Cockpit is a 1.7 MB React bundle** — it will be the heaviest thing on a
  1 GB / software-rendered WebKit. Expect a slow first paint; it should be
  usable once loaded. The lightweight `cog` browser is the right host for it;
  avoid running it alongside many other apps.
- The ToyVerse site is light and will feel snappy.

## Update 26.10.2026: Webseite aus dem echten Build
- Die alte Einzeldatei `apps/toyverse-website.html` ist entfernt. Sie war eine veraltete
  Kopie und versprach noch Bridge, EVM, „TOYPAY auf Polygon“ und ToyCash auf der Kette
  (Widerspruch zu den Entscheidungen 36, 61, 63, 123 in TOYfoundation/toycoin).
- Stattdessen baut `scripts/fetch-website.sh` die Webseite aus `TOYfoundation/ToyVerse-web`
  für den Pfad `/web/` (alle übersetzten Sprachen, Schriften selbst gehostet, keine Anfragen
  an Dritte, alle internen Links geprüft). Launcher und ToySearch zeigen auf `web/de/…`.
- Auf dem Gerät hält `toyweb-update` die Seite aktuell, nur mit mindestens 2 gültigen
  Unterschriften, geprüfter Prüfsumme und einem Archiv ohne Links oder Pfade nach außen.
  Rückbau mit `toyweb-update --rollback`.
- Geprüft: Installation, „bereits aktuell“, neues Release, Rückbau, reproduzierbares Archiv,
  und abgewiesen: eine Unterschrift, verändertes Archiv, `../`-Pfad, absoluter Pfad, Link,
  Archivname mit Pfad. Im Browser: ToyVerse, TOYPAY und ToyCash öffnen im Launcher, alle
  Links der Suche antworten mit 200.
