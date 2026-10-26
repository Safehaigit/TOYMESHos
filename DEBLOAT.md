# No bloatware — by construction

postmarketOS is the opposite of a Samsung/Android stock image: it starts
**empty** and you add only what you list. So "debloat" here means *never
installing* bloat, not stripping it afterwards.

What is intentionally **absent**:
- No Samsung/TouchWiz, no Google Play Services, no Knox, no carrier apps.
- No heavyweight desktop (GNOME/Plasma) — would not fit 1 GB RAM anyway.
- No telemetry, no vendor "assistants", no pre-loaded games or store.
- No services enabled that you didn't ask for (sshd ships **off**).

What is deliberately **present** and why (all small):
- `sxmo-de-sway` + `foot` + `cog` — minimal UI + terminal + kiosk browser.
- `busybox httpd` — a few KB to serve your local ToyVerse apps.
- hardening + security tools — only the ones you chose, armv7-checked.

## Trim further (optional)
```sh
# see what's installed, biggest first
apk list -I | sort
# remove the UI entirely for a pure CLI/kiosk appliance:
doas apk del postmarketos-ui-sxmo-de-sway && \
  doas rc-update add toyverse-kiosk default   # boot straight into the apps
# drop tool groups you don't use (example: wireless, if you have no USB adapter)
doas apk del aircrack-ng hcxtools hcxdumptool reaver
```
Keep `chrony`, `nftables`, `apk-tools`, and the update timer — those are the
spine of staying secure.
