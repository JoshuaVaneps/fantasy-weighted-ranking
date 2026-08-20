import { describe, expect, it } from 'vitest'
import { redistributeWeights } from './redistributeWeights.js'

function player(zScores, overrides = {}) {
  return {
    id: 1,
    name: 'Test Player',
    team: 'KC',
    position: 'WR',
    byeWeek: '10',
    tier: 2,
    rankEcr: 20,
    filename: 'test-player.php',
    lastSeason: { points: 200, games: 16, pointsPerGame: 12.5 },
    projected: 200,
    adp: null,
    zScores,
    ...overrides,
  }
}

describe('redistributeWeights', () => {
  it('leaves effective weights matching the raw weights when every factor is present', () => {
    const players = [player({ ecr: 1, lastSeason: 0.5, projected: -0.2 })]
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const [result] = redistributeWeights(players, weights)

    expect(result.effectiveWeights).toEqual({ ecr: 0.5, lastSeason: 0.3, projected: 0.2 })
    expect(result.missingFactors).toEqual([])
    expect(result.excluded).toBe(false)
    expect(result.exclusionReason).toBeNull()
  })

  it("redistributes a rookie's missing lastSeason weight across ecr and projected", () => {
    const players = [player({ ecr: 1.2, lastSeason: null, projected: 0.4 })]
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const [result] = redistributeWeights(players, weights)

    // totalAvailableWeight = 50 + 20 = 70
    expect(result.effectiveWeights).toEqual({
      ecr: 50 / 70,
      lastSeason: 0,
      projected: 20 / 70,
    })
    expect(result.missingFactors).toEqual(['lastSeason'])
    expect(result.excluded).toBe(false)
  })

  it('sums the redistributed effective weights to 1 for a player missing one factor', () => {
    const players = [player({ ecr: null, lastSeason: 0.3, projected: -1.1 })]
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const [result] = redistributeWeights(players, weights)
    const total = result.effectiveWeights.ecr + result.effectiveWeights.lastSeason + result.effectiveWeights.projected

    expect(total).toBeCloseTo(1, 10)
  })

  it('excludes a player missing all three factors, with a stated reason', () => {
    const players = [player({ ecr: null, lastSeason: null, projected: null })]
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    const [result] = redistributeWeights(players, weights)

    expect(result.excluded).toBe(true)
    expect(result.exclusionReason).toBe('No scoring factors available')
    expect(result.effectiveWeights).toBeNull()
    expect(result.missingFactors).toEqual(['ecr', 'lastSeason', 'projected'])
  })

  it('splits evenly across available factors when their combined raw weight is 0', () => {
    const players = [player({ ecr: 1, lastSeason: null, projected: 0.6 })]
    const weights = { ecr: 0, lastSeason: 100, projected: 0 }

    const [result] = redistributeWeights(players, weights)

    expect(result.effectiveWeights).toEqual({ ecr: 0.5, lastSeason: 0, projected: 0.5 })
  })

  it('does not mutate the input array', () => {
    const players = [player({ ecr: 1, lastSeason: 0.5, projected: -0.2 })]
    const weights = { ecr: 50, lastSeason: 30, projected: 20 }

    redistributeWeights(players, weights)

    expect(players[0].effectiveWeights).toBeUndefined()
  })
})
