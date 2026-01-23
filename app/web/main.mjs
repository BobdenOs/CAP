import load_cds from '/web/node_modules/@sap/cds/lib/index.js'
import remote from '/web/node_modules/@sap/cds/srv/remote-service.js'

import fs from '/web/node_modules/@cap-community/cap/srv/fs/index.js'
import db from '/web/node_modules/@cap-community/cap/srv/db/index.js'
import app from '/web/node_modules/@cap-community/cap/srv/app/index.js'
import trc from '/web/node_modules/@cap-community/cap/srv/trc/index.js'

async function start() {

  const global = globalThis.global = globalThis

  const modelFiles = [
    '/web/node_modules/@sap/cds/common.cds',
    '/web/srv/fs/index.cds',
    '/web/srv/db/index.cds',
    '/web/srv/app/index.cds',
    '/web/srv/trc/index.cds',
  ]

  caches.open('CAP_CACHE').then(cache => cache.addAll(modelFiles))

  const model = (await Promise.all(
    modelFiles.map(url => caches.match(new Request(url)).then(async response => ({ [url]: await response.text() })))
  ))
    .reduce((l, c) => Object.assign(l, c), {})

  global.process = {
    env: {},
    stdout: {},
    cwd() { return '/' },
  }

  const cds = global.cds = load_cds()
  cds.model = cds.linked(cds.minify(cds.compile(model)))
  for (const service of cds.model.services) {
    service['@impl'] = undefined
  }

  cds.env.ssl = {
    names: [location.hostname], //cert, key, ca,
    A: [], AAAA: [],
  }

  globalThis.cds.requires.kinds.odata.impl = remote()

  Object.assign(cds.requires, {
    'sap.cap.fs': { impl: fs() },
    'sap.cap.db': { impl: db() },
    // 'sap.cap.app': { impl: app() },
    'sap.cap.trc': { impl: trc() },
    db: { impl: db() },
  })

  cds.connect.to('sap.cap.fs').then(async srv => {
    const files = await srv.run(cds.ql`SELECT owner, name, dataType FROM sap.cap.fs.files`)
    debugger
  })
    .catch(err => { debugger })
}

self.addEventListener('install', event => event.waitUntil(start()))

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request)
    })
  )
})