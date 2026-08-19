import { request } from './request.js'

/**
 * @typedef {object} MasterListPlayer
 * @property {number} player_id
 * @property {string} player_name
 * @property {string} position_id
 * @property {string} team_id
 * @property {number} rank_adp
 * @property {number} rank_adp_ppr
 */

/**
 * @typedef {object} PlayersResponse
 * @property {number|string} count
 * @property {MasterListPlayer[]} players
 */

/**
 * True for a master-list entry that has a real ADP. `team_id === 'FA'` is
 * NOT a safe proxy for "unranked" — some players briefly carry it while
 * between teams and still have a real rank_adp_ppr. rank_adp_ppr > 0 alone
 * is the correct signal; retired players carry it as 0.
 *
 * @param {MasterListPlayer} player
 * @returns {boolean}
 */
export function hasRankedAdp(player) {
  return player.rank_adp_ppr > 0
}

/**
 * Fetches the player master list, filtered down to players with real ADP —
 * the only feed that carries it. PPR everywhere: read `rank_adp_ppr`, not
 * `rank_adp` (which is STD), same as every other PPR-format field in this
 * app.
 *
 * The raw list is an all-time roster, not an active one — retired players
 * are included and carry `rank_adp_ppr: 0`, meaning "unranked," not an ADP
 * of zero. That's filtered out here, at the API boundary, so nothing
 * downstream has to know the trap ever existed. See `hasRankedAdp`.
 *
 * The row-count floor (minRows) is checked against the raw, unfiltered
 * response — it exists to catch a downgraded API tier, which is a
 * different concern from this filter.
 *
 * Like injuries, this endpoint has no season segment — calling it under
 * `/{season}/players` 403s in a way that reads like an auth failure but
 * isn't.
 *
 * @returns {Promise<{ok: true, data: PlayersResponse} | {ok: false, error: object}>}
 */
export async function getPlayers() {
  const result = await request('/players', {
    rowsKey: 'players',
    minRows: 3000,
  })

  if (!result.ok) return result

  return {
    ok: true,
    data: {
      ...result.data,
      players: result.data.players.filter(hasRankedAdp),
    },
  }
}
