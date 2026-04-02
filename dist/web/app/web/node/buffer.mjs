globalThis.Buffer = class Buffer {
  static isBuffer(x) { return x instanceof Uint8Array }
  static from(x, encoding) {
    if (x instanceof ArrayBuffer) return new Uint8Array(x)
    if (Array.isArray(x)) return Uint8Array.from(x)
    switch (encoding) {
      case 'base64':
        return Uint8Array.fromBase64(x)
      case 'hex':
        return Uint8Array.fromHex(x)
      default:
        return (new TextEncoder()).encode(x)
    }
  }

  static alloc(size) {
    return Buffer.from(Uint8Array.from(new Array(size).fill(0)))
  }

  static concat(arrays) {
    const totalLength = arrays.reduce((total, array) => total + array.byteLength, 0)

    const result = new Uint8Array(totalLength)

    let offset = 0
    arrays.forEach(array => {
      result.set(array, offset)
      offset += array.byteLength
    })

    return result;
  }
}

Uint8Array.prototype.toJSON = function () {
  return this.toString()
}

Uint8Array.prototype.toString = function (encoding) {
  switch (encoding) {
    case 'base64':
      return this.toBase64()
    case 'hex':
      return this.toHex()
    default:
      return (new TextDecoder()).decode(this)
  }
}

Uint8Array.prototype.compare = function (target) {
  return Math.max(-1, Math.min(1, `0x${this.toHex()}` - `0x${target.toHex()}`))
}

export default {
  Buffer,
}
