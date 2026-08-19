import { describe, expect, it } from 'vitest'
import { joinPlayers } from './joinPlayers.js'

function consensusPlayer(overrides = {}) {
  return {
    player_id: 1,
    player_name: 'Test Player',
    player_team_id: 'KC',
    player_position_id: 'WR',
    player_bye_week: '10',
    tier: 2,
    rank_ecr: 15,
    player_filename: 'test-player.php',
    ...overrides,
  }
}

function playerPointsPlayer(overrides = {}) {
  return {
    player_id: 1,
    player_name: 'Test Player',
    team_id: 'KC',
    position_id: 'WR',
    filename: 'test-player.php',
    games: 16,
    points: 240,
    average: 15,
    ...overrides,
  }
}

function projectionsPlayer(overrides = {}) {
  return {
    fpid: 1,
    name: 'Test Player',
    position_id: 'WR',
    team_id: 'KC',
    filename: 'test-player.php',
    stats: { points: 200, points_ppr: 260, points_half: 230 },
    ...overrides,
  }
}

function masterListPlayer(overrides = {}) {
  return {
    player_id: 1,
    player_name: 'Test Player',
    position_id: 'WR',
    team_id: 'KC',
    rank_adp: 10,
    rank_adp_ppr: 8,
    ...overrides,
  }
}

describe('joinPlayers', () => {
  it('merges a player present in all three feeds', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer()],
      playerPoints: [playerPointsPlayer()],
      projections: [projectionsPlayer()],
    })

    expect(result.players).toEqual([
      {
        id: 1,
        name: 'Test Player',
        team: 'KC',
        position: 'WR',
        byeWeek: '10',
        tier: 2,
        rankEcr: 15,
        filename: 'test-player.php',
        lastSeason: { points: 240, games: 16 },
        projected: 260,
        adp: null,
      },
    ])
    expect(result.unmatched).toEqual({ playerPoints: [], projections: [] })
  })

  it('sets lastSeason to null for a rookie absent from last season, not zero', () => {
    const result = joinPlayers({
      consensus: [
        consensusPlayer({ player_id: 2, player_name: 'Rookie Player' }),
      ],
      playerPoints: [],
      projections: [projectionsPlayer({ fpid: 2, name: 'Rookie Player' })],
    })

    expect(result.players[0].lastSeason).toBeNull()
    expect(result.players[0].projected).toBe(260)
  })

  it('takes team from consensus, not from a stale team on player-points', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer({ player_team_id: 'NEW_TEAM' })],
      playerPoints: [playerPointsPlayer({ team_id: 'OLD_TEAM' })],
      projections: [],
    })

    expect(result.players[0].team).toBe('NEW_TEAM')
  })

  it('reports a player present in projections but not in rankings as unmatched, not in players', () => {
    const result = joinPlayers({
      consensus: [],
      playerPoints: [],
      projections: [projectionsPlayer({ fpid: 99, name: 'Unranked Player' })],
    })

    expect(result.players).toEqual([])
    expect(result.unmatched.projections).toEqual([
      { id: 99, name: 'Unranked Player' },
    ])
  })

  it('reports a player present in player-points but not in rankings as unmatched', () => {
    const result = joinPlayers({
      consensus: [],
      playerPoints: [
        playerPointsPlayer({ player_id: 42, player_name: 'Retired Player' }),
      ],
      projections: [],
    })

    expect(result.players).toEqual([])
    expect(result.unmatched.playerPoints).toEqual([
      { id: 42, name: 'Retired Player' },
    ])
  })

  it('reads adp from rank_adp_ppr on the master list, not rank_adp', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer()],
      playerPoints: [],
      projections: [],
      players: [masterListPlayer({ rank_adp: 10, rank_adp_ppr: 8 })],
    })

    expect(result.players[0].adp).toBe(8)
  })

  it('sets adp to null for a player absent from the master list', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer()],
      playerPoints: [],
      projections: [],
      players: [],
    })

    expect(result.players[0].adp).toBeNull()
  })

  it('treats rank_adp_ppr: 0 as unranked, not an ADP of zero', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer()],
      playerPoints: [],
      projections: [],
      players: [
        masterListPlayer({ team_id: 'FA', rank_adp: 0, rank_adp_ppr: 0 }),
      ],
    })

    expect(result.players[0].adp).toBeNull()
  })

  it('defaults adp to null for everyone when the players feed is omitted', () => {
    const result = joinPlayers({
      consensus: [consensusPlayer()],
      playerPoints: [],
      projections: [],
    })

    expect(result.players[0].adp).toBeNull()
  })
})
