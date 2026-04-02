export function createRequire(file) {
  return {
    resolve(path) {
      if (path.startsWith('node:')) return path
      if (path.startsWith('@')) return `//node_modules/${path}`
      throw new Error(`Unknown source for ${file}: ${path}`)
    }
  }
}

export default {
  createRequire,
}
