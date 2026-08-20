import { describe, expect, it } from 'vitest'
import { getRankedPlayers } from './selectors.js'
import { joinPlayers } from '../data/joinPlayers.js'
import consensusFixture from '../../fixtures/consensus-rankings.json'
import playerPointsFixture from '../../fixtures/player-points.json'
import projectionsFixture from '../../fixtures/projections.json'

const WEIGHTS = { ecr: 34, lastSeason: 33, projected: 33 }

function player(overrides = {}) {
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
    ...overrides,
  }
}

describe('getRankedPlayers', () => {
  it('returns the same array reference on repeated calls with unchanged inputs', () => {
    const rawPlayers = [player({ id: 1 }), player({ id: 2, rankEcr: 5 })]
    const weights = { ...WEIGHTS }

    const first = getRankedPlayers({ status: 'loading', rawPlayers, weights })
    const second = getRankedPlayers({ status: 'loading', rawPlayers, weights })

    expect(second).toBe(first)
  })

  it('recomputes when weights change', () => {
    const rawPlayers = [player({ id: 1 }), player({ id: 2, rankEcr: 5 })]

    const first = getRankedPlayers({ rawPlayers, weights: { ...WEIGHTS } })
    const second = getRankedPlayers({ rawPlayers, weights: { ecr: 100, lastSeason: 0, projected: 0 } })

    expect(second).not.toBe(first)
  })

  it('recomputes when rawPlayers changes', () => {
    const weights = { ...WEIGHTS }

    const first = getRankedPlayers({ rawPlayers: [player({ id: 1 })], weights })
    const second = getRankedPlayers({ rawPlayers: [player({ id: 1 })], weights })

    expect(second).not.toBe(first)
  })

  it('does not recompute when an unrelated field changes', () => {
    const rawPlayers = [player({ id: 1 }), player({ id: 2, rankEcr: 5 })]
    const weights = { ...WEIGHTS }

    const first = getRankedPlayers({ status: 'loading', error: null, rawPlayers, weights })
    const second = getRankedPlayers({ status: 'ready', error: 'ignored', rawPlayers, weights })

    expect(second).toBe(first)
  })

  it('ranks the full fixture player list in under 100ms', () => {
    const { players } = joinPlayers({
      consensus: consensusFixture.players,
      playerPoints: playerPointsFixture.players,
      projections: projectionsFixture.players,
    })

    const start = performance.now()
    const result = getRankedPlayers({ rawPlayers: players, weights: { ...WEIGHTS } })
    const duration = performance.now() - start

    expect(result.length).toBeGreaterThan(0)
    expect(duration).toBeLessThan(100)
  })
})
