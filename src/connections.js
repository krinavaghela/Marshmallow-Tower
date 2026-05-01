/**
 * Spaghetti/string connectivity only (structural graph for group moves).
 */
export function getConnectedStructure(startNodeId, edges) {
  const nodeIds = new Set()
  const stack = [startNodeId]

  while (stack.length) {
    const id = stack.pop()
    if (nodeIds.has(id)) continue
    nodeIds.add(id)
    for (const e of edges) {
      if (e.type !== 'spaghetti' && e.type !== 'string') continue
      if (e.aId === id) stack.push(e.bId)
      else if (e.bId === id) stack.push(e.aId)
    }
  }

  const structureEdges = []
  for (const e of edges) {
    if (e.type !== 'spaghetti' && e.type !== 'string') continue
    if (nodeIds.has(e.aId) && nodeIds.has(e.bId)) structureEdges.push(e)
  }

  const nodesList = [...nodeIds]
  return {
    nodeIds: nodesList,
    nodes: nodesList,
    edges: structureEdges,
  }
}
