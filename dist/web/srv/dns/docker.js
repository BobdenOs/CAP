#!/usr/bin/env node

const os = require('node:os')
const net = require('node:net')
const dgram = require('node:dgram')
const child_process = require('node:child_process')
const { pipeline } = require('node:stream')
const { text } = require('node:stream/consumers')

async function extract() {
  console.log('Starting Docker port proxy setup...')

  const appIDs = []

  for await (const app of exec('ps')) {
    appIDs.push(app.ID)
  }

  const mappings = [{
    virtual: {
      host: 'fd14:c9c1:a1a7:1::aaaa'
    }
  }]

  if (appIDs.length) for await (const apps of exec('inspect', ...appIDs)) {
    for (const app of apps) {
      const net = app.NetworkSettings
      for (const network in net.Networks) {
        const virtualV4Host = net.Networks[network].IPAddress
        const virtualV6Host = net.Networks[network].GlobalIPv6Address

        for (const port in net.Ports) {
          const split = /(\d*)\/(tcp|udp)/.exec(port)
          if (!split?.[1]) continue // skip unknown port syntax
          const virtualPort = split[1]
          const prot = split[2]
          for (const { HostIp, HostPort: physicalPort } of net.Ports[port]) {
            if (virtualV6Host && HostIp.indexOf(':') > -1) {
              const physicalHost = HostIp === '::' ? '::1' : HostIp
              mappings.push({
                prot,
                physical: { host: physicalHost, port: physicalPort },
                virtual: { host: virtualV6Host, port: virtualPort },
              })
            } else {
              const physicalHost = HostIp === '0.0.0.0' ? '127.0.0.1' : HostIp
              mappings.push({
                prot,
                physical: { host: physicalHost, port: physicalPort },
                virtual: { host: virtualV4Host, port: virtualPort },
              })
            }
          }
        }
      }
    }
  }

  if (os.platform() === 'win32') {
    const interfaces = JSON.parse(await spawn('powershell', '-Command', 'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | ConvertTo-Json -Compress'))
    const preferedInterfaces = ['WSL', 'vEthernet', 'Ethernet']
    const interface = preferedInterfaces
      .map(name => interfaces.filter(i => i.InterfaceAlias.indexOf(name) > -1)[0])
      .filter(a => a)
    [0]

    const currentIps = JSON.parse(await spawn('powershell', '-Command', `Get-NetIPAddress | Where-Object {$_.InterfaceAlias -eq ${JSON.stringify(interface.InterfaceAlias)}} | ConvertTo-Json -Compress`))
      .filter(ip => ip.SkipAsSource) // SkipAsSource indicates that the IPs are fake as they don't actually have a destination

    const newIps = []
    mappings.forEach(mapping => {
      if (
        !currentIps.find(ip => ip.IPAddress === mapping.virtual.host) &&
        !newIps.includes(mapping.virtual.host)
      ) newIps.push(mapping.virtual.host)
    })

    const oldIps = currentIps.filter(ip => !mappings.find(mapping => ip.IPAddress === mapping.virtual.host)).map(ip => ip.IPAddress)

    if (newIps.length) await spawn('powershell', 'Start-Process', '-WindowStyle', 'Hidden', '-Wait', '-Verb', 'RunAs', 'powershell.exe', '-ArgumentList', `'${ //
      newIps
        .map(ip => `New-NetIPAddress -InterfaceIndex ${interface.InterfaceIndex} -IPAddress ${ip} -SkipAsSource:$true`)
        .join(';')
      }'`)

    if (oldIps.length) await spawn('powershell', 'Start-Process', '-WindowStyle', 'Hidden', '-Wait', '-Verb', 'RunAs', 'powershell.exe', '-ArgumentList', `'${ //
      oldIps
        .map(ip => `Remove-NetIPAddress -InterfaceIndex ${interface.InterfaceIndex} -IPAddress ${ip} -Confirm:$false`)
        .join(';')
      }'`)

    if (currentIps.length) {
      try {
        const oldProxies = JSON.parse(await spawn('powershell', `(Get-NetTCPConnection -State Listen -LocalAddress ${currentIps.map(ip => ip.IPAddress)} ).OwningProcess | ConvertTo-Json`))
        if (oldProxies.length) await spawn('powershell', `Stop-Process -Id ${oldProxies}`)
      } catch { /* ignore when stopping an existing proxy doesn't work */ }
    }
  } else {
    const interfaces = JSON.parse(await spawn('ip', '-j', 'addr'))
    const preferedInterfaces = ['eth']
    const interface = preferedInterfaces
      .map(name => interfaces.filter(i => i.ifname.indexOf(name) > -1)[0])
      .filter(a => a)
    [0]

    const currentIps = interface.addr_info

    const newIps = []
    mappings.forEach(mapping => {
      if (
        !currentIps.find(ip => ip.local === mapping.virtual.host) &&
        !newIps.includes(mapping.virtual.host)
      ) newIps.push(mapping.virtual.host)
    })

    const oldIps = currentIps
      .filter(ip => ip.scope === 'host' || ip.noprefixroute || ip.secondary || (ip.scope === 'global' && !ip.broadcast)) // SkipAsSource indicates that the IPs are fake as they don't actually have a destination
      .filter(ip => !mappings.find(mapping => ip.local === mapping.virtual.host))
      .map(ip => ip.local)
    for (const ip of newIps) await spawn('sudo', 'ip', 'addr', 'add', ip.indexOf(':') > -1 ? `${ip}/64` : `${ip}/20`, 'dev', `${interface.ifname}`, ...(ip.indexOf(':') > -1 ? [] : ['brd', '172.28.223.255'])).catch(() => { })
    for (const ip of oldIps) await spawn('sudo', 'ip', 'addr', 'del', ip.indexOf(':') > -1 ? `${ip}/64` : `${ip}/20`, 'dev', `${interface.ifname}`)
  }

  const proms = []
  for (const mapping of mappings) {
    if (!mapping.physical) continue
    console.log(`start: ${mapping.virtual.host}:${mapping.virtual.port}<==>${mapping.physical.host}:${mapping.physical.port}`)
    proms.push(mapping.prot === 'udp' ? proxyUDP(mapping) : proxy(mapping))
  }
  await Promise.allSettled(proms)
  console.log('proxy started')
}

function proxy(mapping, tries = 0) {
  const server = net.createServer((clientSocket) => {
    console.log(`req: ${mapping.virtual.host}:${mapping.virtual.port}<==>${mapping.physical.host}:${mapping.physical.port}`)
    const targetSocket = net.connect(mapping.physical.port, mapping.physical.host)
    pipeline(clientSocket, targetSocket, err => { if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error(err) })
    pipeline(targetSocket, clientSocket, err => { if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error(err) })
  })

  server.on('error', err => { if (err.code !== 'EADDRNOTAVAIL') console.error(err) })
  return new Promise((resolve, reject) => {
    server.once('error', err => {
      if (tries > 100) return resolve(err)
      if (err.code === 'EADDRNOTAVAIL') return proxy(mapping, tries + 1).then(resolve, reject)
      reject(err)
    })
    server.listen(mapping.virtual.port, mapping.virtual.host, () => {
      console.log(`ready: ${mapping.virtual.host}:${mapping.virtual.port}<==>${mapping.physical.host}:${mapping.physical.port}`)
      resolve(server)
    })
  })
}

function proxyUDP(mapping, tries = 0) {
  const controller = new AbortController();
  const { signal } = controller;

  const type = mapping.virtual.host.indexOf(':') > -1 ? 'udp6' : 'udp4'

  const server = dgram.createSocket({ type, signal })

  server.on("message", async (msg, remote) => {
    console.log(`req: ${mapping.virtual.host}:${mapping.virtual.port}<==>${mapping.physical.host}:${mapping.physical.port}`)
    const socket = dgram.createSocket({ type })
    socket.on("error", (err) => console.log(err))
    socket.on("message", res => server.sendto(
      res, 0, res.byteLength,
      remote.port, remote.address,
      (err) => { if (err) console.log(err) }
    ))
    socket.send(msg, 0, msg.length, mapping.physical.port, mapping.physical.host)
  })
  server.on('error', err => { if (err.code !== 'EADDRNOTAVAIL') console.error(err) })

  return new Promise((resolve, reject) => {
    server.once('error', err => {
      if (tries > 100) return resolve(err)
      if (err.code === 'EADDRNOTAVAIL') return proxyUDP(mapping, tries + 1).then(resolve, reject)
      reject(err)
    })
    server.once('listening', () => {
      console.log(`ready: ${mapping.virtual.host}:${mapping.virtual.port}<==>${mapping.physical.host}:${mapping.physical.port}`)
      resolve(server)
    })
    server.bind(mapping.virtual.port, mapping.virtual.host)
  })
}

function spawn(cmd, ...args) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(cmd, args, { stdio: 'pipe' })
    const out = text(proc.stdout)
    const err = text(proc.stderr)
    proc.on('error', e => {
      e.cause = err
      reject(e)
    })
    proc.on('exit', async code => code ? reject(new Error(await err)) : resolve(out))
  })
}

async function* exec(...args) {
  const proc = child_process.spawn('docker', [...args, '--format', 'json'], { stdio: 'pipe' })

  proc.on('error', () => { }) // Just ignore when docker doesn't exist

  let leftover = ''
  for await (const chunk of proc.stdout) {
    const split = `${leftover}${chunk}`.split('\n')
    leftover = split.pop()

    for (const entry of split) yield JSON.parse(entry)
  }
  if (leftover) yield JSON.parse(leftover)
}

extract()
