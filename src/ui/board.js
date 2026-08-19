// Points arrive from the API with floating-point noise (e.g.
// 195.29999999999998) — round for display only, never for scoring.
function roundForDisplay(value) {
  return value == null ? value : Math.round(value * 10) / 10
}

const COLUMNS = [
  { label: 'Rank', value: (player, rank) => rank },
  { label: 'Player', value: (player) => player.name },
  { label: 'Team', value: (player) => player.team },
  { label: 'Pos', value: (player) => player.position },
  { label: 'Bye', value: (player) => player.byeWeek },
  { label: 'Consensus', value: (player) => player.rankEcr },
  {
    label: 'Last Season',
    value: (player) => roundForDisplay(player.lastSeason?.points),
  },
  { label: 'Projected', value: (player) => roundForDisplay(player.projected) },
]

function textNode(tag, text) {
  const el = document.createElement(tag)
  el.textContent = text
  return el
}

function cell(value) {
  return textNode('td', value ?? '—')
}

function headerRow() {
  const tr = document.createElement('tr')
  tr.append(...COLUMNS.map((column) => textNode('th', column.label)))
  return tr
}

function playerRow(player, rank) {
  const tr = document.createElement('tr')
  tr.append(...COLUMNS.map((column) => cell(column.value(player, rank))))
  return tr
}

function buildTable(players) {
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  thead.append(headerRow())

  const tbody = document.createElement('tbody')
  players.forEach((player, index) => tbody.append(playerRow(player, index + 1)))

  table.append(thead, tbody)
  return table
}

/**
 * Renders the board region from store state. Pure DOM writing — no
 * fetching, no scoring math, all text via textContent.
 *
 * @param {HTMLElement} container
 * @param {{status: 'loading'|'ready'|'empty'|'error', players: object[]}} state
 */
export function renderBoard(container, state) {
  if (state.status === 'loading') {
    container.replaceChildren(textNode('p', 'Loading players…'))
    return
  }

  if (state.status === 'error') {
    container.replaceChildren(
      textNode('p', 'Could not load players. Try refreshing.'),
    )
    return
  }

  if (state.status === 'empty') {
    container.replaceChildren(textNode('p', 'No players found.'))
    return
  }

  container.replaceChildren(buildTable(state.players))
}
