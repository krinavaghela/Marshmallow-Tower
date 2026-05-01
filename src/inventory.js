export function createInventory() {
  const initial = {
    spaghetti: { max: 20, used: 0 },
    stringInches: { max: 36, used: 0 }, // 1 yard
    tapeInches: { max: 36, used: 0 }, // 1 yard
    joints: { max: 12, used: 0 },
    crown: { max: 1, used: 0 }, // single top marshmallow (load), not a structural joint
  }

  const state = structuredClone(initial)

  function reset() {
    Object.assign(state.spaghetti, structuredClone(initial.spaghetti))
    Object.assign(state.stringInches, structuredClone(initial.stringInches))
    Object.assign(state.tapeInches, structuredClone(initial.tapeInches))
    Object.assign(state.joints, structuredClone(initial.joints))
    Object.assign(state.crown, structuredClone(initial.crown))
  }

  function remainingOf(key) {
    const obj = state[key]
    return Math.max(0, obj.max - obj.used)
  }

  function canUseSpaghetti() {
    return remainingOf('spaghetti') >= 1
  }

  function useSpaghetti(n = 1) {
    if (remainingOf('spaghetti') < n) return false
    state.spaghetti.used += n
    return true
  }

  function refundSpaghetti(n = 1) {
    state.spaghetti.used = Math.max(0, state.spaghetti.used - n)
  }

  function canUseJoints(n = 1) {
    return remainingOf('joints') >= n
  }

  function useJoint(n = 1) {
    if (!canUseJoints(n)) return false
    state.joints.used += n
    return true
  }

  function refundJoint(n = 1) {
    state.joints.used = Math.max(0, state.joints.used - n)
  }

  function canUseTapeInches(inches) {
    return remainingOf('tapeInches') >= inches
  }

  function useTapeInches(inches) {
    if (!canUseTapeInches(inches)) return false
    state.tapeInches.used += inches
    return true
  }

  function refundTapeInches(inches) {
    state.tapeInches.used = Math.max(0, state.tapeInches.used - inches)
  }

  function canUseStringSegment() {
    return remainingOf('stringInches') >= 6
  }

  function useStringSegment() {
    if (!canUseStringSegment()) return false
    state.stringInches.used += 6
    return true
  }

  function refundStringSegment() {
    state.stringInches.used = Math.max(0, state.stringInches.used - 6)
  }

  function canUseCrown() {
    return remainingOf('crown') >= 1
  }

  function useCrown() {
    if (!canUseCrown()) return false
    state.crown.used += 1
    return true
  }

  function refundCrown() {
    state.crown.used = Math.max(0, state.crown.used - 1)
  }

  function getSnapshot() {
    const rem = {
      spaghetti: remainingOf('spaghetti'),
      stringInches: remainingOf('stringInches'),
      tapeInches: remainingOf('tapeInches'),
      joints: remainingOf('joints'),
      crown: remainingOf('crown'),
    }
    return {
      remaining: rem,
      max: {
        spaghetti: state.spaghetti.max,
        stringInches: state.stringInches.max,
        tapeInches: state.tapeInches.max,
        joints: state.joints.max,
        crown: state.crown.max,
      },
      used: {
        spaghetti: state.spaghetti.used,
        stringInches: state.stringInches.used,
        tapeInches: state.tapeInches.used,
        joints: state.joints.used,
        crown: state.crown.used,
      },
    }
  }

  return {
    state,
    reset,
    getSnapshot,
    canUseSpaghetti,
    useSpaghetti,
    refundSpaghetti,
    canUseJoints,
    useJoint,
    refundJoint,
    canUseTapeInches,
    useTapeInches,
    refundTapeInches,
    canUseStringSegment,
    useStringSegment,
    refundStringSegment,
    canUseCrown,
    useCrown,
    refundCrown,
  }
}

