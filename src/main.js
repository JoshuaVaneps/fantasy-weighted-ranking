import './style.css'
import { createStore } from './state/store.js'
import { renderBoard } from './ui/board.js'
import { getConsensus } from './api/consensus.js'
import { getPlayers } from './api/players.js'
import { getPriorSeason } from './api/priorSeason.js'
import { getProjections } from './api/projections.js'
import { joinPlayers } from './data/joinPlayers.js'
import { getRankedPlayers } from './state/selectors.js'
import { createMixControl } from './ui/mixControl.js'

const CURRENT_SEASON = new Date().getFullYear()
const PRIOR_SEASON = CURRENT_SEASON - 1

const store = createStore({
  status: 'loading',
  error: null,
  rawPlayers: [],
  weights: { ecr: 34, lastSeason: 33, projected: 33 },
  pins: {},
  settings: {},
  activeBoardId: null,
})

const boardContent = document.getElementById('board-content')
const mixControlContent = document.getElementById('mix-control')

const mixControl = createMixControl(mixControlContent, store.getState().weights, (weights) =>
  store.setState({ weights }),
)

function render(state) {
  renderBoard(boardContent, { status: state.status, players: getRankedPlayers(state) })
  mixControl.update(state.weights)
}

store.subscribe(render)
render(store.getState())

async function loadPlayers() {
  const [consensus, priorSeason, projections, playersList] = await Promise.all([
    getConsensus(CURRENT_SEASON),
    getPriorSeason(PRIOR_SEASON),
    getProjections(CURRENT_SEASON),
    getPlayers(),
  ])

  const failed = [consensus, priorSeason, projections].find((result) => !result.ok)
  if (failed) {
    store.setState({ status: 'error', rawPlayers: [], error: failed.error })
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

  store.setState({
    status: players.length ? 'ready' : 'empty',
    rawPlayers: players,
    error: null,
  })
}

loadPlayers()
