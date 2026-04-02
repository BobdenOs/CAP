const cds = require('@sap/cds')

const expr = function (expr) {

}

const xpr = function ({ xpr }) {
  const ret = [];
  (xpr || [])
    .map((x, i, xpr) => {
      if (typeof x === 'string') {
        const ops = x.trim().split(' ')
        if (ops.find(x => !operators[x.toUpperCase()])) cds.error`Unknown operator ${JSON.stringify(x)}`
        if (ops.find(x => x.toUpperCase() === 'OR')) {
          // TODO: combine 'AND' while splitting on 'OR'
        }
      }
      return expr(x)
    })

  return ret
}

const ops = {
  '=': {
    ref: {
      *val(ref, val) { },
    },
    val: {
      *ref(val, ref) { },
    }
  }
}

function* equal4Ref2Val(ref, val) {

}

function* and4rows2rows(a, b) {

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