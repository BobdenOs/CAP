const { pipeline } = require('stream/promises')

const cds = require("@sap/cds");
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql");
const { error } = require('console');
const { Readable } = require('stream');

const LOG = cds.log('fs')

module.exports = class FSService extends cds.ApplicationService {
  async init() {
    this._store = {
      index: {},
    };
    this._root = `${process.cwd()}/storage/`
    this.db = (await cds.connect.to('sap.cap.db')).bind(this)

    this.on(["SELECT"], this.onSELECT)
    this.on(["INSERT", "UPSERT"], this.onINSERT)
    this.on(["UPDATE"], this.onUPDATE)
  }

  run() {
    if (!this.owner) cds.error`sap.cap.fs requires the service to be bound to an owner`
    return super.run(...arguments)
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

    if (q._target === files) return this.db.run(q.where`owner=${this.owner.name}`)
    if (q._target === chunks) {

      // Cyclic dependency breaker: enforcing local copy of chunk location index
      if (this.owner.name === 'sap.cap.db') {
        q = cqn4sql(q, this.model)
        const root_file = q.SELECT.where.find(val => /sap.cap.fs.chunks\//.test(val.val))
        if (root_file) {
          // TODO: keep local copies of this data for node instances
          const internalLocations = [{
            file_owner: 'sap.cap.db',
            file_name: 'sap.cap.fs.chunks/file_name.col',
            index: 0,
            domain: 'cap',
            data: Readable.from(Buffer.alloc(0), { objectMode: false }),
            hosts: null,
            size: 0n,
            local: true,
          }, {
            file_owner: 'sap.cap.db',
            file_name: 'sap.cap.fs.chunks/.tbl',
            index: 0,
            domain: 'cap',
            data: Readable.from(Buffer.alloc(0), { objectMode: false }),
            hosts: null,
            size: 0n,
            local: true,
          }]

          const fullFileName = `${this._root}${root_file.val}`
          const fullDirName = cds.utils.path.dirname(fullFileName)
          const localFileName = cds.utils.path.relative(fullDirName, fullFileName)
          const localFileNameRegex = new RegExp(localFileName.replaceAll('.', '\\.') + '#(\d*)')
          try {
            const files = await cds.utils.fs.promises.readdir(fullDirName)

            const proms = []
            for (const file of files) {
              const match = localFileNameRegex.exec(file)
              if (!match) continue
              proms.push((async () => {
                const fileName = `${fullDirName}/${file}`
                const stat = await cds.utils.fs.promises.stat(fileName, { bigint: true })
                return {
                  file_owner: 'sap.cap.db',
                  file_name: root_file,
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

      const ret = await this.db.run(q.where`file_owner=${this.owner.name}`)

      for (const row of ret) {
        if (row.local) row.data = cds.utils.fs.createReadStream(`${this._root}${row.file_name}#${row.index}`)
      }

      return ret
    }

    debugger
  }

  async onINSERT(req) {
    const q = req.query
    const { entries } = q.INSERT || q.UPSERT
    const flags = q.UPSERT ? 'a' : 'w'

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
    await this.db.upsert(chunks).into(this.entities.chunks)
    const changes = await this.db.run(q)

    return { changes: entries.length }

    function add_chunk(filename, chunk) {
      const { data } = chunk
      delete chunk.data // Remove blob data from database entry (cyclic)
      chunks.push(chunk)
      const file = cds.utils.fs.createWriteStream(filename, { flags })
      chunk.size = 0
      proms.push(pipeline(
        data,
        async function* (s) {
          for await (const c of s) {
            chunk.size += c.byteLength || c.length
            yield c
          }
        },
        file))
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
