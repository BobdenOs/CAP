const { types, static, ref, rows, rowsAsync } = require('../xpr/types.js')

const names = []
const operators = ['<<']

const impl = {}
impl.sync = {}
impl.sync.ref = {}
impl.sync.rows = {}
impl.sync.static = {}

// -- sync impl
impl.sync.ref.rows = async function (ref, rows) {
  // if (rows.length === 0) return rows
  ref = ref()
  const store = this.store(ref.parent)
  
  store.read_col(ref.name, () => {})
  
  let rowIDs = {}
  rows = await rows()
  for (const row of rows) rowIDs[store.rowID(row).toString('base64')] = true

  const matches = []
  await store.read_col(ref.name, (row) => {
    const rowID = store.rowID(row).toString('base64')
    if (rowIDs[rowID]) matches.push(row)
  })
  return matches
}

impl.sync.ref.rows.args = [ref, rows]
impl.sync.ref.rows.ret = rows

impl.sync.rows.ref = function (rows, ref) {
  return impl.sync.ref.rows(ref, rows)
}

impl.sync.rows.ref.args = [rows, ref]
impl.sync.rows.ref.ret = rows

impl.sync.static.rows = async function (static, rows) {
  const val = static()
  const timestamp = BigInt(Date.now())
  const data = Buffer.from(JSON.stringify(val ?? null))
  const dataBuffer = Buffer.concat([
    Buffer.from(new BigUint64Array([timestamp, BigInt(data.byteLength)]).buffer),
    data,
  ])

  rows = await rows()
  return rows.map(row => Buffer.concat([row.subarray(0, 16), dataBuffer]))
}

impl.sync.static.rows.args = [static.unknown, rows]
impl.sync.static.rows.ret = rows

impl.sync.rows.static = async function (rows, static) {
  return impl.sync.static.rows(static, rows)
}

impl.sync.rows.static.args = [rows, static.unknown]
impl.sync.rows.static.ret = rows

impl.sync.ref.static = async function (ref, static) {
  if (!static()) return []
  ref = ref()
  const store = this.store(ref.parent)
  const matches = []
  await store.read_col(ref.name, (row) => {
    matches.push(row)
  })
  return matches
}

impl.sync.ref.static.args = [ref, static.unknown]
impl.sync.ref.static.ret = rows

impl.sync.static.ref = function (static, ref) {
  return impl.sync.ref.static(ref, static)
}

impl.sync.static.ref.args = [static.unknown, ref]
impl.sync.static.ref.ret = rows


// All implemented APIs for the function in order of preference
const apis = [
  impl.sync.static.rows,
  impl.sync.rows.static,

  impl.sync.ref.static,
  impl.sync.static.ref,

  impl.sync.ref.rows,
  impl.sync.rows.ref,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = -1
