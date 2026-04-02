function format(format, ...data) {
  // TODO: if we care for it
  return format
}

function formatWithOptions(options, format, ...data) {
  // TODO: if we care for it
  return format
}

function inspect(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return value
  }
}

inspect.custom = Symbol('inspect custom')

function inherits(ctor, superCtor) {

  if (ctor === undefined || ctor === null)
    throw new ERR_INVALID_ARG_TYPE('ctor', 'Function', ctor);

  if (superCtor === undefined || superCtor === null)
    throw new ERR_INVALID_ARG_TYPE('superCtor', 'Function', superCtor);

  if (superCtor.prototype === undefined) {
    throw new ERR_INVALID_ARG_TYPE('superCtor.prototype',
      'Object', superCtor.prototype);
  }
  Object.defineProperty(ctor, 'super_', {
    __proto__: null,
    value: superCtor,
    writable: true,
    configurable: true,
  });
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}

export default {
  format,
  formatWithOptions,
  inspect,
  inherits,
}