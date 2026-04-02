import load_cds from '/web/node_modules/@sap/cds/lib/index.js'
import remote from '/web/node_modules/@sap/cds/srv/remote-service.js'

import fs from '/web/node_modules/@cap-community/cap/srv/fs/index.js'
import db from '/web/node_modules/@cap-community/cap/srv/db/index.js'
import app from '/web/node_modules/@cap-community/cap/srv/app/index.js'
import trc from '/web/node_modules/@cap-community/cap/srv/trc/index.js'

import odata from '/web/node_modules/@sap/cds/libx/odata/ODataAdapter.js'
import appService from '/web/node_modules/@sap/cds/srv/app-service.js'

import cacheFiles from '/cache.js'

async function install() {
  caches.open('CAP_CACHE').then(cache => cache.addAll(cacheFiles))
}

async function activate() {
  const global = globalThis.global = globalThis

  const modelFiles = [
    './web/srv/index.cds',
    './web/node_modules/@sap/cds/srv/outbox.cds',
    './web/srv/fs/index.cds',
    './web/srv/db/index.cds',
    './web/srv/app/index.cds',
    './web/app/app.cds',
    './web/app/trc/ui.cds',
    './web/app/sys/ui.cds',
    './web/app/app/ui.cds',
    './web/srv/trc/index.cds',
    './web/srv/dns/index.cds',
    './web/node_modules/@sap/cds/common.cds',
  ]

  const model = (await Promise.all(
    modelFiles.map(url => caches.match(new Request(url)).then(async response => ({ [import.meta.resolve(url)]: await response.text() })))
  ))
    .reduce((l, c) => Object.assign(l, c), {})

  global.process = {
    // platform: 'win32',
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
    'app-service': { impl: appService() },
    'sap.cap.fs': { impl: fs() },
    'sap.cap.db': { impl: db() },
    'sap.cap.app': { impl: app() },
    'sap.cap.trc': { impl: trc() },
    db: { impl: db() },
  })

  await cds.connect.to('sap.cap.fs')
  await cds.connect.to('sap.cap.trc')
  await cds.connect.to('sap.cap.db')
  await cds.connect.to('sap.cap.app')

  const protOData = odata()

  cds.service.protocols.rest.impl = protOData
  cds.service.protocols.odata.impl = protOData
  cds.service.protocols['odata-v4'].impl = protOData

  // await cds.serve('all')
}

self.addEventListener('install', event => event.waitUntil(install()))
self.addEventListener('activate', event => event.waitUntil(activate()))

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(async response => {
      const url = new URL(event.request.url)

      // handle request with cds services when defined
      const app = cds.services['sap.cap.app']?.apps[/\/apps\/([^/]*)\//.exec(event.request.referrer)?.[1]]

      const services = app?.services ?? cds.services
      for (const service of services) {
        for (const endpoint of service.endpoints) {
          if (url.pathname.startsWith(endpoint.path)) {
            if (app) cds.db = app.db
            const prot = endpoint.adapter ??= new cds.service.protocols[endpoint.kind].impl(service, { prefix: endpoint.path })
            return prot.router(event.request)
          }
        }
      }

      return response || fetch(event.request)
    })
  )
})
