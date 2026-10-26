#!/bin/sh
# ToyMesh: Signaturschlüssel für einen Signierer erzeugen (einmalig, auf dem PC).
#   sh scripts/gen-ui-keys.sh NAME ORDNER
# Ergebnis: NAME.pem (PRIVAT, offline, nie ins Repo, nie aufs Gerät)
#           NAME.pub (öffentlich, kommt aufs Gerät nach /etc/toymesh/keys/)
# Für ein Release braucht man mehrere Signierer (Standard: 3, Schwelle 2).
set -eu
NAME="${1:?Name des Signierers fehlt, z. B. signer-a}"
DIR="${2:?Zielordner fehlt}"
case "$NAME" in *[!a-zA-Z0-9_-]*|"") echo "Name nur a-z, 0-9, - und _" >&2; exit 2 ;; esac
mkdir -p "$DIR"
umask 077
openssl genpkey -algorithm ED25519 -out "$DIR/$NAME.pem"
openssl pkey -in "$DIR/$NAME.pem" -pubout -out "$DIR/$NAME.pub"
echo "Privat: $DIR/$NAME.pem  (offline aufbewahren)"
echo "Öffentlich: $DIR/$NAME.pub  (auf das Gerät nach /etc/toymesh/keys/)"
