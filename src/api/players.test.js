import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlayers, hasRankedAdp } from './players.js'

function mockResponse(body) {
  return { ok: true, status: 200, json: async () => body }
}

function masterListPlayer(overrides = {}) {
  return {
    player_id: 1,
    player_name: 'Test Player',
    team_id: 'KC',
    rank_adp_ppr: 8,
    ...overrides,
  }
}

// A response big enough to clear getPlayers' own minRows floor, so tests
// can focus on the ranked-players filter without also needing 3000+ rows
// of filler just to get past the row-count guard.
function bulkRoster(count) {
  return Array.from({ length: count }, (_, i) =>
    masterListPlayer({ player_id: 1000 + i, rank_adp_ppr: 0 }),
  )
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('hasRankedAdp', () => {
  it('is true for a player with a real ADP', () => {
    expect(hasRankedAdp(masterListPlayer({ rank_adp_ppr: 8 }))).toBe(true)
  })

  it('is false for rank_adp_ppr: 0 (retired/unranked)', () => {
    expect(hasRankedAdp(masterListPlayer({ team_id: 'FA', rank_adp_ppr: 0 }))).toBe(
      false,
    )
  })

  it('is true for a player tagged team_id "FA" who still has a real ADP', () => {
    expect(hasRankedAdp(masterListPlayer({ team_id: 'FA', rank_adp_ppr: 12 }))).toBe(
      true,
    )
  })
})

describe('getPlayers', () => {
  it('drops unranked players and keeps ranked ones, including FA-tagged ones', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        players: [
          ...bulkRoster(3000),
          masterListPlayer({ player_id: 1, rank_adp_ppr: 8 }),
          masterListPlayer({ player_id: 2, team_id: 'FA', rank_adp_ppr: 0 }),
          masterListPlayer({ player_id: 3, team_id: 'FA', rank_adp_ppr: 12 }),
        ],
      }),
    )

    const result = await getPlayers()

    expect(result.data.players.map((p) => p.player_id)).toEqual([1, 3])
  })

  it('checks minRows against the raw, unfiltered response', async () => {
    // Below the 3000 floor even before filtering — should fail regardless
    // of how many entries would survive the ranked-players filter.
    global.fetch.mockResolvedValue(
      mockResponse({ players: bulkRoster(10).map((p) => ({ ...p, rank_adp_ppr: 5 })) }),
    )

    const result = await getPlayers()

    expect(result.ok).toBe(false)
    expect(result.error.type).toBe('low_row_count')
  })

  it('passes through a failed request unchanged', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const result = await getPlayers()

    expect(result.ok).toBe(false)
  })
})
