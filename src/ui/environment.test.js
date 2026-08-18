import { describe, expect, it } from 'vitest'

describe('ui environment', () => {
  it('runs with a DOM', () => {
    expect(typeof document).toBe('object')
  })
})
