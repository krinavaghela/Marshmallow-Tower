export function createTimer({ durationSeconds, onTick, onExpire, audio = null }) {
  let secondsLeft = durationSeconds
  let paused = false
  let lastT = performance.now() / 1000
  let expired = false
  let lastIntSecond = null
  let warned5 = false
  let warned2 = false
  let warned1 = false

  function reset() {
    secondsLeft = durationSeconds
    paused = false
    expired = false
    lastIntSecond = null
    warned5 = false
    warned2 = false
    warned1 = false
    lastT = performance.now() / 1000
    tick(true)
  }

  function togglePause() {
    paused = !paused
    lastT = performance.now() / 1000
  }

  function getLevel() {
    const m = secondsLeft / 60
    if (m <= 2) return { level: 'hot', pulse: true }
    if (m <= 5) return { level: 'hot', pulse: true }
    if (m <= 10) return { level: 'amber', pulse: false }
    return { level: 'cool', pulse: false }
  }

  function getTime() {
    const { level, pulse } = getLevel()
    return { secondsLeft, level, pulse, paused }
  }

  function tick(force = false) {
    const now = performance.now() / 1000
    const dt = now - lastT
    lastT = now
    if (!paused) {
      secondsLeft = Math.max(0, secondsLeft - dt)
      if (secondsLeft <= 0.0001 && !expired) {
        expired = true
        audio?.playTimerEnd?.()
        onExpire?.()
      }
    }

    const sInt = Math.floor(secondsLeft + 1e-6)
    if (force || sInt !== lastIntSecond) {
      // Threshold warnings
      if (!warned5 && sInt === 5 * 60) {
        warned5 = true
        audio?.playTimerWarning?.(5)
      }
      if (!warned2 && sInt === 2 * 60) {
        warned2 = true
        audio?.playTimerWarning?.(2)
      }
      if (!warned1 && sInt === 60) {
        warned1 = true
        audio?.playTimerWarning?.(1)
      }

      // Ticks for final minute (10s cadence), final 10s (1s cadence)
      if (sInt <= 60 && sInt > 0) {
        if (sInt <= 10) audio?.playTimerTick?.()
        else if (sInt % 10 === 0) audio?.playTimerTick?.()
      }

      lastIntSecond = sInt
      onTick?.(getTime())
    } else onTick?.(getTime())
  }

  function update() {
    if (expired) return
    tick(false)
  }

  // Drive automatically at 60fps.
  function loop() {
    update()
    requestAnimationFrame(loop)
  }
  loop()
  tick(true)

  return { reset, togglePause, getTime }
}

