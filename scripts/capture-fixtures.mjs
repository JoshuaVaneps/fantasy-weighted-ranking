import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { getConsensus } from '../src/api/consensus.js'
import { getInjuries } from '../src/api/injuries.js'
import { getPriorSeason } from '../src/api/priorSeason.js'
import { getProjections } from '../src/api/projections.js'

const CURRENT_SEASON = new Date().getFullYear()
const PRIOR_SEASON = CURRENT_SEASON - 1
const FIXTURES_DIR = new URL('../fixtures/', import.meta.url)

// request.js fetches a relative '/api/...' path — that only resolves through
// Vite's dev proxy (browser or Vite server), not a bare Node process. Spin up
// the real dev server so this script exercises the exact same proxy + auth
// path the app uses, then point global fetch at it.
async function withDevServer(run) {
  const server = await createServer({ server: { port: 0 } })
  await server.listen()
  const { port } = server.httpServer.address()

  const originalFetch = global.fetch
  global.fetch = (path, options) =>
    originalFetch(`http://localhost:${port}${path}`, options)

  try {
    return await run()
  } finally {
    global.fetch = originalFetch
    await server.close()
  }
}

async function main() {
  const captures = await withDevServer(() =>
    Promise.all(
      [
        ['consensus-rankings', getConsensus(CURRENT_SEASON)],
        ['projections', getProjections(CURRENT_SEASON)],
        ['player-points', getPriorSeason(PRIOR_SEASON)],
        ['injuries', getInjuries()],
      ].map(async ([name, promise]) => [name, await promise]),
    ),
  )

  await mkdir(FIXTURES_DIR, { recursive: true })

  let failed = false
  for (const [name, result] of captures) {
    if (!result.ok) {
      failed = true
      console.error(`✗ ${name}: ${JSON.stringify(result.error)}`)
      continue
    }
    const path = new URL(`${name}.json`, FIXTURES_DIR)
    await writeFile(path, `${JSON.stringify(result.data, null, 2)}\n`)
    console.log(`✓ wrote fixtures/${name}.json`)
  }

  if (failed) {
    process.exitCode = 1
  }
}

await main()
