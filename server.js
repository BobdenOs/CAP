const https = require('node:https')

const cds = require('@sap/cds')

cds.on('bootstrap', async app => {
  const [cert, key] = await Promise.all([
    cds.utils.fs.promises.readFile(__dirname + '/ssl/servers/sap.cap.crt'),
    cds.utils.fs.promises.readFile(__dirname + '/ssl/servers/sap.cap.key'),
  ])

  app.listen = function () {
    const server = https.createServer({
      cert,
      key,

      // Allow un authenticated request to be filtered by authorization checks
      rejectUnauthorized: false,
      requestCert: true,
    }, app)
    return server.listen(...arguments)
  }
})
