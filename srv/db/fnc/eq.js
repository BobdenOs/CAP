const { types, static, ref, rows, rowsAsync } = require('../xpr/types.js')

const names = []
const operators = ['=']

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
impl.async.ref.static = async function* (ref, static) {
  throw new Error('TODO: implement')
}

impl.async.ref.static.args = [ref, static.unknown]
impl.async.ref.static.ret = rowsAsync

// -- sync impl
impl.sync.ref.static = async function (ref, static) {
  const store = this.store(ref.parent)
  const rows = await store.find(static, ref.name)
  return rows
}

impl.sync.ref.static.args = [ref, static.unknown]
impl.sync.ref.static.ret = rows


// -- async aliases --
impl.async.static.ref = function (static, ref) {
  return impl.async.ref.static(ref, static)
}

impl.async.static.ref.args = [static.unknown, ref]
impl.async.static.ref.ret = rowsAsync

// -- sync aliases --
impl.sync.static.ref = function (static, ref) {
  return impl.sync.ref.static(ref, static)
}

impl.sync.static.ref.args = [static.unknown, ref]
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
