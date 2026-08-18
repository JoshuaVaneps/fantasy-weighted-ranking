# Draft Board — Capstone 1

Vanilla JavaScript draft board. Ranks NFL players on a user-controlled blend of expert
consensus (ECR), last season's production, and current-season projections. Weights are
adjustable and the board re-sorts live. Manual pins override the math. Boards are saved
per draft.

Build plan, math, and the full ticket list live in `docs/build-plan.html`.

## How I want to work

Write the code with me — I'm not precious about typing it myself. But this is a learning
capstone, so the goal is that I understand every piece of it. How you deliver matters
more than how fast you go.

**Go chunk by chunk.** One function, or one small coherent piece, at a time. Never dump a
finished module. Stop at the end of each chunk instead of rolling into the next one.

**Explain each chunk in plain language, in this order:**

1. What we're trying to accomplish, and why this piece needs to exist at all
2. What the code actually does, step by step
3. An analogy that makes the idea stick

Assume I know JavaScript but not this particular pattern. Skip jargon, or define it the
first time it appears. Explain the *why* before the *how* — I want to understand the
problem being solved before I read the solution.

**If I say "ELI5"** (or "simpler", or "explain it like I'm 5"), drop the technical
vocabulary entirely and re-explain with an everyday analogy and no code at all. I'll ask
for the code version once the idea has landed.

**Check in before moving on.** After a chunk, ask whether it made sense before
continuing. If I say "keep going," you can chain a few together, but pausing is the
default.

## Hard constraints

- **No UI framework.** No React, Vue, Svelte, jQuery, Alpine. Plain DOM APIs only.
  Vite (vanilla template) and Vitest are tooling and are fine.
- **No new runtime dependencies without asking.** Building the state store, the weight
  math, and the drag interaction from scratch *is* the assignment — reaching for a
  library skips the part I'm here to learn. Never propose zustand, lodash, d3,
  sortablejs, or a charting library as a shortcut. Dev-only deps (lint, test, build)
  are fine to suggest, with a reason.
- **ES modules only.** No CommonJS, no globals.

## Architecture rules

- `src/scoring/**` and `src/data/**` are **pure**: no DOM, no `fetch`, no
  `localStorage`. Data in, data out. That purity is what makes them testable.
- `src/ui/**` does no math. It reads from selectors and renders.
- `src/api/**` is the only place `fetch` appears.
- Never render feed data with `innerHTML`. Use `textContent` or explicit escaping.

## Domain rules that are easy to get wrong

- **ECR is inverted.** Lower rank is better, so negate it before blending.
- **Z-scores are computed within position group**, never across positions. Blending
  raw across positions makes the board all quarterbacks.
- **A missing factor is not zero.** Redistribute its weight proportionally across that
  player's remaining factors and record the absence in `missingFactors`.
- **Last season uses points per game**, not season totals, with a games-played floor
  (default 4). Below the floor the factor counts as missing, not as a bad season.
- **Weights are integers summing to exactly 100.** Every change goes through
  `rebalance()`, which includes a rounding-remainder step. Never let the total drift
  to 99 or 101.
- **Pins are a separate state layer.** Scoring never sees them. Rank everyone, lift
  pinned players out, place them at their claimed slots, fill the rest in order.
- **Persist inputs, never outputs.** Saved boards store weights, pins, and settings.
  Rankings are always recomputed on load. Never write a computed list to storage.

## API rules

- Base path is `/public/v2/json/nfl/`. That's the tier we're on, and it exposes a
  different endpoint set than the general `/v2/` docs — including `injuries`.
- Auth is the `x-api-key` **header**. Never a query parameter, never inlined in source.
- **PPR everywhere.** Every call sends `scoring=PPR`, read from one shared constant.
  Do not hardcode the format per call — a future STD toggle should be a one-line change.
- **Half-point PPR is deliberately unsupported.** `player-points` only accepts STD and
  PPR, so half would leave the last-season factor misaligned. Don't add it.
- **All feeds join on the FantasyPros id.** It's `player_id` in consensus rankings and
  player-points, and `fpid` in projections. Same number, two names.
- **Consensus rankings is the spine.** It's the only feed with bye week and tier, and
  its team values are current-season. Build the player list from it, enrich from others.
- Only projections needs a position list (colon-delimited `positions`). Consensus
  accepts `position=ALL` and player-points defaults to `ALL`.
- **Injury status is display only.** It drives a badge and never touches the score —
  how to weigh an injury is the user's judgement, not the app's.
- Expect type drift: `count` is a number in one payload and a string in another, and
  points arrive like `195.29999999999998`. Guard at the boundary, round for display.

## Visual rules

- The three factor colors are fixed and live only in CSS custom properties:
  `--factor-consensus: #3d3ad6`, `--factor-last-season: #c2710c`,
  `--factor-projected: #b5327f`. These are colorblind-validated — do not substitute.
- Never reassign a factor's color by rank or by which factor is currently largest.
- Never distinguish a factor by color alone. Always pair it with a label.
- Stacked segments get a 2px surface gap between them.

## Testing

- Tests never hit the network. Everything runs against committed `/fixtures`.
- Anything in `data/`, `scoring/`, or `state/` needs unit tests.
- `npm test` must be green before any merge.

## Workflow

- One ticket, one branch, one PR. Branch and commit messages use the **Jira key**, not
  the plan ID from `docs/build-plan.html` — Jira's key is offset `+5` from the plan ID
  in this project (plan DRAFT-12 is Jira DRAFT-17). Full lookup table:
  `docs/jira-key-mapping.md`. Jira only auto-links a commit to a work item when the
  literal existing key appears in the branch name or commit message — the plan ID alone
  won't link.
- Branch: `feat/DRAFT-17-weighted-blend` (Jira key + short slug describing the plan
  ticket, e.g. "weighted-blend" for plan DRAFT-12).
- Commit messages start with the Jira key: `DRAFT-17: add weighted blend`.
- Every merge point leaves a running app. Never merge a red suite.

## Commands

```bash
npm run dev       # Vite dev server (proxies the API, avoids CORS)
npm test          # Vitest
npm run lint
npm run capture   # refresh /fixtures from the live API — run rarely
```

## Environment

`VITE_FP_API_KEY` lives in `.env.local`, which is gitignored. Never read, echo, or
commit the key, and never inline it into source.
