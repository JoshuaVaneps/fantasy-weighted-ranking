# Fantasy Weighted Ranking

Vanilla JavaScript draft board. Ranks NFL players on a user-controlled blend of expert
consensus (ECR), last season's production, and current-season projections. Weights are
adjustable and the board re-sorts live. Manual pins override the math. Boards are saved
per draft.

Build plan, math, and the full ticket list live in [`docs/buildplan.html`](docs/buildplan.html).
Architecture and API notes live in [`docs/api-notes.md`](docs/api-notes.md).

## Status

**M1 (Walking Skeleton) is complete:** real players from the joined FantasyPros feeds
render on screen, sorted by consensus rank, plus an ADP column pulled from the player
master list. See [`docs/m1-wrapup.md`](docs/m1-wrapup.md) for what shipped, the
deviations taken, and what M2 (the weighted blend and drag-to-rank UI) needs next.

## Deployment

Live at **https://fantasy-weighted-ranking.vercel.app**

Production runs on Vercel: a static build of `src/` plus `api/proxy.js`, a
serverless function that attaches the FantasyPros key server-side and forwards
the request — the same role Vite's dev proxy plays locally. `vercel.json`
routes every `/api/*` request to that function. The key is stored as a Vercel
environment variable (`FP_API_KEY`) and never reaches the client bundle or any
request the browser can see.

## Setup

1. `npm install`
2. Add your FantasyPros API key to `.env.local`:
   ```
   VITE_FP_API_KEY=your-key-here
   ```
3. `npm run dev`

## Scripts

| Command                 | Does                             |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start the Vite dev server        |
| `npm run build`         | Production build                 |
| `npm run preview`       | Preview the production build     |
| `npm test`              | Run the test suite once          |
| `npm run test:watch`    | Run tests in watch mode          |
| `npm run test:coverage` | Run tests with a coverage report |
| `npm run lint`          | Check code with ESLint           |
| `npm run format`        | Format code with Prettier        |
| `npm run format:check`  | Check formatting without writing |
| `npm run capture`       | Refresh `/fixtures` from the live API — run rarely |
