import { createScene } from './src/scene.js'
import { createGrid } from './src/grid.js'
import { createMaterials } from './src/materials.js'
import { createInventory } from './src/inventory.js'
import { createUI } from './src/ui.js'
import { createBuilder } from './src/builder.js'
import { createTimer } from './src/timer.js'
import { evaluateStability } from './src/stability.js'
import { createAnimator } from './src/animator.js'
import { createAudio } from './src/audio.js'
import { createHistory } from './src/history.js'

const ui = createUI(document)
const history = createHistory()
const inventory = createInventory()
const mats = createMaterials()
const { scene, renderer, camera, controls, root, platform } = createScene()
const grid = createGrid({ size: 10, levels: 7, spacing: 0.48, baseY: 0.06 })
const audio = createAudio()
audio.start() // begins ambient after first user interaction
const animator = createAnimator({ root, mats, platform, audio })

ui.initRuler({ maxCm: 50, stepCm: 5 })

const builder = createBuilder({
  scene,
  camera,
  renderer,
  root,
  mats,
  grid,
  inventory,
  audio,
  onHint: (text) => ui.setHint(text),
  onChange: syncUI,
  history,
})

history.subscribe(() => {
  ui.setUndoRedoEnabled(history.canUndo(), history.canRedo())
})

const timer = createTimer({
  durationSeconds: 18 * 60,
  onTick: (t) => ui.setTimer(t),
  audio,
  onExpire: () => {
    ui.setHint('Time. Click Test Tower when you are ready.')
  },
})

function syncUI() {
  ui.setActiveTool(builder.state.activeTool)
  ui.setInventory(inventory.getSnapshot())
  ui.checkCrownAvailability(builder.getPlacedNodes().length)
  ui.setTestEnabled(Boolean(builder.state.crownPlaced))
  const h = builder.getCurrentHeightCm()
  ui.setRulerDot(h, 50)
  ui.setSoundState({ enabled: audio.isEnabled(), playing: audio.isPlaying() })
  ui.setUndoRedoEnabled(history.canUndo(), history.canRedo())
}

function resetAll() {
  history.clear()
  builder.reset()
  inventory.reset()
  timer.reset()
  animator.reset()
  ui.hideResult()
  ui.setHint('Build. Test. Iterate.')
  syncUI()
}

ui.onToolSelect((tool) => {
  // Tool keys from DOM: spaghetti|string|tape|joint|crown
  builder.setTool(tool)
  ui.setHint(
    tool === 'spaghetti'
      ? 'Click two joints to place a spaghetti stick.'
      : tool === 'string'
        ? 'Click two joints to add a string brace.'
        : tool === 'tape'
          ? 'Click a joint to tape it.'
          : tool === 'crown'
            ? 'Click a joint — the marshmallow snaps to the highest one (the load).'
        : 'Click the build area to place a joint.',
  )
  syncUI()
})

ui.onReset(() => resetAll())
ui.onTryAgain(() => resetAll())

ui.onUndo(() => {
  history.undo()
})
ui.onRedo(() => {
  history.redo()
})

ui.onToggleTimerPause(() => {
  timer.togglePause()
  ui.setTimer(timer.getTime())
})

ui.onToggleSound(() => {
  const enabled = audio.toggle()
  ui.setSoundState({ enabled, playing: audio.isPlaying() })
  ui.showSoundTooltip(enabled ? 'Sound on' : 'Sound off')
})

ui.onTest(() => {
  if (!builder.getCrown()) {
    ui.setHint('Place the marshmallow on top')
    return
  }
  const nodes = builder.getPlacedNodes()
  const connections = builder.getConnections()
  const crown = builder.getCrown()
  const result = evaluateStability(nodes, connections, crown)
  audio.playTestInitiate()
  animator.play(
    result.band === 'STANDING' ? 'standing' : result.band === 'WOBBLING' ? 'wobbling' : result.band === 'PARTIAL' ? 'partial' : 'collapse',
    { nodes: builder.nodes, edges: builder.edges, crown: builder.crown, onEnd: () => {} },
  )
  ui.showResult(result)
})

// Initial UI state
resetAll()
ui.setHint('Click a supply, then click the build area.')
syncUI()

function frame() {
  requestAnimationFrame(frame)
  builder.update({ skipCrownIdle: animator.isPlaying() })
  animator.update()
  controls.update()
  renderer.render(scene, camera)
}
frame()

