import { request } from './request.js'
import { SCORING } from './constants.js'

/**
 * @typedef {object} PlayerPointsPlayer
 * @property {number} player_id
 * @property {string} player_name
 * @property {string} team_id
 * @property {string} position_id
 * @property {number} games
 * @property {number} points
 * @property {number} average
 */

/**
 * @typedef {object} PlayerPointsResponse
 * @property {string} season
 * @property {string} scoring
 * @property {PlayerPointsPlayer[]} players
 */

/**
 * Fetches a season's actual scored points via the player-points endpoint —
 * this is what feeds the "last season" factor, using the feed's own
 * `average` field for points-per-game rather than deriving it. There's no
 * endpoint literally named "prior season"; the caller is expected to pass
 * last year's season number.
 *
 * @param {number} season
 * @returns {Promise<{ok: true, data: PlayerPointsResponse} | {ok: false, error: object}>}
 */
export function getPriorSeason(season) {
  return request(`/${season}/player-points`, {
    searchParams: { scoring: SCORING },
    // Same as projections: this endpoint echoes the season under `season`,
    // not `year`, and as a string, not a number.
    echo: { season: String(season), scoring: SCORING },
    rowsKey: 'players',
    minRows: 50,
  })
}
