/** Lightweight graph stability heuristic for the alternate lab entry (`src/main.js`). */
export class StabilityEngine {
  constructor() {
    this.nodes = new Map()
    this.edges = []
  }

  reset() {
    this.nodes.clear()
    this.edges = []
  }

  addNode({ id, position, weight, object3d }) {
    this.nodes.set(id, { id, position: position.clone(), weight, object3d })
  }

  addEdge({ a, b, taped, object3d }) {
    this.edges.push({ a, b, taped, object3d })
  }

  evaluate() {
    if (this.nodes.size < 2) {
      return { outcome: 'collapse', reason: 'Not enough structure.' }
    }
    let sum = 0
    let wy = 0
    for (const n of this.nodes.values()) {
      sum += n.weight
      wy += n.weight * n.position.y
    }
    const comY = wy / sum
    const ys = [...this.nodes.values()].map((n) => n.position.y)
    const spread = Math.max(...ys) - Math.min(...ys)
    const topHeavy = comY / Math.max(0.08, Math.max(...ys))

    if (spread < 0.08 && this.edges.length < 3) {
      return { outcome: 'collapse', reason: 'Base too narrow.' }
    }
    if (topHeavy > 0.82) {
      return { outcome: 'wobbly', reason: 'Top-heavy.' }
    }
    if (this.edges.length >= 4 && spread > 0.12) {
      return { outcome: 'stable', reason: 'Holds.' }
    }
    return { outcome: 'wobbly', reason: 'Marginal.' }
  }
}
