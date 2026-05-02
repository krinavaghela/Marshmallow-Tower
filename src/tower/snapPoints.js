import * as THREE from 'three'

/** Curated snap lattice above the table — tuned for a small designed feel. */
export function createSnapPoints() {
  const points = []
  let id = 0

  function add(x, y, z, tier) {
    points.push({ id: `s${id++}`, position: new THREE.Vector3(x, y, z), tier })
  }

  const rings = [
    { r: 0.22, y: 0.07, n: 6 },
    { r: 0.18, y: 0.22, n: 6 },
    { r: 0.14, y: 0.38, n: 5 },
    { r: 0.1, y: 0.54, n: 4 },
  ]

  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + ring.r * 0.15
      add(Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r, ring.y)
    }
  }
  add(0, 0.72, 0, 4)

  return points
}
