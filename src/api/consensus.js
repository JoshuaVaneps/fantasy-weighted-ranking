import { request } from './request.js'
import { SCORING } from './constants.js'

/**
 * @typedef {object} ConsensusPlayer
 * @property {number} player_id
 * @property {string} player_name
 * @property {string} player_team_id
 * @property {string} player_position_id
 * @property {string} player_bye_week
 * @property {number} rank_ecr
 * @property {number} tier
 */

/**
 * @typedef {object} ConsensusResponse
 * @property {string} year
 * @property {string} scoring
 * @property {number} count
 * @property {ConsensusPlayer[]} players
 */

/**
 * Fetches expert consensus rankings for a season. This is the spine feed —
 * the only one carrying bye week and tier — so every other feed enriches
 * onto the player list this returns.
 *
 * @param {number} season
 * @returns {Promise<{ok: true, data: ConsensusResponse} | {ok: false, error: object}>}
 */
export function getConsensus(season) {
  return request(`/${season}/consensus-rankings`, {
    searchParams: { position: 'ALL', scoring: SCORING, week: 0 },
    // year comes back as a string ("2026"), not a number — echo against
    // the same type the API actually returns, not the type we sent.
    echo: { year: String(season), scoring: SCORING },
    rowsKey: 'players',
    minRows: 50,
  })
}
