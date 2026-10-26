# ToyMesh-Signaturprüfung mit Schwellwert (wird von toyui-update und toysafe-warn eingebunden).
#
# Eine Datei gilt als freigegeben, wenn mindestens MIN verschiedene vertrauenswürdige
# Schlüssel sie gültig signiert haben. Jeder vertrauenswürdige Schlüssel liegt als
# NAME.pub in KEYDIR, seine Unterschrift als SIGDIR/NAME.sig (Ed25519, rohe Signatur).
#
#   count_valid_sigs DATEI SIGDIR KEYDIR   -> gibt die Anzahl gültiger Unterschriften aus
#
# Nur POSIX-sh und openssl. Keine Schlüssel werden hier erzeugt oder gespeichert.

count_valid_sigs() {
  _file="$1"; _sigdir="$2"; _keydir="$3"; _n=0
  for _pub in "$_keydir"/*.pub; do
    [ -f "$_pub" ] || continue
    _name=$(basename "$_pub" .pub)
    _sig="$_sigdir/$_name.sig"
    [ -f "$_sig" ] || continue
    if openssl pkeyutl -verify -pubin -inkey "$_pub" -rawin -in "$_file" -sigfile "$_sig" >/dev/null 2>&1; then
      _n=$((_n + 1))
    fi
  done
  echo "$_n"
}
