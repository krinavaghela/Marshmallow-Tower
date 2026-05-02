/**
 * Alternate lab entry (portfolio experiment). Use an HTML shell with `<div id="app"></div>`
 * and `<script type="module" src="/src/main.js"></script>` if you want this route.
 */
import './styles/main.css'
import './styles/ui.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Marshmallow } from './objects/Marshmallow.js'

const mount = document.querySelector('#app') ?? document.querySelector('#mtl-alt-root')
if (!mount) {
  console.warn('[Marshmallow Tower Lab] Alternate entry: add #app or #mtl-alt-root to run src/main.js')
} else {
  mount.innerHTML = ''

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf2ede4)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setSize(mount.clientWidth, mount.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  mount.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.05, 40)
  camera.position.set(1.6, 1.2, 1.6)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0.25, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.62))
  const sun = new THREE.DirectionalLight(0xfff3e4, 1.05)
  sun.position.set(2.2, 2.8, 1.1)
  scene.add(sun)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 48),
    new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.98 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const demo = new Marshmallow()
  demo.object3d.position.set(0, 0.08, 0)
  scene.add(demo.object3d)

  const uiLine = document.createElement('div')
  uiLine.style.cssText =
    'position:absolute;left:12px;bottom:12px;font:13px/1.4 system-ui;background:rgba(255,255,255,.82);padding:8px 12px;border-radius:8px;max-width:min(420px,92vw)'
  uiLine.textContent = 'Alt lab loaded — extend StructureManager / StabilityEngine as needed.'
  mount.style.position = 'relative'
  mount.appendChild(uiLine)

  function resize() {
    const w = mount.clientWidth
    const h = mount.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(mount)
  resize()

  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}
