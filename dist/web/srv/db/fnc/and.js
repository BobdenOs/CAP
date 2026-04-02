import __IMPORT_0__ from '../xpr/types.js'

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

const names = []
const operators = ['and', 'AND']

const impl = {}
impl.sync = {}
impl.sync.rows = {}
impl.sync.rows.rows = {}
impl.sync.rows.static = {}
impl.sync.static = {}
impl.sync.static.static = {}

// -- sync impl
impl.sync.rows.rows.rows = async function (a, b) {
  [a, b] = await Promise.all([a(), b()])
  return a.filter(a => {
    const aID = a.subarray(0, 16)
    return b.find((b) => b.subarray(0, 16).compare(aID) === 0)
  })
}

impl.sync.rows.rows.rows.args = [rows, rows]
impl.sync.rows.rows.rows.ret = rows

impl.sync.rows.static.static = async function (a, b) {
  return b() && a()
}

impl.sync.rows.static.static.args = [statics.unknown, statics.unknown]
impl.sync.rows.static.static.ret = statics.unknown

impl.sync.rows.rows.static = async function (a, b) {
  if (!b()) return []
  return a()
}

impl.sync.rows.rows.static.args = [rows, statics.unknown]
impl.sync.rows.rows.static.ret = rows

impl.sync.rows.static.rows = async function (a, b) {
  return impl.sync.rows.rows.static(b, a)
}

impl.sync.rows.static.rows.args = [statics.unknown, rows]
impl.sync.rows.static.rows.ret = rows


// All implemented APIs for the function in order of preference
const apis = [
  // impl.sync.rows.static.static,

  impl.sync.rows.rows.static,
  impl.sync.rows.static.rows,

  impl.sync.rows.rows.rows,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = 1

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)