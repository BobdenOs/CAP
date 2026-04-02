import __IMPORT_0__ from '/web/node_modules/@sap/cds/lib/index.js'

const require = function() {throw Object.assign(new Error('require in browser'),{code:'MODULE_NOT_FOUND'})}
require.resolve = function(id) { 
  if(id[0] === '.') return new URL(id, import.meta.url).pathname
  throw Object.assign(new Error('require.resolve in browser'),{ code: 'MODULE_NOT_FOUND' }) 
}
export default (function(exports, module, require, __dirname,__filename) {
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
const cds = __IMPORT_0__()

const {
  scalar: unknown,
  any,

  array,

  UUID, Boolean, String,
  Integer, UInt8, Int16, Int32, Int64,

  Double, Decimal,
  Date, Time, DateTime, Timestamp,
  Binary, Vector, LargeBinary, LargeString,
} = cds.builtin.types

const types = {
  unknown, // Requires the other hand of an operation to infer the type
  any,

  array,

  UUID, Boolean, String,
  Integer, UInt8, Int16, Int32, Int64,

  Double, Decimal,
  Date, Time, DateTime, Timestamp,
  Binary, Vector, LargeBinary, LargeString,

  SELECT: cds.ql.SELECT.prototype,
}

for (const type in types) {
  types[type] = types[type].constructor
}

/** @type {types} */
const statics = {}
for (const type in types) {
  statics[type] = class staticType extends types[type] {
    static = true
  }
}

class type {
  constructor(type, isStatic, nullable) {
    this.type = type
    this.static = isStatic
    this.nullable = nullable
  }
}

class ref {
  constructor() {

  }
}

class rows {
  constructor() {

  }
}

class rowsAsync extends rows {
  constructor() {

  }

  async *[Symbol.asyncIterator]() {

  }
}

module.exports.types = types
module.exports.statics = statics
module.exports.ref = ref
module.exports.rows = rows
module.exports.rowsAsync = rowsAsync

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)