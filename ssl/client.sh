#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CLIENT_NAME=${CLIENT_NAME:-client}
DAYS=${DAYS:-365}
PASS=${PASS:-12345678}
SNAP=$HOME/snap/chromium/current

if [ ! -f ca/ca.crt ] || [ ! -f ca/ca.key ]; then
  ./root.sh
fi

mkdir -p clients

openssl genrsa -out clients/${CLIENT_NAME}.key 2048
openssl req -new -key clients/${CLIENT_NAME}.key -out clients/${CLIENT_NAME}.csr -subj "/C=DE/ST=Baden-Württemberg/L=Walldorf/O=SAP SE/OU=CAP/CN=${CLIENT_NAME}/emailAddress=cap@sap.com"

# Create extfile for client cert with clientAuth EKU
EXTFILE=$(mktemp)
cat > "$EXTFILE" <<EOF
[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
subjectAltName = @alt_names
subjectKeyIdentifier = hash

[alt_names]
DNS.1 = ${CLIENT_NAME}
EOF

openssl x509 -req -in clients/${CLIENT_NAME}.csr -CA ca/ca.crt -CAkey ca/ca.key -CAcreateserial -out clients/${CLIENT_NAME}.crt -days "$DAYS" -sha256 -extfile "$EXTFILE" -extensions v3_req
openssl pkcs12 -export -out "clients/${CLIENT_NAME}.p12" -inkey "clients/${CLIENT_NAME}.key" -in "clients/${CLIENT_NAME}.crt" -certfile ca/ca.crt -name "${CLIENT_NAME}" -passout pass:$PASS

# import into NSS DB (pk12util expects the password after -W)
certutil -D -n "${CLIENT_NAME}" -d "sql:${SNAP}/.pki/nssdb" || echo "first $CLIENT_NAME certificate"
pk12util -d "sql:${SNAP}/.pki/nssdb" -i "clients/${CLIENT_NAME}.p12" -K "" -W $PASS
