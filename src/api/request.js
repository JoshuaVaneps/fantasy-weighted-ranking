const PROXY_BASE = '/api'
const DEFAULT_TIMEOUT_MS = 8000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 300

function buildUrl(path, searchParams) {
  const query = new URLSearchParams(searchParams).toString()
  return query ? `${PROXY_BASE}${path}?${query}` : `${PROXY_BASE}${path}`
}

function classifyHttpError(status, body) {
  const message = body?.message

  if (status === 403 && message === 'Forbidden') {
    return { type: 'auth', status, message }
  }

  if (status === 403) {
    return { type: 'not_found', status, message }
  }

  if (status === 400) {
    return {
      type: 'validation',
      status,
      message,
      parameter: body?.parameter,
      validFormat: body?.valid_format,
    }
  }

  if (status === 429) {
    return { type: 'rate_limit', status }
  }

  if (status === 500) {
    return { type: 'server_error', status }
  }

  return { type: 'http_error', status, message }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function checkEcho(data, echo) {
  if (!echo) return null

  for (const [field, expected] of Object.entries(echo)) {
    if (data[field] !== expected) {
      return { type: 'echo_mismatch', field, expected, actual: data[field] }
    }
  }

  return null
}

function checkRowCount(data, rowsKey, minRows) {
  if (!rowsKey || minRows === undefined) return null

  const rows = data[rowsKey]
  const count = Array.isArray(rows) ? rows.length : 0

  if (count < minRows) {
    return { type: 'low_row_count', rowsKey, minRows, actual: count }
  }

  return null
}

async function attempt(path, searchParams, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(buildUrl(path, searchParams), { signal: controller.signal })

    let body
    try {
      body = await response.json()
    } catch {
      return { ok: false, error: { type: 'parse_error', status: response.status } }
    }

    if (!response.ok) {
      return { ok: false, error: classifyHttpError(response.status, body) }
    }

    return { ok: true, data: body }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: { type: 'timeout' } }
    }
    return { ok: false, error: { type: 'unknown' } }
  } finally {
    clearTimeout(timer)
  }
}

export async function request(path, options = {}) {
  const { searchParams = {}, timeoutMs = DEFAULT_TIMEOUT_MS, echo, rowsKey, minRows } = options

  let result = await attempt(path, searchParams, timeoutMs)

  for (let retryCount = 0; result.error?.type === 'rate_limit' && retryCount < MAX_RETRIES; retryCount++) {
    await sleep(RETRY_BASE_DELAY_MS * 2 ** retryCount)
    result = await attempt(path, searchParams, timeoutMs)
  }

  if (!result.ok) {
    return result
  }

  const echoError = checkEcho(result.data, echo)
  if (echoError) {
    return { ok: false, error: echoError }
  }

  const rowCountError = checkRowCount(result.data, rowsKey, minRows)
  if (rowCountError) {
    return { ok: false, error: rowCountError }
  }

  return result
}
