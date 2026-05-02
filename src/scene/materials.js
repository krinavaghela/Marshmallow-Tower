import * as THREE from 'three'

export function createMaterials() {
  const table = new THREE.MeshStandardMaterial({
    color: 0xf1ece2,
    roughness: 0.96,
    metalness: 0,
  })

  const joint = new THREE.MeshPhysicalMaterial({
    color: 0xf6f0e8,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
  })

  const stick = new THREE.MeshStandardMaterial({
    color: 0xe6cf92,
    roughness: 0.78,
    metalness: 0,
  })

  const topMarshmallow = new THREE.MeshPhysicalMaterial({
    color: 0xf8f4ec,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.28,
  })

  const snapGhost = new THREE.MeshBasicMaterial({
    color: 0xb8a995,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })

  const snapHover = new THREE.MeshBasicMaterial({
    color: 0xd4c4a8,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  })

  return {
    table,
    joint,
    stick,
    topMarshmallow,
    snapGhost,
    snapHover,
  }
}
