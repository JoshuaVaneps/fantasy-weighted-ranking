# Fantasy Weighted Ranking

Vanilla JavaScript draft board. Ranks NFL players on a user-controlled blend of expert
consensus (ECR), last season's production, and current-season projections. Weights are
adjustable and the board re-sorts live. Manual pins override the math. Boards are saved
per draft.

Build plan, math, and the full ticket list live in [`docs/build-plan.html`](docs/build-plan.html).
Architecture and API notes live in [`docs/api-notes.md`](docs/api-notes.md).

## Setup

1. `npm install`
2. Add your FantasyPros API key to `.env.local`:
   ```
   VITE_FP_API_KEY=your-key-here
   ```
3. `npm run dev`

## Scripts

| Command                | Does                             |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the Vite dev server        |
| `npm run build`        | Production build                 |
| `npm run preview`      | Preview the production build     |
| `npm run lint`         | Check code with ESLint           |
| `npm run format`       | Format code with Prettier        |
| `npm run format:check` | Check formatting without writing |
