# Hardware reality check — Galaxy Tab 2 10.1 (GT-P5110)

Read this before expecting miracles. The build is designed *around* these limits.

| Part | Spec | Consequence for this build |
|------|------|----------------------------|
| SoC | TI OMAP 4430 | armv7 (32-bit). No arm64 packages. |
| CPU | 2× Cortex-A9 @ 1.0 GHz | Fine for shells, scanners, static web apps. Slow for crypto cracking, heavy JS. |
| RAM | **1 GB** | The hard ceiling. No GUI Wireshark/Burp/Firefox-heavy sessions. Use CLI tools + the `cog` kiosk browser. |
| GPU | PowerVR SGX540 | **No open driver.** postmarketOS runs software rendering only. UI must be light (Sxmo/Sway, not GNOME/Plasma). `hashcat` gets no GPU acceleration. |
| Storage | 8/16/32 GB + microSD | Put the data/tools partition on a big microSD; keep internal for the OS. |
| Wi-Fi | internal (bcm) | Almost certainly **no monitor mode / injection**. Wireless auditing needs an external USB adapter (e.g. Atheros AR9271) via an OTG cable. |
| Modem | none (P5110 = Wi-Fi only) | No cellular; it's a Wi-Fi tablet. |

## What this means concretely

- **postmarketOS (Linux), not Android.** On this device Android tops out at
  unofficial Android 7.1 and gets *no* security patches — attempts to backport
  them bricked the UI in the community builds. A maintained mainline-ish Linux
  with live, signed updates is the only "state of the art security" option here.
  The trade-off: **Android apps do not run.** Your ToyVerse apps are HTML, so
  they run fine; an Android-only tool would not.
- **The GPU blob is unsupported.** Don't file PowerVR bugs upstream; it's a
  known limitation. Keep the UI minimal.
- **Think "capable ARM security box," not "pocket Kali workstation."** Recon,
  network analysis, web-app testing, firmware/forensics, and scripting all work
  well. GPU cracking and RAM-hungry GUIs do not.
