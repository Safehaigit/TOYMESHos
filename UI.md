# ToyMesh-Oberflächen

Zehn wählbare Oberflächen auf einer gemeinsamen App-Liste (`apps.json`). Wechsel
oben rechts im Auswahlfeld, Einstieg über den **Assistenten** (startet beim
ersten Öffnen automatisch).

| Oberfläche | Layout | Prinzip | Für wen |
|------------|--------|---------|---------|
| **ToyClassic** | Desktop | Taskleiste unten, Startmenü, Desktop-Symbole | Wer vertraute Desktop-Bedienung will |
| **ToyAqua** | Dock | Menüleiste oben, schwebendes Dock unten, Glas-Optik | Wer eine ruhige, aufgeräumte Oberfläche mag |
| **ToyQuest** | Karte | Orte auf einer Karte statt Menüs, Missionen im 1001-Nacht-Stil | Spielerisch, passend zu TOYQUEST |
| **ToyPlasma** | Panel | Panel mit App-Menü und Suche, Widgets auf dem Desktop | Wer viele Apps mit Suche steuern will |
| **ToySafe** | Cockpit | Status-Karten, Apps, Hinweise | Sicherheits- und Übersichtsfokus |
| **ToyTiles** | Kacheln | Große Kacheln, touch-first, Ein-Hand-Bedienung | Tablet-Nutzung im Liegen oder Stehen |
| **ToyGuide** | Assistent | Schritt-für-Schritt mit Seitenleiste | Einsteiger, erste Schritte |
| **ToyFocus** | Minimal | Eine Liste, Suche mit Strg+K, keine Ablenkung | Wer nur das Nötige will |
| **ToyDroid** | Android-Prinzip | Startbildschirm mit Uhr-Widget und Dock, App-Schublade (▲ Apps), Übersicht (■), Zurück/Home-Leiste. Gestaltung nach Material 3 (Android 16) | Wer Android-Bedienung gewohnt ist |
| **ToyDesk** | Arbeit | Seitenleiste mit Start, Aufgaben, Notizen, ToyPost, Apps | Für die tägliche Arbeit |

## Hinweise zur Gestaltung
- Die Oberflächen sind **inspiriert von Bedienprinzipien** bekannter Systeme
  (Taskleiste, Dock, Panel, Android-Startbildschirm). Logos, Markenelemente und
  Original-Icons werden bewusst nicht übernommen. „Plasma" ist als
  KDE-Plasma-Prinzip verstanden. Für ToyDroid habe ich Android 16 bzw.
  Material 3 als Vorbild genommen; den genauen Stand von Android 17 habe ich
  nicht verifiziert.
- Alle Oberflächen sind reines HTML/CSS/JS ohne externe Anfragen und laufen offline.

## ToyDesk und ToyPost
Aufgaben und Notizen funktionieren offline und werden im Browser-Speicher des
Geräts gehalten.

**ToyPost** ist an den ToyPost-Server angebunden (Repo `TOYfoundation/Toypost`,
Node.js-API unter `apps/api`). Im Tab „ToyPost" gibt es:
- **Heute**: Handlung nötig, Nachfassen fällig, wartet auf Antwort, neue Infos. Vorgänge lassen sich als erledigt markieren.
- **Vorgänge**: Liste mit Statusfilter und Suche.
- **Posteingang**: eingehende Nachrichten mit Sicherheitshinweisen.
- **Prüfen**: Text einfügen, ToyPost prüft ihn auf Betrug und TOY-Zahlungsaufforderungen.
- **Toy**: Ampel, Rechnungen, Meilensteine der Toy-Projekte.
- **Kanäle**: eingerichtete Kanäle und deren Fehler.
- **Verbindung**: Anmeldung am Server.

Sicherheit der Anbindung:
- Die Server-Adresse muss `https://` sein. `http://` ist nur für `127.0.0.1` und `localhost` erlaubt.
- Passwörter werden nicht gespeichert. Der Anmelde-Token liegt nur in `sessionStorage` und ist beim Schließen des Browsers weg.
- Der Server muss das Gerät erlauben: Auf dem ToyPost-Server `APP_ORIGIN=http://127.0.0.1:8080` setzen (Standard ist `*`, also alle Herkünfte).
- ToyDesk liest und ändert Vorgänge. Es sendet kein TOY und hält keine Schlüssel. Zahlungen bleiben in der Wallet.

Geprüft gegen den echten ToyPost-Server (lokal, Demo-Konto): Anmeldung, Adressprüfung,
Heute mit 6 Vorgängen, Vorgänge, Phishing-Prüfung (Befund „Phrase verlangt"),
Toy, Kanäle, Vorgang als erledigt, Abmelden. Der Posteingang war im Demo-Konto leer
und ist deshalb nur mit leerer Liste geprüft.

## Icons
Jede App bekommt ein Zwei-Buchstaben-Kürzel aus ihrem Namen ohne „Toy":
ToySafe → SA, ToyVerse → VE, ToySearch → SE, TOYPAY → PA.

## Assistent (Ersteinrichtung)
1. **Willkommen**: kurze Einführung.
2. **Oberfläche**: zehn Karten, Klick wechselt sofort.
3. **Datenschutz**: Standard, Streng oder Maximum.
4. **Fertig**: Zusammenfassung.

## Ehrlich: was noch nicht vollständig ist
- **ToySafe-Status** beschreibt die *Konfiguration* (was eingerichtet wurde), keine
  Live-Messung. Eine echte Laufzeitprüfung ist noch nicht eingebaut.
- **Datenschutz-Wahl** im Assistenten wird gespeichert, aber ToySurf übernimmt sie
  noch nicht automatisch. Anpassung weiterhin in `/etc/toysurf/toysurf.conf`.
- **Schriften**: Ohne `scripts/fetch-fonts.sh` (auf dem PC) fallen die Oberflächen
  auf System- bzw. Georgia-Schriften zurück. Die Dateinamen im Skript müssen dabei
  noch von Hand umbenannt werden.
- **App-Fenster** sind eingebettete Frames. Apps mit eigenem Login oder
  Drittanbieter-Einbettung können sich anders verhalten.
- **Aufgaben und Notizen** liegen nur auf diesem Gerät, ohne Synchronisation und Sicherung.

## Geprüft
Automatisch im Chromium-Headless-Browser: alle zehn Oberflächen laden und rendern,
Umschalten funktioniert, App-Fenster, Assistent, App-Schublade, Übersicht, Aufgaben
(hinzufügen, abhaken, nach Neuladen erhalten) und Notizen. Keine Konsolenfehler
außer den fehlenden Schriftdateien. Nicht geprüft: echtes Gerät mit 1 GB RAM und
Touchbedienung auf dem Tablet selbst.

## Eigene Oberfläche hinzufügen
1. In `ui/shell.js` einen Eintrag in `UIS` ergänzen (`id`, `name`, `layout`, `by`).
2. Ein Layout wählen, das es schon gibt, oder eine Funktion `L.<name>` ergänzen.
3. In `ui/themes.css` einen Block `body[data-ui="<id>"]{…}` mit den Variablen
   `--wall --bar --glass --panel-solid --ink --mu --acc --on-acc --line --hover --r --r-big --ico-r --font --serif`.

## UI-Updates (signiert, mehrere Unterschriften)
Die zehn Oberflächen lassen sich über `toyui-update` aktualisieren, ohne dass die Systemdateien neu
installiert werden müssen. Der Job läuft täglich (cron).

**Ablauf auf dem Gerät:** Der Updater lädt `manifest.json` und die Unterschriften
`manifest.sigs/<signierer>.sig` von der Adresse in `/etc/toymesh/ui-update.conf` (`SOURCE=https://…`).
Er akzeptiert ein Release nur, wenn **mindestens `THRESHOLD` unabhängige Signierer** es gültig
unterschrieben haben (Standard 2, nie unter 2). Die vertrauenswürdigen Schlüssel liegen als
`NAME.pub` in `/etc/toymesh/keys/`. Danach werden alle Dateien geladen und per sha256 geprüft.
Erst wenn alles stimmt, wird ersetzt. Der bisherige Stand wird unter `/var/lib/toymesh/ui-backup/`
gesichert (die letzten drei).

**Erlaubt sind nur:** `index.html`, `ui/shell.js`, `ui/themes.css`, `ui/toypost.js`.
Eine ältere oder gleiche Version wird ignoriert.

**Einmalig auf dem PC, pro Signierer (offline aufbewahren):**
```sh
sh scripts/gen-ui-keys.sh signer-a ~/toymesh-keys     # signer-a.pem (PRIVAT) und signer-a.pub
sh scripts/gen-ui-keys.sh signer-b ~/toymesh-keys
sh scripts/gen-ui-keys.sh signer-c ~/toymesh-keys
```
Empfehlung: drei Personen oder Geräte, die je einen eigenen Schlüssel halten. Private Schlüssel
gehören nie ins Repo und nie aufs Gerät.

**Release erstellen und unterschreiben (jeder Signierer mit seinem eigenen Schlüssel):**
```sh
sh scripts/sign-ui-release.sh 6.1.0 ~/toymesh-release ~/toymesh-keys/signer-a.pem ~/toymesh-keys/signer-b.pem
```
Der Ordner `~/toymesh-release` enthält `manifest.json`, `manifest.sigs/` und die vier Dateien. Ihn auf
einen HTTPS-Server legen. Mehrere Signierer können ihre Unterschrift auch getrennt beisteuern: jeder
erzeugt `manifest.sigs/<name>.sig` für dieselbe `manifest.json`.

**Einmalig auf dem Gerät:** Die `.pub`-Dateien nach `/etc/toymesh/keys/` kopieren und in
`/etc/toymesh/ui-update.conf` `SOURCE=` setzen. Ist `SOURCE` leer, sind Updates aus.

**Manuell:** `doas toyui-update` prüft sofort. `doas toyui-update --rollback` stellt die letzte Sicherung wieder her.

**Browser-Cache:** Nach einem Update lädt die Oberfläche neu, wenn die Seite neu geöffnet wird. Der
Kiosk-Browser kann alte Dateien noch zwischenspeichern. Dann hilft ein Neustart des Browsers.

**Was ein Update nicht kann:** Es ändert nur die Oberfläche (HTML, CSS, JavaScript). Systempakete,
Firewall und Verschlüsselung bleiben unberührt. Dafür ist `toyverse-update` zuständig.

## ToySafe-Warnliste (signiert, nur Hinweise)
`toysafe-warn` prüft Domains, Links und Adressen gegen eine öffentliche, signierte Liste.
- `doas toysafe-warn --update` holt die Liste (nur mit `THRESHOLD` Unterschriften), täglich per cron,
  sobald `WARN_SOURCE` in `/etc/toymesh/warnliste.conf` gesetzt ist.
- `toysafe-warn example.com` oder `toysafe-warn 0x…` prüft einen Wert. Ergebnis: Warnung oder „nicht gelistet“.
- **Es wird nie etwas blockiert.** „Nicht gelistet“ heißt nur: keine bekannte Warnung, kein Sicherheitsbeleg.
- Nur Domains und Adressen werden geprüft. Eingaben werden nicht gespeichert und nicht gesendet.
