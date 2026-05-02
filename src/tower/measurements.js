import * as THREE from 'three'

export function measureBaseWidth(towerModel) {
  const occupied = [...towerModel.getOccupiedSnapIds()]
  if (occupied.length < 2) return 0
  const baseY = Math.min(...occupied.map((id) => towerModel.pointsById.get(id).y))
  const onBase = occupied.filter((id) => Math.abs(towerModel.pointsById.get(id).y - baseY) < 0.04)
  if (onBase.length < 2) {
    const pts = onBase.length
      ? onBase
      : occupied.sort((a, b) => towerModel.pointsById.get(a).y - towerModel.pointsById.get(b).y).slice(0, Math.min(4, occupied.length))
    return spanXZ(pts.map((id) => towerModel.pointsById.get(id)))
  }
  return spanXZ(onBase.map((id) => towerModel.pointsById.get(id)))
}

export function measureTopHeavyRatio(towerModel) {
  const occupied = [...towerModel.getOccupiedSnapIds()]
  if (occupied.length === 0) return 1
  let sumY = 0
  let mass = 0
  for (const id of occupied) {
    const p = towerModel.pointsById.get(id)
    sumY += p.y
    mass += 1
  }
  const cy = sumY / mass
  const ys = occupied.map((id) => towerModel.pointsById.get(id).y)
  const maxY = Math.max(...ys)
  const minY = Math.min(...ys)
  const span = Math.max(1e-6, maxY - minY)
  return (cy - minY) / span
}

function spanXZ(points) {
  let max = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = new THREE.Vector2(points[i].x, points[i].z).distanceTo(new THREE.Vector2(points[j].x, points[j].z))
      if (d > max) max = d
    }
  }
  return max
}
