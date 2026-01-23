import utils from './util.mjs'
import EE from './events.mjs'

export const Readable = class Readable {
  static from(iterator, options) {
    const ret = new Readable()
    ret[Symbol.asyncIterator] = () => iterator
    return ret
  }
}

export const stream = function () {
  this._readableState = {}
}
stream.prototype = {}
utils.inherits(stream, EE.EventEmitter)

stream.Readable = Readable
stream.Duplex = function () { }

export default stream
