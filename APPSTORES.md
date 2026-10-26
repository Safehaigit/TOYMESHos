# App stores on the ToyVerse Tab — what's real on this hardware

"Build in all possible app stores" runs straight into the device's limits
(armv7 / 1 GB RAM / no GPU driver). Here's the honest picture, and what
`scripts/setup-appstores.sh` actually wires up.

## ✅ Works well — the real stores

| Store | What it gives you | Use |
|-------|-------------------|-----|
| **apk** (Alpine/pmOS) | The native store. Thousands of armv7 packages: tools, servers, the whole security suite. | `apk search x` · `apk add x` |
| **PyPI** (via pipx) | Huge catalog of Python CLI apps/tools. | `pipx install x` |
| **npm registry** | Node CLI tools, servers, build tooling. | `npm -g install x` |
| **crates.io** (cargo) | Rust CLI tools (many compile fine on armv7). | `cargo install x` |
| **RubyGems** | Ruby tools (e.g. some web-testing gems). | `gem install x` |

These cover essentially any *command-line / server / web* software you'd want
on a device like this, which is the device's real job.

## ⚠️ Installed but nearly empty for this CPU

| Store | Reality |
|-------|---------|
| **Flatpak / Flathub** | The client installs and the Flathub remote is added, but **Flathub builds almost nothing for armv7** — apps are x86_64 / aarch64. So the "store" is there but its shelves are mostly empty on this tablet. Kept because it costs nothing and an occasional armv7 Flatpak appears. |
| **AppImage** | Format works (needs FUSE), but armv7 AppImages are rare; most are x86_64. |
| **Snap** | snapd is not viable on Alpine/armv7 — not set up. |

## ❌ Not possible here — Android app stores

Google Play, **F-Droid**, Aptoide, Amazon Appstore, Samsung Galaxy Store,
Huawei AppGallery — these are **Android** stores. Linux can only run Android
apps through a compatibility layer, **Waydroid**, which needs:

- a working **GPU with EGL/GLES** — this device's PowerVR SGX540 has *no* open
  driver, so there is none;
- realistically **aarch64 and ≥ 2 GB RAM** — this is armv7 with 1 GB.

So Waydroid won't run, and with it no Android store and no APKs. This directly
affects **TOYPAY**, which is planned as an Android APK: that APK can't run on
*this* tablet. The path here is the **web/HTML** version of each ToyVerse app
(already wired into the launcher), which is also what makes them auto-updatable
and offline-capable.

### If you later want real Android-app support
Use a device that fits Waydroid: an **aarch64** phone/tablet with a supported
GPU and ≥ 2–3 GB RAM running postmarketOS or a LineageOS-class ROM. Then
F-Droid + Aoptaide + the TOYPAY APK all work. The GT-P5110 is best kept as the
hardened web-apps + security-tools appliance this kit builds.

## Add a GUI "software center"?
postmarketOS on 1 GB is happiest without one. `apk` + the language managers are
the store. If you insist, `apk add gnome-software` exists but is heavy and not
recommended on this RAM.
