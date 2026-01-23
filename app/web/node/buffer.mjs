globalThis.Buffer = class Buffer {
  static isBuffer(x) { return x instanceof Uint8Array }
  static from(x) { return Uint8Array.fromBase64(btoa(x)) }
}

export default {
  Buffer,
}
