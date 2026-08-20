import { describe, expect, it, vi } from 'vitest'
import { createMixControl } from './mixControl.js'
import { rebalance } from '../scoring/rebalance.js'

const WEIGHTS = { ecr: 34, lastSeason: 33, projected: 33 }

function container() {
  return document.createElement('div')
}

function firePointerEvent(el, type, props) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0 }, props)
  el.dispatchEvent(event)
}

function fireKey(el, key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
}

// Stub layout: jsdom doesn't compute real geometry, so give the bar a
// known rect to translate pointer positions against.
function stubBarWidth(el, width) {
  el.getBoundingClientRect = () => ({ left: 0, width, top: 0, height: 40, right: width, bottom: 40 })
}

describe('createMixControl', () => {
  it('renders one segment per factor, sized and positioned to the weights', () => {
    const el = container()

    createMixControl(el, WEIGHTS, () => {})

    const segments = el.querySelectorAll('.mix-segment')
    expect(segments).toHaveLength(3)
    expect(segments[0].style.width).toBe('34%')
    expect(segments[0].style.left).toBe('0%')
    expect(segments[1].style.width).toBe('33%')
    expect(segments[1].style.left).toBe('34%')
    expect(segments[2].style.width).toBe('33%')
    expect(segments[2].style.left).toBe('67%')
  })

  it('labels every factor with visible text, not color alone', () => {
    const el = container()

    createMixControl(el, WEIGHTS, () => {})

    const legendText = el.querySelector('.mix-legend').textContent
    expect(legendText).toContain('Consensus')
    expect(legendText).toContain('34%')
    expect(legendText).toContain('Last Season')
    expect(legendText).toContain('33%')
    expect(legendText).toContain('Projected')
  })

  it('gives each divider correct ARIA slider attributes', () => {
    const el = container()

    createMixControl(el, WEIGHTS, () => {})

    const [first, second] = el.querySelectorAll('.mix-divider')
    expect(first.getAttribute('role')).toBe('slider')
    expect(first.getAttribute('aria-valuemin')).toBe('0')
    expect(first.getAttribute('aria-valuemax')).toBe('100')
    expect(first.getAttribute('aria-valuenow')).toBe('34')
    expect(first.getAttribute('aria-valuetext')).toBe('Consensus: 34%')
    expect(first.getAttribute('tabindex')).toBe('0')

    expect(second.getAttribute('aria-valuenow')).toBe('33')
    expect(second.getAttribute('aria-valuetext')).toBe('Last Season: 33%')
  })

  it('reuses the same DOM nodes across update() calls instead of rebuilding', () => {
    const el = container()
    const { update } = createMixControl(el, WEIGHTS, () => {})

    const segmentBefore = el.querySelector('.mix-segment')
    const dividerBefore = el.querySelector('.mix-divider')

    update({ ecr: 50, lastSeason: 25, projected: 25 })

    expect(el.querySelector('.mix-segment')).toBe(segmentBefore)
    expect(el.querySelector('.mix-divider')).toBe(dividerBefore)
    expect(segmentBefore.style.width).toBe('50%')
    expect(dividerBefore.getAttribute('aria-valuenow')).toBe('50')
  })

  it('arrow keys rebalance the focused divider by 1', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    createMixControl(el, WEIGHTS, onWeightsChange)
    const [firstDivider] = el.querySelectorAll('.mix-divider')

    fireKey(firstDivider, 'ArrowRight')

    expect(onWeightsChange).toHaveBeenCalledWith(rebalance(WEIGHTS, 'ecr', 35))
  })

  it('Home and End jump the focused divider to 0 and 100', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    createMixControl(el, WEIGHTS, onWeightsChange)
    const [firstDivider] = el.querySelectorAll('.mix-divider')

    fireKey(firstDivider, 'End')
    expect(onWeightsChange).toHaveBeenLastCalledWith(rebalance(WEIGHTS, 'ecr', 100))

    fireKey(firstDivider, 'Home')
    expect(onWeightsChange).toHaveBeenLastCalledWith(rebalance(WEIGHTS, 'ecr', 0))
  })

  it('dragging the first divider sets ecr directly, since nothing precedes it', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    createMixControl(el, WEIGHTS, onWeightsChange)
    const bar = el.querySelector('.mix-bar')
    stubBarWidth(bar, 200)
    const [firstDivider] = el.querySelectorAll('.mix-divider')

    firePointerEvent(firstDivider, 'pointerdown', { clientX: 100 }) // 50% of the bar

    expect(onWeightsChange).toHaveBeenCalledWith(rebalance(WEIGHTS, 'ecr', 50))
  })

  it('dragging the second divider subtracts the current ecr value from the cumulative position', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    createMixControl(el, WEIGHTS, onWeightsChange)
    const bar = el.querySelector('.mix-bar')
    stubBarWidth(bar, 200)
    const [, secondDivider] = el.querySelectorAll('.mix-divider')

    // clientX at 84% of the bar -> cumulative 84, minus the current ecr (34) -> lastSeason = 50
    firePointerEvent(secondDivider, 'pointerdown', { clientX: 168 })

    expect(onWeightsChange).toHaveBeenCalledWith(rebalance(WEIGHTS, 'lastSeason', 50))
  })

  it('keeps committing on pointermove only while the pointer is down, reading fresh weights each tick', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    const { update } = createMixControl(el, WEIGHTS, onWeightsChange)
    const bar = el.querySelector('.mix-bar')
    stubBarWidth(bar, 200)
    const [firstDivider] = el.querySelectorAll('.mix-divider')

    firePointerEvent(firstDivider, 'pointerdown', { clientX: 100 }) // ecr -> 50
    const afterFirstMove = onWeightsChange.mock.calls[0][0]
    update(afterFirstMove) // simulate main.js round-tripping the new weights back in

    firePointerEvent(firstDivider, 'pointermove', { clientX: 140 }) // ecr -> 70
    expect(onWeightsChange).toHaveBeenLastCalledWith(rebalance(afterFirstMove, 'ecr', 70))

    firePointerEvent(firstDivider, 'pointerup', {})
    onWeightsChange.mockClear()

    firePointerEvent(firstDivider, 'pointermove', { clientX: 10 })
    expect(onWeightsChange).not.toHaveBeenCalled()
  })

  it('ignores a non-primary mouse button', () => {
    const el = container()
    const onWeightsChange = vi.fn()
    createMixControl(el, WEIGHTS, onWeightsChange)
    const bar = el.querySelector('.mix-bar')
    stubBarWidth(bar, 200)
    const [firstDivider] = el.querySelectorAll('.mix-divider')

    firePointerEvent(firstDivider, 'pointerdown', { clientX: 100, button: 2 })

    expect(onWeightsChange).not.toHaveBeenCalled()
  })
})
