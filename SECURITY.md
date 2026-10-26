# Security design & responsible use — ToyVerse Tab

## Threat model (what this is for)
A reclaimed tablet that runs your ToyVerse dashboards and may touch wallet
addresses / keys, and doubles as a security-research box for **your own**
infrastructure. The design assumes: untrusted networks, possible device theft,
and a long-lived device that must stay patched.

## The hardening layers
| Layer | What | Where |
|-------|------|-------|
| Boot/disk | **LUKS2 full-disk encryption** (`pmbootstrap --fde`) | set at build time |
| Firewall | **nftables default-deny** inbound; app server bound to loopback only | `overlay/etc/nftables.d/toyverse.nft` |
| Kernel | sysctl hardening (rp_filter, ptrace_scope, kptr/dmesg restrict, ASLR, protected_* ) | `overlay/etc/sysctl.d/99-*.conf` |
| Remote access | sshd **off by default**; if on: key-only, modern ciphers, rate-limited | `overlay/etc/ssh/sshd_config.d/10-*.conf` |
| Brute-force | fail2ban on ssh/httpd logs | `harden.sh` |
| OS updates | weekly **signed** `apk upgrade` with snapshot, service check and reboot flag for kernel updates | `usr/local/bin/toyverse-update` |
| UI updates | daily check of an **Ed25519-signed** manifest; only allow-listed files, sha256-checked before anything is replaced, automatic rollback on failure | `usr/local/bin/toyui-update`, `etc/toymesh/ui-update.pub` |
| Time | chrony — correct time = valid TLS & signature checks | `harden.sh` |
| Secrets | gnupg / `pass` / `age` for local key & backup encryption | `hardening.list` |
| Privacy | optional Tor + proxychains for egress | `hardening.list` |
| Audit | `lynis audit system` for a score + concrete fixes | `hardening.list` |

### Wallet-key specific advice
- Prefer a **watch-only** setup on the tablet (public address, no private key) —
  the ToySafe Cockpit and the wallet-connect page only *read* balances.
- If you must hold keys, keep them in an `age`/GPG-encrypted file on the LUKS
  volume, never in plaintext or browser localStorage.
- The launcher and apps make **no outbound calls** except the explicit
  Polygonscan/Etherscan links you tap. Everything else is local.

## Why postmarketOS and not "hardened Android 7.1"
Android on this device is stuck at an unofficial 7.1 with no security patches,
and community attempts to backport patches broke the system. You cannot make an
unpatched 2017-era Android "state of the art" by adding apps. A maintained Linux
with signed, ongoing package updates is the honest answer on this hardware.

---

## Responsible use of the security-research toolkit — read this
The tools in `security-research.list` are the standard open-source suite (the
same ones in Kali/Parrot/BlackArch). They are **dual-use**: legitimate for
testing systems you own or are authorised to test, and illegal when pointed at
others without permission.

- Test only: **your own** ToyVerse nodes/APIs, your own hosts, your own Wi-Fi,
  or targets you have **written authorisation** for (a signed scope / pentest
  engagement, a bug-bounty program's rules).
- In Germany, unauthorised access, interception, data interference and
  "hacking-tool" misuse are criminal under **§§ 202a–202d, 303a–303b StGB**.
  Most countries have equivalents (CFAA in the US, Computer Misuse Act in the UK).
- Wireless capture/injection, credential brute-forcing, and traffic
  interception against third parties are exactly the acts those laws cover.
- This kit deliberately contains **no exploit payloads, malware, or anything
  pre-aimed at a specific third party** — it's an environment, not a weapon.
  Keep it that way.

Logging, scoping, and authorisation are part of doing this properly. If you're
testing for someone else, get the scope in writing first.

## UI-Update-Kette
- **Schlüssel:** Der private Ed25519-Schlüssel wird nur auf dem PC erzeugt und offline
  aufbewahrt. Er gehört weder ins Repo noch aufs Tablet. Verlust bedeutet: neuen Schlüssel
  erzeugen und `ui-update.pub` auf dem Tablet neu setzen.
- **Signatur vor Inhalt:** Die Signatur wird über das Manifest geprüft, bevor eine Datei
  geladen wird. Dadurch gilt auch ein Angriff auf den Server (ohne Schlüssel) als gescheitert.
- **Pfad-Allowlist:** Der Updater akzeptiert nur die vier Oberflächendateien. Alles andere
  wird verworfen, auch wenn es im signierten Manifest steht.
- **Transport:** Nur `https://` (oder `http://127.0.0.1` / `localhost` zum lokalen Test).
- **Schwellwert:** Ein Release gilt erst mit mindestens THRESHOLD (Standard 2, nie unter 2) unabhängigen Signierern.
- **Keine Teil-Updates:** Erst nach erfolgreicher Prüfung aller Dateien wird ersetzt. Schlägt
  die Nachprüfung fehl, wird die Sicherung automatisch zurückgespielt.
- **Getestet:** gültiges Update und Rollback; manipulierte Datei, manipuliertes Manifest,
  fremder Schlüssel, ältere Version, gleiche Version, unerlaubter Pfad, leere Quelle,
  nicht erreichbare Quelle und `http://` außerhalb von localhost. Bei jedem Fehlschlag blieb
  das Gerät unverändert.
- **Nicht gelöst:** Ein gestohlener privater Schlüssel würde signierte Updates erlauben.
  Deshalb den Schlüssel offline halten und bei Verdacht sofort rotieren.

## OS-Updates
- **Wöchentlich** per cron: `toyverse-update` (Standard). Status: `doas toyverse-update --status`.
- **Vor jedem Update** wird ein Paket-Snapshot unter `/var/lib/toymesh/os-snapshots/` gespeichert
  (die letzten fünf). Nach dem Update entsteht ein zweiter Snapshot, damit sich die Änderungen
  nachvollziehen lassen. Protokoll: `/var/log/toyverse-update.log`.
- **Kernel und Start-Pakete** (`linux-*`, Boot-Pakete) werden installiert, aber erst nach einem
  Neustart aktiv. Der Updater setzt dann `/var/lib/toymesh/reboot-required`. Der Neustart ist
  deine Entscheidung, das Gerät startet nie selbst neu.
- **Dienstprüfung** nach jedem Update: `toyverse-web` und `nftables` werden bei Bedarf neu gestartet.
- **Testing-Quelle** nur mit Tag `@testing`: Testpakete kommen nur, wenn sie ausdrücklich angefordert
  werden, und nicht mit jedem `apk upgrade`.
- **Zurücksetzen:** `doas toyverse-update --list` zeigt Snapshots, `doas toyverse-update --restore <Datei>`
  setzt die Pakete auf die alten Versionen zurück.
- **Ehrlich:** Ein Zurücksetzen klappt nur, solange der Mirror die alten Versionen noch hat. Der
  Updater meldet jedes Paket, das nicht mehr verfügbar ist. Für einen garantierten Rückweg braucht
  es ein Btrfs-Snapshot-Setup oder ein zweites Root-System, das ist in diesem Kit nicht enthalten.

## ToyChat
- Nachrichten und Anruf-Signale sind mit einem Raumschlüssel (AES-256-GCM) verschlüsselt. Der
  Schlüssel steckt nur im Einladungslink und verlässt den Browser nie.
- Jede Nachricht ist mit dem Schlüssel des Absenders signiert (ECDSA P-256). Manipulierte oder
  fremd signierte Einträge werden verworfen.
- Der Relais-Server speichert nur Chiffrat, läuft als eigener Benutzer ohne Login und nur auf loopback.
- Keine Vorwärtsgeheimhaltung und sichtbare Metadaten: siehe TOYCHAT.md, Abschnitt „Grenzen“.

## ToySafe-Prüfung (lokal)
- `doas toysafe-check` zeigt eine Ampel mit neun Prüfungen: Verschlüsselung, Firewall, SSH,
  Uhrzeit (höchstens 15 s Abweichung), Updates und Neustart, Paketquellen, Schutzdienste,
  signierte Oberfläche und Schlüssel im Web-Bereich.
- Die Prüfung ist **nur lesend**. Sie ändert keine Einstellung, sperrt nichts und sendet nichts.
  Ergebnis: Ausgabe 0 = grün, 1 = gelb, 2 = rot. Täglich per cron, Ergebnis in
  `/var/lib/toymesh/schutzstufe.json`.
- Grundlage: ToySafe-Grundsätze G1 bis G4 (ToyChain-Konzept `docs/spaeter/14-toysafe.md`).
  Eine volle ToySafe-App mit Warnlisten und Wallet-Prüfung ist noch nicht gebaut.

## Signierer-Schwelle und Warnliste
- Updates und Warnlisten brauchen mindestens zwei von den Schlüsseln in `/etc/toymesh/keys/`. Ein einzelner
  kompromittierter Schlüssel reicht nicht. Getestet: zwei gültige Unterschriften akzeptiert; eine, eine
  Fälschung mit fremdem Schlüssel unter einem bekannten Namen, Schwelle 1 und Schwelle 3 mit nur zwei
  Unterschriften abgelehnt; manipulierte Warnliste abgelehnt.
- Die Warnliste ist nur Hinweis. Ein Eintrag in der Liste blockiert nichts.
- Die Liste wird bei jeder Prüfung neu verifiziert, nicht nur beim Herunterladen. Fehlt eine Unterschrift,
  wird die Liste nicht verwendet.
- **Noch nicht umgesetzt:** Verankerung der Release- und Listen-Hashes in der ToyChain (Anker-Transaktion,
  Vorschlag Nr. 124 in `docs/02-entscheidungen.md`). Sie hängt von Meilenstein M4 bis M13 ab.
