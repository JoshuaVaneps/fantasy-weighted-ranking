import { describe, expect, it } from 'vitest'
import { scoreAll } from './scoreAll.js'
import { joinPlayers } from '../data/joinPlayers.js'
import { sortByConsensus } from '../data/sortByConsensus.js'
import consensusFixture from '../../fixtures/consensus-rankings.json'
import playerPointsFixture from '../../fixtures/player-points.json'
import projectionsFixture from '../../fixtures/projections.json'

const EQUAL_WEIGHTS = { ecr: 34, lastSeason: 33, projected: 33 }
const ECR_ONLY_WEIGHTS = { ecr: 100, lastSeason: 0, projected: 0 }

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

// A handful of real, well-known players pulled from the committed fixtures,
// across four positions, plus Najee Harris (id 19302) whose real 3-game
// season exercises the floor -> missing-factor path end to end.
const SNAPSHOT_IDS = [19788, 23180, 22968, 23133, 17298, 17233, 22955, 22936, 19302]

function realPlayers() {
  const { players } = joinPlayers({
    consensus: consensusFixture.players,
    playerPoints: playerPointsFixture.players,
    projections: projectionsFixture.players,
  })
  return players.filter((p) => SNAPSHOT_IDS.includes(p.id))
}

describe('scoreAll', () => {
  it('reproduces exact raw consensus order when weight is 100% on ecr', () => {
    const players = [
      player({ id: 1, position: 'WR', rankEcr: 5 }),
      player({ id: 2, position: 'TE', rankEcr: 40 }),
      player({ id: 3, position: 'RB', rankEcr: 12 }),
      player({ id: 4, position: 'QB', rankEcr: 1 }),
      player({ id: 5, position: 'WR', rankEcr: 27 }),
    ]

    const scoredIds = scoreAll(players, ECR_ONLY_WEIGHTS).map((p) => p.id)
    const consensusIds = sortByConsensus(players).map((p) => p.id)

    expect(scoredIds).toEqual(consensusIds)
  })

  it('reproduces exact raw consensus order on the real fixture data, across all positions', () => {
    const { players } = joinPlayers({
      consensus: consensusFixture.players,
      playerPoints: playerPointsFixture.players,
      projections: projectionsFixture.players,
    })

    const scoredIds = scoreAll(players, ECR_ONLY_WEIGHTS).map((p) => p.id)
    const consensusIds = sortByConsensus(players).map((p) => p.id)

    expect(scoredIds).toEqual(consensusIds)
  })

  it('breaks an exact score tie by consensus rank, then surname', () => {
    const players = [
      player({ id: 1, name: 'Test Young', rankEcr: 15 }),
      player({ id: 2, name: 'Test Adams', rankEcr: 15 }),
    ]

    const result = scoreAll(players, ECR_ONLY_WEIGHTS)

    expect(result.map((p) => p.name)).toEqual(['Test Adams', 'Test Young'])
  })

  it('returns a new array and does not mutate the input players', () => {
    const players = [player({ id: 1 }), player({ id: 2, rankEcr: 30 })]

    const result = scoreAll(players, EQUAL_WEIGHTS)

    expect(result).not.toBe(players)
    expect(players[0].score).toBeUndefined()
    expect(players[0].rank).toBeUndefined()
  })

  it('never lets adp influence the score or the order', () => {
    const players = [
      player({ id: 1, rankEcr: 5, adp: 1 }),
      player({ id: 2, rankEcr: 15, adp: 200 }),
      player({ id: 3, rankEcr: 25, adp: null }),
    ]
    const playersWithScrambledAdp = players.map((p) => ({ ...p, adp: null }))

    const result = scoreAll(players, EQUAL_WEIGHTS)
    const resultWithScrambledAdp = scoreAll(playersWithScrambledAdp, EQUAL_WEIGHTS)

    expect(result.map((p) => ({ id: p.id, score: p.score }))).toEqual(
      resultWithScrambledAdp.map((p) => ({ id: p.id, score: p.score })),
    )
  })

  it('excludes a player missing every factor rather than crashing or scoring them as 0', () => {
    const players = [
      player({ id: 1, rankEcr: 5 }),
      player({ id: 2, rankEcr: null, lastSeason: null, projected: null }),
    ]

    const result = scoreAll(players, EQUAL_WEIGHTS)

    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('matches a snapshot over a curated slice of real fixture data', () => {
    const result = scoreAll(realPlayers(), EQUAL_WEIGHTS).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      missingFactors: p.missingFactors,
      rank: p.rank,
      score: Number(p.score.toFixed(4)),
    }))

    expect(result).toMatchSnapshot()
  })
})
