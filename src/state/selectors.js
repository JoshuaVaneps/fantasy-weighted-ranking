import { scoreAll } from '../scoring/scoreAll.js'
import { shallowEqual } from './store.js'

let cache = null

/**
 * Derives the ranked player list from state, memoized on the two inputs
 * that actually feed `scoreAll` — `rawPlayers` and `weights`. A state
 * change to anything else (status, error, settings, ...) returns the same
 * cached array instead of recomputing.
 *
 * @param {{ rawPlayers: object[], weights: { ecr: number, lastSeason: number, projected: number } }} state
 * @returns {object[]}
 */
export function getRankedPlayers(state) {
  const { rawPlayers, weights } = state

  if (cache && cache.rawPlayers === rawPlayers && shallowEqual(cache.weights, weights)) {
    return cache.result
  }

  const result = scoreAll(rawPlayers, weights)
  cache = { rawPlayers, weights, result }
  return result
}
