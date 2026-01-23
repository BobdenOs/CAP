// keeping it simple for browser support
const funcs = [
  require('./and.js'),
  require('./eq.js'),
  require('./in.js'),
  require('./or.js'),
  require('./pipe.js'),
  // ...
]

const operators = {}
const functions = {}
for (const fn of funcs) {
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
