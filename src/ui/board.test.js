import { describe, expect, it } from 'vitest'
import { createBoard } from './board.js'

function player(overrides = {}) {
  return {
    id: 1,
    name: 'Test Player',
    team: 'KC',
    position: 'WR',
    byeWeek: '10',
    rankEcr: 5,
    lastSeason: { points: 200, games: 16 },
    projected: 220,
    adp: 8,
    ...overrides,
  }
}

function container() {
  return document.createElement('div')
}

describe('createBoard', () => {
  it('renders a loading message without a table', () => {
    const el = container()
    const { update } = createBoard(el)

    update({ status: 'loading', players: [] })

    expect(el.textContent).toContain('Loading')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders an empty message when there are no players', () => {
    const el = container()
    const { update } = createBoard(el)

    update({ status: 'empty', players: [] })

    expect(el.textContent).toContain('No players found')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders an error message on error status', () => {
    const el = container()
    const { update } = createBoard(el)

    update({ status: 'error', players: [] })

    expect(el.textContent).toContain('Could not load players')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders one row per player, in the given order', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    update({ status: 'ready', players })

    const rows = el.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Alpha')
    expect(rows[1].textContent).toContain('Beta')
  })

  it('renders a dash for missing factor values instead of blank or "null"', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ lastSeason: null, projected: null })]

    update({ status: 'ready', players })

    const cells = el.querySelectorAll('tbody td')
    expect([...cells].some((td) => td.textContent === '—')).toBe(true)
    expect(el.textContent).not.toContain('null')
  })

  it('rounds floating-point noise for display', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [
      player({ lastSeason: { points: 289.99999999999994, games: 16 }, projected: 336.03 }),
    ]

    update({ status: 'ready', players })

    expect(el.textContent).toContain('290')
    expect(el.textContent).not.toContain('289.99999999999994')
  })

  it('renders the ADP column value for a player', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ adp: 12 })]

    update({ status: 'ready', players })

    const headers = [...el.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toContain('ADP')
    expect(el.querySelector('tbody tr').textContent).toContain('12')
  })

  it('renders a dash for a player missing from the ADP feed', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ adp: null })]

    update({ status: 'ready', players })

    const cells = el.querySelectorAll('tbody td')
    expect([...cells].some((td) => td.textContent === '—')).toBe(true)
  })

  it('re-renders cleanly when called again with new state', () => {
    const el = container()
    const { update } = createBoard(el)

    update({ status: 'loading', players: [] })
    update({ status: 'ready', players: [player()] })

    expect(el.textContent).not.toContain('Loading')
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('reuses the same row node for a player across a re-sort', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    update({ status: 'ready', players })
    const rowBefore = [...el.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent.includes('Alpha'),
    )

    // Same players, reversed order - as a re-sort would produce.
    update({ status: 'ready', players: [...players].reverse() })
    const rowAfter = [...el.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent.includes('Alpha'),
    )

    expect(rowAfter).toBe(rowBefore)
  })

  it('keeps the row count constant across a re-sort', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [
      player({ id: 1, name: 'Alpha' }),
      player({ id: 2, name: 'Beta' }),
      player({ id: 3, name: 'Gamma' }),
    ]

    update({ status: 'ready', players })
    const countBefore = el.querySelectorAll('tbody tr').length

    update({ status: 'ready', players: [players[2], players[0], players[1]] })
    const countAfter = el.querySelectorAll('tbody tr').length

    expect(countAfter).toBe(countBefore)
  })

  it('moves rows into the new order on a re-sort', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    update({ status: 'ready', players })
    update({ status: 'ready', players: [...players].reverse() })

    const names = [...el.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td:nth-child(2)').textContent)
    expect(names).toEqual(['Beta', 'Alpha'])
  })

  it('removes the row for a player no longer in the list', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    update({ status: 'ready', players })
    update({ status: 'ready', players: [players[0]] })

    const rows = el.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Alpha')
  })

  it('creates a new row for a player added on a later update', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' })]

    update({ status: 'ready', players })
    update({ status: 'ready', players: [...players, player({ id: 2, name: 'Beta' })] })

    const rows = el.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain('Beta')
  })

  it('updates a reused row\'s rank cell after a re-sort', () => {
    const el = container()
    const { update } = createBoard(el)
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    update({ status: 'ready', players })
    update({ status: 'ready', players: [...players].reverse() })

    const betaRow = [...el.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent.includes('Beta'),
    )
    expect(betaRow.querySelector('td').textContent).toBe('1')
  })

  it('builds a fresh table after tearing down for a loading/error/empty state', () => {
    const el = container()
    const { update } = createBoard(el)

    update({ status: 'ready', players: [player({ id: 1 })] })
    const tableBefore = el.querySelector('table')

    update({ status: 'error', players: [] })
    update({ status: 'ready', players: [player({ id: 1 })] })
    const tableAfter = el.querySelector('table')

    expect(tableAfter).not.toBe(tableBefore)
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1)
  })
})
