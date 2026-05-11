import { PassThrough } from './stream.mjs'
import utils from './util.mjs'

export function Unzip() {
  const stream = new DecompressionStream('gzip')
  return new PassThrough(stream)
}

export default {
  Unzip,
  // createGzip,
}