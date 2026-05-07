import { THREE, OrbitControls } from './three-deps.js'

export function createScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xF2EDE4)

  const canvas = document.getElementById('three-canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(window.devicePixelRatio || 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.domElement.style.touchAction = 'none'

  // Perspective + OrbitControls (Earth-style inspect).
  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 120)
  camera.position.set(2.45, 2.15, 2.45)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.minDistance = 3
  controls.maxDistance = 20
  controls.minPolarAngle = 0.12
  controls.maxPolarAngle = Math.PI / 2
  controls.target.set(0, 0.35, 0)
  controls.update()

  const ambient = new THREE.AmbientLight(0xffffff, 0.62)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xfff1df, 1.05)
  key.position.set(2.2, 3.2, 1.4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.6
  key.shadow.camera.far = 10
  key.shadow.camera.left = -3
  key.shadow.camera.right = 3
  key.shadow.camera.top = 3
  key.shadow.camera.bottom = -3
  key.shadow.bias = -0.00018
  key.shadow.normalBias = 0.025
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xf3f7ff, 0.22)
  fill.position.set(-2.4, 1.3, -1.1)
  scene.add(fill)

  const root = new THREE.Group()
  scene.add(root)

  const platform = createPlatform()
  root.add(platform)

  function onResize() {
    resize(renderer, camera)
  }
  window.addEventListener('resize', onResize)
  resize(renderer, camera)

  return { scene, renderer, camera, controls, root, platform }
}

function resize(renderer, camera) {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)

  const aspect = w / h
  camera.aspect = aspect
  camera.updateProjectionMatrix()
}

function createPlatform() {
  const g = new THREE.Group()

  // Visible build mat so the 3D area reads as a “table” (not empty beige).
  const matTop = new THREE.MeshStandardMaterial({
    color: 0xe4dcd0,
    roughness: 0.92,
    metalness: 0,
  })
  const buildPad = new THREE.Mesh(new THREE.CircleGeometry(2.85, 72), matTop)
  buildPad.rotation.x = -Math.PI / 2
  buildPad.position.y = 0.002
  buildPad.receiveShadow = true
  g.add(buildPad)

  // Clean workspace: subtle shadow only (no grid lines / patterns)
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.18 }))
  shadowCatcher.rotation.x = -Math.PI / 2
  shadowCatcher.receiveShadow = true
  shadowCatcher.position.y = 0.0
  g.add(shadowCatcher)

  return g
}

