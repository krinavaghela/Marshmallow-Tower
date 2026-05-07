import { THREE } from './three-deps.js'
import { buildJoint, buildBigMarshmallow, buildTapeWrap, getCrownOffsetY } from './materials.js'
import { getConnectedStructure } from './connections.js'
import { createShiftKeyTracker } from './input.js'
import {
  getNearestValidJointSlotAlongRay,
  getStackTargetBottomWorldY,
  isValidJointPlacement,
  parseSlotId,
  worldToNearestClampedSlot,
  validateMovedStructureSlots,
} from './snapping.js'

const UNIT_TO_CM = 10
const CLICK_DRAG_THRESHOLD_PX = 10

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function tubeBetween(a, b, { radius = 0.01, sag = 0.0, segments = 24 } = {}) {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const p0 = a.clone()
  const p1 = mid.clone()
  const p2 = b.clone()
  p1.y -= sag
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2)
  const geo = new THREE.TubeGeometry(curve, segments, radius, 10, false)
  return geo
}

function cloneEmissiveMaterials(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => (m?.clone ? m.clone() : m))
    } else if (o.material?.clone) {
      o.material = o.material.clone()
    }
    if (o.material && 'emissive' in o.material) {
      o.material.emissive = new THREE.Color(0x000000)
      o.material.emissiveIntensity = 0
    }
  })
}

export function createBuilder({
  scene,
  camera,
  renderer,
  root,
  mats,
  grid,
  inventory,
  audio = null,
  onHint = () => {},
  onChange = () => {},
  history = null,
  /** When set, orbit rotation is turned off while a build tool is active so left-click places reliably. */
  controls = null,
  /** Fired after every tool change (including `null` when clearing). Use for HUD hints. */
  onActiveToolChange = null,
}) {
  if (!scene || !camera || !renderer || !root || !mats || !grid || !inventory) {
    throw new Error('createBuilder: missing required args.')
  }

  const canvas = renderer.domElement
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  const nodesGroup = new THREE.Group()
  const edgesGroup = new THREE.Group()
  const wrapsGroup = new THREE.Group()
  const crownGroup = new THREE.Group()
  root.add(nodesGroup, edgesGroup, wrapsGroup, crownGroup)

  // Invisible ground plane for reliable raycasts (at grid baseY).
  const groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  )
  groundPlane.rotation.x = -Math.PI / 2
  groundPlane.position.y = grid.baseY
  scene.add(groundPlane)

  const state = {
    activeTool: null, // 'joint' | 'spaghetti' | 'string' | 'tape' | 'crown'
    sourceNodeId: null,
    crownPlaced: false,
  }

  const nodes = [] // joints only — { id, slotId, mesh, taped, wrapMesh }
  const edges = [] // { id, type, aId, bId, mesh, lengthUnits }
  const crown = { placed: false, anchorJointId: null, mesh: null, obj: null, loaded: false }
  let crownSquash = null // { t0, dur }

  // Ghost previews
  const ghostNode = buildJoint(mats)
  ghostNode.traverse((o) => {
    if (o.isMesh && o.material?.clone) o.material = o.material.clone()
  })
  const ghostCrown = buildBigMarshmallow(mats)
  ghostCrown.traverse((o) => {
    if (o.isMesh && o.material?.clone) o.material = o.material.clone()
  })
  const ghostLine = new THREE.Mesh(mats.geometries.spaghettiUnit, mats.materials.ghost)
  ghostNode.visible = false
  ghostCrown.visible = false
  ghostLine.visible = false
  ghostNode.traverse((o) => (o.castShadow = false))
  ghostCrown.traverse((o) => (o.castShadow = false))
  ghostLine.castShadow = false
  root.add(ghostNode, ghostCrown, ghostLine)

  let pointerDown = null // { x, y, dragged }
  let histSuspend = 0
  function runWithoutHistory(fn) {
    histSuspend++
    try {
      return fn()
    } finally {
      histSuspend--
    }
  }
  function recordAction(action) {
    if (!history || histSuspend > 0) return
    history.push(action)
  }

  function nextNodeId() {
    return nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1
  }

  function nextEdgeId() {
    return edges.reduce((m, e) => Math.max(m, e.id), 0) + 1
  }

  let structureDrag = null
  let hoveredStructureIds = /** @type {Set<number> | null} */ (null)
  const _dragTmp = new THREE.Vector3()
  const _anchorProp = new THREE.Vector3()
  const shiftKeys = createShiftKeyTracker()
  let selectedNodeId = /** @type {number | null} */ (null)

  function getMouseNDC(e) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    }
  }

  function setRayFromEvent(e) {
    const ndc = getMouseNDC(e)
    mouse.x = ndc.x
    mouse.y = ndc.y
    raycaster.setFromCamera(mouse, camera)
  }

  function intersectGround(e) {
    setRayFromEvent(e)
    const hits = raycaster.intersectObject(groundPlane, false)
    return hits.length ? hits[0].point : null
  }

  function pickNodeId(e) {
    setRayFromEvent(e)
    const hits = raycaster.intersectObjects(nodesGroup.children, true)
    for (const h of hits) {
      const id = h.object?.userData?.nodeId
      if (typeof id === 'number') return id
    }
    return null
  }

  function getNodeById(id) {
    return nodes.find((n) => n.id === id) || null
  }

  function removeCrownOnly() {
    if (!crown.placed || !crown.mesh) return
    crownGroup.remove(crown.mesh)
    crown.mesh = null
    crown.obj = null
    crown.placed = false
    crown.anchorJointId = null
    crown.loaded = false
    state.crownPlaced = false
    crownSquash = null
    inventory.refundCrown()
  }

  function endpointsMatch(e, aId, bId) {
    return (e.aId === aId && e.bId === bId) || (e.aId === bId && e.bId === aId)
  }

  function removeEdgeById(edgeId) {
    const i = edges.findIndex((e) => e.id === edgeId)
    if (i < 0) return
    const e = edges[i]
    edgesGroup.remove(e.mesh)
    e.mesh.geometry.dispose()
    edges.splice(i, 1)
    if (e.type === 'spaghetti') inventory.refundSpaghetti(1)
    else if (e.type === 'string') inventory.refundStringSegment()
    onChange()
  }

  function removeEdgeBetween(aId, bId, type) {
    const i = edges.findIndex((e) => e.type === type && endpointsMatch(e, aId, bId))
    if (i < 0) return
    const e = edges[i]
    edgesGroup.remove(e.mesh)
    e.mesh.geometry.dispose()
    edges.splice(i, 1)
    if (e.type === 'spaghetti') inventory.refundSpaghetti(1)
    else if (e.type === 'string') inventory.refundStringSegment()
    onChange()
  }

  function removeJointForUndo(nodeId) {
    if (crown.placed && crown.anchorJointId === nodeId) {
      removeCrownOnly()
    }
    const incidentIds = edges.filter((e) => e.aId === nodeId || e.bId === nodeId).map((e) => e.id)
    for (const eid of incidentIds) {
      removeEdgeById(eid)
    }
    const idx = nodes.findIndex((n) => n.id === nodeId)
    if (idx < 0) return
    const n = nodes[idx]
    if (n.wrapMesh) {
      wrapsGroup.remove(n.wrapMesh)
      n.wrapMesh = null
    }
    n.taped = false
    grid.vacate(n.slotId)
    nodesGroup.remove(n.mesh)
    nodes.splice(idx, 1)
    inventory.refundJoint(1)
    onChange()
  }

  function redoPlaceJoint(slotId, nodeId) {
    const slot = grid.getSlotById(slotId)
    if (!slot || !inventory.useJoint(1)) return
    const mesh = buildJoint(mats)
    cloneEmissiveMaterials(mesh)
    mesh.position.copy(slot.position)
    mesh.userData.nodeId = nodeId
    mesh.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      o.userData.nodeId = nodeId
    })
    nodesGroup.add(mesh)
    nodes.push({ id: nodeId, slotId: slot.id, mesh, obj: mesh, taped: false, wrapMesh: null })
    grid.occupy(slot.id, nodeId)
    onChange()
  }

  function stripTape(nodeId) {
    const n = getNodeById(nodeId)
    if (!n || !n.taped) return
    n.taped = false
    if (n.wrapMesh) {
      wrapsGroup.remove(n.wrapMesh)
      n.wrapMesh = null
    }
    inventory.refundTapeInches(2)
    onChange()
  }

  function reapplyTape(nodeId) {
    const n = getNodeById(nodeId)
    if (!n || n.taped) return
    if (!inventory.useTapeInches(2)) return
    n.taped = true
    const wrap = buildTapeWrap(mats)
    wrap.position.copy(n.mesh.position)
    wrap.position.y += 0.06
    wrap.rotation.y = (n.id * 0.93) % (Math.PI * 2)
    wrapsGroup.add(wrap)
    n.wrapMesh = wrap
    onChange()
  }

  function restoreCrownAt(anchorJointId) {
    const node = getNodeById(anchorJointId)
    if (!node || crown.placed) return
    if (!inventory.useCrown()) return
    const mesh = buildBigMarshmallow(mats)
    mesh.position.copy(node.mesh.position)
    mesh.position.y += mesh.userData?.crownOffsetY ?? getCrownOffsetY()
    mesh.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
    })
    crownGroup.add(mesh)
    crown.placed = true
    crown.anchorJointId = anchorJointId
    crown.mesh = mesh
    crown.obj = mesh
    crown.loaded = true
    state.crownPlaced = true
    crownSquash = { t0: performance.now() / 1000, dur: 0.2 }
    onChange()
  }

  function connectNodesInternal(a, b, type) {
    if (!a || !b || a.id === b.id) return false
    const dist = a.mesh.position.distanceTo(b.mesh.position)

    if (type === 'spaghetti') {
      if (dist > 3) {
        audio?.playInvalidAction?.()
        return false
      }
      if (!inventory.useSpaghetti(1)) {
        audio?.playInvalidAction?.()
        return false
      }
      const sag = Math.max(0, dist - 2.2) * 0.06
      const geo = tubeBetween(a.mesh.position, b.mesh.position, { radius: 0.012, sag, segments: 28 })
      const mesh = new THREE.Mesh(geo, mats.materials.spaghetti)
      mesh.castShadow = true
      edgesGroup.add(mesh)
      edges.push({ id: nextEdgeId(), type: 'spaghetti', aId: a.id, bId: b.id, mesh, lengthUnits: dist })
      audio?.playSpaghettiSnap?.()
      onChange()
      return true
    }

    if (type === 'string') {
      if (dist > 1.5) {
        audio?.playInvalidAction?.()
        return false
      }
      if (!inventory.useStringSegment()) {
        audio?.playInvalidAction?.()
        return false
      }
      const sag = 0.12 + dist * 0.04
      const geo = tubeBetween(a.mesh.position, b.mesh.position, { radius: 0.006, sag, segments: 22 })
      const mesh = new THREE.Mesh(geo, mats.materials.string)
      mesh.castShadow = false
      edgesGroup.add(mesh)
      edges.push({ id: nextEdgeId(), type: 'string', aId: a.id, bId: b.id, mesh, lengthUnits: dist })
      audio?.playStringTwang?.()
      onChange()
      return true
    }

    return false
  }

  function restoreConnect(aId, bId, type) {
    const a = getNodeById(aId)
    const b = getNodeById(bId)
    if (!a || !b) return
    connectNodesInternal(a, b, type)
  }

  function applyStructureMoveUndo(startSlotIds, idsSet) {
    for (const nid of idsSet) {
      const n = getNodeById(nid)
      if (!n) continue
      grid.vacate(n.slotId)
      const sid = startSlotIds.get(nid)
      n.slotId = sid
      grid.occupy(sid, nid)
      const slot = grid.getSlotById(sid)
      if (slot) n.mesh.position.copy(slot.position)
    }
    syncTapeForNodeSet(idsSet)
    syncAllEdgeMeshes()
    if (crown.placed && crown.anchorJointId != null && idsSet.has(crown.anchorJointId)) {
      positionCrownFromAnchor(getNodeById(crown.anchorJointId))
    }
    onChange()
  }

  function applyStructureMoveRedo(endSlotByNodeId, idsSet) {
    for (const nid of idsSet) {
      const n = getNodeById(nid)
      const slot = endSlotByNodeId.get(nid)
      if (!n || !slot) continue
      grid.vacate(n.slotId)
      n.slotId = slot.id
      grid.occupy(slot.id, nid)
      n.mesh.position.copy(slot.position)
    }
    syncTapeForNodeSet(idsSet)
    syncAllEdgeMeshes()
    if (crown.placed && crown.anchorJointId != null && idsSet.has(crown.anchorJointId)) {
      positionCrownFromAnchor(getNodeById(crown.anchorJointId))
    }
    onChange()
  }

  function setNodeHighlight(id, on) {
    const n = getNodeById(id)
    if (!n) return
    n.mesh.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material
      if (!m || !('emissive' in m)) return
      m.emissive.setHex(on ? 0xC17B5A : 0x000000)
      m.emissiveIntensity = on ? 0.35 : 0
      m.needsUpdate = true
    })
  }

  function setNodeSelectionHighlight(id, on) {
    const n = getNodeById(id)
    if (!n) return
    n.mesh.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material
      if (!m || !('emissive' in m)) return
      m.emissive.setHex(on ? 0x5599cc : 0x000000)
      m.emissiveIntensity = on ? 0.32 : 0
      m.needsUpdate = true
    })
  }

  function clearNodeSelection() {
    if (selectedNodeId == null) return
    setNodeSelectionHighlight(selectedNodeId, false)
    selectedNodeId = null
  }

  function beginGhostDragForStructure(ids) {
    const backups = []
    for (const nid of ids) {
      const n = getNodeById(nid)
      if (!n) continue
      n.mesh.traverse((o) => {
        if (!o.isMesh || !o.material) return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          backups.push({
            m,
            transparent: m.transparent,
            opacity: m.opacity,
            depthWrite: m.depthWrite,
          })
          m.transparent = true
          m.opacity = Math.min(0.9, (m.opacity ?? 1) * 0.78)
          m.depthWrite = false
          m.needsUpdate = true
        }
      })
    }
    return backups
  }

  function restoreGhostDragForStructure(backups) {
    if (!backups?.length) return
    for (const b of backups) {
      b.m.transparent = b.transparent
      b.m.opacity = b.opacity
      b.m.depthWrite = b.depthWrite
      b.m.needsUpdate = true
    }
  }

  function syncOrbitWithTool() {
    if (!controls) return
    // OrbitControls calls setPointerCapture on pointerdown *before* it knows rotation is disabled.
    // That still interferes with placement. Turn controls off entirely while a tool is active.
    const building = Boolean(state.activeTool)
    controls.enabled = !building
    if (!building) {
      controls.enableRotate = true
      controls.enablePan = true
      controls.enableZoom = true
    }
  }

  function setTool(tool) {
    clearNodeSelection()
    state.activeTool = tool
    if (state.sourceNodeId != null) setNodeHighlight(state.sourceNodeId, false)
    state.sourceNodeId = null
    canvas.style.cursor = tool ? 'crosshair' : 'default'
    ghostLine.visible = false
    ghostNode.visible = tool === 'joint'
    ghostCrown.visible = tool === 'crown'
    syncOrbitWithTool()
    onChange()
    onActiveToolChange?.(tool)
  }

  function cancelToolSelection() {
    setTool(null)
    ghostNode.visible = false
    ghostCrown.visible = false
    ghostLine.visible = false
    canvas.style.cursor = 'default'
    onChange()
  }

  function placeNodeAtSlot(slot) {
    if (!slot) return false
    if (!isValidJointPlacement(grid, slot)) {
      audio?.playInvalidAction?.()
      return false
    }
    if (!inventory.useJoint(1)) {
      audio?.playInvalidAction?.()
      return false
    }

    const mesh = buildJoint(mats)
    cloneEmissiveMaterials(mesh)
    mesh.position.copy(slot.position)
    const id = nextNodeId()
    mesh.userData.nodeId = id
    mesh.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      o.userData.nodeId = id
    })
    nodesGroup.add(mesh)

    nodes.push({ id, slotId: slot.id, mesh, obj: mesh, taped: false, wrapMesh: null })
    grid.occupy(slot.id, id)
    audio?.playJointPlace?.()
    const capturedSlotId = slot.id
    const nodeId = id
    recordAction({
      type: 'ADD_NODE',
      undo: () => runWithoutHistory(() => removeJointForUndo(nodeId)),
      redo: () => runWithoutHistory(() => redoPlaceJoint(capturedSlotId, nodeId)),
    })
    onChange()
    return true
  }

  function getHighestJoint() {
    if (!nodes.length) return null
    return nodes.reduce((best, cur) => (cur.mesh.position.y > best.mesh.position.y ? cur : best), nodes[0])
  }

  function placeCrownOnNode(node) {
    if (!node) return false
    if (crown.placed) return false
    if (!inventory.useCrown()) {
      audio?.playInvalidAction?.()
      return false
    }

    const mesh = buildBigMarshmallow(mats)
    mesh.position.copy(node.mesh.position)
    mesh.position.y += mesh.userData?.crownOffsetY ?? getCrownOffsetY()
    mesh.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
    })
    crownGroup.add(mesh)

    crown.placed = true
    crown.anchorJointId = node.id
    crown.mesh = mesh
    crown.obj = mesh
    crown.loaded = true
    state.crownPlaced = true
    crownSquash = { t0: performance.now() / 1000, dur: 0.2 }
    audio?.playCrownPlace?.()
    const anchorId = node.id
    recordAction({
      type: 'PLACE_MARSHMALLOW',
      undo: () => runWithoutHistory(() => removeCrownOnly()),
      redo: () => runWithoutHistory(() => restoreCrownAt(anchorId)),
    })
    onChange()
    return true
  }

  function applyTapeToNode(node) {
    if (!node || node.taped) return false
    if (!inventory.useTapeInches(2)) {
      audio?.playInvalidAction?.()
      return false
    }
    node.taped = true
    const wrap = buildTapeWrap(mats)
    wrap.position.copy(node.mesh.position)
    wrap.position.y += 0.06
    wrap.rotation.y = (node.id * 0.93) % (Math.PI * 2)
    wrapsGroup.add(wrap)
    node.wrapMesh = wrap
    audio?.playTapeApply?.()
    const tapedNodeId = node.id
    recordAction({
      type: 'TAPE',
      undo: () => runWithoutHistory(() => stripTape(tapedNodeId)),
      redo: () => runWithoutHistory(() => reapplyTape(tapedNodeId)),
    })
    onChange()
    return true
  }

  function connectNodes(a, b, type) {
    if (!connectNodesInternal(a, b, type)) return false
    const edge = edges[edges.length - 1]
    const snap = { type: edge.type, aId: edge.aId, bId: edge.bId }
    recordAction({
      type: 'CONNECT',
      undo: () => runWithoutHistory(() => removeEdgeBetween(snap.aId, snap.bId, snap.type)),
      redo: () => runWithoutHistory(() => restoreConnect(snap.aId, snap.bId, snap.type)),
    })
    return true
  }

  function syncEdgeMesh(edge) {
    const a = getNodeById(edge.aId)
    const b = getNodeById(edge.bId)
    if (!a || !b) return
    edge.mesh.geometry?.dispose?.()
    const dist = a.mesh.position.distanceTo(b.mesh.position)
    const sag = edge.type === 'string' ? 0.12 + dist * 0.04 : Math.max(0, dist - 2.2) * 0.06
    const radius = edge.type === 'string' ? 0.006 : 0.012
    edge.mesh.geometry = tubeBetween(a.mesh.position, b.mesh.position, { radius, sag, segments: 28 })
    edge.lengthUnits = dist
  }

  function syncAllEdgeMeshes() {
    for (const edge of edges) syncEdgeMesh(edge)
  }

  function syncTapeForNodeSet(ids) {
    const set = new Set(ids)
    for (const n of nodes) {
      if (!set.has(n.id) || !n.wrapMesh) continue
      n.wrapMesh.position.copy(n.mesh.position)
      n.wrapMesh.position.y += 0.06
    }
  }

  function positionCrownFromAnchor(anchorNode) {
    if (!crown.placed || !crown.mesh || !anchorNode) return
    crown.mesh.position.copy(anchorNode.mesh.position)
    crown.mesh.position.y += crown.mesh.userData?.crownOffsetY ?? getCrownOffsetY()
  }

  function setComponentEmissive(ids, colorHex, intensity) {
    for (const id of ids) {
      const n = getNodeById(id)
      if (!n) continue
      n.mesh.traverse((o) => {
        if (!o.isMesh || !o.material || !('emissive' in o.material)) return
        o.material.emissive.setHex(colorHex)
        o.material.emissiveIntensity = intensity
      })
    }
  }

  function clearStructureHover() {
    if (!hoveredStructureIds) return
    setComponentEmissive(hoveredStructureIds, 0x000000, 0)
    hoveredStructureIds = null
  }

  function updateStructureHover(e) {
    const shiftOn = e.shiftKey || shiftKeys.isShiftDown()
    if (structureDrag || state.activeTool || !shiftOn) {
      clearStructureHover()
      return
    }
    const id = pickNodeId(e)
    if (id == null) {
      clearStructureHover()
      return
    }
    const comp = getConnectedStructure(id, edges)
    const next = new Set(comp.nodes ?? comp.nodeIds)
    if (
      hoveredStructureIds &&
      next.size === hoveredStructureIds.size &&
      [...next].every((x) => hoveredStructureIds.has(x))
    ) {
      return
    }
    clearStructureHover()
    hoveredStructureIds = next
    setComponentEmissive(hoveredStructureIds, 0x4a6a9e, 0.1)
  }

  function buildStructureBoxHelper(ids) {
    const box = new THREE.Box3()
    for (const nid of ids) {
      const n = getNodeById(nid)
      if (n) box.expandByObject(n.mesh)
    }
    if (!box.isEmpty()) box.expandByScalar(0.04)
    const helper = new THREE.Box3Helper(box, 0xc17b5a)
    root.add(helper)
    return helper
  }

  function beginStructureDrag(anchorId, e) {
    clearNodeSelection()
    clearStructureHover()
    const comp = getConnectedStructure(anchorId, edges)
    const ids = new Set(comp.nodes ?? comp.nodeIds)
    const startPos = new Map()
    for (const nid of ids) {
      const n = getNodeById(nid)
      startPos.set(nid, n.mesh.position.clone())
    }
    const anchor = getNodeById(anchorId)
    const a0 = parseSlotId(anchor.slotId)
    if (!a0) return
    setRayFromEvent(e)
    const g = intersectGround(e)
    const grabX = g?.x ?? anchor.mesh.position.x
    const grabZ = g?.z ?? anchor.mesh.position.z

    const startSlots = new Map()
    for (const nid of ids) {
      startSlots.set(nid, getNodeById(nid).slotId)
    }

    structureDrag = {
      ids,
      anchorId,
      startPos,
      startSlots,
      a0: { x: a0.x, y: a0.y, z: a0.z },
      grabX,
      grabZ,
      box: buildStructureBoxHelper(ids),
      pendingSlots: null,
      ghostBackups: beginGhostDragForStructure(ids),
    }
    setComponentEmissive(ids, 0xc17b5a, 0.18)
    canvas.style.cursor = 'grabbing'
    audio?.playSpaghettiHover?.()
  }

  /** Rigid XZ from ground grab point + vertical lift so lowest joint matches stack surface under cursor (no hardcoded Y offsets). */
  function computeDragSlotDelta(e) {
    if (!structureDrag) return null
    const hit = intersectGround(e)
    if (!hit) return null

    const dx = hit.x - structureDrag.grabX
    const dz = hit.z - structureDrag.grabZ

    let minY = Infinity
    for (const nid of structureDrag.ids) {
      const p = structureDrag.startPos.get(nid)
      if (p) minY = Math.min(minY, p.y)
    }
    if (!Number.isFinite(minY)) return null

    const refSlot = worldToNearestClampedSlot(grid, new THREE.Vector3(hit.x, grid.baseY, hit.z))
    if (!refSlot) return null

    const rawTarget = getStackTargetBottomWorldY(grid, refSlot.x, refSlot.z, structureDrag.ids, nodes)
    const targetY = rawTarget == null ? minY : rawTarget
    const offsetY = targetY - minY

    const sp0 = structureDrag.startPos.get(structureDrag.anchorId)
    if (!sp0) return null

    _anchorProp.copy(sp0)
    _anchorProp.x += dx
    _anchorProp.z += dz
    _anchorProp.y += offsetY

    const anchorSlot = worldToNearestClampedSlot(grid, _anchorProp)
    const a0 = structureDrag.a0
    if (!anchorSlot || !a0) return null

    return {
      dIx: anchorSlot.x - a0.x,
      dIy: anchorSlot.y - a0.y,
      dIz: anchorSlot.z - a0.z,
    }
  }

  function tryApplyStructureDelta(dIx, dIy, dIz) {
    if (!structureDrag) return { valid: false, slotByNodeId: null }
    const slotByNodeId = new Map()
    const moving = [...structureDrag.ids]
    for (const nid of moving) {
      const n = getNodeById(nid)
      const p0 = parseSlotId(n.slotId)
      if (!p0) return { valid: false, slotByNodeId: null }
      const nx = p0.x + dIx
      const ny = p0.y + dIy
      const nz = p0.z + dIz
      if (nx < 0 || nx >= grid.size || ny < 0 || ny >= grid.levels || nz < 0 || nz >= grid.size) {
        return { valid: false, slotByNodeId: null }
      }
      const slot = grid.getSlotAt(nx, ny, nz)
      if (!slot) return { valid: false, slotByNodeId: null }
      slotByNodeId.set(nid, slot)
    }
    const v = validateMovedStructureSlots(grid, moving, slotByNodeId)
    return { valid: v.valid, slotByNodeId }
  }

  function applySlotPositions(slotByNodeId, ids, boxHelper) {
    const boxRef = boxHelper ?? structureDrag?.box
    for (const [nid, slot] of slotByNodeId) {
      const n = getNodeById(nid)
      if (n) n.mesh.position.copy(slot.position)
    }
    syncTapeForNodeSet(ids)
    syncAllEdgeMeshes()
    if (crown.placed && crown.anchorJointId != null && ids.has(crown.anchorJointId)) {
      positionCrownFromAnchor(getNodeById(crown.anchorJointId))
    }
    if (boxRef) {
      const b = new THREE.Box3()
      for (const nid of ids) {
        const n = getNodeById(nid)
        if (n) b.expandByObject(n.mesh)
      }
      if (!b.isEmpty()) b.expandByScalar(0.04)
      boxRef.box.copy(b)
    }
  }

  function restoreStructureStartPositions(drag) {
    for (const [nid, pos] of drag.startPos) {
      const n = getNodeById(nid)
      if (n) n.mesh.position.copy(pos)
    }
    syncTapeForNodeSet(drag.ids)
    syncAllEdgeMeshes()
    if (crown.placed && crown.anchorJointId != null && drag.ids.has(crown.anchorJointId)) {
      positionCrownFromAnchor(getNodeById(crown.anchorJointId))
    }
    if (drag.box) {
      const b = new THREE.Box3()
      for (const nid of drag.ids) {
        const n = getNodeById(nid)
        if (n) b.expandByObject(n.mesh)
      }
      if (!b.isEmpty()) b.expandByScalar(0.04)
      drag.box.box.copy(b)
    }
  }

  function commitStructureSlots(drag, slotByNodeId) {
    for (const nid of drag.ids) {
      const n = getNodeById(nid)
      const old = n.slotId
      const slot = slotByNodeId.get(nid)
      grid.vacate(old)
      n.slotId = slot.id
      grid.occupy(slot.id, nid)
    }
  }

  function updateStructureDrag(e) {
    if (!structureDrag) return
    const delta = computeDragSlotDelta(e)
    if (!delta) return
    const { valid, slotByNodeId } = tryApplyStructureDelta(delta.dIx, delta.dIy, delta.dIz)
    if (!slotByNodeId) return

    if (valid) {
      structureDrag.pendingSlots = new Map(slotByNodeId)
      applySlotPositions(slotByNodeId, structureDrag.ids)
      setComponentEmissive(structureDrag.ids, 0x1a4a2a, 0.07)
    } else {
      const prev = structureDrag.pendingSlots
      if (prev) {
        applySlotPositions(prev, structureDrag.ids, structureDrag.box)
        setComponentEmissive(structureDrag.ids, 0x6a1a1a, 0.24)
      } else {
        restoreStructureStartPositions(structureDrag)
        setComponentEmissive(structureDrag.ids, 0x6a1a1a, 0.24)
      }
    }
  }

  function finishStructureDrag() {
    const drag = structureDrag
    if (!drag) return
    structureDrag = null
    restoreGhostDragForStructure(drag.ghostBackups)
    if (drag.box) {
      root.remove(drag.box)
      drag.box = null
    }
    if (drag.pendingSlots) {
      commitStructureSlots(drag, drag.pendingSlots)
      let changed = false
      for (const nid of drag.ids) {
        if (drag.startSlots.get(nid) !== drag.pendingSlots.get(nid).id) {
          changed = true
          break
        }
      }
      if (changed && drag.startSlots) {
        const startSnap = new Map(drag.startSlots)
        const endSnap = new Map(drag.pendingSlots)
        const idsSet = drag.ids
        recordAction({
          type: 'MOVE_STRUCTURE',
          undo: () => runWithoutHistory(() => applyStructureMoveUndo(startSnap, idsSet)),
          redo: () => runWithoutHistory(() => applyStructureMoveRedo(endSnap, idsSet)),
        })
      }
      audio?.playSpaghettiSnap?.()
      setComponentEmissive(drag.ids, 0x000000, 0)
      onChange()
    } else {
      restoreStructureStartPositions(drag)
      setComponentEmissive(drag.ids, 0x000000, 0)
    }
    canvas.style.cursor = 'default'
    clearStructureHover()
  }

  function cancelStructureDrag() {
    const drag = structureDrag
    if (!drag) return
    structureDrag = null
    restoreGhostDragForStructure(drag.ghostBackups)
    if (drag.box) root.remove(drag.box)
    restoreStructureStartPositions(drag)
    setComponentEmissive(drag.ids, 0x000000, 0)
    canvas.style.cursor = 'default'
    clearStructureHover()
  }

  function updateGhosts(e) {
    if (!state.activeTool) return

    if (state.activeTool === 'joint') {
      setRayFromEvent(e)
      const slot = getNearestValidJointSlotAlongRay(grid, raycaster.ray)
      if (!slot) {
        ghostNode.visible = false
        return
      }
      const canPlace = isValidJointPlacement(grid, slot) && inventory.canUseJoints(1)
      ghostNode.visible = true
      ghostNode.position.copy(slot.position)
      ghostNode.traverse((o) => {
        if (!o.isMesh || !o.material) return
        o.material.transparent = true
        o.material.opacity = canPlace ? 0.48 : 0.2
        if ('color' in o.material) {
          if (canPlace) {
            o.material.color.setHex(0x7a756e)
            if ('emissive' in o.material) o.material.emissive.setHex(0x000000)
            if ('emissiveIntensity' in o.material) o.material.emissiveIntensity = 0
          } else {
            o.material.color.setHex(0xd84c4c)
            if ('emissive' in o.material) o.material.emissive.setHex(0x401010)
            if ('emissiveIntensity' in o.material) o.material.emissiveIntensity = 0.22
          }
        }
      })
      return
    }

    if (state.activeTool === 'crown') {
      const top = getHighestJoint()
      if (!top) {
        ghostCrown.visible = false
        return
      }
      ghostCrown.visible = true
      ghostCrown.position.copy(top.mesh.position)
      ghostCrown.position.y += getCrownOffsetY()
      ghostCrown.traverse((o) => {
        if (!o.isMesh) return
        if (!o.material) return
        o.material.transparent = true
        o.material.opacity = 0.5
      })
      return
    }

    if (state.activeTool === 'spaghetti' || state.activeTool === 'string') {
      if (state.sourceNodeId == null) {
        ghostLine.visible = false
        return
      }
      const a = getNodeById(state.sourceNodeId)
      if (!a) return
      const targetId = pickNodeId(e)
      const bNode = targetId != null ? getNodeById(targetId) : null
      const bPos = bNode ? bNode.mesh.position : intersectGround(e)
      if (!bPos) return

      const dist = a.mesh.position.distanceTo(bPos)
      const ok = state.activeTool === 'spaghetti' ? dist <= 3 : dist <= 1.5
      const radius = state.activeTool === 'string' ? 0.006 : 0.012
      const sag = state.activeTool === 'string' ? 0.12 + dist * 0.04 : Math.max(0, dist - 2.2) * 0.06

      const geo = tubeBetween(a.mesh.position, bPos, { radius, sag, segments: 26 })
      ghostLine.geometry.dispose?.()
      ghostLine.geometry = geo
      ghostLine.visible = true
      ghostLine.material.opacity = ok ? 0.32 : 0.14
    }
  }

  function onMove(e) {
    onPointerMoveWithDrag(e)
    updateStructureHover(e)
    if (!structureDrag) updateGhosts(e)
    // Subtle node-hover feedback (debounced inside audio module).
    const hid = pickNodeId(e)
    if (hid != null && hid !== onMove._lastHoverId) audio?.playNodeHover?.()
    onMove._lastHoverId = hid
  }

  function onPointerDown(e) {
    if (e.button !== 0) return
    if (e.shiftKey && !state.activeTool) {
      const id = pickNodeId(e)
      if (id != null) {
        beginStructureDrag(id, e)
        try {
          canvas.setPointerCapture(e.pointerId)
        } catch (_) {}
        pointerDown = null
        return
      }
    }
    pointerDown = { x: e.clientX, y: e.clientY, dragged: false }
  }

  function onPointerMoveWithDrag(e) {
    if (structureDrag) {
      updateStructureDrag(e)
      return
    }
    if (pointerDown && (e.buttons & 1)) {
      const dx = e.clientX - pointerDown.x
      const dy = e.clientY - pointerDown.y
      // While a tool is active, camera rotation is off — don't treat small moves as "drag" so taps still place.
      const threshold = state.activeTool ? CLICK_DRAG_THRESHOLD_PX * 3 : CLICK_DRAG_THRESHOLD_PX
      if (dx * dx + dy * dy > threshold * threshold) pointerDown.dragged = true
    }
  }

  function onPointerUp(e) {
    if (e.button !== 0) return
    if (structureDrag) {
      finishStructureDrag()
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch (_) {}
      pointerDown = null
      return
    }
    const down = pointerDown
    pointerDown = null
    if (!down || down.dragged) {
      return
    }
    if (!state.activeTool && !e.shiftKey) {
      const hitId = pickNodeId(e)
      if (selectedNodeId != null && selectedNodeId !== hitId) {
        setNodeSelectionHighlight(selectedNodeId, false)
      }
      selectedNodeId = hitId
      if (hitId != null) setNodeSelectionHighlight(hitId, true)
      return
    }
    if (!state.activeTool) return
    handleToolClick(e)
  }

  function handleToolClick(e) {
    if (state.activeTool === 'joint') {
      setRayFromEvent(e)
      const slot = getNearestValidJointSlotAlongRay(grid, raycaster.ray)
      if (!slot) {
        onHint('Aim at the round build pad and tap. First joints sit on the table; higher ones need support below.')
        audio?.playInvalidAction?.()
        return
      }
      placeNodeAtSlot(slot)
      return
    }

    if (state.activeTool === 'crown') {
      if (crown.placed) return
      if (!nodes.length) {
        onHint('Place the marshmallow on top')
        audio?.playInvalidAction?.()
        return
      }
      const hitId = pickNodeId(e)
      if (hitId == null) {
        onHint('Place the marshmallow on top')
        audio?.playInvalidAction?.()
        return
      }
      const highest = getHighestJoint()
      if (!highest) return
      placeCrownOnNode(highest)
      return
    }

    if (state.activeTool === 'tape') {
      const id = pickNodeId(e)
      if (id == null) return
      applyTapeToNode(getNodeById(id))
      return
    }

    if (state.activeTool === 'spaghetti' || state.activeTool === 'string') {
      const id = pickNodeId(e)
      if (id == null) {
        if (state.sourceNodeId != null) setNodeHighlight(state.sourceNodeId, false)
        state.sourceNodeId = null
        ghostLine.visible = false
        onChange()
        return
      }

      if (state.sourceNodeId == null) {
        state.sourceNodeId = id
        setNodeHighlight(id, true)
        audio?.playSpaghettiHover?.()
        onChange()
        return
      }

      const a = getNodeById(state.sourceNodeId)
      const b = getNodeById(id)
      const tool = state.activeTool
      setNodeHighlight(state.sourceNodeId, false)
      state.sourceNodeId = null
      ghostLine.visible = false
      connectNodes(a, b, tool)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (structureDrag) {
        cancelStructureDrag()
        return
      }
      cancelToolSelection()
    }
  }

  function onCanvasDragOver(e) {
    e.preventDefault()
    try {
      e.dataTransfer.dropEffect = 'copy'
    } catch (_) {}
  }

  function onCanvasDrop(e) {
    e.preventDefault()
    const tool = e.dataTransfer?.getData('application/x-mt-tool') || e.dataTransfer?.getData('text/plain')
    if (!tool || !['joint', 'spaghetti', 'string', 'tape', 'crown'].includes(tool)) return
    setTool(tool)
    // Only some tools make sense to "apply" immediately on drop.
    // For connectors (spaghetti/string/tape), drop should just select the tool.
    if (tool === 'joint' || tool === 'crown') handleToolClick(e)
  }

  function onSyntheticToolDrop(e) {
    const tool = e?.detail?.tool
    const clientX = e?.detail?.clientX
    const clientY = e?.detail?.clientY
    if (!tool || !['joint', 'spaghetti', 'string', 'tape', 'crown'].includes(tool)) return
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return
    setTool(tool)
    // See onCanvasDrop: only apply joint/crown immediately.
    if (tool === 'joint' || tool === 'crown') handleToolClick({ clientX, clientY })
  }

  canvas.addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('dragover', onCanvasDragOver)
  canvas.addEventListener('drop', onCanvasDrop)
  canvas.addEventListener('pointercancel', () => {
    if (structureDrag) cancelStructureDrag()
    pointerDown = null
  })
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('mt:tool-drop', onSyntheticToolDrop)

  syncOrbitWithTool()

  function getPlacedNodes() {
    return nodes.map((n) => ({ id: n.id, mesh: n.mesh, obj: n.mesh, taped: n.taped }))
  }

  function getConnections() {
    return edges.map((e) => ({ ...e }))
  }

  function getCrown() {
    return crown.placed ? { mesh: crown.mesh, obj: crown.mesh, loaded: true, anchorJointId: crown.anchorJointId } : null
  }

  function getCurrentHeightCm() {
    let maxY = 0
    for (const n of nodes) maxY = Math.max(maxY, n.mesh.position.y)
    if (crown.mesh) maxY = Math.max(maxY, crown.mesh.position.y)
    return Math.round(maxY * UNIT_TO_CM * 10) / 10
  }

  function dispose() {
    shiftKeys.dispose()
    if (structureDrag) cancelStructureDrag()
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('dragover', onCanvasDragOver)
    canvas.removeEventListener('drop', onCanvasDrop)
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('mt:tool-drop', onSyntheticToolDrop)
    if (controls) {
      controls.enabled = true
      controls.enableRotate = true
      controls.enablePan = true
      controls.enableZoom = true
    }
    scene.remove(groundPlane)
    root.remove(nodesGroup, edgesGroup, wrapsGroup, crownGroup, ghostNode, ghostCrown, ghostLine)
  }

  return {
    state,
    nodes,
    edges,
    crown,
    setTool,
    cancelToolSelection,
    reset() {
      clearNodeSelection()
      if (structureDrag) {
        const drag = structureDrag
        structureDrag = null
        restoreGhostDragForStructure(drag.ghostBackups)
        if (drag.box) root.remove(drag.box)
        clearStructureHover()
      }
      nodesGroup.clear()
      edgesGroup.clear()
      wrapsGroup.clear()
      crownGroup.clear()
      nodes.length = 0
      edges.length = 0
      grid.occupied.clear()
      state.sourceNodeId = null
      state.crownPlaced = false
      state.activeTool = null
      crown.placed = false
      crown.anchorJointId = null
      crown.mesh = null
      crown.obj = null
      crown.loaded = false
      crownSquash = null
      ghostNode.visible = false
      ghostCrown.visible = false
      ghostLine.visible = false
      canvas.style.cursor = 'default'
      syncOrbitWithTool()
      onChange()
    },
    update(opts = {}) {
      const skipCrownIdle = Boolean(opts.skipCrownIdle)
      if (crownSquash && crown.mesh) {
        const t = performance.now() / 1000
        const k = clamp01((t - crownSquash.t0) / crownSquash.dur)
        let sy
        let sxz
        if (k < 1 / 3) {
          const u = k * 3
          sy = THREE.MathUtils.lerp(1, 0.75, u)
          sxz = THREE.MathUtils.lerp(1, 1.1, u)
        } else if (k < 2 / 3) {
          const u = (k - 1 / 3) * 3
          sy = THREE.MathUtils.lerp(0.75, 1.05, u)
          sxz = THREE.MathUtils.lerp(1.1, 0.95, u)
        } else {
          const u = (k - 2 / 3) * 3
          sy = THREE.MathUtils.lerp(1.05, 1, u)
          sxz = THREE.MathUtils.lerp(0.95, 1, u)
        }
        crown.mesh.scale.set(sxz, sy, sxz)
        if (k >= 1) {
          crown.mesh.scale.set(1, 1, 1)
          crownSquash = null
        }
      }
      if (!skipCrownIdle && crown.placed && crown.mesh && !crownSquash) {
        const t = performance.now() / 1000
        const b = 1 + Math.sin(t * 1.25) * 0.015
        crown.mesh.scale.set(b, b, b)
      }
    },
    getPlacedNodes,
    getConnections,
    getCrown,
    getCurrentHeightCm,
    dispose,
  }
}

