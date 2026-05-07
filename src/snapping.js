import { THREE } from './three-deps.js'

export function parseSlotId(slotId) {
  if (typeof slotId !== 'string') return null
  const p = slotId.split('_').map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null
  return { x: p[0], y: p[1], z: p[2] }
}

/**
 * Nearest grid slot to the pointer ray (3D snapping — not ground-projected).
 * @param {*} grid — grid from createGrid()
 * @param {THREE.Ray} ray — world-space ray
 * @param {number} maxPerpDist — max perpendicular distance to ray (meters)
 * @param {number} maxRayT — ignore hits farther along the ray
 */
export function getNearestSlotAlongRay(grid, ray, maxPerpDist = 0.48, maxRayT = 80) {
  const o = ray.origin
  const d = ray.direction
  const dLen = d.length()
  if (dLen < 1e-8) return null
  const inv = 1 / dLen
  const dx = d.x * inv
  const dy = d.y * inv
  const dz = d.z * inv

  let best = null
  let bestPerp = Infinity

  for (const s of grid.slots) {
    const opx = s.position.x - o.x
    const opy = s.position.y - o.y
    const opz = s.position.z - o.z
    const t = opx * dx + opy * dy + opz * dz
    if (t < 0 || t > maxRayT) continue

    const cx = o.x + dx * t
    const cy = o.y + dy * t
    const cz = o.z + dz * t
    const perp = Math.hypot(s.position.x - cx, s.position.y - cy, s.position.z - cz)

    if (perp < maxPerpDist && perp < bestPerp) {
      bestPerp = perp
      best = s
    }
  }

  return best
}

/**
 * Like {@link getNearestSlotAlongRay}, but only considers slots where a joint may be placed
 * (ground tier or supported higher tiers). Prevents “dead clicks” when the raw nearest slot is
 * floating in mid-air without supports.
 */
export function getNearestValidJointSlotAlongRay(grid, ray, maxPerpDist = 0.58, maxRayT = 80) {
  const o = ray.origin
  const d = ray.direction
  const dLen = d.length()
  if (dLen < 1e-8) return null
  const inv = 1 / dLen
  const dx = d.x * inv
  const dy = d.y * inv
  const dz = d.z * inv

  let best = null
  let bestPerp = Infinity

  for (const s of grid.slots) {
    const opx = s.position.x - o.x
    const opy = s.position.y - o.y
    const opz = s.position.z - o.z
    const t = opx * dx + opy * dy + opz * dz
    if (t < 0 || t > maxRayT) continue

    const cx = o.x + dx * t
    const cy = o.y + dy * t
    const cz = o.z + dz * t
    const perp = Math.hypot(s.position.x - cx, s.position.y - cy, s.position.z - cz)

    if (perp >= maxPerpDist) continue
    if (!isValidJointPlacement(grid, s)) continue
    if (perp < bestPerp) {
      bestPerp = perp
      best = s
    }
  }

  return best
}

/** Count occupied joints on the level below in (x,z) and 4-neighbors (same y-1). */
export function countSupportsBelow(grid, slot) {
  if (slot.y <= 0) return 2
  const yb = slot.y - 1
  const offsets = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let n = 0
  for (const [dx, dz] of offsets) {
    const id = `${slot.x + dx}_${yb}_${slot.z + dz}`
    if (grid.isOccupied(id)) n++
  }
  return n
}

/**
 * Joint placement rules: y=0 ground, or y>0 with ≥2 supporting joints on y-1 under neighborhood.
 */
export function isValidJointPlacement(grid, slot) {
  if (!slot) return false
  if (grid.isOccupied(slot.id)) return false
  if (slot.y === 0) return true
  return countSupportsBelow(grid, slot) >= 2
}

/** Nearest grid cell to a world position, clamped to the build volume. */
export function worldToNearestClampedSlot(grid, worldPos) {
  const half = (grid.size - 1) * 0.5
  const sh = grid.spacing * 0.75
  let ix = Math.round(worldPos.x / grid.spacing + half)
  let iy = Math.round((worldPos.y - grid.baseY) / sh)
  let iz = Math.round(worldPos.z / grid.spacing + half)
  ix = THREE.MathUtils.clamp(ix, 0, grid.size - 1)
  iy = THREE.MathUtils.clamp(iy, 0, grid.levels - 1)
  iz = THREE.MathUtils.clamp(iz, 0, grid.size - 1)
  return grid.getSlotAt(ix, iy, iz)
}

/** Supports at y-1 using a custom occupancy predicate (slotId -> boolean). */
export function countSupportsBelowWithOcc(slot, isOccupiedAt) {
  if (!slot || slot.y <= 0) return 2
  const yb = slot.y - 1
  const offsets = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let n = 0
  for (const [dx, dz] of offsets) {
    const id = `${slot.x + dx}_${yb}_${slot.z + dz}`
    if (isOccupiedAt(id)) n++
  }
  return n
}

/**
 * Validate a whole moved structure: unique slots, no collision with static nodes,
 * bottom tier has ≥2 joints each meeting support rule (y=0 or ≥2 neighbors on y-1).
 */
export function validateMovedStructureSlots(grid, movingNodeIds, slotByNodeId) {
  const moving = new Set(movingNodeIds)
  const usedSlots = new Set()

  for (const nid of movingNodeIds) {
    const s = slotByNodeId.get(nid)
    if (!s) return { valid: false }
    if (usedSlots.has(s.id)) return { valid: false }
    usedSlots.add(s.id)
    const owner = grid.occupied.get(s.id)
    if (owner != null && !moving.has(owner)) return { valid: false }
  }

  const tentativeOwner = new Map()
  for (const nid of movingNodeIds) {
    const s = slotByNodeId.get(nid)
    tentativeOwner.set(s.id, nid)
  }

  const isOccupiedForSupport = (slotId) => {
    if (tentativeOwner.has(slotId)) return true
    const owner = grid.occupied.get(slotId)
    if (owner != null && !moving.has(owner)) return true
    return false
  }

  const minY = Math.min(...[...slotByNodeId.values()].map((s) => s.y))
  const bottomIds = movingNodeIds.filter((nid) => slotByNodeId.get(nid)?.y === minY)
  if (bottomIds.length === 0) return { valid: false }

  const bottomOk = (nid) => {
    const slot = slotByNodeId.get(nid)
    if (slot.y === 0) return true
    return countSupportsBelowWithOcc(slot, isOccupiedForSupport) >= 2
  }

  let supportedBottom = 0
  for (const nid of bottomIds) {
    if (bottomOk(nid)) supportedBottom++
  }

  if (bottomIds.length >= 2) {
    if (supportedBottom < 2) return { valid: false }
  } else if (!bottomOk(bottomIds[0])) {
    return { valid: false }
  }

  return { valid: true }
}

/**
 * World Y for the lowest tier of a dragged structure when hovering column (ix, iz).
 * Uses live mesh positions (grid.occupied is stale until drop). Returns `null` when the column only
 * contains joints from the moving set — caller should keep the rigid body's current height (no sink).
 *
 * @param {{ id: number, mesh: import('three').Object3D }[]} placedNodes
 * @returns {number | null} slot center Y, or null = preserve vertical offset
 */
export function getStackTargetBottomWorldY(grid, ix, iz, movingIds, placedNodes) {
  const moving = new Set(movingIds)
  const half = (grid.size - 1) * 0.5
  const sh = grid.spacing * 0.75
  let maxStaticIdx = -1
  let maxMovingIdx = -1
  for (const n of placedNodes) {
    const p = n.mesh.position
    const pix = THREE.MathUtils.clamp(Math.round(p.x / grid.spacing + half), 0, grid.size - 1)
    const piz = THREE.MathUtils.clamp(Math.round(p.z / grid.spacing + half), 0, grid.size - 1)
    if (pix !== ix || piz !== iz) continue
    const iy = Math.round((p.y - grid.baseY) / sh)
    const clamped = THREE.MathUtils.clamp(iy, 0, grid.levels - 1)
    if (moving.has(n.id)) maxMovingIdx = Math.max(maxMovingIdx, clamped)
    else maxStaticIdx = Math.max(maxStaticIdx, clamped)
  }

  if (maxStaticIdx >= 0) {
    const nextY = Math.min(maxStaticIdx + 1, grid.levels - 1)
    const slot = grid.getSlotAt(ix, nextY, iz)
    return slot ? slot.position.y : grid.baseY
  }
  if (maxMovingIdx >= 0) return null
  const slot0 = grid.getSlotAt(ix, 0, iz)
  return slot0 ? slot0.position.y : grid.baseY
}
