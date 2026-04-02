import __IMPORT_0__ from '/web/srv/db/xpr/types.js'

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
const operators = ['in', 'IN']

const impl = {}
impl.async = {}
impl.async.ref = {}
impl.async.ref.static = {}
impl.async.static = {}
impl.async.static.ref = {}

impl.sync = {}
impl.sync.ref = {}
impl.sync.ref.static = {}
impl.sync.static = {}
impl.sync.static.ref = {}

// -- async impl
impl.async.ref.static = async function* (ref, _static) {
  throw new Error('TODO: implement')
}

impl.async.ref.static.args = [ref, statics.array]
impl.async.ref.static.ret = rowsAsync

// -- sync impl
impl.sync.ref.static = async function (ref, _static) {
  ref = ref()
  const store = this.store(ref.parent)

  // Align data to be searched for with stored data format
  let curData
  const matches = []
  await store.read_col(ref.name, (row) => {
    if (!curData) curData = _static().map(data => Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data)))
    const rowData = row.subarray(32)
    if (curData.findIndex(data => data.compare(rowData) === 0) < 0) {
      // const rowID = row.subarray(0, 16)
      // const index = matches.findIndex(r => rowID.compare(r.subarray(16)) === 0)
      // Remove old row data that no longer matches
      // if (index > -1 && store.timestamp(matches[index]) < store.timestamp(row)) matches.splice(index, 1)
      return
    }
    matches.push(row)
  })

  return matches
}

impl.sync.ref.static.args = [ref, statics.array]
impl.sync.ref.static.ret = rows


// -- async aliases --
impl.async.static.ref = function (_static, ref) {
  return impl.async.ref.static(ref, _static)
}

impl.async.static.ref.args = [statics.array, ref]
impl.async.static.ref.ret = rowsAsync

// -- sync aliases --
impl.sync.static.ref = function (_static, ref) {
  return impl.sync.ref.static(ref, _static)
}

impl.sync.static.ref.args = [statics.array, ref]
impl.sync.static.ref.ret = rows


// All implemented APIs for the function in order of preference
const apis = [
  impl.async.ref.static,
  impl.async.static.ref,

  impl.sync.ref.static,
  impl.sync.static.ref,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = 3

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)