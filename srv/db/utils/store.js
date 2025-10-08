const { PassThrough } = require('stream')

const cds = require('@sap/cds')

const NULL = (2n ** 64n) - 1n
const COL_HEADER_SIZE = 16n

class Store {
  constructor(srv, definition) {
    this.srv = srv
    this.name = definition.name
    this.definition = definition
    this.elements = definition.elements
    this.columns = Object.keys(this.elements)
    if (this.width < 1) cds.error`Cannot define a store without any columns`
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
      {
        name: `${this.name}/.tbl`,
        dataType: 'application/octet-stream',
        chunks: [{
          index: 0,
          data: Buffer.allocUnsafe(0),
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

  get width() {
    return BigInt(this.columns.length) * 8n // sifeOf(ui64) = 8
  }

  async insert(rows) {
    const fs = await this.srv.fs
    const tbl = `${this.name}/.tbl`

    const { width } = this
    const size = (await fs.read`FROM ${fs.entities.chunks}[file.name = ${tbl}] { size }`)?.reduce((l, c) => l += BigInt(c.size), 0n)

    let rowID = size / width

    const tblFile = new PassThrough()
    const columns = await Promise.all(this.columns.map(async (name, index) => {
      const fileName = `${this.name}/${name}.col`
      const size = (await fs.read`FROM ${fs.entities.chunks}[file.name = ${fileName}] { size }`)?.reduce((l, c) => l += BigInt(c.size), 0n)
      const file = new PassThrough()
      return { name, index, size, file, fileName }
    }))

    const files = [{
      name: tbl,
      data: tblFile,
    }, ...columns.map(col => ({
      name: col.fileName,
      data: col.file,
    }))]

    const write = fs.upsert(files).into(fs.entities.files).then(r => r)

    for await (const row of rows) {
      const tblRow = new BigUint64Array(this.columns.length)
      tblRow.fill(NULL) // Set all columns to NULL pointer by default
      for (const col of columns) {
        const val = row[col.name]
        if (val == null) continue
        const data = Buffer.from(JSON.stringify(val))
        tblRow[col.index] = col.size
        col.size += BigInt(data.byteLength) + COL_HEADER_SIZE
        col.file.write(new BigUint64Array([rowID, BigInt(data.byteLength)]))
        col.file.write(data)
      }
      tblFile.write(tblRow)
      rowID++
    }
    tblFile.end()
    columns.forEach(col => col.file.end())

    await write
  }

  async insert_old(rows) {
    const { createWriteStream } = cds.utils.fs
    const { stat } = cds.utils.fs.promises
    const { width } = this

    const { size } = await stat(`${this.name}.tbl`, { bigint: true })
    let rowID = size / width

    const proms = []
    const attach = file => proms.push(new Promise((resolve, reject) => {
      file.on('error', reject)
      file.on('close', resolve)
    }))
    const tblFile = createWriteStream(`${this.name}.tbl`, { flags: 'a' })
    attach(tblFile)
    const columns = await Promise.all(this.columns.map(async (name, index) => {
      const fileName = `${this.name}.${name}.col`
      const { size } = await stat(fileName, { bigint: true })
      const file = createWriteStream(fileName, { flags: 'a' })
      attach(file)
      return { name, index, size, file }
    }))

    for await (const row of rows) {
      const tblRow = new BigUint64Array(this.columns.length)
      tblRow.fill(NULL) // Set all columns to NULL pointer by default
      for (const col of columns) {
        const val = row[col.name]
        if (val == null) continue
        const data = Buffer.from(JSON.stringify(val))
        tblRow[col.index] = col.size
        col.size += BigInt(data.byteLength) + COL_HEADER_SIZE
        col.file.write(new BigUint64Array([rowID, BigInt(data.byteLength)]))
        col.file.write(data)
      }
      tblFile.write(tblRow)
      rowID++
    }
    tblFile.end()
    columns.forEach(col => col.file.end())

    await Promise.all(proms)
  }

  async read(IDs) {
    const fs = await this.srv.fs

    // TODO: ensure that the domain is correctly respected
    const chunks = await fs.read`${fs.entities.chunks}[file.name = ${this.name + '/.tbl'}]`
    if (chunks.length === 0) {
      await this.init()
      return []
    }

    const ret = []
    const proms = []
    for (const col of this.columns) {
      // TODO: sync .tbl with .col
      // TODO: support iterator API
      proms.push(this.read_col(col, 0, null, async (data, rowID, dataID) => {
        if (IDs) {
          const index = IDs.indexOf(rowID)
          if (index < 0) return
          rowID = index
        }
        ; (ret[Number(rowID)] ??= {})[col] = JSON.parse(data)
      }))
    }
    await Promise.all(proms)
    return ret
  }

  async read_row(rowID) {
    if (typeof rowID !== 'bigint') rowID = BigInt(rowID)

    const chunks = []
    for await (const chunk of tblRowRead) chunks.push(chunk)
    const chunk = Buffer.concat(chunks)
    const tblRow = new BigUint64Array(chunk.buffer.slice(chunk.offset, chunk.offset + chunk.length))

    const row = {}
    const proms = []
    for (const col of this.columns) {
      const start = tblRow[proms.length]
      if (start === NULL) {
        proms.push(row[col] = null)
        continue
      }
      proms.push(this.read_col(col, start, data => {
        row[col] = JSON.parse(data)
        return false
      }))
    }
    await Promise.all(proms)
    return row
  }

  async read_col(col, start, data_length, cb) {
    if (typeof data_length === 'function') {
      cb = data_length
      data_length = null // Read all data no matter the length
    }
    if (typeof data_length === 'number') data_length = BigInt(data_length)

    const fs = await this.srv.fs

    // TODO: ensure that the domain is correctly respected
    const chunks = await fs.read`${fs.entities.chunks}[file.name = ${this.name + '/' + col + '.col'}]`

    for (const chunk of chunks) {
      const colRead = chunk.data
      let rowID
      let dataID = 0n
      let length
      let read
      let collecting
      const data = []
      read: for await (const chunk of colRead) {
        let offset = 0
        while (true) {
          if (rowID == null) {
            if (offset > chunk.length - 8) break
            rowID = chunk.readBigUint64LE(offset)
            offset += 8
          }
          if (length == null) {
            if (offset > chunk.length - 8) break
            length = chunk.readBigUint64LE(offset)
            if (data_length == null || length === data_length) collecting = true
            offset += 8
            read = 0n
          }

          if (chunk.length - offset >= length - read) {
            if (collecting) data.push(chunk.slice(offset, offset + Number(length - read)))
            if (await cb(collecting ? Buffer.concat(data) : null, rowID, dataID) === false) break read
            data.length = 0
            dataID += length // Track the pointer value of the data which would be used inside the .tbl file
            offset += Number(length - read)
            collecting = length = rowID = null // Prepare to read length row data
            continue
          }
          read += BigInt(chunk.length - offset)
          if (collecting) data.push(offset ? chunk.slice(offset) : chunk)
          break
        }
      }
    }
  }

  async find(data, column) {
    // Align data to be searched for with stored data format
    if (!Buffer.isBuffer(data)) data = Buffer.from(JSON.stringify(data))
    if (this.columns.indexOf(column) < 0) cds.error`Unknown column name: "${column}"`

    let matchesIndex = 0
    let maxRowID = -1n
    const matches = new BigUint64Array(1024)
    await this.read_col(column, 0, data.byteLength, (cur, rowID, dataID) => {
      if (cur == null || data.compare(cur) !== 0) {
        // if (rowID < maxRowID) {
        const index = matches.indexOf(rowID)
        if (index > -1) matches[index] = NULL
        // }
        return
      }
      // if (rowID > maxRowID) maxRowID = rowID
      matches[matchesIndex++] = rowID
    })
    return matches.slice(0, matchesIndex)
  }
}

module.exports = Store
module.exports.Store = Store
