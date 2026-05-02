/**
 * Legacy hook for drag-based builders (not wired by `createApp` in this restore).
 * Kept so imports / docs from older iterations stay valid.
 */
export function createTowerDragBuilder() {
  return {
    disabled: true,
  }
}
