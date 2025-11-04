const fs = require('node:fs')

const funcs = fs.readdirSync(__dirname)

const operators = {}
const functions = {}
for (const func of funcs) {
  if (func === 'index.js') continue // ignore self
  const fn = require('./' + func)

  if (fn.operators?.[0]) function_name(fn.operators[0], fn.apis)
  for (const operator of (fn.operators || [])) {
    operators[operator] = fn.apis
    operators[operator].priority = fn.priority
  }

  if (fn.names?.[0]) function_name(fn.operators[0], fn.apis)
  for (const name of (fn.names || [])) {
    functions[name] = fn.apis
  }
}

module.exports.operators = operators
module.exports.functions = functions

// example operator priority table https://sqlite.org/lang_expr.html

function function_name(name, apis) {
  for (const api of apis) {
    api._name = `${name}(${api.args.map(arg => arg.name)}) ${api.ret.name}`
  }
}
