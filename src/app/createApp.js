import { createScene } from '../scene/createScene.js'
import { createUI } from '../ui/ui.js'
import { createInitialState } from './state.js'
import { createTowerModel } from '../tower/towerModel.js'
import { createTowerView } from '../tower/towerView.js'
import { createTowerBuilder } from '../tower/towerBuilder.js'
import { createRaf } from '../utils/raf.js'
import { evaluateStability } from '../stability/evaluateStability.js'
import { computeScore } from '../stability/scoring.js'
import { createCollapseAnimator } from '../stability/collapseAnimation.js'

export function createApp(mountEl) {
  mountEl.innerHTML = ''

  const state = createInitialState()
  const ui = createUI(mountEl, state)

  const sceneApi = createScene(ui.canvasHost)
  const towerModel = createTowerModel()
  const towerView = createTowerView(sceneApi.scene, sceneApi.materials)
  const builder = createTowerBuilder({
    state,
    sceneApi,
    towerModel,
    towerView,
    onStateChanged: syncUI,
  })

  const collapse = createCollapseAnimator({ scene: sceneApi.scene, towerView, towerModel })

  function syncUI() {
    ui.update(state)
  }

  function resetAll() {
    collapse.reset()
    towerModel.reset()
    towerView.reset()
    Object.assign(state, createInitialState())
    builder.reset()
    syncUI()
  }

  ui.on('reset', resetAll)
  ui.on('closeOverlay', () => {
    ui.setOverlayVisible(false)
    sceneApi.canvas.focus?.()
  })
  ui.on('test', () => {
    if (state.mode === 'testing') return

    state.mode = 'testing'
    state.hint = 'Testing stability…'
    syncUI()

    const result = evaluateStability(towerModel)
    const scoreInfo = computeScore({ towerModel, stable: result.outcome === 'stand' || result.outcome === 'wobble' })

    state.lastTest = result
    state.score = scoreInfo.score
    state.height = scoreInfo.height

    collapse.play({
      stable: result.outcome === 'stand' || result.outcome === 'wobble',
      outcome: result.outcome,
      weakSnapId: result.weakSnapId,
      onDone: () => {
        state.mode = 'result'
        state.hint =
          result.outcome === 'stand'
            ? 'It stands. Push it taller.'
            : result.outcome === 'wobble'
              ? 'It wobbles… but holds.'
              : `${result.primaryReason} Reset and iterate.`
        syncUI()
      },
    })
  })

  ui.on('placeTopMode', () => {
    if (state.mode === 'testing') return
    if (state.topPlaced) return
    state.mode = 'place_top'
    state.selectedSnapId = null
    state.hint = 'Choose a supported highest joint for the final marshmallow.'
    syncUI()
  })

  builder.onTopPlaced = ({ snapId }) => {
    state.topPlaced = true
    state.topSnapId = snapId
    state.mode = 'build'
    state.hint = 'Top placed. Press “Test Stability”.'
    syncUI()
  }

  const raf = createRaf()
  raf.start((t, dt) => {
    builder.update(t, dt)
    collapse.update(t, dt)
    sceneApi.update(t, dt)
  })

  sceneApi.onResize(() => {
    builder.onResize()
  })

  syncUI()
  ui.setOverlayVisible(true)
}
