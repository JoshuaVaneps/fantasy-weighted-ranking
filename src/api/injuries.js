import { request } from './request.js'

/**
 * @typedef {object} InjuryRecord
 * @property {number} player_id
 * @property {string} name
 * @property {string} team_id
 * @property {string} position_id
 * @property {string} status
 * @property {string} status_short
 * @property {string} injury_type
 * @property {string} comment
 * @property {string} injury_update_date
 * @property {number|null} probability_of_playing
 */

/**
 * @typedef {object} InjuriesResponse
 * @property {string} sport
 * @property {number|string} count
 * @property {InjuryRecord[]} injuries
 */

/**
 * Fetches current injury statuses. This is display-only data — it drives a
 * badge and never touches the ranking math — so it's the one endpoint with
 * no per-player weighting concerns. It also lives outside the season-scoped
 * `/{season}/` path shape entirely: calling it under a season segment
 * returns a 403 that reads like an auth failure but is actually just the
 * wrong path.
 *
 * @returns {Promise<{ok: true, data: InjuriesResponse} | {ok: false, error: object}>}
 */
export function getInjuries() {
  return request('/injuries', {
    rowsKey: 'injuries',
  })
}
