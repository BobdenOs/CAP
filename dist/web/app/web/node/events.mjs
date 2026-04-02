export class EventEmitter extends EventTarget {
  constructor() {
    super()
    this._events = {}
  }

  prependListener(event, cb) {
    (this._events[event] ??= []).unshift(cb)
  }
  on(event, cb) {
    (this._events[event] ??= []).push(cb)
  }
  once(event, cb) {
    const self = this
    const _cb = function () { self.off(event, _cb); return cb.apply(this, arguments) }
    this.on(event, _cb)
  }
  off(event, cb) {
    const ee = this._events[event] ??= []
    ee.splice(ee.indexOf(cb), 1)
  }
  emit(event, ...args) {
    for (const cb of [...this._events[event] ?? []]) cb(...args)
  }
  listeners(event) {
    return this._events[event] ?? []
  }

  removeAllListeners(event) {
    delete this._events[event]
  }
  removeListener(event, cb) {
    return this.off(event, cb)
  }
}

EventEmitter.EventEmitter = EventEmitter

export default EventEmitter
