/**
 * @typedef {object} Player
 * @property {number} id
 * @property {string} name
 * @property {string} team
 * @property {string} position
 * @property {string} byeWeek
 * @property {number} tier
 * @property {number} rankEcr
 * @property {string} filename
 * @property {{points: number, games: number} | null} lastSeason
 * @property {number | null} projected
 * @property {number | null} adp
 */

/**
 * @typedef {object} UnmatchedEntry
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {object} JoinResult
 * @property {Player[]} players
 * @property {{playerPoints: UnmatchedEntry[], projections: UnmatchedEntry[]}} unmatched
 */

/**
 * Merges the three season-scoped feeds into one Player list, keyed on the
 * FantasyPros id. Consensus rankings is the spine — every output player
 * comes from it, so team/position/bye week/tier are always read from
 * consensus, never from player-points (which reflects last season's team,
 * not this one). A player missing from a feed gets `null` for that
 * factor rather than being treated as a zero.
 *
 * @param {object} feeds
 * @param {object[]} feeds.consensus - raw `players` array from getConsensus()
 * @param {object[]} feeds.playerPoints - raw `players` array from getPriorSeason()
 * @param {object[]} feeds.projections - raw `players` array from getProjections()
 * @param {object[]} [feeds.players] - `players` array from getPlayers(), the
 *   only source of ADP. getPlayers() already filters to players with a real
 *   ADP, so anything present here is trusted as-is. Optional: omit it and
 *   every player's `adp` comes back null.
 * @returns {JoinResult}
 */
export function joinPlayers({ consensus, playerPoints, projections, players = [] }) {
  const playerPointsById = new Map(
    playerPoints.map((player) => [player.player_id, player]),
  )
  const projectionsById = new Map(
    projections.map((player) => [player.fpid, player]),
  )
  const adpById = new Map(players.map((player) => [player.player_id, player]))

  const matchedPlayerPointsIds = new Set()
  const matchedProjectionsIds = new Set()

  const joinedPlayers = consensus.map((entry) => {
    const lastSeason = playerPointsById.get(entry.player_id)
    const projected = projectionsById.get(entry.player_id)
    const adpEntry = adpById.get(entry.player_id)

    if (lastSeason) matchedPlayerPointsIds.add(entry.player_id)
    if (projected) matchedProjectionsIds.add(entry.player_id)

    return {
      id: entry.player_id,
      name: entry.player_name,
      team: entry.player_team_id,
      position: entry.player_position_id,
      byeWeek: entry.player_bye_week,
      tier: entry.tier,
      rankEcr: entry.rank_ecr,
      filename: entry.player_filename,
      lastSeason: lastSeason
        ? { points: lastSeason.points, games: lastSeason.games }
        : null,
      projected: projected ? projected.stats.points_ppr : null,
      adp: adpEntry ? adpEntry.rank_adp_ppr : null,
    }
  })

  const unmatched = {
    playerPoints: playerPoints
      .filter((player) => !matchedPlayerPointsIds.has(player.player_id))
      .map((player) => ({ id: player.player_id, name: player.player_name })),
    projections: projections
      .filter((player) => !matchedProjectionsIds.has(player.fpid))
      .map((player) => ({ id: player.fpid, name: player.name })),
  }

  return { players: joinedPlayers, unmatched }
}
