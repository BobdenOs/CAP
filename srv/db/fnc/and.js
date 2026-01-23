const { types, statics, ref, rows, rowsAsync } = require('../xpr/types.js')

const names = []
const operators = ['and', 'AND']

const impl = {}
impl.sync = {}
impl.sync.rows = {}
impl.sync.rows.rows = {}
impl.sync.rows.static = {}

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
  impl.sync.rows.rows.static,
  impl.sync.rows.static.rows,

  impl.sync.rows.rows.rows,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = 1
