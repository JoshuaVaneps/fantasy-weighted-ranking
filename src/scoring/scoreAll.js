import { applyGamesPlayedFloor } from './gamesPlayedFloor.js'
import { zScoreByPosition } from './zScoreByPosition.js'
import { redistributeWeights } from './redistributeWeights.js'

const FACTOR_KEYS = ['ecr', 'lastSeason', 'projected']

function surname(name) {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]
}

function compareByConsensusThenSurname(a, b) {
  if (a.rankEcr !== b.rankEcr) return a.rankEcr - b.rankEcr
  return surname(a.name).localeCompare(surname(b.name))
}

/**
 * The one function the UI calls. Runs the full scoring pipeline — the
 * games-played floor, z-score normalization, missing-factor weight
 * redistribution, and finally the weighted blend itself — and returns a
 * new, sorted, ranked player list. Pure: no DOM, no fetch, no localStorage,
 * and the input array/players are never mutated.
 *
 * A player missing every factor can't be scored at all and is left out of
 * the returned list entirely (see `redistributeWeights`'s `excluded` flag).
 * Everyone else gets a `score` (the weighted sum of their z-scores) and a
 * `rank` (1-indexed position in the sorted output). Ties break by consensus
 * rank, then by surname, so the order is always deterministic.
 *
 * @param {import('../data/joinPlayers.js').Player[]} players
 * @param {{ ecr: number, lastSeason: number, projected: number }} weights - integers summing to 100
 * @returns {(import('../data/joinPlayers.js').Player & {
 *   zScores: object, missingFactors: string[], score: number, rank: number
 * })[]}
 */
export function scoreAll(players, weights) {
  const floored = applyGamesPlayedFloor(players)
  const zScored = zScoreByPosition(floored)
  const withEffectiveWeights = redistributeWeights(zScored, weights)

  const scored = withEffectiveWeights
    .filter((player) => !player.excluded)
    .map((player) => {
      const score = FACTOR_KEYS.reduce(
        (sum, key) => sum + (player.zScores[key] ?? 0) * player.effectiveWeights[key],
        0,
      )
      return { ...player, score }
    })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return compareByConsensusThenSurname(a, b)
  })

  return scored.map((player, index) => ({ ...player, rank: index + 1 }))
}
