import { describe, expect, it } from 'vitest'
import { sortByConsensus } from './sortByConsensus.js'

function player(overrides = {}) {
  return { id: 1, name: 'Test Player', rankEcr: 10, ...overrides }
}

describe('sortByConsensus', () => {
  it('orders players by ascending rankEcr, best rank first', () => {
    const players = [
      player({ id: 1, rankEcr: 15 }),
      player({ id: 2, rankEcr: 3 }),
      player({ id: 3, rankEcr: 9 }),
    ]

    const sorted = sortByConsensus(players)

    expect(sorted.map((p) => p.id)).toEqual([2, 3, 1])
  })

  it('does not mutate the input array', () => {
    const players = [player({ id: 1, rankEcr: 15 }), player({ id: 2, rankEcr: 3 })]
    const original = [...players]

    sortByConsensus(players)

    expect(players).toEqual(original)
  })
})
