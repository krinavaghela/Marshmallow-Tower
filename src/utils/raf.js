export function createRaf() {
  let id = 0
  let last = 0
  let cb = null

  function loop(t) {
    id = requestAnimationFrame(loop)
    const dt = last ? (t - last) / 1000 : 0
    last = t
    if (cb) cb(t / 1000, dt)
  }

  return {
    start(fn) {
      cb = fn
      last = 0
      id = requestAnimationFrame(loop)
    },
    stop() {
      cancelAnimationFrame(id)
      cb = null
    },
  }
}
