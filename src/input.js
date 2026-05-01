/**
 * Tracks Shift key state so hover/drag UX stays in sync when Shift is released without pointer movement.
 */
export function createShiftKeyTracker(windowObj = typeof window !== 'undefined' ? window : globalThis) {
  let shiftDown = false

  function onKeyDown(e) {
    if (e.key === 'Shift') shiftDown = true
  }
  function onKeyUp(e) {
    if (e.key === 'Shift') shiftDown = false
  }

  windowObj.addEventListener('keydown', onKeyDown)
  windowObj.addEventListener('keyup', onKeyUp)

  return {
    isShiftDown: () => shiftDown,
    dispose() {
      windowObj.removeEventListener('keydown', onKeyDown)
      windowObj.removeEventListener('keyup', onKeyUp)
    },
  }
}
