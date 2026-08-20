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
  { label: 'ADP', value: (player) => roundForDisplay(player.adp) },
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

// Creating a row and updating one both render missing values the same way,
// so the fallback lives in one place rather than in each path.
function displayText(value) {
  return value ?? '—'
}

function cell(value) {
  return textNode('td', displayText(value))
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

// Rewrites an existing row's cells rather than building a replacement.
// Every cell is rewritten, not just the changed ones: rank changes on every
// re-sort anyway, and diffing nine strings costs more than it saves.
function updateRow(tr, player, rank) {
  COLUMNS.forEach((column, index) => {
    tr.children[index].textContent = displayText(column.value(player, rank))
  })
}

/**
 * Brings `tbody` in line with `players` by player id instead of by list
 * position: rows that already exist are reused and moved, rows for new
 * players are created, and rows for players no longer in the list are
 * removed. A row already sitting where it belongs is not touched at all —
 * during a mix-bar drag most rows keep their rank between ticks, so most
 * of this loop is a no-op.
 *
 * @param {HTMLTableSectionElement} tbody
 * @param {object[]} players — in the order they should appear
 * @param {Map<number, HTMLTableRowElement>} rows — id to live node, mutated
 */
function syncRows(tbody, players, rows) {
  const present = new Set()
  let previous = null

  players.forEach((player, index) => {
    const rank = index + 1
    let tr = rows.get(player.id)

    if (tr) {
      updateRow(tr, player, rank)
    } else {
      tr = playerRow(player, rank)
      rows.set(player.id, tr)
    }
    present.add(player.id)

    // Where this row belongs: right after the one we just placed, or at the
    // top if it is the first. Moving a node out of its old slot is implicit
    // — a node can only be in one place — so there is no removal step.
    const target = previous ? previous.nextSibling : tbody.firstChild
    if (tr !== target) tbody.insertBefore(tr, target)
    previous = tr
  })

  // Anything still mapped but never walked past is gone from the list.
  // Dropping it from the map too keeps the map from growing forever.
  rows.forEach((tr, id) => {
    if (present.has(id)) return
    tr.remove()
    rows.delete(id)
  })
}

/**
 * Renders the board region from store state, keeping the same `<table>`
 * and per-player `<tr>` nodes across re-sorts instead of rebuilding them
 * (see `syncRows`) — a full rebuild on every mix-bar tick loses scroll
 * position and destroys anything focused inside the table.
 *
 * @param {HTMLElement} container
 * @returns {{ update: (state: {status: 'loading'|'ready'|'empty'|'error', players: object[]}) => void }}
 */
export function createBoard(container) {
  const rows = new Map()
  let table = null
  let tbody = null

  function ensureTable() {
    if (table) return
    table = document.createElement('table')
    const thead = document.createElement('thead')
    thead.append(headerRow())
    tbody = document.createElement('tbody')
    table.append(thead, tbody)
    container.replaceChildren(table)
  }

  // The table gets torn down entirely for these states — there is nothing
  // to preserve row identity against, so the next `ready` starts clean.
  function teardown(message) {
    table = null
    tbody = null
    rows.clear()
    container.replaceChildren(textNode('p', message))
  }

  function update(state) {
    if (state.status === 'loading') {
      teardown('Loading players…')
      return
    }

    if (state.status === 'error') {
      teardown('Could not load players. Try refreshing.')
      return
    }

    if (state.status === 'empty') {
      teardown('No players found.')
      return
    }

    ensureTable()
    syncRows(tbody, state.players, rows)
  }

  return { update }
}
