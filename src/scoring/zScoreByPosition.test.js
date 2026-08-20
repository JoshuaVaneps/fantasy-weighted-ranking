import { describe, expect, it } from 'vitest'
import { zScoreByPosition } from './zScoreByPosition.js'

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

describe('zScoreByPosition', () => {
  it('scores 0 for a player sitting exactly at the position mean', () => {
    const players = [
      player({ id: 1, rankEcr: 10, lastSeason: { games: 16, pointsPerGame: 10 }, projected: 100 }),
      player({ id: 2, rankEcr: 20, lastSeason: { games: 16, pointsPerGame: 20 }, projected: 200 }),
      player({ id: 3, rankEcr: 30, lastSeason: { games: 16, pointsPerGame: 30 }, projected: 300 }),
    ]

    const [, atMean] = zScoreByPosition(players)

    expect(atMean.zScores).toEqual({ ecr: 0, lastSeason: 0, projected: 0 })
  })

  it('matches hand-computed z-scores for a 4-player group, and inverts ecr so the best (lowest) rank gets the highest z', () => {
    // mean/stdev/z worked out by hand from the formulas in docs/buildplan.html:
    //   ecr:  raw [5,18,34,47]           mean 26      stdev ~15.8902
    //   ppg:  raw [22.4,15.1,9.8,4.5]    mean 12.95   stdev ~6.6191
    //   proj: raw [241.7,190.3,140.2,88.9] mean 165.275 stdev ~56.8527
    const players = [
      player({ id: 1, rankEcr: 5, lastSeason: { games: 16, pointsPerGame: 22.4 }, projected: 241.7 }),
      player({ id: 2, rankEcr: 18, lastSeason: { games: 16, pointsPerGame: 15.1 }, projected: 190.3 }),
      player({ id: 3, rankEcr: 34, lastSeason: { games: 16, pointsPerGame: 9.8 }, projected: 140.2 }),
      player({ id: 4, rankEcr: 47, lastSeason: { games: 16, pointsPerGame: 4.5 }, projected: 88.9 }),
    ]

    const [best, second, third, worst] = zScoreByPosition(players)

    expect(best.zScores.ecr).toBeCloseTo(1.3215652286, 8)
    expect(second.zScores.ecr).toBeCloseTo(0.5034534204, 8)
    expect(third.zScores.ecr).toBeCloseTo(-0.5034534204, 8)
    expect(worst.zScores.ecr).toBeCloseTo(-1.3215652286, 8)

    expect(best.zScores.lastSeason).toBeCloseTo(1.4276862960, 8)
    expect(worst.zScores.lastSeason).toBeCloseTo(-1.2766083811, 8)

    expect(best.zScores.projected).toBeCloseTo(1.3442628387, 8)
    expect(worst.zScores.projected).toBeCloseTo(-1.3433833733, 8)

    // best rank (5, numerically lowest) must outrank worst rank (47) after inversion
    expect(best.zScores.ecr).toBeGreaterThan(worst.zScores.ecr)
  })

  it('yields 0 rather than NaN for a one-player position group', () => {
    const players = [player({ id: 1 })]

    const [only] = zScoreByPosition(players)

    expect(only.zScores).toEqual({ ecr: 0, lastSeason: 0, projected: 0 })
  })

  it('keeps a missing factor null rather than turning it into 0', () => {
    const players = [
      player({ id: 1, lastSeason: null }),
      player({ id: 2, projected: null }),
    ]

    const [rookie, noProjection] = zScoreByPosition(players)

    expect(rookie.zScores.lastSeason).toBeNull()
    expect(noProjection.zScores.projected).toBeNull()
  })

  it('excludes a null factor from the group mean/stdev instead of counting it as 0', () => {
    const withoutThirdPlayer = zScoreByPosition([
      player({ id: 1, lastSeason: { games: 16, pointsPerGame: 18 } }),
      player({ id: 2, lastSeason: { games: 16, pointsPerGame: 12 } }),
    ])

    const withThirdPlayer = zScoreByPosition([
      player({ id: 1, lastSeason: { games: 16, pointsPerGame: 18 } }),
      player({ id: 2, lastSeason: { games: 16, pointsPerGame: 12 } }),
      player({ id: 3, lastSeason: null }),
    ])

    // by hand: mean 15, stdev 3 -> z = 1 and -1
    expect(withoutThirdPlayer[0].zScores.lastSeason).toBeCloseTo(1, 8)
    expect(withoutThirdPlayer[1].zScores.lastSeason).toBeCloseTo(-1, 8)

    // adding a null-factor player must not move the other two players' z-scores
    expect(withThirdPlayer[0].zScores.lastSeason).toBe(withoutThirdPlayer[0].zScores.lastSeason)
    expect(withThirdPlayer[1].zScores.lastSeason).toBe(withoutThirdPlayer[1].zScores.lastSeason)
    expect(withThirdPlayer[2].zScores.lastSeason).toBeNull()
  })

  it('never compares lastSeason or projected across position groups', () => {
    const players = [
      player({ id: 1, position: 'WR', rankEcr: 1, lastSeason: { games: 16, pointsPerGame: 30 }, projected: 300 }),
      player({ id: 2, position: 'TE', rankEcr: 1, lastSeason: { games: 16, pointsPerGame: 30 }, projected: 300 }),
    ]

    const [wr, te] = zScoreByPosition(players)

    // each is the only player in their position group for these two factors,
    // so both are lone-group 0s, never blended against the other position's numbers
    expect(wr.zScores.lastSeason).toBe(0)
    expect(wr.zScores.projected).toBe(0)
    expect(te.zScores.lastSeason).toBe(0)
    expect(te.zScores.projected).toBe(0)
  })

  it('computes ecr across the whole player pool, not per position, so 100% consensus weight can reproduce raw consensus order', () => {
    // by hand: raw ecr [10, 20, 30, 40] as ONE pool -> mean 25, stdev ~11.1803
    // (a per-position calc would instead split this into two 2-player groups
    // with mean 15/35 and stdev 5, giving every player z = +-1 — different
    // numbers entirely, which is the bug this test guards against)
    const players = [
      player({ id: 1, position: 'WR', rankEcr: 10 }),
      player({ id: 2, position: 'WR', rankEcr: 20 }),
      player({ id: 3, position: 'TE', rankEcr: 30 }),
      player({ id: 4, position: 'TE', rankEcr: 40 }),
    ]

    const [wr1, wr2, te1, te2] = zScoreByPosition(players)

    expect(wr1.zScores.ecr).toBeCloseTo(1.3416407865, 8)
    expect(wr2.zScores.ecr).toBeCloseTo(0.4472135955, 8)
    expect(te1.zScores.ecr).toBeCloseTo(-0.4472135955, 8)
    expect(te2.zScores.ecr).toBeCloseTo(-1.3416407865, 8)
  })

  it('does not mutate the input array', () => {
    const players = [player({ id: 1 })]

    zScoreByPosition(players)

    expect(players[0].zScores).toBeUndefined()
  })
})
