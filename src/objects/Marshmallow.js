import * as THREE from 'three'

export class Marshmallow {
  constructor({ radius = 0.048, height = 0.06, color = 0xf5eee6, material = 'soft' } = {}) {
    const geo = new THREE.SphereGeometry(radius, 24, 18)
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: material === 'heavy' ? 0.35 : 0.55,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
    })
    this.object3d = new THREE.Mesh(geo, mat)
    this.object3d.name = 'Marshmallow'
    this.object3d.castShadow = true
    this.radius = radius
    this.height = height
  }
}
