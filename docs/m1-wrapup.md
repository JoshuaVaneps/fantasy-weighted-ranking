# M1 Wrap-Up — Walking Skeleton

**Status:** Complete · **Date:** 2026-08-19
**Milestone goal** (from `docs/build-plan.html`): *"Real players from four joined feeds, on screen, in consensus order."*
**Scope:** plan DRAFT-1–DRAFT-11 / Jira DRAFT-6–DRAFT-16, 27 pts — plus one off-plan deviation, Jira DRAFT-48.

All identifiers below are **Jira keys** (the ones in branch names and commits), with the plan ID from `docs/build-plan.html` noted alongside. See `docs/jira-key-mapping.md` for the full lookup.

---

## 1. What shipped, ticket by ticket

| Jira (plan) | Pts | PR | Title | What it actually delivered |
|---|---|---|---|---|
| DRAFT-6 (1) | 2 | #1 | Spike: verify tier endpoints, parameters, CORS | ~100 live calls against the real API. Confirmed CORS is refused (proxy mandatory), the join key is clean, half-PPR is fully supported, rate limiting exists but is undocumented. Evidence in `docs/api-notes.md`. |
| DRAFT-7 (2) | 2 | #2 | Scaffold repo on Vite vanilla template | `src/{api,data,scoring,state,ui}` folder skeleton, ESLint + Prettier, npm scripts. |
| DRAFT-47 (—) | — | #3 | Add minimal setup README | Off-plan, small — the README's initial setup/scripts section. |
| DRAFT-8 (3) | 1 | #4 | Add Vitest and coverage | jsdom + node test environments, coverage reporter, watch mode. |
| DRAFT-9 (4) | 2 | #5 | Dev proxy and API key configuration | Vite `server.proxy` forwards `/api/*` to FantasyPros with `x-api-key` attached server-side; key lives in gitignored `.env.local`. |
| DRAFT-10 (5) | 4 | #6 | API client with structured errors | `request()` wrapper: timeout, exponential backoff on 429, echo-validation (`year`/`scoring`/`positions` against the request), classified error shapes (auth vs. wrong-path 403, validation 400, rate limit, server error). |
| DRAFT-11 (6) | 3 | #7 | Endpoint modules for the four datasets | `getConsensus`, `getProjections`, `getPriorSeason`, `getInjuries` — locked params, one shared `SCORING` constant, JSDoc typedefs of raw shapes. |
| DRAFT-12 (7) | 2 | #8 | Fixture capture script | `npm run capture` snapshots all live endpoints to `/fixtures` for offline dev and network-free tests. |
| DRAFT-13 (8) | 3 | #9 | Join the feeds into one Player list | `joinPlayers()` — pure, merges consensus/player-points/projections on the FantasyPros id, spine is consensus, unmatched entries tracked per feed. |
| DRAFT-14 (9) | 2 | #10 | App shell, layout, and design tokens | Static two-column skeleton (`#control-panel`, `#board`), collapsing to one column under 720px. The three factor color tokens (`--factor-consensus`, `--factor-last-season`, `--factor-projected`) defined once in `:root`. |
| DRAFT-15 (10) | 3 | #11 | Hand-rolled state store | `createStore(initial)` → `getState`/`setState`/`subscribe`. Shallow-equal no-op detection, per-listener `try/catch` isolation, `unsubscribe` via closure. |
| DRAFT-16 (11) | 3 | #12 | Render the board from state | The walking skeleton comes together: `main.js` fetches the three core feeds in parallel, joins them, sorts by consensus rank, and pushes into the store; `renderBoard` subscribes and renders loading/error/empty/ready states as a table, `textContent` only. |

**27/27 points shipped, matching the plan total exactly.**

### Deviation: DRAFT-48 — Extend API to pull ADP

Not in `docs/build-plan.html` or the original Jira import — a mid-session ask, given its own real Jira key (DRAFT-48, "Extend API to Pull ADP") rather than invented. PR #13, **open, not yet merged**.

- New endpoint module `getPlayers()` hits `/players` (the master list) — the only feed that carries ADP. There is no dedicated `/adp` endpoint; it 403s at both path shapes.
- Reads `rank_adp_ppr` (PPR, per the project's PPR-everywhere rule), not `rank_adp` (STD).
- The master list is an **all-time roster** — retired players are included and carry `rank_adp_ppr: 0`. That's treated as "unranked," not an ADP of zero (same "missing factor is not zero" principle CLAUDE.md already applies to the three scoring factors).
- `joinPlayers` takes ADP as a fourth, *optional* feed (`players`, defaulting to `[]`) — nothing breaks if it's ever omitted.
- **ADP is enrichment, not core data.** In `main.js`, its fetch runs alongside the three core feeds but is *not* part of the fail-fast group — if it fails, the board still renders with `adp: null` for everyone and a `console.warn`, rather than the whole board going to an error state over a non-critical column.
- **ADP is display-only, like injury status — it is not part of the weighted blend.** The app's stated scoring model is three factors: consensus, last season, projections. ADP was added purely as a fourth *visible* column for comparison against those three, not as a fourth input to `scoreAll()`. This matters for M2: nothing in the z-score/redistribution/blend pipeline should touch `player.adp`.
- Real-data testing surfaced two bugs the synthetic unit tests didn't catch: floating-point display noise (`289.99999999999994`) and a CSS Grid `min-width: auto` gotcha that let the new table blow out the page width on narrow screens. Both fixed (see §3).
- Cost: `fixtures/players.json` is ~5.5MB (8,525 players including retirees, vs. a few hundred active players in the other four fixtures combined at ~1.2MB). Decision: keep it committed, per the project's existing "fixtures committed" convention — flagged to the user, kept as-is.
- **Open question the user asked, worth revisiting if it matters later:** the API's ADP is FantasyPros' own blended consensus across multiple platforms (ESPN, Yahoo, Sleeper, etc.), not ESPN-specific. Getting an ESPN-only number would require a separate, unofficial ESPN Fantasy API integration — a materially bigger lift (new key, new proxy route, new auth/CORS story) that was explicitly *not* undertaken here.

---

## 2. Architecture as it stands today

```
src/
  api/          consensus.js, projections.js, priorSeason.js, injuries.js, players.js,
                request.js (shared fetch wrapper), constants.js
  data/         joinPlayers.js, sortByConsensus.js   — pure, tested
  state/        store.js                              — pure, tested
  ui/           board.js                               — DOM only, tested
  main.js       composition root: fetch → join → sort → store → render
```

- **`main.js`** is the only place allowed to both call the API modules *and* touch the store — every other module respects its lane (no fetch in `ui/`, no DOM in `data/`/`state/`, no math in `ui/`).
- **Store shape:** `{ status: 'loading' | 'ready' | 'empty' | 'error', players: Player[], error: object | null }`.
- **`Player` shape** (from `joinPlayers`): `{ id, name, team, position, byeWeek, tier, rankEcr, filename, lastSeason: {points, games} | null, projected: number | null, adp: number | null }`.
- **Board columns**, left to right: Rank, Player, Team, Pos, Bye, Consensus (`rankEcr`), ADP, Last Season, Projected. Numbers are rounded for display only (`roundForDisplay`) — the underlying stored values are untouched, so M2's scoring math will still see full precision.
- **Fixtures**: `consensus-rankings.json`, `projections.json`, `player-points.json`, `injuries.json`, `players.json` — all five refreshed from the live API as of this session, all committed.
- `getInjuries()` exists and is tested but **is not called anywhere yet** — injury badges are DRAFT-39 (M4), intentionally untouched here.

---

## 3. Rough edges found and fixed along the way

These came up testing DRAFT-16/DRAFT-48 against the *live* API in a browser — not from unit tests, which used clean synthetic fixtures that wouldn't have surfaced either one:

1. **Floating-point display noise.** Points arrive like `195.29999999999998`. Fixed with a `roundForDisplay()` helper in `board.js` — display-layer only, per CLAUDE.md's boundary-guarding rule. Scoring math (M2) must do its own rounding decisions independently; this fix does not touch stored values.
2. **CSS Grid `min-width: auto` gotcha.** Once the board held a real table, it forced the grid track wider than intended on narrow screens, defeating the `overflow-x: auto` meant to contain it. Fixed with `min-width: 0` on `.control-panel`/`.board`. Worth remembering for any future wide content (the contribution bars in DRAFT-28, the mix bar in DRAFT-23) that lands inside these same grid cells.

---

## 4. What's needed for M2 — The Core Feature (30 pts, Jira DRAFT-17–DRAFT-25)

M2's goal per the plan: *"Drag the mix, the board re-sorts live — the actual idea, working."* This is the scoring math and the weight-control UI. None of it is started.

| Jira (plan) | Pts | Title | Depends on (plan ID) | Ready to start? |
|---|---|---|---|---|
| DRAFT-17 (12) | 5 | Z-score normalization within position | plan 8 = **DRAFT-13, done** | **Yes** |
| DRAFT-18 (13) | 1 | Games-played floor on last season | DRAFT-17 (above) | After DRAFT-17 |
| DRAFT-19 (14) | 3 | Missing-factor weight redistribution | DRAFT-18 (above) | After DRAFT-18 |
| DRAFT-20 (15) | 3 | Weighted blend and ranking (`scoreAll`) | DRAFT-19 (above) | After DRAFT-19 |
| DRAFT-21 (16) | 3 | App state shape and memoized selector | plan 10 = **DRAFT-15, done**; plan 15 = DRAFT-20 (above) | After DRAFT-20 |
| DRAFT-22 (17) | 3 | Weight rebalance function | plan 10 = **DRAFT-15, done** | **Yes** |
| DRAFT-23 (18) | 5 | Draggable three-segment mix bar | DRAFT-22 (above); plan 9 = **DRAFT-14, done** | After DRAFT-22 |
| DRAFT-24 (19) | 2 | Numeric weight inputs synced to the bar | DRAFT-23 (above) | After DRAFT-23 |
| DRAFT-25 (20) | 5 | Keyed DOM reordering instead of full re-render | plan 11 = **DRAFT-16, done**; plan 16 = DRAFT-21 (above) | After DRAFT-21 |

**Two tickets are unblocked right now** and don't depend on each other, so they could go in either order or even in parallel: **DRAFT-17** (z-score normalization — the natural first step, since everything else in the scoring chain builds on it) and **DRAFT-22** (weight rebalance — pure function, only needs the state store shape which already exists).

**Things M2 needs to get right, per CLAUDE.md's domain rules, that aren't yet exercised by any shipped code:**
- ECR must be **negated** before blending (lower rank = better; the blend needs higher = better).
- Z-scores computed **within position group only** — never across positions.
- A missing factor gets its weight **redistributed proportionally** across that player's remaining factors, and the absence recorded in `missingFactors` — this is a different rule from the ADP-zero handling in DRAFT-48; do not conflate them, they're separate feeds with separate "missing" semantics.
- Last season uses **points per game**, with a games-played floor (default 4) — DRAFT-18 (Jira). The `lastSeason.points` field currently on `Player` is a season **total**, not yet divided by games; that division belongs to DRAFT-18, not before.
- Weights are **integers summing to exactly 100**, always through `rebalance()`.
- **`player.adp` is not a scoring input** — see §1's deviation note. `scoreAll()` should only ever read `rankEcr`, `lastSeason`, and `projected`.

---

## 5. Where things are left / handoff

- `main` has everything through DRAFT-16 (PR #12) merged.
- **PR #13 (DRAFT-48, ADP) is open, not yet merged.** Merge it before branching M2 work, same handoff pattern used throughout M1 (check `gh pr view <n> --json state,mergedAt`, pull main, then branch).
- No blockers. Recommended next step: branch `feat/DRAFT-17-<slug>` off updated `main` and start Z-score normalization — it's pure, fully within `src/scoring/**` (not yet created), and unblocks the rest of the scoring chain.
- `src/scoring/` currently holds only `environment.test.js` (a node-environment smoke test confirming `document` is undefined there, i.e. no DOM) — DRAFT-17 will be the first real content there.
