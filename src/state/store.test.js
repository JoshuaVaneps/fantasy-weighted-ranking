import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store.js'

describe('createStore', () => {
  it('getState returns the initial state', () => {
    const store = createStore({ count: 0 })

    expect(store.getState()).toEqual({ count: 0 })
  })

  it('setState merges a partial object into state', () => {
    const store = createStore({ count: 0, label: 'a' })

    store.setState({ count: 1 })

    expect(store.getState()).toEqual({ count: 1, label: 'a' })
  })

  it('setState accepts an updater function receiving the current state', () => {
    const store = createStore({ count: 1 })

    store.setState((state) => ({ count: state.count + 1 }))

    expect(store.getState()).toEqual({ count: 2 })
  })

  it('notifies subscribers when state actually changes', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.setState({ count: 1 })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ count: 1 })
  })

  it('does not notify subscribers on a no-op set', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.setState({ count: 0 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribe removes the listener', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.setState({ count: 1 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('a listener that throws does not stop other listeners from running', () => {
    const store = createStore({ count: 0 })
    const throwingListener = vi.fn(() => {
      throw new Error('boom')
    })
    const okListener = vi.fn()
    store.subscribe(throwingListener)
    store.subscribe(okListener)

    expect(() => store.setState({ count: 1 })).not.toThrow()
    expect(throwingListener).toHaveBeenCalledTimes(1)
    expect(okListener).toHaveBeenCalledTimes(1)
  })
})
