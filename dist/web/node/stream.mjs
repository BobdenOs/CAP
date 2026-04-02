import utils from './util.mjs'
import EE from './events.mjs'
import './buffer.mjs'

export class Readable extends ReadableStream {
  static from(iterator, options) {
    const ret = new Readable()
    ret[Symbol.asyncIterator] = () => iterator[Symbol.asyncIterator]?.() || iterator[Symbol.iterator]?.() || iterator
    return ret
  }

  async pipe(target) {
    for await (const chunk of this) target.write(chunk)
    target.end()
  }
}

export class Writable extends WritableStream {
  constructor() {
    this._buffer = []
    this._ended = false
  }

  write(chunk, encoding, callback) {
    if (this._ended) throw new Error('Stream already closed...')
    this._buffer.push(Buffer.from(chunk, encoding))
    if (callback) { debugger }
    return true
  }

  end(chunk, encoding, callback) {
    this.write(chunk, encoding, callback)
    this._ended = true
  }
}

export class PassThrough extends TransformStream {
  constructor(src) {
    super(...arguments)
    if (src && src.writable && src.readable) this._src = src
    return this
  }

  /** @type {WritableStreamDefaultWriter} */
  get _writer() {
    return super._writer = (this._src || this).writable.getWriter()
  }

  write(chunk, encoding, callback) {
    if (typeof encoding === 'function') callback = encoding
    if (!callback) callback = () => { }
    this._writer.ready
      .then(() => this._writer.write(chunk))
      .then(callback, callback)
  }

  end(chunk, encoding, callback = err => { if (err) { debugger } }) {
    if (typeof encoding === 'function') {
      callback = encoding
      encoding = undefined
    }
    if (this._close) callback = this._close
    const close = () => this._writer.ready
      .then(() => this._writer.close())
      .then(callback, callback)
    if (chunk) this.write(chunk, encoding, close)
    else close()
  }

  on(event, callback) {
    if (event === 'error') {
      this._error = callback
      return
    }
    if (event === 'close' || event === 'end') {
      this._close = callback
      return
    }
    if (event === 'data') {
      ; (async () => {
        try {
          for await (const chunk of this) callback(chunk)
          this.end()
        } catch (err) {
          if (this._error) return this._error(err)
          throw err
        }
      })()
    }
  }

  removeAllListeners(event) {
    if (event === 'error') this._error = undefined
  }

  get [Symbol.asyncIterator]() {
    return (this._src || this).readable[Symbol.asyncIterator].bind((this._src || this).readable)
  }
}

export const stream = function () {
  this._readableState = {}
}
stream.prototype = {}
utils.inherits(stream, EE.EventEmitter)

stream.Readable = Readable
stream.PassThrough = PassThrough
stream.Duplex = function () { }

export default stream
