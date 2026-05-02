import { easeInOutSine, easeOutCubic } from '../utils/easing.js'

export function createCollapseAnimator({ scene, towerView, towerModel }) {
  let mode = 'idle'
  let t0 = 0
  let dur = 1.2
  let onDone = null
  const baseRot = new THREE.Euler(0, 0, 0)
  const orig = new THREE.Quaternion()

  function reset() {
    mode = 'idle'
    scene.rotation.set(0, 0, 0)
    t0 = 0
    onDone = null
  }

  function play({ stable, outcome, weakSnapId: _weak, onDone: done }) {
    reset()
    onDone = done
    t0 = performance.now() / 1000
    if (outcome === 'stand' || outcome === 'wobble') {
      mode = stable ? 'wobble_ok' : 'wobble_fail'
      dur = stable ? 1.35 : 1.55
    } else {
      mode = 'collapse'
      dur = 1.45
    }
  }

  function update(_t, _dt) {
    if (mode === 'idle') return
    const t = performance.now() / 1000 - t0
    const k = Math.min(1, t / dur)
    if (mode === 'wobble_ok') {
      const w = easeInOutSine(k) * 0.028
      scene.rotation.y = Math.sin(t * 5.5) * w
      scene.rotation.x = Math.cos(t * 4.2) * w * 0.6
    } else if (mode === 'wobble_fail') {
      const w = easeInOutSine(k) * 0.065
      scene.rotation.y = Math.sin(t * 9) * w
      scene.rotation.x = Math.cos(t * 7) * w * 0.55
    } else if (mode === 'collapse') {
      const sink = easeOutCubic(k)
      scene.rotation.z = sink * 0.35
      scene.rotation.x = sink * 0.12
      towerView.root.position.y = -sink * 0.35
    }

    if (k >= 1) {
      mode = 'idle'
      scene.rotation.set(0, 0, 0)
      towerView.root.position.y = 0
      const cb = onDone
      onDone = null
      cb?.()
    }
  }

  return { reset, play, update }
}
