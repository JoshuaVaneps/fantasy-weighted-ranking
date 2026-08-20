const FACTOR_KEYS = ['ecr', 'lastSeason', 'projected']

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Moves one weight to `newValue` and spreads the remainder across the other
 * two, in proportion to their current values, so the three always sum to
 * exactly 100.
 *
 * @param {{ ecr: number, lastSeason: number, projected: number }} weights - integers summing to 100
 * @param {'ecr' | 'lastSeason' | 'projected'} changedKey
 * @param {number} newValue
 * @returns {{ ecr: number, lastSeason: number, projected: number }}
 */
export function rebalance(weights, changedKey, newValue) {
  const clampedValue = Math.round(clamp(newValue, 0, 100))
  const remaining = 100 - clampedValue

  const otherKeys = FACTOR_KEYS.filter((key) => key !== changedKey)
  const othersSum = otherKeys.reduce((sum, key) => sum + weights[key], 0)

  const result = { ...weights, [changedKey]: clampedValue }

  for (const key of otherKeys) {
    const share = othersSum === 0 ? remaining / otherKeys.length : remaining * (weights[key] / othersSum)
    result[key] = Math.round(share)
  }

  // Rounding two independent shares can leave the total 1 or 2 off from
  // 100 - push the leftover onto whichever of the two OTHER buckets is
  // largest, so the value the user just set is never second-guessed.
  const total = FACTOR_KEYS.reduce((sum, key) => sum + result[key], 0)
  const leftover = 100 - total
  if (leftover !== 0) {
    const largestOtherKey = otherKeys.reduce((a, b) => (result[b] > result[a] ? b : a))
    result[largestOtherKey] += leftover
  }

  return result
}
