import load_cds from '/web/node_modules/@sap/cds/lib/index.js'
import remote from '/web/node_modules/@sap/cds/srv/remote-service.js'

import fs from '/web/node_modules/@cap-community/cap/srv/fs/index.js'
import db from '/web/node_modules/@cap-community/cap/srv/db/index.js'
import app from '/web/node_modules/@cap-community/cap/srv/app/index.js'
import trc from '/web/node_modules/@cap-community/cap/srv/trc/index.js'

import odata from '/web/node_modules/@sap/cds/libx/odata/ODataAdapter.js'

const endpoints = []

async function start() {

  const global = globalThis.global = globalThis

  const modelFiles = [
    '/web/srv/index.cds',
    '/web/node_modules/@sap/cds/srv/outbox.cds',
    '/web/srv/fs/index.cds',
    '/web/srv/db/index.cds',
    '/web/srv/app/index.cds',
    '/web/app/app.cds',
    '/web/app/trc/ui.cds',
    '/web/app/sys/ui.cds',
    '/web/srv/trc/index.cds',
    '/web/srv/dns/index.cds',
    '/web/node_modules/@sap/cds/common.cds',
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
    names: ['offline.' + location.hostname], //cert, key, ca,
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

  await cds.connect.to('sap.cap.fs')
  await cds.connect.to('sap.cap.trc')
  await cds.connect.to('sap.cap.db')

  const protOData = odata()
  const protocols = {
    'odata': protOData,
    'odata-v4': protOData,
  }

  for (const service of cds.services) {
    for (const endpoint of service.endpoints) {
      // TODO: come up with a good way to enable protocol adapter implementation
      endpoints.push({
        path: endpoint.path,
        adapter: new protocols[endpoint.kind](service, { prefix: endpoint.path }),
      })
    }
  }

}

self.addEventListener('install', event => event.waitUntil(start()))

self.addEventListener('fetch', event => {


  event.respondWith(
    caches.match(event.request).then(async response => {
      const url = new URL(event.request.url)
      const prot = endpoints.find(prefix => url.pathname.startsWith(prefix.path))
      if (prot) return prot.adapter.router(event.request)
      return response || fetch(event.request)
    })
  )
})
