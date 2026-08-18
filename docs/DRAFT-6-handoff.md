# DRAFT-6 Handoff — API spike results and build-plan impact

**For:** the planning conversation that owns `docs/build-plan.html`
**From:** the build conversation, 2026-08-18
**Ticket:** Jira DRAFT-6 / plan DRAFT-1 — *Spike: verify tier endpoints, parameters, and CORS*
**Status:** complete, all acceptance criteria met. Full evidence in `docs/api-notes.md`.

---

## TL;DR for the planner

The spike did its job — it found things. Nine items in the build plan are now wrong or
incomplete. Two of them are **decisions that were made on false information** and should
be revisited, not just reworded.

The most important corrections:

1. **The half-PPR exclusion is based on a false premise.** Half-PPR is fully supported by
   both factors. The v1 scope decision may stand, but its stated reason must not.
2. **CORS is settled: No.** A production proxy is now a hard requirement, not a "may
   need". This changes the deployment story from open question to constraint.
3. **The identity join is de-risked.** `player_id` and `fpid` are the same integer,
   verified. DRAFT-8's "sleeper risk" framing is now too pessimistic.
4. **Rate limiting exists and is unadvertised** — a new risk the plan doesn't mention at
   all.

---

## 1. What we did

Ran the spike as a raw `curl` harness (no Vite, no scaffold — that's DRAFT-7's job),
roughly 100 calls against the live API:

- All four locked endpoints with the locked parameters
- Deliberate negative tests to capture error shapes (bad key, no key, bad position,
  missing params, out-of-range season, unsupported scoring)
- A direct `player_id` vs `fpid` cross-reference to verify the join
- CORS tested twice: raw `OPTIONS` preflight, plus a real browser origin
- A rate-limit burst
- Path-shape probes after `injuries` turned out not to follow the season pattern

Mid-spike, the API key was upgraded from free to **HOF premium**, which changed several
results. Everything below reflects the premium tier.

**Repo state:** three commits. `main` has the bootstrap (CLAUDE.md, `.gitignore`,
`docs/jira-key-mapping.md`); branch `feat/DRAFT-6-api-spike` has `docs/api-notes.md` and
the CLAUDE.md corrections. Nothing pushed yet.

---

## 2. What we found

### Confirmed as planned ✅

- Base path, `x-api-key` header auth, and the season-scoped URL shape all correct
- `position=ALL` on consensus, colon-delimited `positions` on projections — both honoured
- Consensus rankings **is** the spine: the only feed with `player_bye_week`, `tier`, `rank_ecr`
- Season segments honoured (2026 → 502 players, 2025 → 544, 2024 → 724)
- Type drift, exactly as predicted: `count` is a number in one payload and a string in
  another; points arrive as `195.29999999999998`
- The `/players` master list exists and does carry `rank_ecr`, `rank_adp`,
  `rank_ecr_ppr`, `rank_adp_ppr`, `rank_ecr_half` — viable future ADP source

### The join is solved, and cleaner than feared ✅

`player_id` (consensus, player-points, injuries) and `fpid` (projections) are **the same
integer**. Verified across 8 players:

| Player | `player_id` | `fpid` |
|---|---|---|
| Josh Allen | 17298 | 17298 |
| Lamar Jackson | 17233 | 17233 |
| Drake Maye | 23046 | 23046 |
| Joe Burrow | 19196 | 19196 |

No fuzzy name matching required. **Caveat:** this proves the *key* is clean, not that
*coverage* is complete — rookies present in one feed and absent from another are still
possible. The unmatched report in DRAFT-8 is still worth building.

### New constraints the plan doesn't account for ⚠️

| Finding | Impact |
|---|---|
| **CORS: No.** `OPTIONS` preflight → 403, zero CORS headers. `x-api-key` isn't safelisted, so browsers *must* preflight. No browser call can succeed at any origin. | Proxy mandatory in dev **and** prod. Static-only deploy impossible. |
| **Rate limiting, unadvertised.** A 20-request burst gave `200 ×7`, then `429 ×11`, then recovered. **No `Retry-After`, no `X-RateLimit-*` headers on any response, including the 429.** | Client needs exponential backoff with no server-supplied delay to read. |
| **Silent 200s.** Bad input returns 200 with the wrong data: omitting `positions` silently defaults to `RB`; an out-of-range season silently returns the current one. | Client must echo-check `year` / `scoring` / `positions` against the request. |
| **`count` ≠ array length.** It reflects the requested filter, not the payload. | Never use it for length. Use `players.length`. |
| **403 has two meanings.** `{"message":"Forbidden"}` = auth. `{"message":"Missing Authentication Token"}` = API Gateway's 404. | Don't report a wrong path as an auth failure. |
| **CDN cache excludes the API key.** `cache-control: max-age=1200` via CloudFront; the cache key doesn't include `x-api-key`. | Observed live: premium key served cached *free-tier* responses for minutes. Also gives DRAFT-30 a non-arbitrary 20-min TTL. |
| **Free tier caps every feed at 10 players**, unpageable. | The plan silently assumes paid access. Worth stating — if the subscription lapses the app degrades to 10 players with a 200 response and no error. |

### Two path shapes, not one ⚠️

Season-scoped data is `/{season}/{endpoint}`. Everything else lives at the root:

```
/{season}/consensus-rankings   /{season}/projections   /{season}/player-points
/injuries    /players    /news          ← no season segment
/adp  /depth-charts  /teams             ← genuinely absent at both shapes
```

Calling one under the wrong shape returns a 403 that reads as permissions. This cost us
a wrong conclusion mid-spike — we initially reported `injuries` and `players` as
nonexistent.

---

## 3. What changed in CLAUDE.md

Committed as `d4a9a80`. CLAUDE.md loads into context every session, so stale claims there
actively steer future tickets wrong — that's why these were corrected rather than just
recorded in the notes.

**Corrected (were factually wrong):**

- `scoring=PPR` "on every call" → **projections ignores `scoring` entirely and always
  returns STD.** Read `stats.points_ppr`. The param is not a fallback there; it does
  nothing.
- Half-PPR ban's stated reason → **false, removed.** See §4.1.
- `injuries` path → replaced with the two-path-shape rule above.
- "Only projections needs a position list" → still true, but **omitting it silently
  defaults to `RB`**, so always send it explicitly.
- Join key → `injuries` also uses `player_id`.

**Added (new rules, no prior equivalent):**

- A *Guarding the boundary* section: 200 ≠ success, echo-check the response; never use
  `count` as a length; 429s carry no `Retry-After`; the two meanings of 403.
- A *The proxy is not optional* section: required in dev **and** production, static-only
  deploy cannot work, plus the CloudFront cache-key issue and the 20-min TTL.

**Structural decision:** rules live in CLAUDE.md, evidence lives in `docs/api-notes.md`.
No duplication — CLAUDE.md links out rather than restating payloads.

---

## 4. What's now wrong in the build plan

Ordered by how much rework each implies.

### 4.1 — Decision: "PPR everywhere, no scoring toggle in v1" — **premise is false**

> *Plan says:* "Consensus rankings and projections also support HALF, but player-points
> only supports STD and PPR — so half-point leagues cannot align all three factors."

**Both halves of this are wrong.**

`player-points` **does** honour `scoring=HALF`, returning genuinely different values —
and STD even produces a different top WR:

```
scoring=STD   → top WR Jaxon Smith-Njigba, 232.5
scoring=HALF  → top WR Puka Nacua,         289.49999999999994
scoring=PPR   → top WR Puka Nacua,         349
```

Meanwhile `projections` **ignores `scoring` entirely** — but ships `points`,
`points_ppr`, *and* `points_half` inside `stats`, so all three formats are available
there too.

So half-PPR is fully alignable across all three factors. There is no technical barrier.

**Recommended update:** keep half-PPR out of v1 if you want scope discipline — that's a
defensible call — but rewrite the justification as a scope decision, not a limitation.
The current wording will cause a future session to "discover" that half works and treat
it as a bug in the plan. Also update **DRAFT-36 / Jira DRAFT-41**, whose AC says
"half-PPR is either absent or clearly labelled as approximated" — no approximation is
needed; it would be exact.

### 4.2 — Decision: "The one real unknown: whether the API permits browser calls" — **resolved, No**

> *Plan says:* "Deployment may need a thin serverless proxy."

Not "may". **Will.** The preflight is unhandled, so this isn't a maybe. And there's a
second independent reason the plan doesn't mention: a browser-side `x-api-key` is a
public key, now a *paid* credential.

**Recommended update:** move this out of "unknowns" into the locked-decisions list as
*"Deployment requires a server-side proxy."* Then update the **Risks** section, which
still frames CORS as a live risk — it's now a resolved constraint. Add a note that the
proxy host needs choosing before deploy (it doesn't block any ticket before then).

### 4.3 — **DRAFT-7 / Jira DRAFT-12** (fixture capture) — wrong dataset count

> *Plan says:* "calls all three endpoints once" · AC: "npm run capture writes three JSON files"

There are **four** datasets. DRAFT-6 (Jira DRAFT-11) already says "the four datasets" and
includes `getInjuries()`, so the plan contradicts itself.

**Recommended update:** three → four throughout DRAFT-7. Note also that the injuries call
takes no season segment, and that a 4-call sequential capture is comfortably under the
rate limit.

### 4.4 — **DRAFT-5 / Jira DRAFT-10** (API client) — wrong error cases

> *Plan AC:* "mocked fetch covering timeout, 401, 500, and invalid JSON"

**We never observed a 401.** Auth failure is **403**. The real error surface is:

| Case | Observed |
|---|---|
| Bad key *or* no key | `403 {"message":"Forbidden"}` — identical for both, no detail |
| Wrong path | `403 {"message":"Missing Authentication Token"}` |
| Invalid param | `400` + `parameter` + `valid_format` fields |
| Rate limited | `429`, no `Retry-After` |
| Bad input, silently ignored | **200 with wrong data** |

**Recommended update:** replace 401 with the two 403 variants, add 429, and add an
explicit AC for **echo-validation** — the client should compare `year` / `scoring` /
`positions` in the response against what was requested and surface a mismatch. This is
the single highest-value guard the spike produced, and there's currently no ticket for
it. It belongs in DRAFT-5 rather than a new ticket. Consider +1 point.

### 4.5 — **DRAFT-6 / Jira DRAFT-11** (endpoint modules) — the PPR constant has an exception

> *Plan says:* "Scoring is a single constant (PPR) referenced by all of them"

Still the right design, but `getProjections()` is an exception: the constant goes on the
call for consistency, yet the value must be read from `stats.points_ppr` because the
param is ignored.

**Recommended update:** add to the AC that `getProjections()` reads `stats.points_ppr`
and does not rely on the `scoring` param. Worth an inline comment in the code too —
it looks like a bug otherwise.

### 4.6 — **DRAFT-30 / Jira DRAFT-35** (TTL cache) — TTL now has a real basis

The plan doesn't specify a TTL value. Upstream sends `cache-control: max-age=1200`.

**Recommended update:** default the TTL to 20 minutes, citing upstream. Add an AC noting
that upstream's CDN cache doesn't vary on the API key, so a cached response may be up to
20 minutes stale regardless of what the client does — the client cache sits on top of an
existing one.

### 4.7 — Risks section — one risk overstated, one missing

**Overstated:** "The identity join (DRAFT-8) is the sleeper... suffixes, apostrophes,
nicknames." The join is a clean integer match, verified. The name-matching worry applies
only to the `filename` fallback. Keep the unmatched report; drop the "budget more time
than 5 points suggests" framing.

*(Related: `filename` is a **full URL** in `/players` but a bare `jahmyr-gibbs.php` in the
other feeds. Same field name, different shape — the plan calls it a fallback key without
noting this.)*

**Missing:** rate limiting. Nothing in the plan mentions it. It touches DRAFT-5
(backoff), DRAFT-7 (capture), DRAFT-30 (cache), and DRAFT-31 (error states).

### 4.8 — API contract table — small fixes

- Cross-reference for the injury badge says **DRAFT-35**; the actual ticket is plan
  DRAFT-34 / Jira DRAFT-39. Off by one.
- Projections row lists `scoring=PPR` in the URL — harmless but misleading, since it's
  ignored. Annotate it. *(Credit where due: the "Fields used" column already says
  `stats.points_ppr`, so the contract table was **more correct than CLAUDE.md** here.)*
- The `/injuries` row is already correct in having no season segment — the plan got this
  right and CLAUDE.md was the one that was wrong.
- Last-season row says `?position=ALL&scoring=PPR`. `player-points` defaults to ALL, so
  the param is redundant but harmless; we didn't explicitly test that it's accepted.

### 4.9 — Nothing in the plan mentions API tier

The free tier caps every feed at 10 rows with a 200 response and no error — the app would
silently render a 10-player board. Now on HOF premium, which lifts it entirely.

**Recommended update:** record the tier requirement in the locked decisions, and consider
an AC on DRAFT-5 or DRAFT-8 asserting a sane minimum row count so a lapsed subscription
fails loudly instead of silently.

---

## 5. What did *not* change

Worth stating so the planner doesn't over-correct:

- All milestone boundaries, ticket ordering, dependencies, and point estimates stand
- The scoring math (z-scores within position, redistribution, rebalance, VOR, pins) is
  untouched — it's pure and never depended on API details
- The module map is unaffected
- Success criteria all still hold
- M1+M2 remains a complete, defensible capstone

The spike changed the **data-access layer's assumptions**, not the app's design.

---

## 6. Suggested next actions for the planner

1. Rewrite the half-PPR decision as scope, not limitation (§4.1) — highest priority, it's
   a decision made on false information
2. Promote the proxy from unknown to locked decision (§4.2)
3. Fix DRAFT-7's three → four (§4.3)
4. Rewrite DRAFT-5's error-case AC and add echo-validation (§4.4) — biggest gap, no
   ticket currently covers it
5. Add rate limiting to Risks; downgrade the join risk (§4.7)
6. Record the premium-tier requirement (§4.9)

Items 3–6 are edits. Items 1–2 are decision changes and want a deliberate call.

**Unblocked by this spike:** DRAFT-7 (Vite scaffold) and DRAFT-9 (dev proxy), the latter
now carrying a hard production requirement rather than a dev convenience.
