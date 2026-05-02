import * as THREE from 'three'
import { SIZES } from '../app/constants.js'

export function createTowerView(scene, materials) {
  const root = new THREE.Group()
  scene.add(root)

  const jointGeo = new THREE.SphereGeometry(SIZES.jointRadius, 22, 16)
  const stickGeo = new THREE.CylinderGeometry(SIZES.stickRadius, SIZES.stickRadius, 1, 10, 1)
  const topMesh = new THREE.Mesh(new THREE.SphereGeometry(SIZES.topRadius, 24, 18), materials.topMarshmallow)
  topMesh.castShadow = true
  topMesh.visible = false
  root.add(topMesh)

  const snapGroup = new THREE.Group()
  root.add(snapGroup)

  const hitMeshes = []
  const nodeMeshes = new Map()
  const edgeObjs = []
  const snapIdByMesh = new WeakMap()

  function initSnapPoints(points) {
    while (snapGroup.children.length) snapGroup.remove(snapGroup.children[0])
    hitMeshes.length = 0
    for (const p of points) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), materials.snapGhost.clone())
      m.position.copy(p.position)
      m.userData.snapId = p.id
      snapIdByMesh.set(m, p.id)
      m.castShadow = false
      snapGroup.add(m)
      hitMeshes.push(m)
    }
  }

  function setEdgeMesh(mesh, a, b) {
    const pa = a.clone()
    const pb = b.clone()
    const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5)
    const len = pa.distanceTo(pb)
    const dir = new THREE.Vector3().subVectors(pb, pa).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir)
    mesh.position.copy(mid)
    mesh.setRotationFromQuaternion(q)
    mesh.scale.set(1, len, 1)
  }

  function reset() {
    for (const [, m] of nodeMeshes) root.remove(m)
    nodeMeshes.clear()
    for (const e of edgeObjs) {
      root.remove(e.mesh)
    }
    edgeObjs.length = 0
    topMesh.visible = false
  }

  function syncFromModel(towerModel) {
    for (const id of towerModel.getOccupiedSnapIds()) {
      if (!nodeMeshes.has(id)) {
        const m = new THREE.Mesh(jointGeo, materials.joint)
        m.castShadow = true
        m.position.copy(towerModel.pointsById.get(id))
        root.add(m)
        nodeMeshes.set(id, m)
      }
    }
    for (const [id, m] of [...nodeMeshes]) {
      if (!towerModel.getOccupiedSnapIds().has(id)) {
        root.remove(m)
        nodeMeshes.delete(id)
      }
    }

    for (const e of edgeObjs) root.remove(e.mesh)
    edgeObjs.length = 0
    for (const e of towerModel.edges) {
      const a = towerModel.pointsById.get(e.a)
      const b = towerModel.pointsById.get(e.b)
      const mesh = new THREE.Mesh(stickGeo, materials.stick)
      mesh.castShadow = true
      setEdgeMesh(mesh, a, b)
      root.add(mesh)
      edgeObjs.push({ mesh, a: e.a, b: e.b })
    }

    if (towerModel.topSnapId != null) {
      const p = towerModel.pointsById.get(towerModel.topSnapId)
      topMesh.position.copy(p).add(new THREE.Vector3(0, 0.09, 0))
      topMesh.visible = true
    } else {
      topMesh.visible = false
    }
  }

  return {
    root,
    initSnapPoints,
    reset,
    syncFromModel,
    getHitMeshes() {
      return hitMeshes
    },
    topMesh,
  }
}
