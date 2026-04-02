import __IMPORT_0__ from 'types.js'

const require = function() {throw Object.assign(new Error('require in browser'),{code:'MODULE_NOT_FOUND'})}
require.resolve = function(id) { 
  if(id[0] === '.') return new URL(id, import.meta.url).pathname
  throw Object.assign(new Error('require.resolve in browser'),{ code: 'MODULE_NOT_FOUND' }) 
}
export default (function(exports, module, require, __dirname,__filename) {
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
const { types, statics, ref, rows, rowsAsync } = __IMPORT_0__()

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

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)