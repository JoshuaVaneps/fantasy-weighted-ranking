import { describe, expect, it } from 'vitest'
import { renderBoard } from './board.js'

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

describe('renderBoard', () => {
  it('renders a loading message without a table', () => {
    const el = container()

    renderBoard(el, { status: 'loading', players: [] })

    expect(el.textContent).toContain('Loading')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders an empty message when there are no players', () => {
    const el = container()

    renderBoard(el, { status: 'empty', players: [] })

    expect(el.textContent).toContain('No players found')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders an error message on error status', () => {
    const el = container()

    renderBoard(el, { status: 'error', players: [] })

    expect(el.textContent).toContain('Could not load players')
    expect(el.querySelector('table')).toBeNull()
  })

  it('renders one row per player, in the given order', () => {
    const el = container()
    const players = [player({ id: 1, name: 'Alpha' }), player({ id: 2, name: 'Beta' })]

    renderBoard(el, { status: 'ready', players })

    const rows = el.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Alpha')
    expect(rows[1].textContent).toContain('Beta')
  })

  it('renders a dash for missing factor values instead of blank or "null"', () => {
    const el = container()
    const players = [player({ lastSeason: null, projected: null })]

    renderBoard(el, { status: 'ready', players })

    const cells = el.querySelectorAll('tbody td')
    expect([...cells].some((td) => td.textContent === '—')).toBe(true)
    expect(el.textContent).not.toContain('null')
  })

  it('rounds floating-point noise for display', () => {
    const el = container()
    const players = [
      player({ lastSeason: { points: 289.99999999999994, games: 16 }, projected: 336.03 }),
    ]

    renderBoard(el, { status: 'ready', players })

    expect(el.textContent).toContain('290')
    expect(el.textContent).not.toContain('289.99999999999994')
  })

  it('renders the ADP column value for a player', () => {
    const el = container()
    const players = [player({ adp: 12 })]

    renderBoard(el, { status: 'ready', players })

    const headers = [...el.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toContain('ADP')
    expect(el.querySelector('tbody tr').textContent).toContain('12')
  })

  it('renders a dash for a player missing from the ADP feed', () => {
    const el = container()
    const players = [player({ adp: null })]

    renderBoard(el, { status: 'ready', players })

    const cells = el.querySelectorAll('tbody td')
    expect([...cells].some((td) => td.textContent === '—')).toBe(true)
  })

  it('re-renders cleanly when called again with new state', () => {
    const el = container()

    renderBoard(el, { status: 'loading', players: [] })
    renderBoard(el, { status: 'ready', players: [player()] })

    expect(el.textContent).not.toContain('Loading')
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1)
  })
})
