// Shared between vite.config.js (dev proxy) and api/[...path].js (production proxy)
// so the two never drift into divergent upstream targets.
export const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json/nfl'
