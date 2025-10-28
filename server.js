const os = require('node:os')
const https = require('node:https')
const crypto = require('node:crypto')

const { Agent, setGlobalDispatcher } = require('undici')
const cds = require('@sap/cds')

process.env.CF_INSTANCE_CERT ??= __dirname + '/server.crt'
process.env.CF_INSTANCE_KEY ??= __dirname + '/server.key'

cds.on('bootstrap', async app => {
  const [cert, key, ca] = await Promise.all([
    cds.utils.fs.promises.readFile(process.env.CF_INSTANCE_CERT),
    cds.utils.fs.promises.readFile(process.env.CF_INSTANCE_KEY),
    cds.utils.fs.promises.readFile(__dirname + '/ssl/ca/ca.crt'),
  ])

  const parsedCert = new crypto.X509Certificate(cert)
  const names = parsedCert.subjectAltName
    .split(',')
    .map(p => /^ *DNS:([^*]*)/.exec(p)?.[1])
    .filter(a => a)

  const A = []
  const AAAA = []
  const networks = os.networkInterfaces()
  for (const interface in networks) {
    const ips = networks[interface]
    for (const ip of ips) {
      if (ip.internal) continue
      if (ip.family === 'IPv4') A.push({ url: ip.address })
      if (ip.family === 'IPv6') AAAA.push({ url: ip.address })
    }
  }

  // Configure current node ssl identity
  cds.env.ssl = {
    names, cert, key, ca,
    A, AAAA,
  }

  // Automatic mTLS configuration for external calls
  for (const name in cds.requires) {
    const service = cds.requires[name]
    if (service.external && service.credentials.url) {
      service.credentials.mtls = true
      service.credentials.trustStoreCertificate = {
        content: btoa(ca)
      }
    }
  }
  https.globalAgent = new https.Agent({ key, cert, ca, })
  setGlobalDispatcher(new Agent({ connect: { key, cert, ca, } }))

  app.listen = function () {
    const server = https.createServer({
      cert,
      key,
      ca,
      // Allow un authenticated request to be filtered by authorization checks
      rejectUnauthorized: false,
      requestCert: true,
    }, app)
    // Bind to 0.0.0.0 instead of default localhost
    server.listen(process.env.PORT || 443, process.env.HOST || '0.0.0.0', ...Array.prototype.slice.call(arguments, 2))
    if (process.env.HOST6) {
      const server = https.createServer({
        cert,
        key,
        ca,
        // Allow un authenticated request to be filtered by authorization checks
        rejectUnauthorized: false,
        requestCert: true,
      }, app)
      server.listen(process.env.PORT || 443, process.env.HOST6, (reason) => {
        if (reason) console.log(new Error(`Failed to host on ipv6 address [${process.env.HOST6}]`, { reason }))
      })
    }
    return server
  }
})
