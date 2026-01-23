const { types, statics, ref, rows, rowsAsync } = require('../xpr/types.js')

const impl = {}
impl.ref = function (column, where) {
  const start = column()
  return start
}
impl.ref.args = [ref, ref]
impl.ref.ret = ref

const apis = [
  impl.ref,
]

module.exports.apis = apis
