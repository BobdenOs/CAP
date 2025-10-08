npm pack
curl --request PUT --upload-file ./*.tgz "https://sap.cap/odata/v4/app/applications(name='$(basename $PWD)')/src"