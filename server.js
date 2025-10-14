const https = require('node:https')
const crypto = require('node:crypto')

const { Agent, setGlobalDispatcher } = require('undici')
const cds = require('@sap/cds')

process.env.CF_INSTANCE_CERT = __dirname + '/server.crt'
process.env.CF_INSTANCE_KEY = __dirname + '/server.key'
// process.env.CF_INSTANCE_CERT = __dirname + '/ssl/servers/sap.cap.crt'
// process.env.CF_INSTANCE_KEY = __dirname + '/ssl/servers/sap.cap.key'

cds.on('bootstrap', async app => {
  const [cert, key, ca] = await Promise.all([
    cds.utils.fs.promises.readFile(process.env.CF_INSTANCE_CERT),
    cds.utils.fs.promises.readFile(process.env.CF_INSTANCE_KEY),
    cds.utils.fs.promises.readFile(__dirname + '/ssl/ca/ca.crt'),
  ])

  // const parsedCert = new crypto.X509Certificate(cert)
  // debugger

  for (const name in cds.requires) {
    const service = cds.requires[name]
    if (service.external && service.credentials.url) {
      service.credentials.mtls = true
      service.credentials.trustStoreCertificate = {
        content: btoa(ca)
      }
    }
  }
  cds.requires

  https.globalAgent = new https.Agent({
    key,
    cert,
    ca,
  })

  setGlobalDispatcher(new Agent({
    connect: {
      key,
      cert,
      ca,
    }
  }))

  app.listen = function () {
    const server = https.createServer({
      cert,
      key,
      ca,

      // Allow un authenticated request to be filtered by authorization checks
      rejectUnauthorized: false,
      requestCert: true,
    }, app)
    return server.listen(...arguments)
  }
})
