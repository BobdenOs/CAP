const cds = require('@sap/cds')

const expr = module.exports.expr = x => {
  if (typeof x !== 'object') return JSON.stringify(x)

  if ('param' in x) {
    return `params${x.ref.map(r => `[${JSON.stringify(r)}]`).join('')}`
  }
  if ('ref' in x) {
    return `row[${JSON.stringify(resultName)}]`
  }
  if ('val' in x) {
    if ('cast' in x) {
      const inputConverter = x.element[this.constructor._convertInput]
      if (inputConverter) {
        return `(${inputConverter})(${expr({ val: x.val })},cds.builtin.types[${JSON.stringify(x.element.type)}])`
      }
    }
    if (x.val instanceof RegExp) {
      return JSON.stringify(x.val.source)
    }
    if (typeof x.val === 'function') {
      cds.error`A val cannot be a function`
    }
    return JSON.stringify(x.val ?? null)
  }
  if ('xpr' in x) return `(${xpr(x)})`
  if ('func' in x) {
    const func = functions[x.func]
    if (!func) {
      cds.error`Unknown function ${x.func}`
    }
    funcs.push(func)
    return `this.Functions[${JSON.stringify(x.func)}].fn${func.aggregate ? `(group,${JSON.stringify(x.args)})` : `(row,[${x.args.map(expr)}])`}`
  }
  if ('list' in x) {
    return `[${x.list.map(expr)}]`
  }
  if ('SELECT' in x)
    return `(await this.run(
  cds.ql.SELECT${x.SELECT.one ? '.one' : ''}${x.SELECT.columns ? `.columns(${JSON.stringify(x.SELECT.columns)})` : ''
      }.from(${JSON.stringify(x.SELECT.from)})${x.SELECT.where ? `.where([${x.SELECT.where.map(w => subSELECT(w, x.SELECT.from.as))}])` : ''
      }${x.SELECT.groupBy ? `.groupBy(${expr({ xpr: x.SELECT.groupBy })})` : ''}${x.SELECT.having ? `.having(${expr({ xpr: x.SELECT.having })})` : ''
      }${x.SELECT.orderBy ? `.orderBy(${expr({ xpr: x.SELECT.orderBy })})` : ''}${x.SELECT.limit ? `.limit(${JSON.stringify(x.SELECT.limit)}` : ''
      },
  row
))`

  cds.error`UNKNOWN EXPR ${JSON.stringify(x)}`
}

const subSELECT = (x, alias) => {
  if (alias && x.ref && x.ref.length > 1 && x.ref[0] !== alias) {
    x = { ref: x.ref.slice(1), param: true }
  }
  return JSON.stringify(x)
}

const xpr = module.exports.xpr = ({ xpr }) => {
  return (xpr || [])
    .map((x, i, xpr) => {
      if (typeof x === 'string') {
        const ops = x.trim().split(' ')
        return ops
          .map(x => {
            const op = operators[x.toUpperCase()]
            if (op == null) {
              cds.error`Unknown operator ${JSON.stringify(x)}`
            }
            return typeof op === 'function' ? op(x, i, xpr) : op
          })
          .join(' ')
      }
      return expr(x)
    })
    .join(' ')
}

// Operators
String.prototype.like = function (pattern) {
  return this.match(pattern instanceof RegExp ? pattern : pattern.replace(/%/g, '.*').replace(/_/g, '.'))
}

const operators = {
  EXISTS: `'0' in `,
  IN: 'in',
  '=': '===',
  '!=': '!==',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  '||': '+',
  AND: '&&',
  OR: '||',
  NOT: '!',
  LIKE: (e, i, expr) => {
    // Put brackets around pattern string
    expr[i + 1] = { xpr: [expr[i + 1]] }
    return '?.like?.'
  },

  CASE: '',
  WHEN: '(',
  THEN: ')?(',
  ELSE: '):(',
  END: (e, i, expr) => {
    const hasElse = expr.slice(expr.slice(0, i).lastIndexOf('case'), i).lastIndexOf('else') > -1
    return hasElse ? ')' : ':null)'
  }
}

// Functions
const functions = {
  count: {
    aggregate: true,
    fn: (data /*args*/) => {
      return data.length
    }
  },
  countdistinct: {
    aggregate: true,
    fn: (data, [col]) => {
      const prop = col.ref[col.ref.length - 1]
      const found = {}
      for (let i = 0; i < data.length; i++) {
        found[data[i][prop]] = true
      }
      return Object.keys(found).length
    }
  },
  avg: {
    aggregate: true,
    fn: (data, [col]) => {
      const prop = col.ref[1]
      let avg = 0
      const cnt = data.length
      for (let i = 0; i < data.length; i++) {
        avg += data[i][prop] / cnt
      }
      return avg
    }
  },
  sum: {
    aggregate: true,
    fn: (data, [col]) => {
      const prop = col.ref[1]
      let total = 0
      for (let i = 0; i < data.length; i++) {
        total += data[i][prop]
      }
      return total
    }
  },
  max: {
    aggregate: true,
    fn: (data, [col]) => {
      const prop = col.ref[1]
      let max = data[0][prop] || 0
      for (let i = 1; i < data.length; i++) {
        if (data[i][prop] > max) {
          max = data[i][prop]
        }
      }
      return max
    }
  },
  min: {
    aggregate: true,
    fn: (data, [col]) => {
      const prop = col.ref[1]
      let min = data[0][prop] || 0
      for (let i = 1; i < data.length; i++) {
        if (data[i][prop] < min) {
          min = data[i][prop]
        }
      }
      return min
    }
  },

  search: {
    // TODO: make sure that args are not compiled, but raw cqn
    fn: (row, [cols, match]) => {
      if (!cols?.length) cds.error`SEARCH MISSING COLUMN LIST ARGUMENT`
      if (!match || !match.length) cds.error`SEARCH MISSING TERM ARGUMENT`

      const regexp = new RegExp(match, 'i')

      // Check all columns references for the sub string
      for (var i = 0; i < cols.length; i++) {
        if (cols[i]?.match?.(regexp)) return true
      }
      return false
    }
  },

  // String functions
  length: { fn: (row, [str]) => str.length },
  indexof: { fn: (row, [str, subStr]) => str?.indexOf(subStr) },
  substring: { fn: (row, [str, s, e]) => str?.slice(s, e === undefined ? undefined : s + e) },
  trim: { fn: (row, [str]) => str?.trim() },
  contains: { fn: (row, [str, subStr]) => str?.indexOf(subStr) > -1 },
  endswith: { fn: (row, [str, subStr]) => str?.endsWith(subStr) || false },
  startswith: { fn: (row, [str, subStr]) => str?.startsWith(subStr) || false },
  tolower: { fn: (row, [str]) => str.toLowerCase() },
  toupper: { fn: (row, [str]) => str.toUpperCase() },
  concat: { fn: (row, args) => args.join('') },

  // Numbers
  ceiling: { fn: (row, [nr]) => Math.ceil(nr) },
  floor: { fn: (row, [nr]) => Math.floor(nr) },
  round: { fn: (row, [nr]) => Math.round(nr) },

  // Date
  year: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCFullYear() },
  month: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCMonth() + 1 },
  day: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCDate() },
  hour: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCHours() },
  minute: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCMinutes() },
  second: { fn: (row, [date]) => (date instanceof Date ? date : new Date(date)).getUTCSeconds() }
}

functions.average = functions.avg
