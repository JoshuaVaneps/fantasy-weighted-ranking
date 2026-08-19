import { request } from './request.js'
import { PROJECTION_POSITIONS } from './constants.js'

const ECHOED_POSITIONS = PROJECTION_POSITIONS.split(':').join(',')

/**
 * @typedef {object} ProjectionsPlayer
 * @property {number} fpid
 * @property {string} name
 * @property {string} position_id
 * @property {object} stats
 * @property {number} stats.points
 * @property {number} stats.points_ppr
 * @property {number} stats.points_half
 */

/**
 * @typedef {object} ProjectionsResponse
 * @property {string} season
 * @property {string} positions
 * @property {number|string} count
 * @property {ProjectionsPlayer[]} players
 */

/**
 * Fetches current-season projections. Unlike the other three endpoints,
 * `scoring` is not part of this call at all: the endpoint ignores that
 * param completely and always returns STD totals in `stats.points` — it
 * quietly returns the same payload no matter what you send. PPR is still
 * available, just under a different field: read `stats.points_ppr` per
 * player instead of asking the query string for it.
 *
 * @param {number} season
 * @returns {Promise<{ok: true, data: ProjectionsResponse} | {ok: false, error: object}>}
 */
export function getProjections(season) {
  return request(`/${season}/projections`, {
    searchParams: { positions: PROJECTION_POSITIONS, week: 0 },
    // This endpoint echoes the season under `season`, not `year` like the
    // other three — and as a string, not a number.
    echo: { season: String(season), positions: ECHOED_POSITIONS },
    rowsKey: 'players',
    minRows: 50,
  })
}
