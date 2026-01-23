let i = 1
const randomUUID = function() {
  const str = (i++).toString(16).padStart(32,'0')
  return `${str.slice(0,8)}-${str.slice(0,4)}-${str.slice(0,4)}-${str.slice(0,4)}-${str.slice(0,12)}`
}

export default {
  randomUUID,
}