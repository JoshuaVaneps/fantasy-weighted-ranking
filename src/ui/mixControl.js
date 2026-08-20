import { rebalance } from '../scoring/rebalance.js'

const FACTORS = [
  { key: 'ecr', label: 'Consensus', cssVar: '--factor-consensus' },
  { key: 'lastSeason', label: 'Last Season', cssVar: '--factor-last-season' },
  { key: 'projected', label: 'Projected', cssVar: '--factor-projected' },
]

const STEP_KEYS = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function textNode(tag, className, text) {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text != null) el.textContent = text
  return el
}

function buildSegment(factor) {
  const el = document.createElement('div')
  el.className = 'mix-segment'
  el.style.background = `var(${factor.cssVar})`
  return el
}

function buildDivider(factor) {
  const el = document.createElement('div')
  el.className = 'mix-divider'
  el.setAttribute('role', 'slider')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-orientation', 'horizontal')
  el.setAttribute('aria-valuemin', '0')
  el.setAttribute('aria-valuemax', '100')
  el.setAttribute('aria-label', `${factor.label} weight`)
  return el
}

function buildLegendItem(factor) {
  const li = textNode('li', 'mix-legend-item')
  const swatch = textNode('span', 'mix-swatch')
  swatch.style.background = `var(${factor.cssVar})`

  const label = document.createElement('label')
  label.className = 'mix-legend-label'
  label.append(`${factor.label} `)

  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'mix-weight-input'
  input.min = '0'
  input.max = '100'
  input.step = '1'
  input.setAttribute('aria-label', `${factor.label} weight percent`)
  label.append(input, ' %')

  li.append(swatch, label)
  return { li, input }
}

/**
 * Builds the three-segment mix bar once and returns an `update(weights)`
 * function to call on every subsequent weight change, instead of
 * re-rendering the DOM from scratch — a mid-drag re-render would destroy
 * the divider the user is actively holding.
 *
 * Dragging or keying a divider computes a new value for the factor it
 * controls and runs it through `rebalance()`; the result is handed to
 * `onWeightsChange` rather than written to any store directly, keeping
 * this module free of state-management concerns.
 *
 * @param {HTMLElement} container
 * @param {{ ecr: number, lastSeason: number, projected: number }} weights
 * @param {(weights: object) => void} onWeightsChange
 * @returns {{ update: (weights: object) => void }}
 */
export function createMixControl(container, weights, onWeightsChange) {
  let currentWeights = weights

  const bar = document.createElement('div')
  bar.className = 'mix-bar'

  const segments = {}
  const dividers = []

  FACTORS.forEach((factor, index) => {
    segments[factor.key] = buildSegment(factor)
    bar.append(segments[factor.key])
    if (index < FACTORS.length - 1) {
      const divider = buildDivider(factor)
      dividers.push({ el: divider, key: factor.key, label: factor.label, factorIndex: index })
      bar.append(divider)
    }
  })

  const legend = textNode('ul', 'mix-legend')
  const weightInputs = {}
  FACTORS.forEach((factor) => {
    const { li, input } = buildLegendItem(factor)
    weightInputs[factor.key] = input
    legend.append(li)
  })

  container.replaceChildren(bar, legend)

  function commit(key, newValue) {
    onWeightsChange(rebalance(currentWeights, key, newValue))
  }

  FACTORS.forEach((factor) => {
    weightInputs[factor.key].addEventListener('change', (event) => {
      // An emptied or non-numeric field parses to NaN - clamp it to 0
      // rather than silently ignoring the edit, per the "never reject
      // input outright" rule. rebalance() itself clamps the 0-100 range.
      const parsed = Number(event.target.value)
      commit(factor.key, Number.isFinite(parsed) ? parsed : 0)
    })
  })

  // A divider's on-screen position is CUMULATIVE (e.g. divider 1 sits at
  // ecr + lastSeason), but it directly controls only its own factor's
  // value - so translating a pointer position into that value means
  // subtracting off every prior factor's current weight.
  function valueFromClientX(clientX, factorIndex) {
    const rect = bar.getBoundingClientRect()
    const fraction = clamp((clientX - rect.left) / rect.width, 0, 1)
    const sumBefore = FACTORS.slice(0, factorIndex).reduce(
      (sum, factor) => sum + currentWeights[factor.key],
      0,
    )
    return fraction * 100 - sumBefore
  }

  dividers.forEach(({ el, key, factorIndex }) => {
    let dragging = false

    el.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      dragging = true
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture isn't implemented everywhere (e.g. jsdom in
        // tests) - the `dragging` flag alone still drives the gesture.
      }
      commit(key, valueFromClientX(event.clientX, factorIndex))
    })

    el.addEventListener('pointermove', (event) => {
      if (!dragging) return
      commit(key, valueFromClientX(event.clientX, factorIndex))
    })

    const endDrag = () => {
      dragging = false
    }
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)

    el.addEventListener('keydown', (event) => {
      const step = STEP_KEYS[event.key]
      if (step !== undefined) {
        event.preventDefault()
        commit(key, currentWeights[key] + step)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        commit(key, 0)
      } else if (event.key === 'End') {
        event.preventDefault()
        commit(key, 100)
      }
    })
  })

  function update(nextWeights) {
    currentWeights = nextWeights

    let cumulative = 0
    FACTORS.forEach((factor) => {
      const factorWeight = nextWeights[factor.key]
      segments[factor.key].style.left = `${cumulative}%`
      segments[factor.key].style.width = `${factorWeight}%`
      weightInputs[factor.key].value = String(factorWeight)
      cumulative += factorWeight
    })

    let dividerPosition = 0
    dividers.forEach(({ el, key, label }) => {
      dividerPosition += nextWeights[key]
      el.style.left = `${dividerPosition}%`
      el.setAttribute('aria-valuenow', String(nextWeights[key]))
      el.setAttribute('aria-valuetext', `${label}: ${nextWeights[key]}%`)
    })
  }

  update(weights)

  return { update }
}
