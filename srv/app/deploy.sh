npm pack

# compute application local data
APP=$(basename $PWD)
TAR=$PWD/*.tgz

# switch to general platform directory for certificate access
cd $(dirname $(node -e "console.log(require.resolve('@cap-community/cap/package.json'))"))
curl --verbose --cacert ssl/ca/ca.crt --cert ssl/clients/client.p12 --cert-type P12 --pass 12345678 --request PUT --upload-file $TAR "https://dev.sap.cap/odata/v4/app/applications(name='$APP')/src"