const cds = require('@sap/cds')

async function extractRequire(file, replace) {
  const source = await cds.utils.fs.promises.readFile(file, 'utf-8')

  let transform = source
  transform = transform.replace(/^#!.*/, '')
  transform = transform.replace(/(?:lazyload|require) *\( *?['"](.*?)['"] *?\)/g, (_, path) => replace(path))

  return transform
}

async function transformESM(file) {
  const requires = {}
  let imports = 0

  const resolve = require('node:module').createRequire(file).resolve
  const replace = path => {
    try {
      path = resolve(path)
      return `__IMPORT_${(requires[path] ??= imports++)}__${path.startsWith(cds.root) ? '()' : ''}`
    } catch {
      return `({})`
    }
  }

  let transform = await extractRequire(file, replace)

  switch (cds.utils.path.extname(file)) {
    case '.json': transform = `export default function() {return ${transform}\n}`
      break
    case '.cjs':
    case '.js': transform = `
const require = function() {throw Object.assign(new Error('require in browser'),{code:'MODULE_NOT_FOUND'})}
require.resolve = function(id) { 
  if(id[0] === '.') return new URL(id, import.meta.url).pathname
  throw Object.assign(new Error('require.resolve in browser'),{ code: 'MODULE_NOT_FOUND' }) 
}
export default (function(exports, module, require, __dirname,__filename) {
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
${transform}
return module.exports
}).bind(globalThis,{},{},require,new URL('.', import.meta.url).pathname,new URL('', import.meta.url).pathname)`
      break;
  }

  for (const path in requires) {
    transform = `import __IMPORT_${requires[path]}__ from '${path.startsWith(cds.root) ? `/web${path.slice(cds.root.length)}` : `/web/node/${path.replace('node:', '')}.mjs`}'\n${transform}`
  }
  return transform
}

async function transformFunction(file) {
  const replace = path => path === '@sap/cds' ? 'global.cds' : `({})`

  let transform = await extractRequire(file, replace)

  switch (cds.utils.path.extname(file)) {
    case '.json': transform = `return ${transform}`
      break
    case '.cjs':
    case '.js': transform = `
if(module.__loaded__) { return module.exports }
module.__loaded__ = true
module.exports = exports;
${transform}
return module.exports
`
      break;
  }

  const localRequire = function () { throw Object.assign(new Error('require in browser'), { code: 'MODULE_NOT_FOUND' }) }
  localRequire.resolve = function (id) {
    if (id[0] === '.') return new URL(id, file).pathname
    throw Object.assign(new Error('require.resolve in browser'), { code: 'MODULE_NOT_FOUND' })
  }
  const impl = new Function('exports', 'module', 'require', '__dirname', '__filename', transform).bind(globalThis, {}, {}, localRequire, new URL('.', `https://host/${file}`).pathname, new URL('', `https://host/${file}`).pathname)
  return impl()
}


if (require.main === module) {
  const appDir = cds.utils.path.resolve(__dirname, '../../app/')
  const srvDir = cds.utils.path.resolve(__dirname, '../../srv/')
  const capRoot = cds.root
  const distDir = cds.utils.path.resolve(capRoot, 'dist')

  function ensureJS(str) {
    return str.replace(/\.(json|cjs)$/, '.js')
  }

  async function walkImports(file, parent, walked = {}) {
    if (file[0] === '/') file = file.slice(1)
    const appFile = cds.utils.path.resolve(appDir, file)
    const rootFile = cds.utils.path.resolve(capRoot, file.replace('web/', ''))

    // find source of the file that would be served
    let content
    if (parent && file[0] === '.') {
      file = cds.utils.path.resolve(parent, '..', file)
      content = parent.startsWith(appDir) ? await cds.utils.fs.promises.readFile(file) : await transformESM(file)
    }
    else if (cds.utils.fs.existsSync(appFile)) {
      file = appFile
      content = await cds.utils.fs.promises.readFile(file)
    }
    else if (cds.utils.fs.existsSync(rootFile)) {
      file = rootFile
      content = await transformESM(file)
    }
    else cds.error`Failed to identify dependency: ${file}${parent ? ` (${parent})` : ''}`

    if (walked[file]) return

    const distFile = cds.utils.path.resolve(distDir, file.startsWith(appDir) ? file.replace(appDir, '.') : file.replace(capRoot, './web/'))
    await cds.utils.fs.promises.mkdir(cds.utils.path.dirname(distFile), { recursive: true })
    await cds.utils.fs.promises.writeFile(
      ensureJS(distFile),
      `${content}`.replace(/^(import.*from.*)'(.*)'(.*)$/gm, (_, a, b, c) => {
        b = ensureJS(b)
        if (b[0] === '/') {
          b = '.' + b
          b = cds.utils.path.resolve(distDir, b)
          b = cds.utils.path.relative(cds.utils.path.dirname(distFile), b)
          if (b[0] !== '.') b = './' + b
        }
        return `${a}'${b}'${c}`
      }),
    )

    console.log(file)
    walked[file] = true

    for (const [a, f, b, c, d, e] of `${content}`.matchAll(/^import.*from\W*'(.*)'\W*$/gm)) {
      await walkImports(f, file, walked)
    }
  }

  cds.utils.fs.promises.rm(distDir, { recursive: true, force: true }).then(() => { }, () => { })
    .then(() => cds.utils.fs.promises.mkdir(distDir, { recursive: true }))
    .then(() => Promise.all([
      cds.utils.fs.promises.cp(cds.utils.path.resolve(appDir, 'index.html'), cds.utils.path.resolve(distDir, 'index.html')),
      cds.utils.fs.promises.cp(cds.utils.path.resolve(appDir, 'main.mjs'), cds.utils.path.resolve(distDir, 'main.mjs')),
      cds.utils.fs.promises.cp(cds.utils.path.resolve(appDir, 'appconfig'), cds.utils.path.resolve(distDir, 'appconfig'), { recursive: true }),
      cds.utils.fs.promises.cp(appDir, cds.utils.path.resolve(distDir, 'web/app'), { recursive: true }),
      cds.utils.fs.promises.cp(srvDir, cds.utils.path.resolve(distDir, 'web/srv'), { recursive: true }),
    ]))
    .then(async () => {
      const cdsDir = cds.utils.path.resolve(require.resolve('@sap/cds'), '../..')
      const files = await cds.utils.fs.promises.readdir(cdsDir, { recursive: true })
      const models = files.filter(f => /\.cds$/.test(f))
      return Promise.all(models.map(f => cds.utils.fs.promises.cp(cds.utils.path.resolve(cdsDir, f), cds.utils.path.resolve(distDir, 'web/node_modules/@sap/cds', f))))
    })
    .then(() => walkImports('main.mjs'))
    .then(async () => {
      const files = (await cds.utils.fs.promises.readdir(distDir, { recursive: true, withFileTypes: true })).map(f => f.isFile() && `${f.parentPath.slice(distDir.length)}/${f.name}`).filter(a => a)
      files.unshift('/')
      await cds.utils.fs.promises.writeFile(cds.utils.path.resolve(distDir, 'cache.js'), `export default ${JSON.stringify(files, null, 2)}`)
    })
}

module.exports = {
  transformESM,
  transformFunction,
}
