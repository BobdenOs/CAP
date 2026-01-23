export const sep = '/'

export const resolve = function () { }
export const parse = function (path) {
  const root = path[0] === '/' ? '/' : ''
  const baseSplit = Math.max(path.lastIndexOf(sep), 0)
  const dir = path.slice(0, baseSplit)
  const base = path.slice(baseSplit)
  const extSplit = base.lastIndexOf('.')
  const ext = base.slice(extSplit)
  const name = base.slice(0, extSplit)
  return { root, dir, base, ext, name }
}
export const join = function (...args) {
  return args.join(sep)
}
export const extname = function (path) {
  return parse(path).ext
}

export default {
  resolve,
  parse,
  join,
  extname,
}