import { THREE } from './three-deps.js'

export function createMaterials() {
  // Soft load marshmallow: compact capsule (still reads as load vs joints)
  const bigMallow = new THREE.CapsuleGeometry(0.19, 0.22, 12, 32)

  const geometries = {
    joint: new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12, 1),
    miniMallow: new THREE.CylinderGeometry(0.3, 0.3, 0.45, 16, 1),
    bigMallow,
    spaghettiUnit: new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1),
    tapeBand: new THREE.PlaneGeometry(0.55, 0.22),
    stringUnit: new THREE.CylinderGeometry(0.025, 0.025, 1, 10, 1),
    shadowDisk: new THREE.CircleGeometry(0.26, 22),
  }

  const materials = {
    joint: new THREE.MeshStandardMaterial({
      color: 0x7a756e,
      roughness: 0.92,
      metalness: 0.12,
    }),
    miniMallow: new THREE.MeshStandardMaterial({ color: 0xFFF8F0, roughness: 0.95, metalness: 0 }),
    bigMallow: new THREE.MeshStandardMaterial({
      color: 0xfff8f0,
      roughness: 0.9,
      metalness: 0,
      emissive: new THREE.Color(0xfff5e8),
      emissiveIntensity: 0.06,
    }),
    spaghetti: new THREE.MeshStandardMaterial({ color: 0xE8C97A, roughness: 0.65, metalness: 0 }),
    spaghettiStress: new THREE.MeshStandardMaterial({ color: 0xC0522A, roughness: 0.65, metalness: 0 }),
    string: new THREE.MeshStandardMaterial({ color: 0xC8B89A, roughness: 0.85, metalness: 0 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xD4C5B0, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.55 }),
    ghost: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.5 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xC17B5A, transparent: true, opacity: 0.18 }),
  }

  return { geometries, materials }
}

/** Joint top above mesh.position.y (buildJoint) + half marshmallow capsule extent along Y */
export function getCrownOffsetY() {
  const jointTop = 0.27
  const capsuleRadius = 0.19
  const capsuleCylinderHalf = 0.11
  return jointTop + capsuleRadius + capsuleCylinderHalf
}

/** Neutral structural connector — not marshmallow-like */
export function buildJoint(mats) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(mats.geometries.joint, mats.materials.joint)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mats.materials.joint)
  cap.position.y = 0.12
  cap.castShadow = true
  cap.receiveShadow = true
  g.add(cap)
  return g
}

export function buildMiniMarshmallow(mats) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(mats.geometries.miniMallow, mats.materials.miniMallow)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  const disk = new THREE.Mesh(mats.geometries.shadowDisk, mats.materials.shadow)
  disk.rotation.x = -Math.PI / 2
  disk.position.y = -0.235
  g.add(disk)

  // Hover glow ring (hidden by default).
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 24), mats.materials.glow)
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -0.225
  glow.visible = false
  g.add(glow)
  g.userData.glow = glow

  return g
}

export function buildBigMarshmallow(mats) {
  const g = new THREE.Group()
  g.userData.crownOffsetY = getCrownOffsetY()
  const mat = mats.materials.bigMallow
  const body = new THREE.Mesh(mats.geometries.bigMallow, mat)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  // Subsurface hint: slightly smaller warm core (no extra lights)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 20),
    new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      roughness: 0.75,
      metalness: 0,
      emissive: new THREE.Color(0xffe8d8),
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.35,
    }),
  )
  core.castShadow = false
  core.receiveShadow = false
  g.add(core)
  return g
}

export function buildTapeWrap(mats) {
  const m = new THREE.Mesh(mats.geometries.tapeBand, mats.materials.tape)
  m.castShadow = true
  return m
}

