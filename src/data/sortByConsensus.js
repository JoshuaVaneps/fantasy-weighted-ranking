/**
 * Sorts players by consensus rank, best (lowest rankEcr) first. Returns a
 * new array — the input is never mutated.
 *
 * @param {import('./joinPlayers.js').Player[]} players
 * @returns {import('./joinPlayers.js').Player[]}
 */
export function sortByConsensus(players) {
  return [...players].sort((a, b) => a.rankEcr - b.rankEcr)
}
