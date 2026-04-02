import __IMPORT_4__ from './col.js'
import __IMPORT_3__ from './src.js'
import __IMPORT_2__ from './types.js'
import __IMPORT_1__ from '../fnc/index.js'
import __IMPORT_0__ from '../../../node/stream.mjs'

const require = function() {throw Object.assign(new Error('require in browser'),{code:'MODULE_NOT_FOUND'})}
require.resolve = function(id) { 
  if(id[0] === '.') return new URL(id, import.meta.url).pathname
  throw Object.assign(new Error('require.resolve in browser'),{ code: 'MODULE_NOT_FOUND' }) 
}
export default (function(exports, module, require, __dirname,__filename) {
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
const { PassThrough } = __IMPORT_0__

const { operators, functions } = __IMPORT_1__()
const { types, statics, ref, rows, rowsAsync } = __IMPORT_2__()
const source = __IMPORT_3__()
const column = __IMPORT_4__()

const parse = function (query, xpr, ret = []) {
  // Parse whole query definition
  if (!xpr) {

    const one = query.SELECT?.one
    if (query.SELECT) {
      // Materialize requested columns
      if (!query.SELECT.columns) query.SELECT.columns = Object.keys(query.elements).map(col => ({ ref: [col] }))
      else {
        const wildcard = query.SELECT.columns.indexOf('*')
        if (wildcard > -1) query.SELECT.columns.splice(wildcard, 1, ...Object.keys(query.elements).filter(col => !query.SELECT.columns.find(c => c !== '*' && column_name(c) === col)).map(col => ({ ref: [col] })))
      }
    }

    const kind = query.kind
    const from = query[kind].from || query[kind].entity
    const where = query[kind].where ? { xpr: [{ xpr: query[kind].where }, 'and', from] } : from
    const whereShared = this.parse(query, [where], [statics.unknown, rows])

    const columns = query.SELECT?.columns || []
    if (kind === 'UPDATE') {
      for (const col in query.UPDATE.data) columns.push({ val: query.UPDATE.data[col], as: col })
      for (const col in query.UPDATE.with) columns.push({ ...query.UPDATE.with[col], as: col })
    }
    const cols = columns.map(col => {
      let fn = this.parse(query, [col, '<<', whereShared], ret.length ? ret : [statics.unknown, rows])
      if (fn instanceof Error) fn = this.parse(query, [col, '<<', where], ret.length ? ret : [statics.unknown, rows])
      return fn
    })

    const errors = cols.filter(col => typeof col !== 'function')
    if (errors.length) cds.error`Failed to parse query: \n${errors.join('\n')}`

    return async (context) => {
      const rowss = await Promise.all(cols.map(col => col(context)))

      if (kind === 'UPDATE') {
        const store = this.store(query._target)
        const cols = {}
        columns.forEach((col, i) => cols[column_name(col)] = rowss[i])
        return store.update(cols)
      }

      const empty = {}
      columns.forEach(col => empty[column_name(col)] = null)

      const IDs = {}
      const results = []
      let column = 0
      for (const rows of rowss) {
        const columnName = column_name(columns[column])
        column++

        for (const row of rows) {
          if (!row) continue
          const rowID = row.subarray(0, 16).toString('base64')
          const index = IDs[rowID]
          const value = JSON.parse(row.subarray(32))
          if (index > -1) results[index][columnName] = value
          else {
            IDs[rowID] = results.length
            results.push({ ...empty, [columnName]: value })
          }
        }
      }
      if (one) return results[0]
      return results
    }


    return

    // return async () => {
    //   try {
    //     const rows = await from()
    //     const cols = query.SELECT.columns.map(col => this.parse(query, [col], []))

    //     // TODO: use parse to provide column expression calculations
    //     // const store = this.store(query._target)
    //     // return store.read(rows)
    //   } catch (err) {
    //     debugger
    //     process.exit(1)
    //   }
    // }
  }

  if (xpr[0] in { case: 1, CASE: 1 }) {
    if (ret.includes(statics.unknown)) xpr = [{ val: null }]
    else {
      debugger
    }
  }

  // Find lowest operator
  let operatorIndex
  let operatorPriority
  for (let i = xpr.length; i > -1; i--) {
    const cur = xpr[i]
    if (cur in operators) {
      const op = operators[cur]
      if (!operatorPriority || operatorPriority > op.priority) {
        operatorIndex = i
        operatorPriority = op.priority
      }
    }
  }

  // Split expression into operator arguments
  if (operatorIndex) {
    const cur = xpr[operatorIndex]
    const apis = operators[cur].filter(fn => ret.includes(fn.ret))
    if (apis.length === 0) return new cds.error(`not supported: "${cur}" with return type: ${ret.map(r => r.name)}`)
    const args = []
    for (const api of apis) {
      api.args.forEach((a, i) => (args[i] ??= []).push(a))
    }
    if (args.length === 1) {
      const arg0 = this.parse(query, xpr.slice(operatorIndex + 1), args[0])
      return this.wrap(apis.find(fn => fn.args[0] === arg0.ret), arg0)
    } else {
      const right = xpr.slice(operatorIndex + 1)
      const left = xpr.slice(0, operatorIndex)
      // Try all possible combinations of argument types in order of preference
      while (args[1].length) {
        const arg1 = this.parse(query, right, args[1])
        if (arg1 instanceof Error) break // throw error
        const arg0 = this.parse(query, left, args[0].filter((_, i) => args[1][i] === arg1.ret))
        if (arg0 instanceof Error) {
          const before = args[1].length
          // Remove tried argument types for another try
          for (let i = args[1].length; i > -1; i--) {
            // splice backwards to prevent index de sync issues
            if (args[1][i] === arg1.ret) {
              args[0].splice(i, 1)
              args[1].splice(i, 1)
            }
          }
          if (before === args[1].length) debugger // detect infinite loop
          continue
        }
        return this.wrap(apis.find(fn => fn.args[0] === arg0.ret && fn.args[1] === arg1.ret), arg0, arg1)
      }
      return new cds.error(`not supported: "${cur}" with arguments: ${left}, ${right}`)
    }
  }

  // Handle native cqn types
  if (xpr.length === 1) {
    const expr = xpr[0]
    if (typeof expr === 'function' && expr.ret) {
      if (ret.includes(expr.ret)) return expr
      return new Error(`not supported: ${expr.name} for current return types`)
    }
    if (!expr || typeof expr !== 'object') { debugger; cds.error`not supported: ${expr}` }

    if ('xpr' in expr) return this.parse(query, expr.xpr, ret)
    if ('val' in expr) {
      const getter = () => expr.val
      getter.args = []
      getter.ret = statics.unknown
      return getter
    }
    if ('list' in expr) {
      // TODO: add proper list impl
      const getter = () => expr.list.map(val => val.val)
      getter.args = []
      getter.ret = statics.array
      return getter
    }
    if ('ref' in expr) {
      let where, col
      let entity = query._target
      let i = 0
      for (const step of expr.ref) {
        const id = step.id || step
        i++

        // Apply all infix filters for path expressions
        if (step.where) {
          if (where) where = [step.where, 'and', { xpr: ['exists', cds.ql.SELECT({ val: 1 }).from(entity).where(where)] }]
          else where = step.where
        }

        // References that start with an entity name (e.g. q.SELECT.from)
        if (i === 1 && this.model.definitions[id]) {
          entity = this.model.definitions[id]
        } else if (i === 1 && query.SELECT?.from?.as === id) {
          entity = query._target
        } else if (i < expr.ref.length) {
          col = entity.elements[id]
          if (col._target !== entity) {
            if (ret.includes(types.SELECT)) {
              let parent = entity
              while (parent.query) parent = parent.query._target
              const link = function () {
                return [this.context.rowID]
              }
              link.ret = rows

              const subRoutine = this.parse(cds.ql.SELECT.from(col._target), [{ ref: expr.ref.slice(i) }, '<<', link], [rows])

              const impl = function () {
                return {
                  col: col.name,
                  parent,
                  async fn(parentRow) {
                    const rowID = Buffer.from(JSON.parse(parentRow.slice(32)), 'hex')
                    const res = await subRoutine({ rowID })
                    if (!res?.length) return
                    return Buffer.concat([parentRow.slice(0, 16), res[0].slice(16)])
                  },
                }
              }

              impl.ret = types.SELECT
              return this.wrap(impl)
            }
            // return new Error(`not supported: path expressions are WIP`)
          }
          entity = col._target
        } else {
          if (col?.foreignKeys?.[id]) {
            col = col.parent.elements[col.name + '_' + id]
          } else {
            col = entity.elements[id]
          }
        }
      }

      if (!col) {
        // Apply inline where as normal expression
        if (where) return this.parse(query, [{ xpr: where }, 'and', { ref: [entity.name] }], ret)
        const apis = source.apis.filter(fn => ret.includes(fn.ret))
        if (apis.length === 0) return new cds.error(`not supported: table with return type: ${ret.map(r => r.name)}`)
        return this.wrap(apis[0], () => entity, () => where) // 0 should be the most efficient available implementations
      }

      if (expr.expand) {
        if (ret.includes(types.SELECT)) {
          let parent = entity
          while (parent.query) parent = parent.query._target
          // CURRENT PROGRESS:
          // is2one: seems to work
          // is2many: not yet supported

          const link = function () {
            return [this.context.rowID]
          }
          link.ret = rows

          const subQuery = cds.ql.SELECT(expr.expand).from(col._target).where([link])
          if (col.is2one) subQuery.SELECT.one = true
          const subRoutine = this.parse(subQuery)

          const impl = function () {
            return {
              col: col.name,
              parent,
              async fn(parentRow) {
                const rowID = Buffer.from(JSON.parse(parentRow.slice(32)), 'hex')
                const res = await subRoutine({ rowID })
                if (!res) return
                const data = Buffer.from(JSON.stringify(res))
                // parentRow.writeBigInt64LE(BigInt(data.byteLength), 24)
                return Buffer.concat([parentRow.slice(0, 24), Buffer.from(BigUint64Array.from([BigInt(data.byteLength)]).buffer), data])
              },
            }
          }

          impl.ret = types.SELECT
          return this.wrap(impl)
        }
        return new Error(`not supported: expand queries are WIP`)
      }

      if (entity.query) {
        if (entity.query.SELECT.columns) {
          const def = entity.query.SELECT.columns.find(c => c !== '*' && column_name(c) === col.name)
          if (def) {
            return this.parse(entity.query, [def], ret)
          }
        }
        return this.parse(query, [{ ref: [entity.query._target.name, col.name] }], ret)
      }

      const apis = column.apis.filter(fn => ret.includes(fn.ret))
      if (apis.length === 0) return new cds.error(`not supported: column with return type: ${ret.map(r => r.name)}`)
      return this.wrap(apis[0], () => col, () => where) // 0 should be the most efficient available implementations
    }
    debugger
  }
  debugger
}

function column_name(col) {
  return (typeof col.as === 'string' && col.as) || ('val' in col && col.val + '') || col.func || col.ref.at(-1)
}

function wrap(fn, arg0, arg1) {
  // const ret = () => {
  //   this._depth ??= 0
  //   console.log(`${''.padStart(this._depth, ' ')}${fn._name}`)
  //   this._depth += 2
  //   const ret = fn.call(this, arg0, arg1)
  //   if (ret.then === 'function') ret.then(() => { this._depth -= 2 })
  //   else this._depth -= 2
  //   return ret
  // }
  const self = this
  const ret = function (context) {
    if (context) context = { __proto__: self, context }
    else context = this === global ? self : this ?? self
    return fn.call(context, arg0?.bind(context), arg1?.bind(context))
  }
  // ret.name = fn.name
  ret.ret = fn.ret
  ret.args = fn.args
  ret.fn = fn
  return ret
}

module.exports.parse = parse
module.exports.wrap = wrap

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)