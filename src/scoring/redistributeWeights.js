const FACTOR_KEYS = ['ecr', 'lastSeason', 'projected']

/**
 * Turns each player's z-scores and the user's global weights into the
 * per-player weight fractions DRAFT-20's blend will actually use. A missing
 * factor (z-score `null`) has its weight spread proportionally across that
 * player's remaining factors, so a rookie is judged on consensus and
 * projections rather than being silently penalized to zero. A player
 * missing all three factors can't be scored at all, so they're excluded
 * with a stated reason instead.
 *
 * @param {(import('../data/joinPlayers.js').Player & {
 *   zScores: { ecr: number | null, lastSeason: number | null, projected: number | null }
 * })[]} players
 * @param {{ ecr: number, lastSeason: number, projected: number }} weights - integers summing to 100
 * @returns {(import('../data/joinPlayers.js').Player & {
 *   zScores: object,
 *   missingFactors: string[],
 *   excluded: boolean,
 *   exclusionReason: string | null,
 *   effectiveWeights: { ecr: number, lastSeason: number, projected: number } | null
 * })[]}
 */
export function redistributeWeights(players, weights) {
  return players.map((player) => {
    const available = FACTOR_KEYS.filter((key) => player.zScores[key] !== null)
    const missingFactors = FACTOR_KEYS.filter((key) => player.zScores[key] === null)

    if (available.length === 0) {
      return {
        ...player,
        missingFactors,
        excluded: true,
        exclusionReason: 'No scoring factors available',
        effectiveWeights: null,
      }
    }

    const totalAvailableWeight = available.reduce((sum, key) => sum + weights[key], 0)

    const effectiveWeights = {}
    for (const key of FACTOR_KEYS) {
      if (!available.includes(key)) {
        effectiveWeights[key] = 0
      } else if (totalAvailableWeight === 0) {
        // every available factor was dialed to 0 weight - split evenly
        // rather than dividing by zero
        effectiveWeights[key] = 1 / available.length
      } else {
        effectiveWeights[key] = weights[key] / totalAvailableWeight
      }
    }

    return {
      ...player,
      missingFactors,
      excluded: false,
      exclusionReason: null,
      effectiveWeights,
    }
  })
}
