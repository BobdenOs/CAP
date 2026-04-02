export const sep = '/'

export function isAbsolute() {
  return false
}
export function resolve(...segments) {
  return segments.reduce((l, c) => {
    if (c[0] === '/') return c
    return `${l}${l[l.length - 1] !== '/' ? '/' : ''}${c}`
  }, '/')
}

export function relative(from, to) {
  from = from.split('/')
  to = to.split('/')
  let i = 0
  for (; i < from.length; i++) if (from[i] !== to[i]) break
  return [...new Array(from.length - i).fill('..'), ...to.slice(i)].join('/')
}

export function parse(path) {
  const root = path[0] === '/' ? '/' : ''
  const baseSplit = Math.max(path.lastIndexOf(sep), 0)
  const dir = path.slice(0, baseSplit)
  const base = path.slice(baseSplit)
  const extSplit = base.lastIndexOf('.')
  const ext = base.slice(extSplit)
  const name = base.slice(0, extSplit)
  return { root, dir, base, ext, name }
}

export function join(...args) {
  return args.join(sep)
}
export function dirname(path) {
  return parse(path).dir
}
export function extname(path) {
  return parse(path).ext
}

export function basename(path, ext) {
  let base = parse(path).base.slice(1)
  if (ext) base = base.replace(ext, '')
  return base
}

export const win32 = {
  isAbsolute,
  parse,
}

export default {
  resolve,
  relative,
  isAbsolute,
  parse,
  join,
  dirname,
  extname,
  basename,
  win32,
}
