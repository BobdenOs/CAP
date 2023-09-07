class WeakCache {
  constructor() {
    this.keys = {};
    this.timeouts = {};
    this.weak = new WeakMap();
  }

  get(key) {
    if (this.timeouts[key] < Date.now()) {
      this.delete(key);
      return;
    }
    return this.weak.get(this.keys[key]);
  }

  set(key, value) {
    const timeout = Date.now() + value.ttl * 1000;

    key = key + "";
    const pointer = this.keys[key];
    if (pointer) {
      this.timeouts[key] = Math.min(this.timeouts[key], timeout);
      this.weak.get(pointer).push(value);
      return;
    }

    const k = { key };
    this.keys[key] = k;
    this.timeouts[key] = timeout;
    this.weak.set(k, [value]);
  }

  delete(key) {
    delete this.timeouts[key];
    delete this.keys[key];
  }
}

module.exports = WeakCache;
