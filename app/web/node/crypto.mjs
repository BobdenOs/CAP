const randomUUID = () => crypto.randomUUID()

async function hash(algorithm, compound, returnType) {
  // Encode the input string to a Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(compound);
  const hash = await crypto.subtle.digest(algorithm.toUpperCase(), data);
  if (returnType !== 'buffer') { debugger }
  return new Uint8Array(hash)
}

export default {
  randomUUID,
  hash,
}
