const net = require('net')

const cds = require("@sap/cds");
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql");
const landingPage = require('@sap/cds/app/index.js')
const htmlGetter = Object.getOwnPropertyDescriptor(landingPage, 'html')

const LOG = cds.log('app')

module.exports = class APPService extends cds.ApplicationService {
  async init() {
    this._store = {
      index: {},
      ports: {},
      applications: []
    };
    this.apps = this._store.index

    this.on(["SELECT"], this.onSELECT);
    this.on(["INSERT"], this.onINSERT);
    this.on(["UPDATE"], this.onUPDATE);
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
      await new Promise(resolve => app.server.close(resolve))
    }

    const fs = cds.utils.fs.promises

    // TODO: Add mtar support ?
    // Extract uploaded archive as .tar format (used for npm pack uploads)
    const appsFolder = `${process.cwd()}/apps/`
    const appFolder = `${appsFolder}${application}`
    await fs.mkdir(appFolder, { recursive: true })
    const tar = cds.utils.tar.xz(q.UPDATE.data.src).to(appFolder)
    await tar

    // when usign npm pack there is a package folder which is moved to root
    const packageFolder = `${appFolder}/package`
    await fs.cp(packageFolder, appFolder, { recursive: true })
    await fs.rm(packageFolder, { force: true, recursive: true })

    // update default index page with the latest application
    const _app_links = cds.utils.fs.find(appsFolder, ['*/app/*.html', '*/app/*/*.html', '*/app/*/*/*.html'])
      .map(file => 'http://' + cds.utils.fs.path.relative(appsFolder, file).replace(/\\/g, '/').replace('/app/', '.sap.cap/'))
    Object.defineProperty(landingPage, 'html', htmlGetter)

    const rootDB = cds.db
    const rootApp = cds.app
    const rootModel = cds.model
    const rootServices = cds.services
    const rootProviders = cds.service.providers

    cds.db = undefined
    cds.app = undefined
    cds.model = undefined
    cds.services = {}
    cds.service.providers = []

    // Serve bookshop app on own port
    const server = await cds.server({
      port: app.port,
      from: `apps/${app.name}/*`,
      in_memory: true,
      static: `apps/${app.name}/app`
    })

    Object.defineProperty(app, 'db', { value: cds.db, configurable: true })
    Object.defineProperty(app, 'model', { value: (app.db.model = cds.model), configurable: true })
    Object.defineProperty(app, 'server', { value: server, configurable: true })
    Object.defineProperty(app, 'services', { value: cds.services, configurable: true })
    Object.defineProperty(app, 'providers', { value: cds.service.providers, configurable: true })

    app.status = 'running'

    cds.db = rootDB
    cds.app = rootApp
    cds.model = rootModel
    cds.services = rootServices
    cds.service.providers = rootProviders

    cds.app._app_links = _app_links

    const dns = await cds.connect.to('sap.cap.dns')
    const { A } = dns.entities

    const ownip = await dns.run(SELECT(A).where([{ ref: ['name'] }, '=', { val: 'sap.cap' }]))
    await dns.run(INSERT(ownip.map(ip => ({ ...ip, name: `${app.name}.${ip.name}` }))).into(A))

    return { changes: 1 }
  }

  async _ensurePort() {
    const validate = port => new Promise(resolve => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.listen(port, () => srv.close(() => resolve(true)))
    })

    for (let port = 5000; port < 65535; port++) {
      if (!this._store.ports[port] && await validate(port)) {
        this._store.ports[port] = true
        return port
      }
    }
    throw new Error('Failed to locate ')
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

    created.port = await this._ensurePort()

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

const _run = cds._context.run
cds._context.run = function (context) {
  // context = context.context || context
  const app = context.http?.req?.host.slice(0, -8)
  const apps = cds.services['sap.cap.app']?.apps
  if (apps?.[app]) {
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
  return _run.apply(this, arguments)
}
