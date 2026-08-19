import './style.css'
import { createStore } from './state/store.js'
import { renderBoard } from './ui/board.js'
import { getConsensus } from './api/consensus.js'
import { getPlayers } from './api/players.js'
import { getPriorSeason } from './api/priorSeason.js'
import { getProjections } from './api/projections.js'
import { joinPlayers } from './data/joinPlayers.js'
import { sortByConsensus } from './data/sortByConsensus.js'

const CURRENT_SEASON = new Date().getFullYear()
const PRIOR_SEASON = CURRENT_SEASON - 1

const store = createStore({ status: 'loading', players: [], error: null })

const boardContent = document.getElementById('board-content')
store.subscribe((state) => renderBoard(boardContent, state))
renderBoard(boardContent, store.getState())

async function loadPlayers() {
  const [consensus, priorSeason, projections, playersList] = await Promise.all([
    getConsensus(CURRENT_SEASON),
    getPriorSeason(PRIOR_SEASON),
    getProjections(CURRENT_SEASON),
    getPlayers(),
  ])

  const failed = [consensus, priorSeason, projections].find((result) => !result.ok)
  if (failed) {
    store.setState({ status: 'error', players: [], error: failed.error })
    return
  }

  // ADP is enrichment, not core data — if the master list fails to load,
  // fall back to no ADP rather than failing the whole board over it.
  if (!playersList.ok) {
    console.warn('ADP unavailable:', playersList.error)
  }

  const { players } = joinPlayers({
    consensus: consensus.data.players,
    playerPoints: priorSeason.data.players,
    projections: projections.data.players,
    players: playersList.ok ? playersList.data.players : [],
  })
  const sorted = sortByConsensus(players)

  store.setState({
    status: sorted.length ? 'ready' : 'empty',
    players: sorted,
    error: null,
  })
}

loadPlayers()
