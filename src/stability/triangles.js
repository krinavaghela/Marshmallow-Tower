/** Rough triangle count among occupied nodes (for stability heuristic). */
export function countTriangles(towerModel) {
  const nodes = [...towerModel.getNodeIds()]
  const adj = new Map()
  for (const id of nodes) adj.set(id, new Set())
  for (const e of towerModel.edges) {
    if (adj.has(e.a) && adj.has(e.b)) {
      adj.get(e.a).add(e.b)
      adj.get(e.b).add(e.a)
    }
  }
  let tri = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      if (!adj.get(a).has(b)) continue
      for (const c of adj.get(a)) {
        if (c === b) continue
        if (adj.get(b).has(c) && c > b) tri++
      }
    }
  }
  return tri
}
