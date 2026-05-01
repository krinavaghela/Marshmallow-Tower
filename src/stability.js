function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function countTriangles(placedNodes, connections) {
  const ids = (placedNodes || []).map((n) => n.id).slice().sort((a, b) => a - b)
  const adj = new Map(ids.map((id) => [id, new Set()]))
  for (const c of connections || []) {
    if (c.type !== 'spaghetti') continue
    adj.get(c.a)?.add(c.b)
    adj.get(c.b)?.add(c.a)
  }
  let count = 0
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i]
    const Na = adj.get(a)
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j]
      if (!Na.has(b)) continue
      const Nb = adj.get(b)
      for (const c of Nb) {
        if (c <= b) continue
        if (Na.has(c)) count++
      }
    }
  }
  return count
}

function tapedCount(placedNodes) {
  return (placedNodes || []).filter((n) => n?.taped).length
}

function longStickCount(connections) {
  return (connections || []).filter((c) => c?.type === 'spaghetti' && (c.lengthUnits ?? c.length ?? 0) > 2.8).length
}

/** Max horizontal span between joints (meters) — proxy for base width / footprint */
function footprintSpan(placedNodes) {
  const nodes = placedNodes || []
  if (nodes.length < 2) return 0.35
  let maxD = 0
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].mesh?.position
    if (!a) continue
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j].mesh?.position
      if (!b) continue
      const dx = a.x - b.x
      const dz = a.z - b.z
      maxD = Math.max(maxD, Math.hypot(dx, dz))
    }
  }
  return Math.max(0.2, maxD)
}

function baseCount(placedNodes) {
  if (!placedNodes || placedNodes.length === 0) return 0
  let minY = Infinity
  for (const n of placedNodes) {
    const y = n.mesh?.position?.y ?? n.position?.y ?? 0
    minY = Math.min(minY, y)
  }
  let count = 0
  for (const n of placedNodes) {
    const y = n.mesh?.position?.y ?? n.position?.y ?? 0
    if (Math.abs(y - minY) < 1e-3) count++
  }
  return count
}

function isSingleChain(placedNodes, connections) {
  const ids = (placedNodes || []).map((n) => n.id)
  const deg = new Map(ids.map((id) => [id, 0]))
  for (const c of connections || []) {
    if (c.type !== 'spaghetti') continue
    deg.set(c.a, (deg.get(c.a) || 0) + 1)
    deg.set(c.b, (deg.get(c.b) || 0) + 1)
  }
  const degrees = [...deg.values()]
  const maxDeg = degrees.length ? Math.max(...degrees) : 0
  return maxDeg <= 2
}

export function evaluateStability(placedNodes, connections, crown) {
  // PROBLEM 3 — guard clause for empty towers
  if (!placedNodes || placedNodes.length === 0) {
    return {
      score: 0,
      band: 'COLLAPSE',
      height: 0,
      flavorText: "You haven't built anything yet. Drag some pieces in first.",
    }
  }

  const crownPlaced = crown !== null && crown !== undefined && crown.loaded !== false
  if (!crownPlaced) {
    return {
      score: 0,
      band: 'COLLAPSE',
      height: 0,
      flavorText: "Place the marshmallow on top first. That's literally the whole challenge.",
    }
  }

  // PROBLEM 2 — height measurement (with logging)
  let maxY = 0

  placedNodes.forEach((node) => {
    const y = node.mesh?.position?.y ?? node.position?.y ?? 0
    if (y > maxY) maxY = y
  })

  if (crown && crown.mesh) {
    const crownY = crown.mesh.position?.y ?? 0
    if (crownY > maxY) maxY = crownY
  }

  const heightInCm = parseFloat((maxY * 10).toFixed(1))
  const height = Number.isFinite(heightInCm) ? heightInCm : 0

  const triangles = countTriangles(placedNodes, connections)
  const base = baseCount(placedNodes)
  const taped = tapedCount(placedNodes)
  const longSticks = longStickCount(connections)
  const chainPenalty = isSingleChain(placedNodes, connections) ? 35 : 0
  const footprint = footprintSpan(placedNodes)
  const heightM = maxY
  const slenderness = heightM / Math.max(0.15, footprint)

  let score = 0
  score += Math.min(60, height * 2)
  score += Math.min(45, triangles * 15)
  score += base >= 3 ? 20 : -30
  score += Math.min(35, taped * 5)
  score -= longSticks * 8
  if (triangles === 0) score -= 25
  score -= chainPenalty

  // Structure is loaded (marshmallow on top): extra demand on narrow / weak / long-span frames
  const loadPenalty =
    slenderness * 14 +
    Math.max(0, 4 - taped) * 7 +
    longSticks * 10 +
    (base < 3 ? 18 : 0)
  score -= loadPenalty

  score = Math.round(clamp01(score / 100) * 100)

  let band = 'COLLAPSE'
  let flavorText = 'Spaghetti dreams. Marshmallow nightmare.'
  if (score >= 85) {
    band = 'STANDING'
    flavorText = 'Structure approved. The marshmallow lives.'
  } else if (score >= 65) {
    band = 'WOBBLING'
    flavorText = 'Brave structure. Questionable life choices.'
  } else if (score >= 40) {
    band = 'PARTIAL'
    flavorText = 'The middle section had doubts.'
  }

  return { score, band, height, flavorText }
}

