const { operators, functions } = require('../fnc/index.js')
const { types, static, ref, rows, rowsAsync } = require('../xpr/types.js')

const parse = function (query, xpr, ret = [rows]) {
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
    if (!expr || typeof expr !== 'object') cds.error`not supported: ${expr}`
    if ('xpr' in expr) return this.parse(query, expr.xpr, ret)
    if ('val' in expr) {
      const getter = () => expr.val
      getter.args = []
      getter.ret = static.unknown
      return getter
    }
    if ('ref' in expr) {
      const getter = () => query.sources[expr.ref[0]].definition.elements[expr.ref[1]]
      getter.args = []
      getter.ret = ref
      return getter
    }
    debugger
  }
  debugger
}

function wrap(fn, arg0, arg1) {
  const ret = () => fn.call(this, arg0?.(), arg1?.())
  ret.name = fn.name
  ret.ret = fn.ret
  ret.args = fn.args
  return ret
}

module.exports.parse = parse
module.exports.wrap = wrap
