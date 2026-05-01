/**
 * Simple undo/redo — actions carry their own undo/redo closures (minimal state).
 */
export function createHistory() {
  const undoStack = []
  const redoStack = []
  let listeners = []

  function notify() {
    for (const fn of listeners) fn()
  }

  function subscribe(fn) {
    listeners.push(fn)
    return () => {
      listeners = listeners.filter((x) => x !== fn)
    }
  }

  /**
   * @param {{ type?: string, undo: () => void, redo: () => void }} action
   */
  function push(action) {
    undoStack.push(action)
    redoStack.length = 0
    notify()
  }

  function undo() {
    const action = undoStack.pop()
    if (!action) return false
    action.undo()
    redoStack.push(action)
    notify()
    return true
  }

  function redo() {
    const action = redoStack.pop()
    if (!action) return false
    action.redo()
    undoStack.push(action)
    notify()
    return true
  }

  function clear() {
    undoStack.length = 0
    redoStack.length = 0
    notify()
  }

  function canUndo() {
    return undoStack.length > 0
  }

  function canRedo() {
    return redoStack.length > 0
  }

  return { push, undo, redo, clear, canUndo, canRedo, subscribe }
}
