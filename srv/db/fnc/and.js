const { types, static, ref, rows, rowsAsync } = require('../xpr/types.js')

const names = []
const operators = ['and', 'AND']

const impl = {}
impl.sync = {}
impl.sync.rows = {}
impl.sync.rows.rows = {}

// -- sync impl
impl.sync.rows.rows = async function (a, b) {
  a = await a
  b = await b
  return a.filter(a => b.includes(a))
}

impl.sync.rows.rows.args = [rows, rows]
impl.sync.rows.rows.ret = rows


// All implemented APIs for the function in order of preference
const apis = [
  impl.sync.rows.rows,
]

module.exports.apis = apis
module.exports.names = names
module.exports.operators = operators
module.exports.priority = 1
