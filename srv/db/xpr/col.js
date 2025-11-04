const { types, static, ref, rows, rowsAsync } = require('../xpr/types.js')

const impl = {}
impl.ref = function (column, where) {
  // TODO: walk definition tree until physical reference is hit
  // TODO: use parse to support all expressions behind a column definition
  const start = column
  return start
}
impl.ref.args = [ref, ref]
impl.ref.ret = ref

const apis = [
  impl.ref,
]

module.exports.apis = apis
