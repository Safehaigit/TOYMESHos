# Build & flash — ToyVerse Tab

You need a **Linux PC** (building an OS image can't be done on the tablet or in
a chat sandbox). Budget ~10–20 GB disk and 1–2 hours the first time.

## 0. Back up & prerequisites
- **Back up the tablet** — everything gets wiped.
- On the PC: `python3`, `git`, `heimdall` (for flashing Samsung devices) and
  Node.js 22.12 or newer (to build the ToyVerse website).
  Debian/Ubuntu: `sudo apt install python3 git heimdall-flash`, Node.js from nodejs.org
- Know your recovery combo: **Power + Volume-Down** to enter download/Odin mode;
  **Power + Volume-Up** for recovery.

## 1. Build
```sh
cd toyverse-tab
bash scripts/fetch-website.sh   # builds the ToyVerse website into overlay/srv/toyverse/web
sh scripts/build.sh
```
`fetch-website.sh` clones `TOYfoundation/ToyVerse-web`, builds it for the path
`/web/` and checks every internal link. Pass a local checkout instead if you have one:
`bash scripts/fetch-website.sh ../ToyVerse-web`.
This clones `pmbootstrap`, runs `pmbootstrap init` (use `pmbootstrap-init.txt`
to answer), then `install --fde` and `export`. At the end it prints the export
directory containing:
- `samsung-espresso10.img`       — root filesystem
- `samsung-espresso10-boot.img`  — kernel + initramfs

## 2. Flash — pick ONE path

### A) Internal storage (replaces Android) — heimdall
```sh
# tablet in download mode (Power + Vol-Down), connected by USB
heimdall flash --KERNEL samsung-espresso10-boot.img \
               --FACTORYFS samsung-espresso10.img --no-reboot
```
Then reboot. First boot is slow (FDE setup + first-run). Details & partition
names: https://wiki.postmarketos.org/wiki/Samsung_Galaxy_Tab_2_10.1_(3G_and_Wifi)_(samsung-espresso10)

### B) microSD dual-boot (keeps Android) — recommended to try first
pmOS can boot from SD, so you risk nothing on internal storage.
```sh
# find your card FIRST (do not get this wrong — it overwrites the target):
lsblk
# write the rootfs image to the card (replace sdX):
xz -dc samsung-espresso10.img.xz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
```
Flash the matching `-boot.img` as KERNEL with heimdall, insert the card, boot.
The pmOS wiki "use Community pre-built image" section covers the exact steps.

## 3. First boot → make it yours
Copy this `toyverse-tab/` folder to the tablet (USB stick, `scp`, or microSD), then:
```sh
doas sh scripts/install-overlay.sh   # apps + launcher + app server
doas sh scripts/harden.sh            # firewall, tools, sysctl, auto-updates
```
`harden.sh` prints exactly which tools installed and which armv7 skipped.

## 4. Open your apps
- Workstation mode (default): `cog http://127.0.0.1:8080/`
- Appliance/kiosk mode: see `overlay/etc/init.d/toyverse-kiosk` header.

## Updating apps later
Drop a new `.html` into `/srv/toyverse/apps/` (same name) — no rebuild, no
reflash. Add an app by adding an entry to `/srv/toyverse/apps.json`.

**Website:** `toyweb-update` replaces `/srv/toyverse/web` once a day from a signed
release, with the same keys and threshold as the UI updates (at least 2 signers).
On the PC: `bash scripts/fetch-website.sh`, then
`sh scripts/sign-web-release.sh ~/toyweb-release ~/toymesh-keys/signer-a.pem ~/toymesh-keys/signer-b.pem`,
put the folder on an HTTPS server and set `SOURCE=` in `/etc/toymesh/web-update.conf`.
Undo: `doas toyweb-update --rollback`.

## If a step fails
- Black screen after Samsung logo → wrong kernel variant; rebuild choosing the
  other kernel (mainline vs downstream) in `pmbootstrap init`.
- To go back to Android: reflash stock Samsung firmware (Odin/heimdall) first.
- Ask on `#postmarketOS` (Matrix/IRC) with your `pmbootstrap log`.
