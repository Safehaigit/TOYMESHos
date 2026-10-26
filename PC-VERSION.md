# ToyMesh auf dem PC (Windows)

**Wichtig:** Das Tablet-Image (Samsung GT-P5110) ist für ARM gebaut. Es startet nicht auf einem PC.
Für einen PC braucht es einen eigenen x86_64-Build. Dieses Kit erzeugt ihn als **virtuelle Festplatte**.

## Was du brauchst
- Windows 10/11 mit Virtualisierung im BIOS aktiv
- WSL2 mit Ubuntu (in einer Windows-PowerShell als Administrator: `wsl --install -d Ubuntu`)
- Etwa 20 GB freier Speicher, gute Internetverbindung

## Schritte
1. Ubuntu in WSL öffnen. Dort ausführen:
   ```sh
   sudo apt update && sudo apt install -y git python3 python3-pip qemu-system-x86
   ```
2. Das Kit in WSL holen (Ordner aus dem ZIP nach `~/toyverse-tab` kopieren).
3. Build starten:
   ```sh
   cd ~/toyverse-tab && bash scripts/build-pc-vm.sh
   ```
   Bei der Einrichtung die Antworten aus dem Skript übernehmen.
4. Das Image liegt in `~/toymesh-pc/toymesh-pc.img`. Prüfsumme in `toymesh-pc.img.sha256`.
5. Starten, zum Beispiel mit VirtualBox (neue VM, Festplatte als RAW einhängen) oder QEMU:
   ```sh
   qemu-system-x86_64 -m 2048 -smp 2 -drive file=~/toymesh-pc/toymesh-pc.img,format=raw -nic user
   ```

## Ehrlich: was noch offen ist
- **Ungeprüft:** Das Skript habe ich nicht ausgeführt. Meine Umgebung kann die Paketquellen
  von postmarketOS und Alpine nicht erreichen. Gerätename `qemu-amd64` ist als Paket bestätigt,
  der Build selbst nicht.
- **Echter PC per USB:** Nicht automatisiert. Ob ein Stick mit einem Gerätetyp für echte
  Hardware (Grafik, WLAN, Tastatur) funktioniert, muss man prüfen. Dafür bräuchte es einen
  eigenen Gerätetyp für Standard-PCs, den ich nicht verifiziert habe.
- **Die Oberfläche** (cog, Sway) ist auf dem Tablet ausgelegt. Auf der VM läuft zunächst nur das Grundsystem.
- **Sicherheit:** Die Verschlüsselung mit LUKS ist beim Einrichten gewählt. Die Schutzprüfung
  `toysafe-check` läuft dann genauso.
