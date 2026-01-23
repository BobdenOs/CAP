const { pipeline } = require('stream/promises')

const cds = require("@sap/cds");
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql");
const { Readable } = require('stream');

const LOG = cds.log('fs')

module.exports = class FSService extends cds.ApplicationService {
  async init() {
    if (cds.requires?.[this.name]?.impl) delete cds.requires[this.name].impl // impl has to be defined for offline mode
    this._store = {
      index: {},
    };
    this._root = `${process.env.FS_MOUNT || process.cwd()}/storage/`
    this.db = (await cds.connect.to('sap.cap.db')).bind(this)

    const domain = cds.env.ssl.names[0].split('.').slice(1).join('.')
    this._remote = await cds.connect.to(this.name, {
      kind: 'odata',
      credentials: {
        url: `https://${domain}/odata/v4/fs`,
        mtls: true,
        trustStoreCertificate: {
          content: btoa(global.cds.env.ssl.ca)
        },
      }
    })

    this.on(["SELECT"], this.onSELECT)
    this.on(["INSERT", "UPSERT"], this.onINSERT)
    this.on(["UPDATE"], this.onUPDATE)
  }

  disconnect() { }

  bind(srv) {
    return { __proto__: this, owner: srv, _root: `${this._root}${srv.name}/` }
  }

  // CURRENT TASK: convert to using db service for the fs index table
  // REQUIREMENTS: insert file names into index table
  // REQUIREMENTS: search index table for specific file name
  // REQUIREMENTS: cluster and local mode to distribute tasks over the cluster
  async onSELECT(req) {
    const { files, chunks } = this.entities
    if (req.query._target !== files && req.query._target !== chunks) { debugger }
    let q = req.query

    const external = []
    if (cds.env.ssl.names[0] === 'dev.sap.cap' && !q.SELECT.one) {
      const parent = await this._SELECT_Parent(req)
        // REVISIT: used to identify cluster config issue when calling top level domains
        .catch(err => { /*debugger*/ })
      if (parent?.length) for (const row of parent) {
        external.push(row)
      }
    }

    if (q._target === files) {
      const ret = await this.db.run(this.owner ? q.where`owner=${this.owner.name}` : q)
      if (Array.isArray(ret)) for (const row of external) ret.push(row)
      return ret
    }
    if (q._target === chunks) {

      // Cyclic dependency breaker: enforcing local copy of chunk location index
      if (this.owner?.name === 'sap.cap.db') {
        q = cqn4sql(q, this.model)
        const root_file = q.SELECT.where?.find(val => /sap.cap.fs.chunks\//.test(val.val) || (val.list && !val.list?.find(val => !/sap.cap.fs.chunks\//.test(val.val))))
        if (root_file) {
          const localFileNameRegex = new RegExp(root_file.val
            ? root_file.val.replace('sap.cap.fs.chunks/', '').replaceAll('.', '\\.') + '#(\\d*)'
            : '(?:' + root_file.list.map(v => v.val.replace('sap.cap.fs.chunks/', '').replaceAll('.', '\\.')).join('|') + ')#(\\d*)'
          )
          try {
            const files = await cds.utils.fs.promises.readdir(this._root + 'sap.cap.fs.chunks/')

            const proms = []
            for (const file of files) {
              const match = localFileNameRegex.exec(file)
              if (!match) continue
              proms.push((async () => {
                const fileName = `${this._root}sap.cap.fs.chunks/${file}`
                const stat = await cds.utils.fs.promises.stat(fileName, { bigint: true })
                return {
                  file_owner: 'sap.cap.db',
                  file_name: `sap.cap.fs.chunks/${file}`,
                  index: Number.parseInt(match[1]),
                  domain: 'cap',
                  data: cds.utils.fs.createReadStream(fileName),
                  hosts: null,
                  size: stat.size,
                  local: true,
                }
              })())
            }

            return await Promise.all(proms)
          } catch (err) {
            if (err.code === 'ENOENT') return []
            throw err
          }
        }
      }

      if (q.elements.data || req.http?.req?.url?.indexOf('$select=data')) q.columns`local,file_owner,file_name,index`
      const ret = await this.db.run(this.owner?.name ? q.where`file_owner=${this.owner.name}` : q)
      const proms = []
      if (!Array.isArray(ret)) {
        if (ret.local) {
          if (req.tx === req.context.tx && req?.http?.req) proms.push(cds.utils.fs.promises.readFile(this.owner ? `${this._root}${ret.file_name}#${ret.index}` : `${this._root}${ret.file_owner}/${ret.file_name}#${ret.index}`, 'base64').then(data => ret.data = data))
          else ret.data = cds.utils.fs.createReadStream(this.owner ? `${this._root}${ret.file_name}#${ret.index}` : `${this._root}${ret.file_owner}/${ret.file_name}#${ret.index}`)
        }
      } else {
        for (const row of ret) if (row.local) {
          if (req.tx === req.context.tx && req?.http?.req) proms.push(cds.utils.fs.promises.readFile(this.owner ? `${this._root}${row.file_name}#${row.index}` : `${this._root}${row.file_owner}/${row.file_name}#${row.index}`, 'base64').then(data => row.data = data))
          else row.data = cds.utils.fs.createReadStream(this.owner ? `${this._root}${row.file_name}#${row.index}` : `${this._root}${row.file_owner}/${row.file_name}#${row.index}`)
        }
        for (const parent of external) ret.push(parent)
      }
      if (proms.length) await Promise.all(proms)

      return ret
    }

    debugger
  }

  async _SELECT_Parent(req) {
    const remote = this._remote

    const query = req.query.clone()
    if (query.SELECT.from?.ref?.[0]?.where) {
      query.where(query.SELECT.from.ref[0].where)
      query.SELECT.from = { ref: [query.SELECT.from.ref[0].id] }
    }
    if (query._target === this.entities.files) {
      query.where`owner=${this.owner.name}`
    } else if (query._target === this.entities.chunks) {
      query.where`file_owner=${this.owner.name}`
    }

    const rows = await remote.run(query)
    // const proms = []
    for (const row of rows) {
      // REVISIT: there are many options to make proper streams out of file chunks
      //          but with the current way the remote service works it is mostly overhead
      if (typeof row.data === 'string') row.data = Readable.from(async function* (data) { yield Buffer.from(data, 'base64') }(row.data), { objectMode: false })
      // if (query.elements.data) {
      // proms.push(
      // await remote.send({
      //   _resolved: true,
      //   query: cds.ql.SELECT`FROM ${this.entities.chunks}[file_name=${row.file_name} and file_owner=${row.file_owner} and index=${row.index}].data`,
      //   headers: { 'accept': 'application/octet-stream' },
      // })
      //   .then(data => row.data = data)
      //   .catch(() => row.data = null)
      // )
      // row.data = Readable.from(this._SELECT_Parent_data(remote, row), { objectMode: false })
      // }
    }
    // await Promise.all(proms)
    return rows
  }

  async * _SELECT_Parent_data(remote, row) {
    yield* await remote.send(
      {
        _resolved: true,
        query: cds.ql.SELECT`FROM ${this.entities.chunks}[file_name=${row.file_name} and file_owner=${row.file_owner} and index=${row.index}].data`,
        headers: { 'accept': 'application/octet-stream' },
      }
    )
    // yield Buffer.from(await remote.send(
    //   {
    //     query: cds.ql.SELECT`FROM ${this.entities.chunks}[file_name=${row.file_name} and file_owner=${row.file_owner} and index=${row.index}].data`,
    //     headers: { 'accept': 'application/octet-stream' },
    //   }
    // ), 'binary')
  }

  async onINSERT(req) {
    const q = req.query
    const { entries } = q.INSERT || q.UPSERT
    const flags = q.UPSERT ? 'a' : 'w'
    let internal = false

    const proms = []
    const chunks = []

    for (const entry of entries) {
      const dirname = cds.utils.path.dirname(`${this._root}${entry.name}`)
      await cds.utils.fs.promises.mkdir(dirname, { recursive: true })

      entry.owner = this.owner.name
      if (entry.data) {
        // TODO: file chunking stream
        add_chunk(`${this._root}${entry.name}#${0}`, {
          file_owner: this.owner.name,
          file_name: entry.name,
          index: 0,
          data: entry.data,
          domain: 'cap', // TODO: add proper default domain
          local: true, // TODO: implement cluster file system :)
        })
      }
      else if (entry.chunks?.length) {
        let index = 0
        for (const chunk of entry.chunks) add_chunk(`${this._root}${entry.name}#${index}`, {
          ...chunk,
          file_owner: this.owner.name,
          file_name: entry.name,
          index: index++,
          domain: entry.domain || 'cap', // TODO: add proper default domain
          local: true, // TODO: implement cluster file system :)
        })
      }
      delete entry.chunks
    }

    await Promise.all(proms)
    if (internal === 'chunks') { return { changes: entries.length } }
    await this.db.upsert(chunks).into(this.entities.chunks)
    if (internal === 'files') { return { changes: entries.length } }
    const changes = await this.db.run(q)

    return { changes: entries.length }

    function add_chunk(filename, chunk) {
      if (chunk.file_owner === 'sap.cap.db' && /sap.cap.fs.chunks\//.test(chunk.file_name)) { internal = 'chunks' }
      if (chunk.file_owner === 'sap.cap.db' && /sap.cap.fs.files\//.test(chunk.file_name)) { internal = 'files' }
      const { data } = chunk
      delete chunk.data // Remove blob data from database entry (cyclic)
      chunks.push(chunk)
      const file = cds.utils.fs.createWriteStream(filename, { flags })
      proms.push(cds.utils.fs.promises.stat(filename).catch(() => ({ size: 0 })).then(stat => {
        chunk.size = stat.size
        return pipeline(
          data,
          async function* (s) {
            for await (const c of s) {
              chunk.size += c.byteLength || c.length
              yield c
            }
          },
          file)
      }))
    }
  }

  async onUPDATE(req) {
    const q = cqn4sql(req.query, this.model || cds.model)

    // Identify what application is being uploaded
    const name = q.UPDATE.where.find(e => typeof e.val === 'string')?.val
    if (!name) {
      throw Object.assign(new Error('Target name missing'), { code: 400 })
    }

    // Ensure file is included in the index
    await this.run(cds.ql.INSERT({
      name: name,
      owner: this.owner.name,
      data: q.UPDATE.data.data,
    }).into(q._target))

    return { changes: 1 }
  }
};
