# M2 Wrap-Up — The Core Feature

**Status:** Complete · **Date:** 2026-08-20
**Milestone goal** (from `docs/buildplan.html`): *"Drag the mix, the board re-sorts live — the actual idea, working."*
**Scope:** Jira DRAFT-17–DRAFT-25, 31 pts — plus two off-plan deviations, DRAFT-49 (pulled forward from M4) and DRAFT-52 (unscheduled).

All identifiers below are Jira keys. Plan IDs are retired as of `docs/buildplan.html` revision 2 and don't apply to anything in this milestone.

---

## 1. What shipped, ticket by ticket

| Jira | Pts | PR | Title | What it actually delivered |
|---|---|---|---|---|
| DRAFT-18 | 2 | #15 | Games-played floor on last season | `applyGamesPlayedFloor(players, floor = 4)` — a player below the floor has `lastSeason` set to `null` (missing, not a bad season) *before* anything else runs. Also carried the feed's own `average` field through `joinPlayers` as `lastSeason.pointsPerGame`, closing a gap the M1 join had left. |
| DRAFT-17 | 5 | #16 | Z-score normalization within position | `zScoreByPosition(players)` — converts raw factors to z-scores. ECR is inverted (lower rank = better). A missing factor is excluded from its group's mean/stdev, not zeroed. **Superseded mid-ticket — see §3.** |
| DRAFT-19 | 3 | #17 | Missing-factor weight redistribution | `redistributeWeights(players, weights)` — a `null` z-score has its weight spread proportionally across the player's remaining factors (`effectiveWeights`), and the gap recorded in `missingFactors`. A player missing all three is `excluded` with a stated reason rather than scored as 0. |
| DRAFT-20 | 3 | #18 | Weighted blend and ranking (`scoreAll`) | `scoreAll(players, weights)` — the one function the UI calls. Runs floor → z-score → redistribute → weighted sum → sort (by score, then consensus rank, then surname) → rank assignment. Pure, new array, snapshot-tested. A test asserts `player.adp` never influences the result. |
| DRAFT-21 | 3 | #21 | App state shape and memoized selector | Real store shape — `{ status, error, rawPlayers, weights, pins, settings, activeBoardId }`, replacing M1's provisional `{ status, players, error }`. `getRankedPlayers(state)` memoizes on `rawPlayers`/`weights` only, so unrelated state changes don't recompute `scoreAll`. |
| DRAFT-22 | 3 | #20 | Weight rebalance function | `rebalance(weights, changedKey, newValue)` — moves one weight, spreads the remainder proportionally across the other two, and pushes any 1–2pt rounding leftover onto the larger of the two untouched buckets so the total is always exactly 100. Property-tested over random inputs. |
| DRAFT-23 | 5 | #22 | Draggable three-segment mix bar | `createMixControl(container, weights, onWeightsChange)` — one stacked bar, two draggable/keyboard-operable dividers, correct ARIA slider semantics, built once and updated in place (`update(weights)`) rather than rebuilt per drag tick — the pattern DRAFT-25 later reused for the board. |
| DRAFT-24 | 2 | #23 | Numeric weight inputs synced to the bar | Three `<input type=number>`s wired into the same `commit()`/`rebalance()` path as the dividers. Typing rebalances the other two; an emptied or non-numeric field clamps to 0 instead of being rejected; bar and inputs can never disagree. |
| DRAFT-25 | 5 | #24 | Keyed DOM reordering instead of full re-render | `createBoard(container)` replaces `renderBoard`. Rows are keyed by player id in a `Map`, reused and moved (`insertBefore`) rather than rebuilt on every mix-bar tick. Verified live with a Playwright-driven continuous drag against the real 508-player board: constant row count, persisted node identity, preserved scroll position and focus, zero console errors. |

**31/31 points shipped, matching the plan total exactly.**

### Off-plan work shipped inside the M2 window

- **DRAFT-49 — Production proxy and first deploy** (PR #14, 2 pts, formally an M4 ticket). The build plan allows pulling this forward to *the end* of M2; it actually shipped *before M2 started* — merged right after the M1-era DRAFT-48, ahead of DRAFT-18. `docs/buildplan.html` lists its dependency as DRAFT-9 and DRAFT-25, which as written implies the whole milestone should have finished first; in practice a Vercel serverless function forwarding `x-api-key` doesn't actually need the board's rendering strategy to exist, so shipping early caused no problems, but the dependency line in the plan document doesn't reflect what happened and is worth fixing in a future doc pass. App is live at `https://fantasy-weighted-ranking.vercel.app` (`api/proxy.js` + `vercel.json`).
- **DRAFT-52 — Football-themed dark palette and hero banner** (PR #19, unpointed, not in `docs/buildplan.html` at all). Visual-only: `src/style.css` dark palette, hero banner asset, `index.html` markup changes. No scoring, state, or rendering logic touched.

---

## 2. A real deviation worth flagging: ECR normalization scope

DRAFT-20's PR (#18) contains a second commit — `f511031`, "compute ecr z-scores globally, not per position" — that changes `zScoreByPosition` after DRAFT-17 had already shipped it:

- **The bug:** per-position ECR normalization broke the 100-weight-on-consensus AC. 497 of 508 fixture players reordered versus raw consensus rank. Small position groups (e.g. TE) were producing inflated z-scores disconnected from the player's real consensus standing, because ECR is already a cross-position measure — FantasyPros ranks a TE and a WR against each other directly — unlike `lastSeason`/`projected`, which are raw point totals that a low-end RB can outscore an elite TE at, and so genuinely do need position-scoping to avoid the blend skewing toward high-scoring positions.
- **The fix:** `zScoreByPosition` now tags each factor with a `scope` (`'global'` for `ecr`, `'position'` for `lastSeason`/`projected`) and groups accordingly before computing mean/stdev.

**This means CLAUDE.md's current domain rule — "Z-scores are computed within position group, never across positions" — is stated too broadly and is now wrong for one of the three factors.** It's accurate for `lastSeason` and `projected`, not for `ecr`. Worth a CLAUDE.md correction before M3 work (contribution bars, DRAFT-28) reads that rule and assumes all three factors are position-scoped.

---

## 3. Architecture as it stands today

```
src/
  api/          consensus.js, projections.js, priorSeason.js, injuries.js, players.js,
                request.js, constants.js
  data/         joinPlayers.js, sortByConsensus.js        — pure, tested
  scoring/      gamesPlayedFloor.js, zScoreByPosition.js, redistributeWeights.js,
                scoreAll.js, rebalance.js                  — pure, tested, no DOM/fetch/storage
  state/        store.js, selectors.js                     — pure, tested
  ui/           board.js, mixControl.js                    — DOM only, no math, tested
  main.js       composition root: fetch → join → store → render
api/proxy.js    Vercel serverless function (DRAFT-49) — production x-api-key proxy
```

- **Store shape:** `{ status, error, rawPlayers, weights: { ecr, lastSeason, projected }, pins, settings, activeBoardId }`. `pins` and `settings` are declared but not yet consumed by anything — that's M3.
- **`scoreAll` pipeline order** (this order is load-bearing, not incidental): `applyGamesPlayedFloor` → `zScoreByPosition` → `redistributeWeights` → weighted sum → sort → rank. Each stage is independently pure and independently tested.
- **Both `board.js` and `mixControl.js` now follow the same "build once, `update()` in place" shape** — `createBoard(container)` / `createMixControl(container, weights, onWeightsChange)`, each returning `{ update }`. `main.js` constructs both once at module scope and calls `update()` from a single `render(state)` on every store change.
- **Weights are always integers summing to 100**, enforced through `rebalance()` on every change — the mix bar, the numeric inputs, and (per CLAUDE.md) anything future that changes a weight all have to route through it.
- **`player.adp` is confirmed never read by the scoring chain** — `scoreAll` only touches `rankEcr`, `lastSeason`, `projected`, and a test asserts it.

---

## 4. What's needed for M3 — Control & Explanation

M3's goal per the plan: pins, contribution bars, the validated color palette, and drag-to-pin — the layer that lets a user *override* and *understand* the math M2 just built, rather than just watch it move.

| Jira | Pts | Title | Depends on | Ready to start? |
|---|---|---|---|---|
| DRAFT-26 | 5 | Value over replacement for the overall board | DRAFT-20 | **Yes** |
| DRAFT-27 | 2 | Position filter and name search | DRAFT-25 | **Yes** |
| DRAFT-28 | 3 | Per-player contribution bar | DRAFT-25, DRAFT-20 | **Yes** |
| DRAFT-29 | 1 | Apply validated factor palette | DRAFT-23, DRAFT-28 | After DRAFT-28 |
| DRAFT-30 | 5 | Pin model in state and ranking | DRAFT-21 | **Yes** |
| DRAFT-31 | 5 | Drag to reorder (drag-to-pin) | DRAFT-30, DRAFT-25 | After DRAFT-30 |
| DRAFT-32 | 3 | Pin affordances and keyboard alternative | DRAFT-31 | After DRAFT-31 |

**Four tickets are unblocked right now and don't depend on each other:** DRAFT-26 (VOR, only needs DRAFT-20), DRAFT-27 (filter/search, only needs DRAFT-25), DRAFT-28 (contribution bar, needs DRAFT-25 and DRAFT-20), and DRAFT-30 (pin model, only needs DRAFT-21). DRAFT-29, DRAFT-31, and DRAFT-32 each queue behind one of those.

**Things M3 needs to get right, per CLAUDE.md's domain rules, that M2 didn't have to exercise:**
- **Pins are a separate state layer — scoring never sees them.** Rank everyone via `scoreAll` first, then lift pinned players out and place them at their claimed slots, then fill the rest in order. Nothing in `src/scoring/**` should ever know a pin exists.
- **The three factor colors are fixed** (`--factor-consensus`, `--factor-last-season`, `--factor-projected`) and validated — DRAFT-28's contribution bar and DRAFT-29's palette pass must reuse them exactly, never reassign by rank or by which factor is currently largest, and always pair color with a label.
- **A missing factor's contribution bar segment** needs to render as muted/hatched with a tooltip naming it — `missingFactors` (from DRAFT-19) is already on every scored player, ready to read.
- DRAFT-31's drag-to-pin has to work *with* DRAFT-25's keyed rendering, not fight it — the row nodes it's dragging are the same reused `<tr>` elements `syncRows` manages, so a pin drop shouldn't trigger a rebuild that would invalidate an in-progress drag.
- DRAFT-27's ranks shown must stay the board's true ranks even while filtered — `getRankedPlayers` already returns the full ranked list, so the filter has to be applied as a display-layer step after ranking, never by re-running `scoreAll` on a subset.

---

## 5. Where things are left / handoff

- `main` has everything through DRAFT-25 (PR #24) merged, plus the off-plan DRAFT-49 and DRAFT-52. Full suite green (109/109), lint clean.
- **No open PRs.** No blockers.
- **Before branching M3 work:** fix the CLAUDE.md domain-rule wording on z-score scoping (§2) — a small text change, but leaving it wrong risks a future ticket trusting the stale "always within position group" line.
- **Recommended next step:** branch `feat/DRAFT-26-<slug>` or `feat/DRAFT-28-<slug>` off updated `main` — both are unblocked now that DRAFT-25 is merged. Read the current `docs/buildplan.html` M3 section directly rather than trusting §4's summary table above, the same caution the M1 wrap-up gave about its own M2 preview.
- `docs/buildplan.html` still lists DRAFT-49's dependency as `DRAFT-9, DRAFT-25` even though it shipped before either M2 or the dependency chain implied — worth a revision-3 correction alongside the z-score wording fix, not urgent since the ticket is already done and working.
