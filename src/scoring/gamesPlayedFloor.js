const DEFAULT_FLOOR = 4

/**
 * Applies the games-played floor to a joined player list, before any
 * normalization happens. A player whose `lastSeason.games` is below the
 * floor is treated as missing that factor entirely — `lastSeason` becomes
 * `null` — rather than as a bad season. This has to run before z-scoring:
 * a below-floor player must be excluded from their position group's mean
 * and standard deviation, not zeroed and masked afterward.
 *
 * @param {import('../data/joinPlayers.js').Player[]} players
 * @param {number} [floor] - minimum games played to count last season as
 *   real data. Defaults to 4.
 * @returns {import('../data/joinPlayers.js').Player[]}
 */
export function applyGamesPlayedFloor(players, floor = DEFAULT_FLOOR) {
  return players.map((player) => {
    const { lastSeason } = player

    if (!lastSeason) return player

    const belowFloor = !(lastSeason.games >= floor)
    if (!belowFloor) return player

    return { ...player, lastSeason: null }
  })
}
