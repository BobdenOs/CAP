const { types, statics, ref, rows, rowsAsync } = require('../xpr/types.js')

const impl = {}
impl.static = function (entity, where) {
  return true
}
impl.static.args = [ref]
impl.static.ret = statics.unknown

impl.ref = function (entity, where) {
  return src
}
impl.ref.args = [ref]
impl.ref.ret = ref

impl.rows = function (entity, where) {
  debugger
}
impl.rows.args = [ref]
impl.rows.ret = types.rows

const apis = [
  impl.static,
  impl.ref,
  impl.rows,
]

module.exports.apis = apis
