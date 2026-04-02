import __IMPORT_4__ from './pipe.js'
import __IMPORT_3__ from './or.js'
import __IMPORT_2__ from './in.js'
import __IMPORT_1__ from './eq.js'
import __IMPORT_0__ from './and.js'

const require = function() {throw Object.assign(new Error('require in browser'),{code:'MODULE_NOT_FOUND'})}
require.resolve = function(id) { 
  if(id[0] === '.') return new URL(id, import.meta.url).pathname
  throw Object.assign(new Error('require.resolve in browser'),{ code: 'MODULE_NOT_FOUND' }) 
}
export default (function(exports, module, require, __dirname,__filename) {
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
// keeping it simple for browser support
const funcs = [
  __IMPORT_0__(),
  __IMPORT_1__(),
  __IMPORT_2__(),
  __IMPORT_3__(),
  __IMPORT_4__(),
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

return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)