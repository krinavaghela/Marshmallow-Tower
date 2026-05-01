import * as THREE from 'three'

export function createGrid({ size = 10, levels = 7, spacing = 0.48, baseY = 0.06 } = {}) {
  const slots = []
  const half = (size - 1) * 0.5

  for (let y = 0; y < levels; y++) {
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const id = `${x}_${y}_${z}`
        slots.push({
          id,
          x,
          y,
          z,
          position: new THREE.Vector3((x - half) * spacing, baseY + y * (spacing * 0.75), (z - half) * spacing),
        })
      }
    }
  }

  const occupied = new Map() // slotId -> nodeId

  function getNearestSlot(worldPos, radius = 0.5) {
    let best = null
    let bestD = Infinity
    for (const s of slots) {
      const d = s.position.distanceTo(worldPos)
      if (d < radius && d < bestD) {
        bestD = d
        best = s
      }
    }
    return best
  }

  function isOccupied(slotId) {
    return occupied.has(slotId)
  }

  function occupy(slotId, nodeId) {
    occupied.set(slotId, nodeId)
  }

  function vacate(slotId) {
    occupied.delete(slotId)
  }

  function getSlotById(id) {
    return slots.find((s) => s.id === id) || null
  }

  function getSlotAt(ix, iy, iz) {
    return getSlotById(`${ix}_${iy}_${iz}`)
  }

  function worldToGridXZ(worldPos) {
    return { x: worldPos.x, z: worldPos.z }
  }

  return {
    size,
    levels,
    spacing,
    baseY,
    slots,
    occupied,
    getNearestSlot,
    isOccupied,
    occupy,
    vacate,
    getSlotById,
    getSlotAt,
    worldToGridXZ,
  }
}

