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

export function mkdir(file, options, cb) {
  if (typeof options === 'function') cb = options
  promises.mkdir(file).then(s => cb(null, s), cb)
}

export function readdir(file, options, cb) {
  if (typeof options === 'function') cb = options
  promises.readdir(file).then(s => cb(null, s), cb)
}

export function unlink(path, cb) {
  promises.unlink(path).then(cb, cb)
}

export function open(path, flags, mode, cb) {
  if (typeof flags === 'function') cb = flags
  if (typeof mode === 'function') cb = mode
  promises.open(path, flags, mode).then(s => cb(null, s), cb)
}

export async function write(fd, buffer, offset = 0, length = buffer.byteLength - offset, position, callback) {
  if (typeof length === 'function') {
    callback = length
    length = undefined
  }
  if (typeof position === 'function') {
    callback = position
    position = undefined
  }

  try {
    const stream = fd._stream ??= createWriteStream(fd).getWriter()
    await stream.write(buffer.subarray(offset, length))
    callback(null, length, buffer)
  } catch (err) {
    callback(err)
  }
}

export async function close(fd, callback) {
  try {
    await fd._stream?.close?.()
    callback()
  } catch (err) {
    callback(err)
  }
}

export function stat(file, options, cb) {
  if (typeof options === 'function') cb = options
  promises.stat(file).then(s => cb(null, s), cb)
}

export const constants = {
  UV_FS_SYMLINK_DIR: 1,
  UV_FS_SYMLINK_JUNCTION: 2,
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  UV_DIRENT_UNKNOWN: 0,
  UV_DIRENT_FILE: 1,
  UV_DIRENT_DIR: 2,
  UV_DIRENT_LINK: 3,
  UV_DIRENT_FIFO: 4,
  UV_DIRENT_SOCKET: 5,
  UV_DIRENT_CHAR: 6,
  UV_DIRENT_BLOCK: 7,
  S_IFMT: 61440,
  S_IFREG: 32768,
  S_IFDIR: 16384,
  S_IFCHR: 8192,
  S_IFBLK: 24576,
  S_IFIFO: 4096,
  S_IFLNK: 40960,
  S_IFSOCK: 49152,
  O_CREAT: 64,
  O_EXCL: 128,
  UV_FS_O_FILEMAP: 0,
  O_NOCTTY: 256,
  O_TRUNC: 512,
  O_APPEND: 1024,
  O_DIRECTORY: 65536,
  O_NOATIME: 262144,
  O_NOFOLLOW: 131072,
  O_SYNC: 1052672,
  O_DSYNC: 4096,
  O_DIRECT: 16384,
  O_NONBLOCK: 2048,
  S_IRWXU: 448,
  S_IRUSR: 256,
  S_IWUSR: 128,
  S_IXUSR: 64,
  S_IRWXG: 56,
  S_IRGRP: 32,
  S_IWGRP: 16,
  S_IXGRP: 8,
  S_IRWXO: 7,
  S_IROTH: 4,
  S_IWOTH: 2,
  S_IXOTH: 1,
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  UV_FS_COPYFILE_EXCL: 1,
  COPYFILE_EXCL: 1,
  UV_FS_COPYFILE_FICLONE: 2,
  COPYFILE_FICLONE: 2,
  UV_FS_COPYFILE_FICLONE_FORCE: 4,
  COPYFILE_FICLONE_FORCE: 4
}

export default {
  promises,
  constants,

  createReadStream,
  createWriteStream,

  mkdir,
  readdir,
  open,
  write,
  close,
  stat,
  lstat: stat,
  unlink,
}
