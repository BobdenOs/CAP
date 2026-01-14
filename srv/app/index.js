const { Readable } = require('stream')
const express = require('express')

const cds = require("@sap/cds");
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql");

const LOG = cds.log('app')

module.exports = class APPService extends cds.ApplicationService {
  async init() {
    this._store = {
      index: {},
      ports: {},
      applications: []
    };
    this.apps = this._store.index
    this._root = `${process.env.FS_MOUNT || process.cwd()}/apps/`

    this.on(["SELECT"], this.onSELECT);
    this.on(["INSERT"], this.onINSERT);
    this.on(["UPDATE"], this.onUPDATE);

    const fioriConfig = '/appconfig/fioriSandboxConfig.json'
    const rootStatic = express.static(cds.utils.path.resolve(cds.root, 'app'))
    cds.app.use('/', async (req, res, next) => {
      const host = req.hostname
      let app
      if (host) for (let name of cds.env.ssl.names) if (host.endsWith(name)) app = host.slice(0, name.length * -1 - 1)
      const apps = cds.services['sap.cap.app']?.apps
      if (apps?.[app]) {
        if (req.url === '/') return res.redirect(apps[app].appIndex)
        return apps[app].static?.(req, res, next)
      }
      if (req.path === fioriConfig) {
        try {
          const defaultConfig = JSON.parse(await cds.utils.fs.promises.readFile(cds.utils.path.resolve(cds.root, `app${fioriConfig}`)))
          for (const app in apps) defaultConfig.applications[`${app}-open`] = {
            title: app,
            description: app,
            applicationType: 'URL',
            url: `https://${app}.${host}/`,
          }
          return res.json(defaultConfig)
        } catch (err) {
          return next(err)
        }
      }
      return rootStatic(req, res, next)
    })

    cds.on('listening', () => this._loadApps())
  }

  disconnect() { }

  async onSELECT(req) {
    const q = cqn4sql(req.query, this.model);

    return this._store.applications
  }

  async onINSERT(req) {
    const q = cqn4sql(req.query, this.model);

    return { changes: 0 }
  }

  async onUPDATE(req) {
    const q = cqn4sql(req.query, this.model || cds.model);

    // Identify what application is being uploaded
    const application = q.UPDATE.where.find(e => typeof e.val === 'string')?.val
    if (!application) {
      throw Object.assign(new Error('Application name missing'), { code: 400 })
    }

    const app = await this._ensureApplication(application)
    if (app.status === 'running') {
      app.status = 'upgrading'
    }
    // TODO: Add mtar support ?
    // Extract uploaded archive as .tar format (used for npm pack uploads)
    const appFolder = `${this._root}${application}`
    await cds.utils.fs.promises.mkdir(appFolder, { recursive: true })

    if (q.UPDATE.data?.src) {

      // Split the stream into two streams for storing and unpacking at the same time
      const [toTar, toFs] = Readable.toWeb(q.UPDATE.data.src).tee().map(s => Readable.fromWeb(s))

      // Store archive to sap.cap.fs service
      const fs = await this.fs
      const update = fs.run(
        cds.ql.UPDATE(fs.entities.files)
          .with({ dataType: 'application/x-tar', data: toFs })
          .where`name=${application}`
      )

      // Stream archive into tar to be unpacked
      const tar = cds.utils.tar.xz(toTar).to(appFolder)
      await Promise.all([tar, update])

      await new Promise((resolve) => setTimeout(resolve, 10000))
    } else {
      const fs = await this.fs
      // TODO: this query should include the current domain to no auto host all parent applications
      const chunks = await fs.run(cds.ql.SELECT('data').from(fs.entities.chunks).where`file.name = ${application}`)
      if (chunks.length < 1) {
        app.status = 'failed'
        return { changes: 1 }
      }
      const [{ data: toTar }] = chunks

      // Stream archive into tar to be unpacked
      const tar = cds.utils.tar.xz(toTar).to(appFolder)
      await tar
    }

    // when using npm pack there is a package folder which is moved to root
    const packageFolder = `${appFolder}/package`
    await cds.utils.fs.promises.cp(packageFolder, appFolder, { recursive: true })
    await cds.utils.fs.promises.rm(packageFolder, { force: true, recursive: true })
    await cds.utils.fs.promises.symlink(cds.utils.path.resolve(`${cds.home}/../../`), `${appFolder}/node_modules`)
      .catch(err => { })

    if (!cds.db) await cds.connect.to('db')

    const rootDB = cds.db
    const rootApp = cds.app
    const rootModel = cds.model
    const rootDomain = cds.env.ssl.names[0]
    const rootServices = cds.services
    const rootProviders = cds.service.providers

    try {
      const csn = await cds.load(`${appFolder}/*`)
      const model = cds.compile.for.nodejs(csn)

      cds.db = rootDB.bind({ model })
      // cds.app = undefined
      cds.model = model
      cds.services = { __proto__: rootServices }
      cds.service.providers = []

      // Serve app
      await cds.serve('all').in(rootApp)
      // cds.deploy is not needed as the sap.cap.db will create the entity on the fly
      // when the first piece of data is written to the entity
      await cds.deploy.data(cds.db)
      await cds.emit('served', cds.services)

      for (const each of cds.service.providers) {
        const endpoint = each.endpoints[0]
        cds.service.bindings.provides[each.name] = {
          kind: endpoint.kind,
          credentials: {
            url: `${app.name}.${rootDomain}${endpoint.path}`
          }
        }
      }

      Object.defineProperty(app, 'db', { value: cds.db, configurable: true })
      Object.defineProperty(app, 'model', { value: (app.db.model = cds.model), configurable: true })
      Object.defineProperty(app, 'services', { value: cds.services, configurable: true })
      Object.defineProperty(app, 'providers', { value: cds.service.providers, configurable: true })
      Object.defineProperty(app, 'static', {
        value: express.static(cds.utils.path.resolve(appFolder, 'app')),
        configurable: true,
      })

      const appIndex = cds.utils.fs.find(appFolder, ['app/*.html', 'app/*/*.html', 'app/*/*/*.html'])
        .map(file => 'https://' + cds.utils.fs.path.relative(appFolder, file).replace(/\\/g, '/').replace('app/', `${application}.${rootDomain}/`))
      Object.defineProperty(app, 'appIndex', { value: appIndex[0], configurable: true })
    } finally {
      cds.db = rootDB
      cds.app = rootApp
      cds.model = rootModel
      cds.services = rootServices
      cds.service.providers = rootProviders

      await cds.spawn({ user: rootDomain }, async () => {
        const dns = await cds.connect.to('sap.cap.dns')
        const { A, AAAA } = dns.entities

        await Promise.all([
          dns.run(SELECT(A).where([{ ref: ['name'] }, '=', { val: rootDomain }]))
            .then(ips => dns.run(INSERT(ips.map(ip => ({ ...ip, name: `${app.name}.${ip.name}` }))).into(A))),
          dns.run(SELECT(AAAA).where([{ ref: ['name'] }, '=', { val: rootDomain }]))
            .then(ips => dns.run(INSERT(ips.map(ip => ({ ...ip, name: `${app.name}.${ip.name}` }))).into(AAAA))),
        ])
      })

      app.status = 'failed'
    }

    app.status = 'running'

    return { changes: 1 }
  }

  get fs() {
    return super.fs = cds.connect.to('sap.cap.fs').then(fs => fs.bind(this))
  }

  async _loadApps() {
    const fs = await this.fs

    // TODO: this query should include the current domain to no auto host all parent applications
    const applications = await fs.run(cds.ql.SELECT.from(fs.entities.files))

    for (const application of applications) {
      await this.run(cds.ql.UPDATE(this.entities.applications).where`name=${application.name}`)
    }
  }

  async _ensureApplication(application) {
    const current = this._store.applications.find(a => {
      a.port
      return a.name === application
    })
    if (current) return current

    const created = {
      name: application,
      status: 'deploying',
    }
    this._store.applications.push(created)
    this._store.index[application] = created

    created.port = Number(cds.app.server?.address()?.port || process.env.PORT || 443)

    return created
  }
};

// cds context injection for running multiple applications within the same process
cds._model = cds.model
Object.defineProperty(cds, 'model', {
  get() { return cds.context?.model || cds._model },
  set(model) { cds._model = model }
})

cds._db = cds.db
Object.defineProperty(cds, 'db', {
  get() { return cds.context?.db || cds._db },
  set(db) { cds._db = db }
})

cds._services = cds.services
Object.defineProperty(cds, 'services', {
  get() { return cds.context?.services || cds._services },
  set(services) { cds._services = services }
})

cds.service._providers = cds.service.providers
Object.defineProperty(cds.service, 'providers', {
  get() { return cds.context?.providers || cds.service._providers },
  set(providers) { cds.service._providers = providers }
})

const _with = cds._with
cds._with = function (context) {
  // context = context.context || context
  const host = context.http?.req?.hostname
  let app
  if (host) for (let name of cds.env.ssl.names) if (host.endsWith(name)) app = host.slice(0, name.length * -1 - 1)
  const apps = cds.services['sap.cap.app']?.apps
  if (apps?.[app]) {
    // Object.defineProperty(landingPage, 'html', htmlGetter)
    context.db = apps[app].db
    context.services = apps[app].services
    context.providers = apps[app].providers
    apps[app].db.model = context.model = apps[app].model
  } else if (cds.context) {
    context = context.context || context
    context.db = cds.context.db
    context.model = cds.context.model
    context.services = cds.context.services
    context.providers = cds.context.providers
  }
  return _with.apply(this, arguments)
}
