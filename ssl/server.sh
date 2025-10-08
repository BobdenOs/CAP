#!/usr/bin/env bash
cd $(dirname "$0")

if [ -z "$HOST" ]; then
  echo 'Please set HOST environment variable';
  exit 1;
fi
mkdir -p servers 
openssl genrsa -out servers/$HOST.key 2048 
openssl req -new -key servers/$HOST.key -out servers/$HOST.csr -subj "/C=DE/ST=Baden-Württemberg/L=Walldorf/O=SAP SE/OU=CAP/CN=$HOST/emailAddress=cap@sap.com" 

# Create a temporary extfile with v3_req and SANs so openssl includes the DNS entries
EXTFILE=$(mktemp)
cat > "$EXTFILE" <<EOF
[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer

[alt_names]
DNS.1 = $HOST
DNS.2 = *.$HOST
EOF

# Sign using SHA256 and include the v3_req extensions from the temporary file
openssl x509 -req -in servers/$HOST.csr -CA ca/ca.crt -CAkey ca/ca.key -CAcreateserial -out servers/$HOST.crt -days 365 -sha256 -extensions v3_req -extfile "$EXTFILE"
