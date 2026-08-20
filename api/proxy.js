import { FANTASYPROS_BASE_URL } from '../config/fantasypros.js'

export default async function handler(req, res) {
  const { pathname, search } = new URL(req.url, 'http://localhost')
  const upstreamPath = pathname.replace(/^\/api\//, '')
  const url = `${FANTASYPROS_BASE_URL}/${upstreamPath}${search}`

  const upstream = await fetch(url, {
    headers: { 'x-api-key': process.env.FP_API_KEY },
  })

  const body = await upstream.text()
  res.status(upstream.status)
  res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
  res.send(body)
}
