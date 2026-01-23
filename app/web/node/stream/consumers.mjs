export const text = async function (stream) {
  let str = ''
  for await (const chunk of stream) {
    str += chunk
  }
  return str
}

export default { text }