import * as THREE from 'three'

export function addLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.58)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xfff1df, 1.02)
  key.position.set(2.2, 3.0, 1.4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.4
  key.shadow.camera.far = 9
  key.shadow.camera.left = -2.5
  key.shadow.camera.right = 2.5
  key.shadow.camera.top = 2.5
  key.shadow.camera.bottom = -2.5
  key.shadow.bias = -0.00016
  key.shadow.normalBias = 0.02
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xeef4ff, 0.2)
  fill.position.set(-2, 1.2, -1)
  scene.add(fill)
}
