const FACTORS = [
  // ECR is already a cross-position expert ranking, not a raw stat total, so
  // it's normalized once across the whole player pool rather than per
  // position — that's what keeps a 100% consensus-weighted board in the
  // same order as raw consensus rank. lastSeason and projected are raw
  // point totals that genuinely differ by position (a low-end RB can outscore
  // an elite TE), so those stay position-scoped to avoid the blend skewing
  // toward high-scoring positions.
  { key: 'ecr', getRaw: (player) => player.rankEcr, invert: true, scope: 'global' },
  {
    key: 'lastSeason',
    getRaw: (player) => (player.lastSeason ? player.lastSeason.pointsPerGame : null),
    invert: false,
    scope: 'position',
  },
  { key: 'projected', getRaw: (player) => player.projected, invert: false, scope: 'position' },
]

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdev(values, avg) {
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function groupByPosition(players) {
  const byPosition = new Map()
  for (const player of players) {
    if (!byPosition.has(player.position)) byPosition.set(player.position, [])
    byPosition.get(player.position).push(player)
  }
  return byPosition
}

/**
 * Converts each player's raw scoring factors (consensus rank, last-season
 * points-per-game, projected points) into z-scores. `lastSeason` and
 * `projected` are computed within each player's own position group; `ecr`
 * is computed once across the whole player pool (see the note on `FACTORS`
 * above). Consensus is inverted, since a lower rank is better there but
 * higher is better everywhere else. A player missing a factor
 * (`lastSeason: null` or `projected: null`) is excluded from that factor's
 * mean and standard deviation entirely — not treated as 0 — and their own
 * z-score for that factor stays `null`.
 *
 * @param {import('../data/joinPlayers.js').Player[]} players
 * @returns {(import('../data/joinPlayers.js').Player & {
 *   zScores: { ecr: number | null, lastSeason: number | null, projected: number | null }
 * })[]}
 */
export function zScoreByPosition(players) {
  const zScoresById = new Map()
  for (const player of players) zScoresById.set(player.id, {})

  for (const factor of FACTORS) {
    const groups =
      factor.scope === 'global' ? [players] : [...groupByPosition(players).values()]

    for (const groupPlayers of groups) {
      const rawValues = groupPlayers
        .map((player) => factor.getRaw(player))
        .filter((value) => value !== null)

      const avg = rawValues.length ? mean(rawValues) : 0
      const sd = rawValues.length ? stdev(rawValues, avg) : 0

      for (const player of groupPlayers) {
        const raw = factor.getRaw(player)
        let z = null
        if (raw !== null) {
          z = sd === 0 ? 0 : (raw - avg) / sd
          if (factor.invert) z *= -1
          if (z === 0) z = 0 // normalizes -0 (e.g. inverting a 0 z-score) to 0
        }
        zScoresById.get(player.id)[factor.key] = z
      }
    }
  }

  return players.map((player) => ({ ...player, zScores: zScoresById.get(player.id) }))
}
