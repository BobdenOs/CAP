const cds = require('@sap/cds')

module.exports = function custom_auth(req, res, next) {
  const authError = req.socket.authorizationError
  const cert = req.client.ssl.getPeerX509Certificate()
  if (authError || !cert) {
    cds.context.user = cds.User.anonymous
    return next()
  }

  const id = /(?:CN|emailAddress)=(.*)/.exec(cert.subject())[1]
  // do your custom authentication
  cds.context.user = new cds.User({ id })
  // cds.context.tenant = '<tenant>'
  return next()
}
