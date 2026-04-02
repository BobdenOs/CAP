class AsyncLocalStorage {
  _current = null
  _queue = []
  enterWith(x) { this._current = x }
  getStore() { return this._current }
  run(_, fn, ...args) {
    const prom = new Promise((resolve, reject) => {
      this._queue.push(async () => {
        this.enterWith(_)
        await fn.apply(null, args).then(resolve, reject)
        this._current = null
        this._queue.shift()
        if (this._queue.length) this._queue[0]()
      })
    })

    if (this._queue.length === 1) this._queue[0]()

    return prom
  }
}

class AsyncResource {
  runInAsyncScope(cb, self, ...args) {
    return cb.apply(self, args)
  }
}

export default {
  AsyncLocalStorage,
  AsyncResource,
}
