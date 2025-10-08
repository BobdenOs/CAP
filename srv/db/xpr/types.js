const cds = require('@sap/cds')


const {
  scalar: unknown,
  any,

  UUID, Boolean, String,
  Integer, UInt8, Int16, Int32, Int64,

  Double, Decimal,
  Date, Time, DateTime, Timestamp,
  Binary, Vector, LargeBinary, LargeString,
} = cds.builtin.types

const types = {
  unknown, // Requires the other hand of an operation to infer the type
  any,

  UUID, Boolean, String,
  Integer, UInt8, Int16, Int32, Int64,

  Double, Decimal,
  Date, Time, DateTime, Timestamp,
  Binary, Vector, LargeBinary, LargeString,
}

for (const type in types) {
  types[type] = types[type].constructor
}

const static = {}
for (const type in types) {
  static[type] = class staticType extends types[type] {
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
module.exports.static = static
module.exports.ref = ref
module.exports.rows = rows
module.exports.rowsAsync = rowsAsync
