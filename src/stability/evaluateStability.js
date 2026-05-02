import { STABILITY } from '../app/constants.js'
import { measureBaseWidth, measureTopHeavyRatio } from '../tower/measurements.js'
import { countTriangles } from './triangles.js'

export function evaluateStability(towerModel) {
  if (towerModel.edges.length === 0 || towerModel.getNodeIds().size === 0) {
    return {
      outcome: 'fall',
      primaryReason: 'Need at least one stick and a joint.',
      weakSnapId: null,
    }
  }

  const baseWidth = measureBaseWidth(towerModel)
  const edges = towerModel.edges.length
  const topHeavyRatio = measureTopHeavyRatio(towerModel)
  const triangles = countTriangles(towerModel)
  const tapedEdges = towerModel.edges.filter((e) => e.taped).length

  const deg = towerModel.getDegreeMap()
  const topId = towerModel.topSnapId
  const effectiveTopId = topId ?? towerModel.getHighestOccupiedSnapId()

  if (baseWidth < STABILITY.minBaseSpread && edges < 4) {
    return {
      outcome: 'fall',
      primaryReason: 'Base is too narrow.',
      weakSnapId: pickLowestDegreeOnBase(towerModel, deg),
    }
  }

  if (edges < STABILITY.minEdgesForTest) {
    return {
      outcome: 'wobble',
      primaryReason: 'Barely connected.',
      weakSnapId: pickLowestDegreeNode(towerModel, deg),
    }
  }

  if (topHeavyRatio > STABILITY.topHeavyWarn && triangles < 2) {
    return {
      outcome: 'fall',
      primaryReason: 'Too top-heavy.',
      weakSnapId: effectiveTopId ?? pickLowestDegreeNode(towerModel, deg),
    }
  }

  if (triangles >= 3 || tapedEdges >= 2 || baseWidth > STABILITY.minBaseSpread * 2) {
    return {
      outcome: 'stand',
      primaryReason: 'Solid structure.',
      weakSnapId: null,
    }
  }

  if (topHeavyRatio > 0.72 || baseWidth < STABILITY.minBaseSpread * 1.2) {
    return {
      outcome: 'wobble',
      primaryReason: 'On the edge…',
      weakSnapId: pickLowestDegreeNode(towerModel, deg),
    }
  }

  return {
    outcome: 'stand',
    primaryReason: 'Holds.',
    weakSnapId: null,
  }
}

function pickLowestDegreeNode(towerModel, deg) {
  let best = null
  let bestD = Infinity
  for (const id of towerModel.getOccupiedSnapIds()) {
    const d = deg.get(id) ?? 0
    if (d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}

function pickLowestDegreeOnBase(towerModel, deg) {
  const occupied = [...towerModel.getOccupiedSnapIds()]
  if (occupied.length === 0) return pickLowestDegreeNode(towerModel, deg)
  const baseY = Math.min(...occupied.map((id) => towerModel.pointsById.get(id).y))
  const base = occupied.filter((id) => {
    const p = towerModel.pointsById.get(id)
    return Math.abs(p.y - baseY) < 0.05
  })
  if (base.length === 0) return pickLowestDegreeNode(towerModel, deg)
  let best = base[0]
  let bestD = deg.get(best) ?? 0
  for (const id of base) {
    const d = deg.get(id) ?? 0
    if (d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}
