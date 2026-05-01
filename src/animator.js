import * as THREE from 'three'

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

export function createAnimator({ root, mats, platform, audio = null }) {
  const state = {
    playing: false,
    mode: 'standing',
    t0: 0,
    nodes: [],
    edges: [],
    crown: null,
    debris: [],
    onEnd: null,
  }

  const crownBloom = new THREE.PointLight(0xC17B5A, 0, 1.2)
  crownBloom.castShadow = false
  root.add(crownBloom)

  function reset() {
    state.playing = false
    state.debris.forEach((d) => root.remove(d))
    state.debris = []
    crownBloom.intensity = 0
    root.rotation.set(0, 0, 0)
  }

  function play(mode, { nodes, edges, crown, onEnd }) {
    reset()
    state.playing = true
    state.mode = mode
    state.t0 = performance.now() / 1000
    state.nodes = nodes
    state.edges = edges
    state.crown = crown
    state.onEnd = onEnd

    if (audio?.isEnabled?.() && audio?.isPlaying?.()) {
      if (mode === 'standing') audio.playStanding?.()
      else if (mode === 'wobbling') audio.playWobbling?.()
      else if (mode === 'partial') audio.playPartialCollapse?.()
      else if (mode === 'collapse') audio.playTotalCollapse?.()
    }

    if (mode === 'standing' && crown?.obj) {
      crownBloom.position.copy(crown.obj.position)
      crownBloom.intensity = 2.2
    }
  }

  function update() {
    if (!state.playing) return
    const t = performance.now() / 1000 - state.t0

    if (state.mode === 'standing') {
      // Bottom-to-top pulse wave, plus crown bloom.
      const wave = Math.sin(t * 3.2) * 0.02
      root.rotation.z = wave
      crownBloom.intensity = Math.max(0, 2.2 * Math.exp(-t * 1.6))

      for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i]
        const phase = i * 0.08
        const s = 1 + Math.max(0, Math.sin((t - phase) * 10)) * 0.06
        n.obj.scale.lerp(new THREE.Vector3(s, s, s), 0.25)
      }

      if (t > 1.2) end()
      return
    }

    if (state.mode === 'wobbling') {
      const osc = Math.sin(t * 10.5) * Math.exp(-t * 1.3)
      root.rotation.z = osc * (Math.PI / 180) * 6
      root.rotation.x = osc * (Math.PI / 180) * 2.4
      // Crown bounce
      if (state.crown?.obj) {
        const b = 1 + Math.max(0, Math.sin(t * 7)) * 0.15 * Math.exp(-t * 1.2)
        state.crown.obj.scale.set(1, 1, 1)
        state.crown.obj.scale.lerp(new THREE.Vector3(b, 1 / Math.max(0.001, b), b), 0.35)
      }
      // Stress long sticks
      for (const e of state.edges) {
        if (e.type === 'spaghetti' && e.lengthUnits > 2.5) e.mesh.material = mats.materials.spaghettiStress
      }
      if (t > 1.4) end()
      return
    }

    if (state.mode === 'partial') {
      // Top 40% fall, bottom holds.
      const k = clamp01(t / 0.8)
      const heights = state.nodes.map((n) => n.obj.position.y)
      const maxY = Math.max(...heights)
      const threshold = maxY * 0.6
      for (const n of state.nodes) {
        if (n.obj.position.y > threshold) {
          n.obj.position.y = Math.max(0.06, n.obj.position.y - k * 0.6)
          n.obj.materialNeedsUpdate = true
          n.obj.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15)
        }
      }
      // Sticks flash then fade
      for (const e of state.edges) {
        if (e.type !== 'spaghetti') continue
        e.mesh.material.transparent = true
        e.mesh.material.opacity = 1 - k
      }
      // Crown drops
      if (state.crown?.obj) {
        state.crown.obj.position.y = Math.max(0.35, state.crown.obj.position.y - k * 1.2)
      }
      if (t > 1.0) end()
      return
    }

    // collapse
    const k = clamp01(t / 1.5)
    const scatter = (i) => (i % 2 === 0 ? 1 : -1) * (0.2 + (i % 5) * 0.02)

    for (let i = 0; i < state.nodes.length; i++) {
      const n = state.nodes[i]
      n.obj.position.x += scatter(i) * 0.01 * (1 - k)
      n.obj.position.z -= scatter(i) * 0.008 * (1 - k)
      n.obj.position.y = Math.max(0.06, n.obj.position.y - 0.03 - k * 0.05)
    }

    for (let i = 0; i < state.edges.length; i++) {
      const e = state.edges[i]
      if (e.type !== 'spaghetti') continue
      e.mesh.material = mats.materials.spaghettiStress
      e.mesh.material.transparent = true
      e.mesh.material.opacity = 1 - clamp01((t - 0.2) / 0.2)
    }

    if (state.crown?.obj) {
      state.crown.obj.position.y = Math.max(0.35, state.crown.obj.position.y - 0.05 - k * 0.06)
      const y = state.crown.obj.position.y
      const floorY = 0.35
      const impact = clamp01(1 - (y - floorY) / 0.28)
      const wobble = Math.sin(k * Math.PI * 4.2) * 0.14 * impact
      const sq = Math.max(0.18, 1 - k * 0.62 + wobble * 0.35)
      const spread = 1 + k * 0.72 + Math.abs(wobble) * 1.05
      state.crown.obj.scale.set(spread, sq, spread)
    }

    if (t > 1.55) end()
  }

  function isPlaying() {
    return state.playing
  }

  function end() {
    state.playing = false
    root.rotation.set(0, 0, 0)
    crownBloom.intensity = 0
    state.onEnd?.()
  }

  return { play, update, reset, isPlaying }
}

