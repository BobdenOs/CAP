export function assert(bool, msg) {
  if (!bool) throw new Error(msg)
}

assert.equal = function (a, b) {
  assert(a === b, `ASSERTION: ${a} === ${b}`)
}

export default assert