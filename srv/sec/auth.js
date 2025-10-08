const cds = require('@sap/cds')

module.exports = function custom_auth(req, res, next) {
  const authError = req.socket.authorizationError
  if (authError) {
    cds.context.user = cds.User.anonymous
    return next()
  }

  const cert = req.client.ssl.getPeerX509Certificate()
  const id = /(?:CN|emailAddress)=(.*)/.exec(cert.subject())[1]
  // do your custom authentication
  cds.context.user = new cds.User({ id })
  // cds.context.tenant = '<tenant>'
  return next()
}
