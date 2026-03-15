async function _dir(dir) {
  const dirs = Array.isArray(dir) ? dir : dir.split('/')

  let dirHandle = await navigator.storage.getDirectory()
  for (const name of dirs) {
    if (name.length === 0) continue
    dirHandle = await dirHandle.getDirectoryHandle(name, { create: true })
  }

  return dirHandle
}

async function readdir(dir) {
  const dirHandle = await _dir(dir)

  const ret = []
  for await (const [key] of dirHandle) {
    ret.push(key)
  }
  return ret
}

async function mkdir(dir) {
  // TODO: handle recursive:true in options
  await _dir(dir)
}

async function open(file) {
  const dirs = file.split('/')
  const filename = dirs.pop()
  const dirHandle = await _dir(dirs)

  return dirHandle.getFileHandle(filename, { create: true })
}

async function stat(file) {
  const fileHandle = await open(file)
  const fileStat = await fileHandle.getFile()

  return {
    size: fileStat.size,
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
  open,
  stat,
  $ls,
  $rm
}
