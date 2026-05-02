export function computeScore({ towerModel, stable }) {
  const height = towerModel.getHeight()
  const sticks = towerModel.edges.length
  const mult = stable ? 1.15 : 0.4
  const efficiency = Math.max(0.65, 1 - sticks * 0.02)
  const score = Math.round(height * 120 * mult * efficiency)
  return { score, height }
}
