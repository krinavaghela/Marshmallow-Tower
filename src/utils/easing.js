export function easeInOutSine(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t)
}

export function easeOutCubic(t) {
  const u = 1 - t
  return 1 - u * u * u
}
