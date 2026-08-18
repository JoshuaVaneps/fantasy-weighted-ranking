import { describe, expect, it } from 'vitest'

describe('scoring environment', () => {
  it('runs without a DOM', () => {
    expect(typeof document).toBe('undefined')
  })
})
