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
 * Fetches the full player master list — the only feed that carries ADP.
 * PPR everywhere: read `rank_adp_ppr`, not `rank_adp` (which is STD), same
 * as every other PPR-format field in this app. This is an all-time roster,
 * not an active one — retired players are included and carry
 * `rank_adp_ppr: 0`, meaning "unranked," not an ADP of zero; callers must
 * treat that as missing. Like injuries, this endpoint has no season
 * segment — calling it under `/{season}/players` 403s in a way that reads
 * like an auth failure but isn't.
 *
 * @returns {Promise<{ok: true, data: PlayersResponse} | {ok: false, error: object}>}
 */
export function getPlayers() {
  return request('/players', {
    rowsKey: 'players',
    minRows: 3000,
  })
}
