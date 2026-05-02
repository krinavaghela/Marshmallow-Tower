import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createMaterials } from './materials.js'
import { addLights } from './lighting.js'

export function createScene(mountEl) {
  mountEl.innerHTML = ''

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none'
  canvas.setAttribute('aria-label', 'Marshmallow Tower Lab 3D scene')
  mountEl.appendChild(canvas)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xeae4da)

  const materials = createMaterials()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const camera = new THREE.PerspectiveCamera(42, 1, 0.06, 40)
  camera.position.set(1.55, 1.05, 1.55)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.05
  controls.maxDistance = 3.8
  controls.minPolarAngle = Math.PI * 0.25
  controls.maxPolarAngle = Math.PI * 0.52
  controls.target.set(0, 0.35, 0)
  controls.update()

  addLights(scene)

  const table = new THREE.Mesh(new THREE.CircleGeometry(0.95, 56), materials.table)
  table.rotation.x = -Math.PI / 2
  table.receiveShadow = true
  scene.add(table)

  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.14 }))
  catcher.rotation.x = -Math.PI / 2
  catcher.position.y = -0.001
  catcher.receiveShadow = true
  scene.add(catcher)

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  const resizeHandlers = []
  function resize() {
    const w = mountEl.clientWidth || window.innerWidth
    const h = mountEl.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
    resizeHandlers.forEach((fn) => fn())
  }

  const ro = new ResizeObserver(resize)
  ro.observe(mountEl)
  resize()

  window.addEventListener('resize', resize)

  function pickFromPointer(ev, targets) {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    raycaster.setFromCamera(ndc, camera)
    return raycaster.intersectObjects(targets, true)
  }

  function update(_t, _dt) {
    controls.update()
    renderer.render(scene, camera)
  }

  return {
    scene,
    renderer,
    camera,
    controls,
    canvas,
    materials,
    mountEl,
    update,
    pickFromPointer,
    onResize(fn) {
      resizeHandlers.push(fn)
    },
    dispose() {
      ro.disconnect()
      window.removeEventListener('resize', resize)
    },
  }
}
