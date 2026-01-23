export default function assert(bool, msg) {
  if (!bool) throw new Error(msg)
}