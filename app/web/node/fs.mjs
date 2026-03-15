// TODO: identify all fs operations to support
import promises from './fs/promises.mjs'

export function createReadStream(file) {
  return new ReadableStream(
    {
      async start(controller) {
        const handle = await promises.open(file)
        const fileContent = await handle.getFile()
        for await (const chunk of fileContent.stream()) controller.enqueue(chunk)
        controller.close()
      },
    },
  )
}

export function createWriteStream(file) {
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })
  return new WritableStream(
    {
      async start() {
        const handle = await promises.open(file)
        const { size } = await handle.getFile()
        const writeable = await handle.createWritable({
          mode: "exclusive",
          keepExistingData: true,
        })
        writeable.seek(size)
        this._writer = writeable.getWriter()
      },
      async write(chunk) {
        await this._writer.ready
        return this._writer.write(chunk)
      },
      async close() {
        await this._writer.ready
        return this._writer.close()
      },
      abort(err) {
        return this._writer.abort(err)
      },
    },
    queuingStrategy,
  )
}

export default {
  promises,

  createReadStream,
  createWriteStream,
}
