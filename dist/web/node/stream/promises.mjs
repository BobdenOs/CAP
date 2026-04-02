
async function pipeline(...args) {
  const abort = new AbortController()
  const signal = abort.signal

  let last
  for (const arg of args) {
    switch (typeof arg) {
      case 'object':
        if (!last) {
          last = arg
          continue
        }

        if (last.readable) last = last.readable
        if (arg === args.at(-1)) last = last.pipeTo(arg.writable || arg)
        else last = last.pipeThrough(arg)
        break
      case 'function':
        const gen = arg(last, { end: undefined, signal })
        last = new ReadableStream({
          async start(controller) {
            for await (const chunk of gen) controller.enqueue(chunk)
            controller.close()
          },
        })
        break
    }
  }

  return last
}

export default {
  pipeline,
}