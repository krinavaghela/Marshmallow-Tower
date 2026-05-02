import * as THREE from 'three'
import { createSnapPoints } from './snapPoints.js'
import { PARTS } from '../app/constants.js'

export function createTowerModel() {
  const points = createSnapPoints()
  const pointsById = new Map(points.map((p) => [p.id, p.position.clone()]))

  /** Occupied snap ids that hold a joint marshmallow */
  const nodes = new Set()
  const edges = []

  let topSnapId = null

  function reset() {
    nodes.clear()
    edges.length = 0
    topSnapId = null
  }

  function hasNode(snapId) {
    return nodes.has(snapId)
  }

  function placeNode(snapId) {
    if (nodes.size >= PARTS.maxMarshmallows) return { ok: false, reason: 'No more marshmallow joints.' }
    nodes.add(snapId)
    return { ok: true }
  }

  function canPlaceNode(snapId) {
    return !nodes.has(snapId) && nodes.size < PARTS.maxMarshmallows
  }

  function canAddEdge(a, b) {
    if (a === b) return { ok: false, reason: 'Pick two different joints.' }
    if (!pointsById.has(a) || !pointsById.has(b)) return { ok: false, reason: 'Invalid snap.' }
    if (!nodes.has(a) || !nodes.has(b)) return { ok: false, reason: 'Both ends need a joint.' }
    if (edges.length >= PARTS.maxSticks) return { ok: false, reason: 'Out of sticks.' }
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return { ok: false, reason: 'Already connected.' }
    const da = pointsById.get(a).distanceTo(pointsById.get(b))
    if (da > 0.42) return { ok: false, reason: 'Too far apart.' }
    return { ok: true }
  }

  function addEdge(a, b, { taped = Math.random() > 0.55 } = {}) {
    edges.push({ a, b, taped })
  }

  function getNodeIds() {
    return new Set(nodes)
  }

  function getOccupiedSnapIds() {
    return nodes
  }

  function getDegreeMap() {
    const m = new Map()
    for (const id of nodes) m.set(id, 0)
    for (const e of edges) {
      m.set(e.a, (m.get(e.a) ?? 0) + 1)
      m.set(e.b, (m.get(e.b) ?? 0) + 1)
    }
    return m
  }

  function getHighestOccupiedSnapId() {
    let best = null
    let bestY = -Infinity
    for (const id of nodes) {
      const y = pointsById.get(id).y
      if (y > bestY) {
        bestY = y
        best = id
      }
    }
    return best
  }

  function getHeight() {
    let maxY = 0.06
    for (const id of nodes) maxY = Math.max(maxY, pointsById.get(id).y + 0.05)
    if (topSnapId != null) maxY = Math.max(maxY, pointsById.get(topSnapId).y + 0.09)
    return maxY * 100 * 0.42
  }

  return {
    points,
    pointsById,
    edges,
    get topSnapId() {
      return topSnapId
    },
    set topSnapId(v) {
      topSnapId = v
    },
    reset,
    hasNode,
    placeNode,
    canPlaceNode,
    canAddEdge,
    addEdge,
    getNodeIds,
    getOccupiedSnapIds,
    getDegreeMap,
    getHighestOccupiedSnapId,
    getHeight,
  }
}
