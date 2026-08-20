import { describe, expect, it } from 'vitest'
import { applyGamesPlayedFloor } from './gamesPlayedFloor.js'
import { joinPlayers } from '../data/joinPlayers.js'
import consensusFixture from '../../fixtures/consensus-rankings.json'
import playerPointsFixture from '../../fixtures/player-points.json'

function playerWithLastSeason(overrides = {}) {
  return {
    id: 1,
    name: 'Test Player',
    team: 'KC',
    position: 'WR',
    byeWeek: '10',
    tier: 2,
    rankEcr: 15,
    filename: 'test-player.php',
    lastSeason: { points: 240, games: 16, pointsPerGame: 15 },
    projected: 260,
    adp: null,
    ...overrides,
  }
}

describe('applyGamesPlayedFloor', () => {
  it('nulls out lastSeason for a player below the default floor of 4', () => {
    const players = [
      playerWithLastSeason({
        lastSeason: { points: 11.6, games: 3, pointsPerGame: 3.9 },
      }),
    ]

    const result = applyGamesPlayedFloor(players)

    expect(result[0].lastSeason).toBeNull()
  })

  it('leaves lastSeason alone for a player at exactly the floor', () => {
    const players = [
      playerWithLastSeason({
        lastSeason: { points: 40, games: 4, pointsPerGame: 10 },
      }),
    ]

    const result = applyGamesPlayedFloor(players)

    expect(result[0].lastSeason).toEqual({ points: 40, games: 4, pointsPerGame: 10 })
  })

  it('leaves lastSeason alone for a player comfortably above the floor', () => {
    const players = [playerWithLastSeason()]

    const result = applyGamesPlayedFloor(players)

    expect(result[0].lastSeason).toEqual({ points: 240, games: 16, pointsPerGame: 15 })
  })

  it('leaves an already-missing lastSeason as null, e.g. a rookie', () => {
    const players = [playerWithLastSeason({ lastSeason: null })]

    const result = applyGamesPlayedFloor(players)

    expect(result[0].lastSeason).toBeNull()
  })

  it('treats a missing games value as below the floor rather than passing it through', () => {
    const players = [
      playerWithLastSeason({
        lastSeason: { points: 0, games: undefined, pointsPerGame: 0 },
      }),
    ]

    const result = applyGamesPlayedFloor(players)

    expect(result[0].lastSeason).toBeNull()
  })

  it('respects a configurable floor', () => {
    const players = [
      playerWithLastSeason({
        lastSeason: { points: 50, games: 5, pointsPerGame: 10 },
      }),
    ]

    expect(applyGamesPlayedFloor(players, 4)[0].lastSeason).not.toBeNull()
    expect(applyGamesPlayedFloor(players, 6)[0].lastSeason).toBeNull()
  })

  it('does not mutate the input array', () => {
    const players = [
      playerWithLastSeason({
        lastSeason: { points: 11.6, games: 3, pointsPerGame: 3.9 },
      }),
    ]

    applyGamesPlayedFloor(players)

    expect(players[0].lastSeason).not.toBeNull()
  })

  it('excludes a real short-season player from the fixtures, hand-verified against a healthy teammate', () => {
    // Najee Harris (id 19302) played 3 games in the captured fixture season —
    // an injured starter, exactly the case this ticket exists for. Verified
    // by hand against fixtures/player-points.json: games: 3, below the
    // default floor of 4.
    const { players } = joinPlayers({
      consensus: consensusFixture.players,
      playerPoints: playerPointsFixture.players,
      projections: [],
    })

    const najeeHarris = players.find((player) => player.id === 19302)
    expect(najeeHarris.lastSeason.games).toBe(3)

    const result = applyGamesPlayedFloor(players)
    const flooredNajeeHarris = result.find((player) => player.id === 19302)

    expect(flooredNajeeHarris.lastSeason).toBeNull()
  })
})
