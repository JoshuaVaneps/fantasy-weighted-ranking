import { describe, expect, it } from 'vitest'
import { rebalance } from './rebalance.js'

const FACTOR_KEYS = ['ecr', 'lastSeason', 'projected']

function randomWeights() {
  // three random non-negative integers, rescaled to sum to 100
  const raw = FACTOR_KEYS.map(() => Math.floor(Math.random() * 100))
  const total = raw.reduce((sum, value) => sum + value, 0)
  if (total === 0) return { ecr: 34, lastSeason: 33, projected: 33 }

  const scaled = raw.map((value) => Math.round((value / total) * 100))
  const weights = { ecr: scaled[0], lastSeason: scaled[1], projected: scaled[2] }

  // the rescale above can itself drift off 100 - force it back before using
  // it as a test input, since we're only trying to generate valid starting
  // weights here, not exercise the rounding step we're about to test
  const drift = 100 - (weights.ecr + weights.lastSeason + weights.projected)
  weights.projected += drift
  return weights
}

describe('rebalance', () => {
  it('always sums to exactly 100 across many random inputs', () => {
    for (let i = 0; i < 1000; i++) {
      const weights = randomWeights()
      const changedKey = FACTOR_KEYS[Math.floor(Math.random() * FACTOR_KEYS.length)]
      const newValue = Math.floor(Math.random() * 101)

      const result = rebalance(weights, changedKey, newValue)
      const total = FACTOR_KEYS.reduce((sum, key) => sum + result[key], 0)

      expect(total).toBe(100)
      for (const key of FACTOR_KEYS) {
        expect(result[key]).toBeGreaterThanOrEqual(0)
        expect(result[key]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('splits the remainder evenly when both other factors are at 0', () => {
    const weights = { ecr: 100, lastSeason: 0, projected: 0 }

    const result = rebalance(weights, 'ecr', 40)

    expect(result).toEqual({ ecr: 40, lastSeason: 30, projected: 30 })
  })

  it('zeroes the other two factors when one is set to 100, regardless of their prior proportion', () => {
    const weights = { ecr: 20, lastSeason: 65, projected: 15 }

    const result = rebalance(weights, 'ecr', 100)

    expect(result).toEqual({ ecr: 100, lastSeason: 0, projected: 0 })
  })

  it('keeps the changed factor exactly at the requested value', () => {
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const result = rebalance(weights, 'lastSeason', 45)

    expect(result.lastSeason).toBe(45)
  })

  it('splits the remainder in proportion to the other two factors current values', () => {
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const result = rebalance(weights, 'ecr', 0)

    // remaining = 100, split 30:20 -> 60:40
    expect(result).toEqual({ ecr: 0, lastSeason: 60, projected: 40 })
  })

  it('clamps an out-of-range newValue instead of rejecting it', () => {
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const over = rebalance(weights, 'ecr', 150)
    const under = rebalance(weights, 'ecr', -20)

    expect(over.ecr).toBe(100)
    expect(under.ecr).toBe(0)
  })

  it('does not mutate the input weights object', () => {
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    rebalance(weights, 'ecr', 70)

    expect(weights).toEqual({ ecr: 50, lastSeason: 30, projected: 20 })
  })
})
