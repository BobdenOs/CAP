const { PassThrough } = require('stream')
const { hash } = require('node:crypto')

const cds = require('@sap/cds')
const { Readable } = require('node:stream')

const NULL = (2n ** 64n) - 1n
const COL_HEADER_SIZE = 32n

const noop = () => { }

class Store {
  constructor(srv, definition) {
    this.srv = srv
    this.name = definition.name
    this.definition = definition
    this.elements = definition.elements
    this.columns = Object.keys(this.elements)
    if (this.width < 1) cds.error`Cannot define a store without any columns`
    this._cache = {}
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

  rowID(row, keys = this.definition.keys) {
    if (Buffer.isBuffer(row)) return row.subarray(0, 16)
    const k = Object.keys(keys)
    if (k.length === 1 && keys[k[0]] instanceof cds.builtin.classes.UUID) {
      // Convert UUID into rowID
      return row[k[0]] && Buffer.from(row[k[0]].replaceAll('-', ''), 'hex')
    }
    let compound = ''
    for (const key in keys) compound = `${compound};${row[key] == null ? '' : `${`${row[key]}`.length}${row[key]}`}`
    return hash('shake128', compound, 'buffer')
  }

  async update(rowss) {
    const fs = await this.srv.fs

    const files = []
    for (const col in rowss) {
      this._cache[col] = undefined
      files.push({
        name: `${this.name}/${col}.col`,
        data: Readable.from(rowss[col], { objectMode: false }),
      })
    }

    return fs.upsert(files).into(fs.entities.files)
  }

  async insert(rows) {
    if (rows.length === 0) return

    const fs = await this.srv.fs

    const columns = await Promise.all(this.columns.map(async (name, index) => {
      const fileName = `${this.name}/${name}.col`
      const file = new PassThrough()
      const element = this.elements[name]
      let extract = row => row[name]
      if (element.isAssociation) {
        if (element.is2one && element.keys) {
          const fkeys = element.keys.reduce((l, c) => {
            l[c.$generatedFieldName] = this.elements[c.$generatedFieldName]
            return l
          }, {})
          extract = row => this.rowID(row, fkeys)
        } else {
          extract = noop
        }
      }

      return { name, index, extract, file, fileName }
    }))

    const files = columns.map(col => ({
      name: col.fileName,
      data: col.file,
    }))

    const write = fs.upsert(files).into(fs.entities.files).then(r => r)
    const timestamp = BigInt(Date.now())

    for await (const row of rows) {
      const rowID = this.rowID(row)
      for (const col of columns) {
        let val = col.extract(row)
        if (val === undefined) continue
        if (Buffer.isBuffer(val)) val = val.toString('hex')
        const data = Buffer.from(JSON.stringify(val ?? null))

        col.file.write(rowID)
        col.file.write(new BigUint64Array([timestamp, BigInt(data.byteLength)]))
        col.file.write(data)
      }
    }
    columns.forEach(col => col.file.end())

    await write
  }

  async read_col(col, cb) {
    let rows
    if (Date.now() < this._cache[col]?.ttl) rows = await this._cache[col]
    else {
      this._cache[col] = this.read_chunks(`${this.name}/${col}.col`)
        .then(chunks => this.read_col_exec(chunks))
      this._cache[col].catch(() => { }).then(() => {
        const ttl = cds.utils.ms4(this.elements[col]['@cache.ttl'] ?? this.definition['@cache.ttl'] ?? 10000)
        this._cache[col].ttl = Date.now() + ttl
      })
      this._cache[col].ttl = Number.POSITIVE_INFINITY
      rows = await this._cache[col]
    }
    for (const row of rows) cb(row)
  }

  async read_chunks(filename) {
    if (!this._chunks) {
      const list = []
      this._chunks = new Promise((resolve, reject) => {
        setImmediate(async () => {
          try {
            const fs = await this.srv.fs
            this._chunks = undefined
            const ret = fs.read`${fs.entities.chunks}[file.name in ${{ list }}]`
            resolve(ret)
          } catch (err) { reject(err) }
        })
      })
      this._chunks.list = list
    }
    this._chunks.list.push({ val: filename })
    return this._chunks.then(chunks => chunks.filter(chunk => chunk.file_name.startsWith(filename)))
  }

  async read_col_exec(chunks) {
    // TODO: ensure that the domain is correctly respected
    // const chunks = typeof col === 'string' ? await fs.read`${fs.entities.chunks}[file.name = ${this.name + '/' + col + '.col'}]` : col

    const IDs = {}
    const rows = []

    for (const chunk of await chunks) {
      const colRead = chunk.data
      let rowID
      let dataTimestamp
      let length
      let read
      let carry
      const data = []
      read: for await (let chunk of colRead) {
        if (carry) {
          chunk = Buffer.concat([carry, chunk])
          carry = undefined
        }
        let offset = 0
        let start = -1
        while (true) {
          if (rowID == null) {
            if (offset > chunk.length - 16) {
              carry = chunk.subarray(offset)
              break
            }
            start = offset
            rowID = chunk.subarray(offset, offset + 16).toString('base64')
            data.push(chunk.subarray(offset, offset + 16))
            offset += 16
          }
          if (dataTimestamp == null) {
            if (offset > chunk.length - 8) {
              carry = chunk.subarray(offset)
              break
            }
            data.push(chunk.subarray(offset, offset + 8))
            dataTimestamp = offset
            offset += 8
          }
          if (length == null) {
            if (offset > chunk.length - 8) {
              carry = chunk.subarray(offset)
              break
            }
            data.push(chunk.subarray(offset, offset + 8))
            length = chunk.readBigUint64LE(offset)
            offset += 8
            read = 0n
          }

          if (chunk.length - offset >= length - read) {
            let row
            if (start > -1) {
              // When whole row is inside a single chunk use the original buffer
              row = chunk.subarray(start, offset + Number(length))
            } else {
              data.push(chunk.subarray(offset, offset + Number(length - read)))
              row = Buffer.concat(data)
            }

            const index = IDs[rowID]
            // Remove old row data that no longer matches
            if (index > -1) {
              if (this.timestamp(rows[index]) <= this.timestamp(row)) rows[index] = row
            }
            else {
              IDs[rowID] = rows.length
              rows.push(row)
            }

            // for (const cb of cbs) cb(row)
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

      // if(length) {
      //   debugger
      // }
    }
    return rows
  }

}

module.exports = Store
module.exports.Store = Store
