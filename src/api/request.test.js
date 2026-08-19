import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './request.js'

function mockResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('request', () => {
  it('returns parsed data on success and hits the proxy path with query params', async () => {
    const body = { year: 2026, scoring: 'PPR', players: [{ id: 1 }, { id: 2 }] }
    global.fetch.mockResolvedValue(mockResponse({ body }))

    const result = await request('/2026/consensus-rankings', {
      searchParams: { position: 'ALL', scoring: 'PPR' },
    })

    expect(result).toEqual({ ok: true, data: body })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/2026/consensus-rankings?position=ALL&scoring=PPR',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('reports a timeout when the request exceeds timeoutMs', async () => {
    vi.useFakeTimers()
    global.fetch.mockImplementation(
      (url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const promise = request('/2026/consensus-rankings', { timeoutMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toEqual({ ok: false, error: { type: 'timeout' } })
  })

  it('classifies a 403 "Forbidden" body as an auth error', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 403, body: { message: 'Forbidden' } }),
    )

    const result = await request('/injuries')

    expect(result).toEqual({
      ok: false,
      error: { type: 'auth', status: 403, message: 'Forbidden' },
    })
  })

  it('classifies a 403 "Missing Authentication Token" body as a wrong path, not auth', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 403,
        body: { message: 'Missing Authentication Token' },
      }),
    )

    const result = await request('/2026/injuries')

    expect(result.error.type).toBe('not_found')
    expect(result.error.type).not.toBe('auth')
  })

  it('carries parameter and valid_format through on a 400', async () => {
    const body = {
      message: 'Invalid Position',
      parameter: 'position',
      valid_format: 'QB, RB, WR, TE',
    }
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 400, body }))

    const result = await request('/2026/consensus-rankings')

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'validation',
        status: 400,
        message: 'Invalid Position',
        parameter: 'position',
        validFormat: 'QB, RB, WR, TE',
      },
    })
  })

  it('retries 429s with exponential backoff before giving up', async () => {
    vi.useFakeTimers()
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 429, body: {} }))

    const promise = request('/2026/consensus-rankings')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ ok: false, error: { type: 'rate_limit', status: 429 } })
    expect(global.fetch).toHaveBeenCalledTimes(4)
  })

  it('classifies a 500 as a server_error', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }))

    const result = await request('/2026/consensus-rankings')

    expect(result).toEqual({ ok: false, error: { type: 'server_error', status: 500 } })
  })

  it('reports a parse_error when the body is not valid JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })

    const result = await request('/2026/consensus-rankings')

    expect(result).toEqual({ ok: false, error: { type: 'parse_error', status: 200 } })
  })

  it('returns a structured unknown error instead of throwing on a network failure', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'))

    const result = await request('/2026/consensus-rankings')

    expect(result).toEqual({ ok: false, error: { type: 'unknown' } })
  })

  it('flags an echo mismatch when the response silently substituted a different value', async () => {
    const body = { year: 2026, players: [] }
    global.fetch.mockResolvedValue(mockResponse({ body }))

    const result = await request('/1999/consensus-rankings', {
      echo: { year: 1999 },
    })

    expect(result).toEqual({
      ok: false,
      error: { type: 'echo_mismatch', field: 'year', expected: 1999, actual: 2026 },
    })
  })

  it('flags a low row count instead of trusting the count field', async () => {
    const body = { count: 100, players: Array.from({ length: 10 }, (_, id) => ({ id })) }
    global.fetch.mockResolvedValue(mockResponse({ body }))

    const result = await request('/2026/consensus-rankings', {
      rowsKey: 'players',
      minRows: 50,
    })

    expect(result).toEqual({
      ok: false,
      error: { type: 'low_row_count', rowsKey: 'players', minRows: 50, actual: 10 },
    })
  })
})
