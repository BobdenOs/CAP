import utils from './util.mjs'
import EE from './events.mjs'
import './buffer.mjs'

export class Readable extends ReadableStream {
  static from(iterator, options) {
    const ret = new Readable()
    ret[Symbol.asyncIterator] = () => iterator
    return ret
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
  /** @type {WritableStreamDefaultWriter} */
  get _writer() {
    return super._writer = this.writable.getWriter()
  }

  write(chunk, encoding, callback) {
    this._writer.ready
      .then(() => this._writer.write(chunk))
      .then(callback, callback)
  }

  end(chunk, encoding, callback = err => { if (err) { debugger } }) {
    const close = () => this._writer.ready
      .then(() => this._writer.close())
      .then(callback, callback)
    if (chunk) this.write(chunk, encoding, close)
    else close()
  }

  get [Symbol.asyncIterator]() {
    return this.readable[Symbol.asyncIterator].bind(this.readable)
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
