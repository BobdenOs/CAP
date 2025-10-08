#!/usr/bin/env bash
cd $(dirname "$0")

mkdir -p ca
openssl genrsa -out ca/ca.key 4096 
# Generate root certificate with proper CA extensions
openssl req -new -x509 -days 365 -key ca/ca.key -out ca/ca.crt -config root-ca.conf
sudo cp ca/ca.crt /usr/local/share/ca-certificates/cap-ca.crt
sudo update-ca-certificates --fresh

# Node export
export NODE_EXTRA_CA_CERTS=$(pwd)/ca/ca.crt

# Chromium export
PASS=
SNAP=$HOME/snap/chromium/current

rm -rf "$SNAP/.pki/nssdb"
mkdir -p "$SNAP/.pki/nssdb"
certutil -N -d sql:$SNAP/.pki/nssdb -f <(printf '%s\n%s\n' "$PASS" "$PASS")
certutil -A -n "CAP Root CA" -t "TCu,Cu,Tu" -i ca/ca.crt -d sql:$SNAP/.pki/nssdb -f <(printf '%s\n' "$PASS")

mkdir -p "/etc/chromium-browser/policies/managed/"
sudo cp ./policies.json "/etc/chromium-browser/policies/managed/policies.json"
