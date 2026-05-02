import * as THREE from 'three'

export class StructureManager {
  constructor({ snapRadius, limits }) {
    this.snapRadius = snapRadius
    this.limits = limits
    this.used = {
      spaghetti: 0,
      tapeMeters: 0,
      stringMeters: 0,
      payloadPlaced: 0,
    }
    this.nodes = new Map()
    this.edgeCount = 0
  }

  reset({ keepNodes }) {
    this.used = {
      spaghetti: 0,
      tapeMeters: 0,
      stringMeters: 0,
      payloadPlaced: 0,
    }
    if (!keepNodes) this.nodes.clear()
    this.edgeCount = 0
  }

  createNode({ position, object3d, weight }) {
    const id = `n_${this.nodes.size}_${Math.random().toString(36).slice(2, 7)}`
    this.nodes.set(id, {
      id,
      position: position.clone(),
      object3d,
      weight,
    })
    return id
  }

  getNode(id) {
    return this.nodes.get(id)
  }

  getNearestNodeId(worldPos, radius = this.snapRadius) {
    let best = null
    let bestD = Infinity
    for (const [id, n] of this.nodes) {
      const d = n.position.distanceTo(worldPos)
      if (d < radius && d < bestD) {
        bestD = d
        best = id
      }
    }
    return best
  }

  canAddSpaghetti() {
    return this.used.spaghetti < this.limits.spaghetti
  }

  canUseTape(meters) {
    return this.used.tapeMeters + meters <= this.limits.tapeMeters
  }

  addSpaghettiEdge({ a, b, object3d, isRigid }) {
    if (this.used.spaghetti >= this.limits.spaghetti) return { ok: false, reason: 'Out of spaghetti.' }
    this.used.spaghetti += 1
    this.edgeCount += 1
    return { ok: true, id: `e_${this.edgeCount}` }
  }
}
