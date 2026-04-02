const cds = require('@sap/cds')

const NULL = (2n ** 64n) - 1n
const SIGN = (2n ** 63n)

class Index {
  constructor({ name, columns }) {
    this.name = name
    this.columns = columns
  }

  get file() {
    return super.file = (async () => {
      try {
        return await cds.utils.fs.promises.open(this.name, 'r+')
      } catch (err) {
        if (err.code === 'ENOENT') {
          await cds.utils.fs.promises.writeFile(this.name, '')
          return cds.utils.fs.promises.open(this.name, 'r+')
        }
        throw err
      }
    })()
  }

  get file() {
    return super.file = {
      _buffers: {},
      write(buffer, options) {
        this._buffers[options.position] = Buffer.alloc(buffer.byteLength, buffer)
      },
      read(buffer, options) {
        if (!this._buffers[options.position]) return { bytesRead: 0 }
        this._buffers[options.position].copy(buffer)
        return { bytesRead: 2048, buffer }
      },
      sync() { },
      truncate() { },
      close() { },
    }
  }

  async init(entries) {
    const file = await this.file

    let row = 0n
    let end = 0n

    // Init zero index into the file empty
    let buf = new BigUint64Array(Buffer.alloc(2048, 0xFF).buffer)
    await file.truncate(0)
    await file.write(buf, { position: 0 })
    end += 2048n

    for (const entry of entries) {
      entry.row ??= row++
      const data = this.data(entry)
      let x = 0
      let i = 0
      let val = 0
      await file.read(buf, { position: Number(x) })
      while (NULL !== (val = buf[data[i++]])) {
        if (i > data.length) { debugger }
        if (val & SIGN) { // handle existing index entry
          if (entry.row !== val - SIGN) entries.push(entries[val - SIGN])
          buf[data[i - 1]] = end
          await file.write(buf, { position: Number(x) })
          buf.fill(NULL)
          x = end
          await file.write(buf, { position: Number(x) })
          end += 2048n
        }
        else { // continue to target index
          x = val
          await file.read(buf, { position: Number(val) })
        }
      }
      buf[data[i - 1]] = SIGN + entry.row
      await file.write(buf, { position: Number(x) })
    }
  }

  async add(entry) {

  }

  async list(entries) {
    const file = await this.file
    const buf = new BigUint64Array(Buffer.alloc(2048, 0xFF).buffer)
    let read = 0
    let x = 0
    const col = { 0: [] }
    const ret = {}
    while ((read = (await file.read(buf, { position: x })).bytesRead) === 2048) {
      buf.forEach((val, char) => {
        entries
        if (val === NULL) return
        if (val & SIGN) {
          ret[Buffer.from([...col[x], char]).toString('utf8')] = 1
        } else {
          col[val] = [...col[x], char]
        }
      })
      x += read
    }
    return ret
  }

  async find(entry) {

  }

  data(entry) {
    return Buffer.from(
      this.columns.length === 1
        ? entry[this.columns[0].ref[0]]
        : this.columns
          .map(ref => entry[ref.ref[0]] == null ? `` : `${entry[ref.ref[0]].length},${entry[ref.ref[0]]}`)
          .join(';')
    )
  }
}

module.exports = Index
module.exports.Index = Index

if (require.main === module) {
  let i = 1
  let x = 0
  const runTest = async () => {
    const times = { start: performance.now() }
    const index = new Index({ name: __dirname + '/test.index', columns: [{ ref: ['ID'] }] })
    times.constructor = performance.now()
    const entries = new Array(i).fill(0).map(() => ({ ID: cds.utils.uuid() }))
    times.entries = performance.now()
    await index.init(entries)
    times.init = performance.now()
    const indexList = await index.list(entries)
    times.list = performance.now()
    await (await index.file).close()
    times.total = performance.now()
    console.log(`
rows(${i})
  total: ${(times.total - times.start) >>> 0}
  constructor: ${(times.constructor - times.start) >>> 0}
  entries: ${(times.entries - times.constructor) >>> 0}
  init: ${(times.init - times.entries) >>> 0}
  list: ${(times.list - times.init) >>> 0}
  memory: ${process.memoryUsage().rss / 1024 / 1024} MiB`)
    // console.log(indexList)

    if (i < 30_000) {
      i *= 2
      return runTest()
    }
    if (x++ < 10) setTimeout(runTest, 1000)
  }

  runTest()
}
