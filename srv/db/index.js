const { pipeline } = require('stream/promises')

const cds = require("@sap/cds")
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql")

const { Store } = require('./utils/store.js')
const { parse, wrap } = require('./xpr/parse.js')

const LOG = cds.log('db')

module.exports = class DBService extends cds.ApplicationService {
  async init() {
    this.on(["CREATE ENTITY"], this.onCREATE)
    this.on(["SELECT"], this.onSELECT)
    this.on(["INSERT", "UPSERT"], this.onINSERT)
    this.on(["UPDATE"], this.onUPDATE)
    this._caches = {
      stores: {},
      chunks: false,
    }
  }

  _requires_resolving() { return false }

  disconnect() { }

  bind(srv) {
    return { __proto__: this, owner: srv }
  }

  get model() {
    return this.owner?.model ?? this._model
  }

  set model(model) {
    this._model = model
  }

  get fs() {
    return (super.fs = (cds.connect.to('sap.cap.fs').then(fs => fs.bind(this))))
  }

  async onCREATE(req) {
    return new Store(this, req.query._target).init()
  }

  async onSELECT(req) {
    req.query.SELECT.localized = false // TODO: probably one of the last features to support
    const action = this.parse(req.query)
    return action()
  }

  async onINSERT(req) {
    let q
    try { q = this.resolve(req.query) || req.query } catch { q = req.query }
    const kind = q.kind
    if (!q[kind].entries && q[kind].rows && q[kind].columns) {
      q[kind].entries = q[kind].rows.map(row => {
        const r = {}
        q[kind].columns.forEach((col, i) => { r[col] = row[i] })
        return r
      })
    }

    const store = new Store(this, q._target)
    await store.insert(q[kind].entries)

    return { changes: 0 }
  }

  async onUPDATE(req) {
    // const q = cqn4sql(req.query, this.model)

    const action = this.parse(req.query)
    return action()
  }

  store(entity) {
    return (this._caches.stores[entity.name] ??= new Store(this, entity))
  }

  parse(query, xpr, ret) {
    return parse.call(this, query, xpr, ret)
  }

  wrap(fn, ...args) {
    return wrap.call(this, fn, ...args)
  }

  url4(tenant) {
    return 'sap.cap.db'
  }

  // REVISIT: used by `@sap/cds-compiler` to identify old database services
  static includes () { return false }
}
