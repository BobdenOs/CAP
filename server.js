const cds = require('@sap/cds')

// REVISIT: find a way to have it not inside the server.js file
cds.once('bootstrap', (app) => {
  app.use('/', (req, res, next) => {
    if (req.host.slice(-8) === '.sap.cap') {
      const app = req.host.slice(0, -8)
      const apps = cds.services['sap.cap.app']?.apps
      if (apps[app]) {
        return res.redirect(`http://${app}.sap.cap:${apps[app].port}${req.url}`)
      } else {
        return res.status(404)
      }
    }
    return next()
  })
})
