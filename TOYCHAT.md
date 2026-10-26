# ToyChat — verschlüsselter Teamchat, Aufgaben und Videoanrufe

Slack-artige Team-Organisation mit Kanälen, Aufgaben (offen/erledigt, mit Zuständigen)
und Videoanrufen zwischen ToyMesh-Geräten. Kein Konto, kein Passwort: Wer den Einladungslink
hat, gehört zum Arbeitsbereich.

## Aufbau
| Teil | Wo | Aufgabe |
|------|-----|---------|
| Client | `srv/toyverse/toychat/` (HTML, JS, CSS) | Verschlüsselung, Signaturen, Oberfläche, WebRTC |
| Relais | `usr/local/lib/toychat/server.js` (Node.js, keine Abhängigkeiten) | speichert und leitet **nur Chiffrat** weiter |
| Dienst | `etc/init.d/toychat-server` (Benutzer `toychat`, Port 8090, nur loopback) | Start beim Boot |

## Sicherheitsmodell
- **Raumschlüssel:** 256 Bit, nur im Einladungslink (nach dem `#`). Der Browser schickt den Teil
  nach dem `#` nie an den Server. Aus dem Schlüssel wird die Raum-ID abgeleitet (SHA-256), der Server
  kann daraus den Schlüssel nicht zurückrechnen.
- **Inhalte:** jede Nachricht, Aufgabe und jedes Anruf-Signal ist mit AES-256-GCM verschlüsselt.
  Auf dem Server liegen nur Chiffrat und Zeitstempel der Reihenfolge.
- **Signaturen:** jeder Teilnehmer hat ein eigenes ECDSA-P256-Schlüsselpaar. Jede Nachricht ist damit
  signiert. Ein Teilnehmer kann dadurch nicht im Namen eines anderen schreiben. Ein Schlüssel für
  eine bekannte Person darf sich nie ändern (Trust-on-first-use).
- **Abweisung:** Einträge mit falscher Signatur oder falschem Schlüssel werden verworfen und gezählt
  (sichtbar unter „Team“).
- **Videos:** WebRTC verschlüsselt Medien immer (DTLS-SRTP). Die Anrufe laufen direkt zwischen den
  Geräten, der Server sieht die SDP-Angebote nur verschlüsselt.
- **Sicherheitscode:** Team-Ansicht zeigt einen Fingerabdruck des Raumschlüssels. Bei Verdacht
  am Telefon vergleichen.

## Grenzen (ehrlich)
- **Keine Vorwärtsgeheimhaltung.** Alle Nachrichten eines Raums hängen am selben Schlüssel. Wer den
  Schlüssel später erhält, kann die gespeicherte Historie entschlüsseln. Abhilfe: Raum wechseln
  (neuer Arbeitsbereich) und alte Daten löschen.
- **Kein Ausschluss einzelner Personen.** Wer den Link hat, ist drin. Ausschluss heißt: neuer Raum,
  neue Einladung an die anderen.
- **Metadaten sichtbar:** der Server sieht Raum-ID, Zeitpunkte, Größen und IP-Adressen.
- **Privater Signaturschlüssel** liegt im Browser-Speicher des Geräts. Der Schutz hängt von der
  Festplattenverschlüsselung (LUKS) ab.
- **Vertrauen im Raum:** Ein Teilnehmer kann neue Identitäten anlegen (z. B. Zweitkonten). Die
  Signaturen zeigen nur, dass der Schlüssel zu dieser Identität gehört, nicht, wer dahintersteckt.
- **Anrufe über das Internet** brauchen einen TURN-Server (`iceServers` in `etc/toychat/server.json`).
  Ohne TURN klappen Anrufe nur im gleichen Netz.
- **Mesh-Anrufe:** jeder mit jedem. Auf dem Tablet (1 GB RAM) realistisch 2–3 Personen, bis 4 mit
  wenig Auflösung. Für größere Runden fehlt ein Medienserver (SFU).
- **Browser für Video:** Chat läuft im Standard-Browser. Video braucht WebRTC. **ToySurf Voll**
  (Firefox ESR) hat das. Ob der Browser cog auf dem Tablet WebRTC hat, ist nicht geprüft.
- **Nur HTTPS für fremde Geräte.** Der Relais-Server spricht HTTP. Für Teilnehmer außerhalb des
  Geräts braucht er einen TLS-Terminator (z. B. Reverse Proxy auf einem anderen Rechner). Im Kit ist
  das nicht enthalten.
- **Nicht enthalten:** Dateiaustausch, Push-Benachrichtigungen, Suche über Nachrichten, Bearbeitung
  oder Löschung einzelner Nachrichten, Gäste ohne Einladung.

## Geprüft
Automatisch mit Chromium im Headless-Modus, zwei getrennte Profile:
- Arbeitsbereich anlegen, Einladungslink, Beitritt mit Entschlüsselung der bisherigen Nachrichten
- Nachrichten in beide Richtungen, Aufgaben anlegen und abhaken
- Server-Dateien enthalten keinen Klartext
- ein gefälschter Eintrag mit falschem Schlüssel wird abgewiesen und gezählt
- Videoanruf: beide Seiten sehen zwei Kacheln mit echtem Bild (künstliche Kamera), Auflegen
  entfernt die Kachel
- keine Browserfehler

Nicht geprüft: echtes Tablet mit 1 GB RAM, WebRTC in cog, Anrufe über das Internet mit TURN,
Anrufe mit mehr als zwei Personen.

## Betrieb
- Server: `doas rc-service toychat-server start` (läuft als Benutzer `toychat`).
- Daten: `/var/lib/toychat/<raum>.jsonl` (nur Chiffrat). Löschen = Datei entfernen.
- Log: `/var/log/toychat-server.log`
- Apps-Eintrag: `apps.json` (ToyChat öffnet sich in der Oberfläche; der Server ist über den
  Einrichtungsschritt „Server“ angegeben, Standard 127.0.0.1:8090).
