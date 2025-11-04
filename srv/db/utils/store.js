const { PassThrough } = require('stream')
const { hash } = require('node:crypto')

const cds = require('@sap/cds')

const NULL = (2n ** 64n) - 1n
const COL_HEADER_SIZE = 32n

class Store {
  constructor(srv, definition) {
    this.srv = srv
    this.name = definition.name
    this.definition = definition
    this.elements = definition.elements
    this.columns = Object.keys(this.elements)
    if (this.width < 1) cds.error`Cannot define a store without any columns`
    this._queues = {}
  }

  /**
   * Initializes all the files required for the physical part of this entity
   */
  async init() {
    const fs = await this.srv.fs
    const exists = await fs.read`${fs.entities.chunks}[file.name = ${this.name + '/.def'}]`
    if (exists.length) return

    // TODO: Compute the top level domain of the database owner service
    const domain = 'cap'
    const files = [
      {
        name: `${this.name}/.def`,
        dataType: 'application/json',
        chunks: [{
          index: 0,
          data: JSON.stringify(this.definition),
          domain,
        }],
      },
    ]
    for (const element in this.elements) {
      files.push({
        name: `${this.name}/${element}.col`,
        dataType: 'application/octet-stream',
        chunks: [{
          index: 0,
          data: Buffer.allocUnsafe(0),
          domain,
        }],
      })
    }

    await fs.insert(files).into(fs.entities.files)
  }

  timestamp(row) {
    if (Buffer.isBuffer(row)) return row.readBigUint64LE(16)
  }

  rowID(row) {
    if (Buffer.isBuffer(row)) return row.subarray(0, 16)
    let compound = ''
    for (const key in this.definition.keys) compound = `${compound};${row[key] == null ? '' : `${row[key].length}${row[key]}`}`
    return hash('shake128', compound, 'buffer')
  }

  async insert(rows) {
    if (rows.length === 0) return

    const fs = await this.srv.fs

    const columns = await Promise.all(this.columns.map(async (name, index) => {
      const fileName = `${this.name}/${name}.col`
      const file = new PassThrough()
      return { name, index, file, fileName }
    }))

    const files = columns.map(col => ({
      name: col.fileName,
      data: col.file,
    }))

    const write = fs.upsert(files).into(fs.entities.files).then(r => r)
    const timestamp = BigInt(Date.now())

    for await (const row of rows) {
      for (const col of columns) {
        const val = row[col.name]
        const data = Buffer.from(JSON.stringify(val ?? null))
        col.file.write(this.rowID(row))
        col.file.write(new BigUint64Array([timestamp, BigInt(data.byteLength)]))
        col.file.write(data)
      }
    }
    columns.forEach(col => col.file.end())

    await write
  }

  read_col(col, cb) {
    if (!this._chunks) {
      const list = []
      this._chunks = this.srv.fs.then(fs => fs.read`${fs.entities.chunks}[file.name in ${{ list }}]`)
      this._chunks.list = list
    }
    this._chunks.list.push({ val: `${this.name}/${col}.col` })

    if (this._timeout) clearTimeout(this._timeout)
    this._timeout = setTimeout(() => { this.read_col_drain() }, 20) || true

    const queue = this._queues[col] ??= []
    if (!queue.prom) {
      queue.prom = new Promise((resolve, reject) => {
        queue.resolve = resolve
        queue.reject = reject
      })
    }

    queue.push(cb)

    return queue.prom
  }

  async read_col_drain() {
    this._timeout = undefined
    const queues = this._queues
    this._queues = {}
    const chunks = this._chunks
    this._chunks = false

    for (const col in queues) {
      const queue = queues[col]
      this.read_col_exec(
        chunks.then(chunks => chunks.filter(chunk => chunk.file_name.startsWith(`${this.name}/${col}.col`))),
        queue, col
      )
        .then(queue.resolve, queue.reject)
    }
  }

  async read_col_exec(chunks, cbs) {
    // const fs = await this.srv.fs

    // TODO: ensure that the domain is correctly respected
    // const chunks = typeof col === 'string' ? await fs.read`${fs.entities.chunks}[file.name = ${this.name + '/' + col + '.col'}]` : col
    for (const chunk of await chunks) {
      const colRead = chunk.data
      let rowID
      let dataTimestamp
      let length
      let read
      const data = []
      read: for await (const chunk of colRead) {
        let offset = 0
        while (true) {
          if (rowID == null) {
            if (offset > chunk.length - 16) break
            data.push(chunk.subarray(offset, offset + 16))
            rowID = offset
            offset += 16
          }
          if (dataTimestamp == null) {
            if (offset > chunk.length - 8) break
            data.push(chunk.subarray(offset, offset + 8))
            dataTimestamp = offset
            offset += 8
          }
          if (length == null) {
            if (offset > chunk.length - 8) break
            data.push(chunk.subarray(offset, offset + 8))
            length = chunk.readBigUint64LE(offset)
            offset += 8
            read = 0n
          }

          if (chunk.length - offset >= length - read) {
            data.push(chunk.subarray(offset, offset + Number(length - read)))
            const row = Buffer.concat(data)
            for (const cb of cbs) cb(row)
            // if (await cb() === false) break read
            data.length = 0
            offset += Number(length - read)
            length = rowID = dataTimestamp = null // Prepare to read next row metadata
            continue
          }
          read += BigInt(chunk.length - offset)
          data.push(offset ? chunk.subarray(offset) : chunk)
          break
        }
      }
    }
  }

}

module.exports = Store
module.exports.Store = Store
