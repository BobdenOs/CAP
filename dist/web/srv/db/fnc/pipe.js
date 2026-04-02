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
const operators = ['<<']

const impl = {}
impl.sync = {}
impl.sync.ref = {}
impl.sync.rows = {}
impl.sync.static = {}
impl.sync.SELECT = {}

// -- sync impl
impl.sync.ref.rows = async function (ref, rows) {
  // if (rows.length === 0) return rows
  ref = ref()
  const store = this.store(ref.parent)

  store.read_col(ref.name, () => { })

  let rowIDs = {}
  rows = await rows()
  for (const row of rows) rowIDs[(await store.rowID(row)).toString('base64')] = true

  const matches = []
  await store.read_col(ref.name, async (row) => {
    const rowID = (await store.rowID(row)).toString('base64')
    if (rowIDs[rowID]) matches.push(row)
  })
  return matches
}

impl.sync.ref.rows.args = [ref, rows]
impl.sync.ref.rows.ret = rows

impl.sync.rows.ref = function (rows, ref) {
  // TODO: fix
  return impl.sync.ref.rows(ref, rows)
}

impl.sync.rows.ref.args = [rows, ref]
impl.sync.rows.ref.ret = rows

impl.sync.static.rows = async function (_static, rows) {
  const val = _static()
  const timestamp = BigInt(Date.now())
  const data = Buffer.from(JSON.stringify(val ?? null))
  const dataBuffer = Buffer.concat([
    Buffer.from(new BigUint64Array([timestamp, BigInt(data.byteLength)]).buffer),
    data,
  ])

  rows = await rows()
  return rows.map(row => Buffer.concat([row.subarray(0, 16), dataBuffer]))
}

impl.sync.static.rows.args = [statics.unknown, rows]
impl.sync.static.rows.ret = rows

impl.sync.rows.static = async function (rows, _static) {
  // TODO: fix
  return impl.sync.static.rows(_static, rows)
}

impl.sync.rows.static.args = [rows, statics.unknown]
impl.sync.rows.static.ret = rows

impl.sync.SELECT.static = async function (sub, _static) {
  if (!_static()) return []
  sub = sub()
  const store = this.store(sub.parent)

  const proms = []
  await store.read_col(sub.col || Object.keys(sub.parent.keys)[0], (row) => {
    proms.push(sub.fn(row))
  })

  return await Promise.all(proms)
}

impl.sync.SELECT.static.args = [types.SELECT, statics.unknown]
impl.sync.SELECT.static.ret = rows

impl.sync.ref.static = async function (ref, _static) {
  if (!_static()) return []
  ref = ref()
  const store = this.store(ref.parent)
  const matches = []
  await store.read_col(ref.name, (row) => {
    matches.push(row)
  })
  return matches
}

impl.sync.ref.static.args = [ref, statics.unknown]
impl.sync.ref.static.ret = rows

impl.sync.static.ref = function (_static, ref) {
  // TODO: fix it should return the static value for each row in the ref
  return impl.sync.ref.static(ref, _static)
}

impl.sync.static.ref.args = [statics.unknown, ref]
impl.sync.static.ref.ret = rows


// All implemented APIs for the function in order of preference
const apis = [
  impl.sync.static.rows,
  impl.sync.static.ref,

  impl.sync.rows.static,
  impl.sync.ref.static,

  impl.sync.ref.rows,
  impl.sync.rows.ref,

  impl.sync.SELECT.static,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = -1

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)