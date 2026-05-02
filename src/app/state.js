import { PARTS } from './constants.js'

export function createInitialState() {
  return {
    mode: 'build',
    hint: 'Click a joint, then another to place a stick.',
    topPlaced: false,
    topSnapId: null,
    selectedSnapId: null,
    score: 0,
    height: 0,
    lastTest: null,
    inventory: {
      sticksUsed: 0,
      marshmallowsUsed: 0,
      maxMarshmallows: PARTS.maxMarshmallows,
      maxSticks: PARTS.maxSticks,
    },
  }
}
