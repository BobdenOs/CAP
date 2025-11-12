const cds = require("@sap/cds");

const LOG = cds.log('trc')

const server = `${process.pid}`
let domain = ''

class Tracer {
  constructor() {
    this.srv = undefined
    this.buffer = []
  }

  connect(srv) {
    this.srv = srv

    domain = cds.env.ssl.names[0]
    this.buffer.forEach(row => { if (row.server) row.domain = domain })
    if (this.interval) clearInterval(this.interval)
    this.interval = setInterval(() => this.flush(srv), 10000)
  }

  async flush(srv) {
    const buffer = this.buffer
    this.buffer = []
    await srv.db.upsert(buffer).into(srv.entities.traces)
  }

  start(name) {
    const stack = cds.context._stack ??= []
    const all = cds.context._stack_all ??= []

    if (cds.context?.http?.res && !cds.context.http.res._traced) {
      const start = Date.now()
      const res = cds.context.http.res
      const end = res.end
      res.setHeader('trailer', 'Server-Timing')
      res.end = function () {
        const measures = { 'total': Date.now() - start }
        self(all).forEach((trace) => {
          const name = trace.name.split(' - ')[0].replace('sap.cap.', '')
          measures[name] ??= 0
          if (trace.dur) measures[name] += trace.dur
        })
        // '"@' + domain + '", '+
        const timing = Object.keys(measures).map(measure => `${measure}${measures[measure] ? ';dur=' + measures[measure] : ''}`).join(',')
        if (!res.chunkedEncoding) {
          res.removeHeader('trailer')
          res.setHeader('Server-Timing', timing)
        } else {
          res.addTrailers({ 'Server-Timing': timing })
        }
        return end.apply(this, arguments)
      }
      res._traced = true
    }

    const parent = stack.at(-1)
    const trace = {
      server,
      domain,

      name,

      ID: cds.utils.uuid(),
      correlation: cds.context.id,
      parent_ID: parent?.ID,

      start: new Date(),
    }

    stack.push(trace)
    all.push(trace)
    this.buffer.push(trace)
    return trace
  }

  end(trace) {
    cds.context._stack.splice(cds.context._stack.findIndex(trc => trc === trace), 1)
    const end = {
      ID: trace.ID,
      end: new Date(),
    }
    cds.context._stack_all.push(end)
    this.buffer.push(end)
  }
}

const traces = new Tracer()

const { handle } = cds.Service.prototype
cds.Service.prototype.handle = function (req) {
  const trace = traces.start(`${this.name} - ${req.event ? `${req.event} ${req.path}` : req.query}`)
  return handle.apply(this, arguments).finally(() => traces.end(trace))
}

module.exports = class TRCService extends cds.ApplicationService {
  async init() {
    this.db = (await cds.connect.to('sap.cap.db')).bind(this)

    traces.connect(this)

    this.on(["SELECT"], this.onSELECT)
  }

  async onSELECT(req) {
    const ret = await this.db.send(req)
    return ret
  }
}

function self(traces) {
  const trc = {}
  for (const trace of traces) {
    const t = trc[trace.ID] ??= {}
    Object.assign(t, trace)
    if (trace.parent_ID) {
      const p = trc[trace.parent_ID] ??= {}
        ; (p.children ??= []).push(t)
    }
  }

  const ret = []
  for (const ID in trc) {
    const t = trc[ID]
    t.times = [{ start: t.start, end: t.end }]
    if (t.children) for (const child of t.children) {
      for (let i = 0; i < t.times.length; i++) {
        const time = t.times[i]
        if (time.start < child.start && time.end > child.end) {
          t.times.splice(i, 1, { start: time.start, end: child.start }, { start: child.end, end: time.end })
        } else if (time.start <= child.start && time.end <= child.end) {
          time.end = child.start
        } else if (time.start >= child.start && time.end >= child.end) {
          time.start = child.end
        }
      }
    }
    t.dur = t.times.reduce((l, c) => l + c.end.getTime() - c.start.getTime(), 0)
    ret.push(t)
  }

  return ret
}

// trace render function usable also in the browser dev tools
const render = function (rows) {
  const colors = ['lightblue', 'lightgreen', 'orange', 'lightgray']
  const servers = {}
  const limits = rows.reduce((l, c) => {
    servers[c.domain + ':' + c.server] ??= colors.shift()
    const start = new Date(c.start).getTime()
    const end = new Date(c.end).getTime()
    if (l.min > start) l.min = start
    if (l.max < end) l.max = end
    if (l.name < c.name?.length) l.name = c.name.length
    if (l.domain < c.domain?.length) l.domain = c.domain.length
    return l
  }, { min: Number.POSITIVE_INFINITY, max: 0, name: 0, domain: 0 })
  limits.scale = 100 / (limits.max - limits.min)

  console.log(rows.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).map(row => {
    const start = new Date(row.start).getTime()
    const end = new Date(row.end).getTime()
    const l = start - limits.min
    const r = end - limits.min
    return `%c[${(row.domain || '').padStart(limits.domain, ' ')}] ${(row.name || '').padEnd(limits.name, ' ')} (${`${(r - l) >>> 0}`.padStart(5, ' ')} ms) | ${''.padStart((l * limits.scale) >>> 0, ' ')}${'='.padStart(((r - l) * limits.scale) >>> 0, '=')}`
  }).join('\n'), ...rows.map(row => {
    return `color: ${servers[row.domain + ':' + row.server]};`
  }))
}

// const groups = JSON.parse(document.body.innerText).value.reduce((groups, cur) => {
//     (groups[cur.correlation] ??= []).push(cur)
//     return groups
// },{})

// for(const correlation in groups) try{render(groups[correlation])}catch{}