import { createReadStream } from '../fs.mjs'

async function _dir(dir) {
  if (dir instanceof FileSystemHandle) return dir
  const dirs = Array.isArray(dir) ? dir : dir.split('/')

  let dirHandle = await navigator.storage.getDirectory()
  for (const name of dirs) {
    if (name.length === 0) continue
    dirHandle = await dirHandle.getDirectoryHandle(name, { create: true })
  }

  return dirHandle
}

async function readdir(dir, options) {
  const dirHandle = await _dir(dir)

  const ret = []
  for await (const [key, value] of dirHandle) {
    ret.push(key)
    if (options?.recursive && value.kind === 'directory') ret.push(...(await readdir(value, options)).map(r => key + '/' + r))
  }
  return ret
}

async function readFile(path) {
  let data = ''
  for await (const chunk of createReadStream(path)) data = `${data}${chunk}`
  return data
}

async function mkdir(dir) {
  // TODO: handle recursive:true in options
  await _dir(dir)
}

async function unlink(file) {
  if (typeof file === 'object') return file
  const dirs = file.split('/')
  const filename = dirs.pop()
  const dirHandle = await _dir(dirs)

  return dirHandle.removeEntry(filename)
}

async function open(file) {
  if (typeof file === 'object') return file
  const dirs = file.split('/')
  const filename = dirs.pop()
  const dirHandle = await _dir(dirs)

  return dirHandle.getFileHandle(filename, { create: true })
}

async function stat(file) {
  try {
    const fileHandle = await open(file)
    const fileStat = await fileHandle.getFile()
    return {
      size: fileStat.size,
      isFile() { return true },
      isDirectory() { return false },
    }
  } catch {
    await _dir(file)
    return {
      isFile() { return false },
      isDirectory() { return true },
    }
  }
}

async function $ls(dirHandle, prefix = '') {
  dirHandle ??= await navigator.storage.getDirectory()
  for await (const [name, handle] of dirHandle) {
    console.log(prefix, name)
    if (handle.kind === 'directory') await $ls(handle, prefix + '  ')
  }
}

async function $rm(dirHandle, prefix = '') {
  dirHandle ??= await navigator.storage.getDirectory()
  for await (const [name, handle] of dirHandle) {
    console.log(prefix, name)
    await dirHandle.removeEntry(name, { recursive: true })
  }
}

export default {
  mkdir,
  readdir,
  readFile,
  unlink,
  open,
  stat,
  lstat: stat,
  $ls,
  $rm
}
