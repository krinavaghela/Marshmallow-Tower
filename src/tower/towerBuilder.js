import { PARTS } from '../app/constants.js'

export function createTowerBuilder({ state, sceneApi, towerModel, towerView, onStateChanged }) {
  let pendingA = null
  let onTopPlaced = null

  function syncInv() {
    state.inventory.sticksUsed = towerModel.edges.length
    state.inventory.marshmallowsUsed = towerModel.getOccupiedSnapIds().size
    onStateChanged?.()
  }

  function pointerDown(ev) {
    if (state.mode === 'testing' || state.mode === 'result') return
    const hits = sceneApi.pickFromPointer(ev, towerView.getHitMeshes())
    if (!hits.length) return
    const snapId = hits[0].object.userData.snapId
    if (snapId == null) return

    if (state.mode === 'place_top') {
      if (!towerModel.hasNode(snapId)) {
        state.hint = 'Choose a joint that already holds marshmallow.'
        onStateChanged?.()
        return
      }
      const highest = towerModel.getHighestOccupiedSnapId()
      if (snapId !== highest) {
        state.hint = 'Place on the highest supported joint.'
        onStateChanged?.()
        return
      }
      towerModel.topSnapId = snapId
      towerView.syncFromModel(towerModel)
      onTopPlaced?.({ snapId })
      state.mode = 'build'
      syncInv()
      return
    }

    if (pendingA == null) {
      if (!towerModel.hasNode(snapId)) {
        if (!towerModel.canPlaceNode(snapId)) {
          state.hint = 'No more joints left.'
          onStateChanged?.()
          return
        }
        towerModel.placeNode(snapId)
        syncInv()
      }
      pendingA = snapId
      state.selectedSnapId = snapId
      state.hint = 'Pick a second joint to place a stick (or click same to cancel).'
      onStateChanged?.()
      towerView.syncFromModel(towerModel)
      return
    }

    if (snapId === pendingA) {
      pendingA = null
      state.selectedSnapId = null
      state.hint = 'Cancelled. Pick a joint to start.'
      onStateChanged?.()
      return
    }

    if (!towerModel.hasNode(snapId)) {
      if (!towerModel.canPlaceNode(snapId)) {
        state.hint = 'No more joints left.'
        onStateChanged?.()
        return
      }
      towerModel.placeNode(snapId)
      syncInv()
    }

    const a = pendingA
    const b = snapId
    pendingA = null
    state.selectedSnapId = null

    const chk = towerModel.canAddEdge(a, b)
    if (!chk.ok) {
      state.hint = chk.reason
      onStateChanged?.()
      return
    }
    towerModel.addEdge(a, b)
    towerView.syncFromModel(towerModel)
    syncInv()
    state.hint = 'Stick placed. Add more, then use “Place top”.'
    onStateChanged?.()
  }

  function reset() {
    pendingA = null
    towerModel.reset()
    towerView.reset()
    towerView.initSnapPoints(towerModel.points)
    towerView.syncFromModel(towerModel)
    syncInv()
  }

  function update() {}

  function onResize() {}

  reset()

  sceneApi.canvas.addEventListener('pointerdown', pointerDown)

  return {
    reset,
    update,
    onResize,
    get onTopPlaced() {
      return onTopPlaced
    },
    set onTopPlaced(fn) {
      onTopPlaced = fn
    },
  }
}
