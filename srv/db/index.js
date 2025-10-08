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
    this.on(["INSERT"], this.onINSERT)
    this.on(["UPSERT"], this.onUPSERT)
    this.on(["UPDATE"], this.onUPDATE)
  }

  run() {
    if (!this.owner) cds.error`sap.cap.fs requires the service to be bound to an owner`
    return super.run(...arguments)
  }

  disconnect() { }

  bind(srv) {
    return { __proto__: this, owner: srv }
  }

  get model() {
    return this.owner?.model
  }

  set model(_) { }

  get fs() {
    return (super.fs = (cds.connect.to('sap.cap.fs').then(fs => fs.bind(this))))
  }

  async onCREATE(req) {
    return new Store(this, req.query._target).init()
  }

  async onSELECT(req) {
    const q = cqn4sql(req.query, this.model)

    const store = this.store(q._target)

    // TODO: implement full fletched where clauses
    if (q.SELECT.where) {
      const action = this.parse(q, q.SELECT.where)
      const rows = await action()
      if (rows.length === 0) return []

      const ret = await store.read(rows)
      return ret
    } else {

    }

    const results = await store.read()

    return results
  }

  async onINSERT(req) {
    const q = cqn4sql(req.query, this.model)

    const store = new Store(this, q._target)
    await store.insert(q.INSERT.entries)

    return { changes: 0 }
  }

  async onUPSERT(req) {
    const q = cqn4sql(req.query, this.model)

    const store = new Store(this, q._target)

    const keys = []
    for (const element of store.elements) {
      if (!element.key || element.virtual || element.isAssociation || element.value) continue
      keys.push(element.name)
    }

    const entries = []
    for await (const entry of q.UPSERT.entries) {
      // TODO: proper compound key lookup
      for (const key of keys) {
        const rows = await store.find(entry[key], key)
        if (rows.length === 0) {
          entries.push(entry)
          break
        }
      }
    }
    if (entries.length === 0) return { changes: 0 }

    await store.insert(entries)
    return { changes: entries.length }
  }

  async onUPDATE(req) {
    const q = cqn4sql(req.query, this.model)

    debugger
  }

  store(entity) {
    return new Store(this, entity)
  }

  parse(query, xpr) {
    return parse.call(this, query, xpr)
  }

  wrap(fn, ...args) {
    return wrap.call(this, fn, ...args)
  }
}
