# API Notes — FantasyPros `/public/v2/`

**Ticket:** DRAFT-6 (plan DRAFT-1) · **Verified:** 2026-08-18 · **Tier at time of testing:** `premium` (HOF)

Findings from calling the live API. Every claim below was observed in a response, not
inferred from documentation. Where this contradicts an assumption in `CLAUDE.md`, the
contradiction is called out explicitly.

---

## 1. Connection basics

| | |
|---|---|
| Base | `https://api.fantasypros.com/public/v2/json/nfl` |
| Auth | `x-api-key` **header** (40 chars). Query param not supported. |
| Protocol | HTTP/2, behind AWS API Gateway + CloudFront |
| Tier reported | `tier: "premium"` in every payload |

---

## 2. Confirmed endpoints

All four work. Note that **`injuries` has no season segment** — this is the one path
that breaks the `/{season}/{endpoint}` pattern.

| Endpoint | Path | Confirmed params | Rows returned |
|---|---|---|---|
| Consensus rankings | `/{season}/consensus-rankings` | `position=ALL`, `scoring=PPR`, `week=0` | 502 (2026) |
| Projections | `/{season}/projections` | `positions=QB:RB:WR:TE`, `week=0` | 525 (2026) |
| Player points | `/{season}/player-points` | `scoring=PPR` | 734 (2025) |
| Injuries | `/injuries` — **no season** | none | 117 |

`/{season}/injuries` returns 403. So do `/adp`, `/players`, `/depth-charts`, `/news` —
those endpoints do not exist on this tier at any path tried.

### Season segment

Honoured for real seasons. Out-of-range years silently fall back to the current season
rather than erroring:

```
/2026/consensus-rankings → year=2026, count=502, top=Ja'Marr Chase
/2025/consensus-rankings → year=2025, count=544, top=Ja'Marr Chase
/2024/consensus-rankings → year=2024, count=724, top=Christian McCaffrey
/1999/consensus-rankings → year=2026, count=502   ← silent fallback, no error
```

Always read the `year` field back from the response rather than trusting the request.

---

## 3. ⚠️ `scoring` on projections is cosmetic — use `stats.points_ppr`

**This contradicts `CLAUDE.md`'s "PPR everywhere, every call sends `scoring=PPR`" rule.**

The `projections` endpoint **always** echoes `scoring: "STD"` regardless of what you
send. `scoring=PPR` and `scoring=STD` return byte-identical payloads.

That does **not** mean PPR is unavailable. Every projections player carries all three
scoring totals inside `stats`:

```json
{
  "fpid": 22968, "name": "Jahmyr Gibbs", "position_id": "RB",
  "stats": {
    "points": 301.65,        // STD
    "points_ppr": 372.92,    // ← use this
    "points_half": 337.28,
    "rec_rec": 71.27, "rush_yds": 1381.53, ...
  }
}
```

Arithmetic checks out: `301.65 STD + 71.27 receptions = 372.92 PPR`.

**Rule for the projected-season factor: ignore the `scoring` query param on projections
and read `stats.points_ppr`.** The shared PPR constant still governs `consensus-rankings`
and `player-points`, which both honour it properly.

### Half-PPR is fully supported — the original ban was based on a false premise

`CLAUDE.md` originally said half-PPR was impossible because "`player-points` only accepts
STD and PPR." **That is not true.** `player-points` honours `scoring=HALF`, returning a
third distinct set of values — and STD even yields a different top WR:

```
scoring=STD   → top WR Jaxon Smith-Njigba, 232.5
scoring=HALF  → top WR Puka Nacua,         289.49999999999994
scoring=PPR   → top WR Puka Nacua,         349
```

(Tested on WRs specifically. An earlier attempt using kickers and team defenses proved
nothing, since those score identically in all three formats — worth remembering when
spot-checking scoring changes.)

Combined with `stats.points_half` on projections, **both factors can supply half-PPR**.
It remains out of scope by choice, but it is a legitimate third option for DRAFT-41's
scoring toggle rather than a technical impossibility.

---

## 4. Join key — confirmed

`player_id` (consensus, player-points, injuries) and `fpid` (projections) are the same
number. Verified by cross-referencing the QB list:

| Player | consensus `player_id` | projections `fpid` |
|---|---|---|
| Josh Allen | 17298 | 17298 |
| Lamar Jackson | 17233 | 17233 |
| Drake Maye | 23046 | 23046 |
| Joe Burrow | 19196 | 19196 |
| Jalen Hurts | 19275 | 19275 |
| Jayden Daniels | 22902 | 22902 |
| Trevor Lawrence | 19780 | 19780 |
| Dak Prescott | 15600 | 15600 |

8/10 matched; the other two were absent from one sample, not mismatched. **Safe to join
on this id** (DRAFT-13).

Consensus is confirmed as the spine — it is the only feed carrying `player_bye_week`,
`tier`, and `rank_ecr`.

---

## 5. Error shapes (input for DRAFT-10)

Four distinct categories. The client must distinguish all four.

| Category | Status | Body | Notes |
|---|---|---|---|
| Auth failure | 403 | `{"message":"Forbidden"}` | **Identical for bad key and missing key.** No detail. |
| Route not found | 403 | `{"message":"Missing Authentication Token"}` | API Gateway's 404. A *403 that means 404* — do not report as an auth problem. |
| Validation | 400 | `{"message":"Invalid Position","parameter":"position","valid_format":"QB, RB, WR, TE, K, OP, FLX, DST, IDP, DL, LB, DB, TK, TQB, TRB, TWR, TTE, TOL, HC, P, ALL, RK"}` | Rich and parseable — has `parameter` and `valid_format`. |
| Rate limit | 429 | — | See §6. |
| **Silent ignore** | **200** | normal payload | **The dangerous one.** See below. |

### Silent failures return 200

Several bad inputs succeed while quietly ignoring what you asked:

- omitting `positions` on projections → 200, silently defaults to `positions: "RB"`
- `scoring=PPR` on projections → 200, silently returns STD (see §3)
- `/1999/` season → 200, returns the current season

(`scoring=HALF` on player-points also returns 200 and echoes `"HALF"` — but that one is
genuine, not a silent ignore. See §3.)

**Never treat 200 as "got what I asked for."** Echo-check the response fields
(`year`, `scoring`, `positions`, `position_id`) against the request. This is the single
most important guard for the API boundary.

---

## 6. Rate limits

Rate limiting is real but not advertised. **No `X-RateLimit-*` and no `Retry-After`
headers exist on any response**, including the 429 itself.

Observed: a sequential burst of 20 cache-busted requests returned `200 ×7`, then
`429 ×11`, then recovered to 200 while still bursting. Later attempts (15 sequential,
10 fully parallel) did not reproduce it — so this is a **sustained-rate quota**, not a
burst cap or a concurrency cap. The exact threshold was not characterised.

**Implication:** the client needs 429 handling with exponential backoff regardless of the
exact number, and it cannot rely on a `Retry-After` value to time the retry.

---

## 7. ⚠️ CDN caching does not vary on the API key

`cache-control: max-age=1200` (20 min), served through CloudFront.

**Observed during this spike:** after upgrading from free to premium, the API kept
returning cached *free-tier* responses (`tier: "free"`, `limit: 10`, 10 players) to the
new premium key for several minutes. Adding a cache-busting query param immediately
returned full premium payloads (502 / 525 / 734 players).

This means **the CloudFront cache key does not include the `x-api-key` header.** Two
consequences:

1. Responses can be stale by up to 20 minutes, and can reflect a *different* key's tier.
2. `max-age=1200` is upstream's own freshness window — a defensible, non-arbitrary
   default TTL for the DRAFT-30 cache layer.

---

## 8. CORS — **No.** A proxy is mandatory.

```
OPTIONS preflight, Origin: http://localhost:5173,
        Access-Control-Request-Headers: x-api-key
  → HTTP 403, zero Access-Control-* headers

GET with same Origin (curl)
  → HTTP 200, access-control-allow-origin: http://localhost:5173
```

`x-api-key` is **not** a CORS-safelisted request header, so browsers are *required* to
preflight before the GET. The preflight fails with 403 and returns no
`Access-Control-Allow-Headers`, so the browser never issues the real request.

The GET succeeding in curl — and the `Access-Control-Allow-Origin` echoing the localhost
origin back — is misleading. Neither is reachable from browser JavaScript.

### Decision: proxy required, in dev **and** in production

Two independent reasons, either sufficient on its own:

1. **The preflight is unhandled.** No browser-side call can succeed, at any origin.
2. **A browser-side key is a public key.** Even if CORS were open, shipping `x-api-key`
   to the client exposes a paid credential to every visitor.

DRAFT-9's dev proxy is therefore not a convenience — it is the only way the app functions
in a browser. Production needs an equivalent server-side proxy (serverless function or
similar); a static-only deploy will not work.

---

## 9. Type drift — confirmed

As `CLAUDE.md` warned. Guard at the boundary.

- `count` is a **number** (`502`) on consensus-rankings, a **string** (`"525"`) on projections
- Floating-point noise in points values (`195.29999999999998`)
- `count` reflects the **requested filter, not the payload** — under the free tier,
  `limit=100` set `count: 100` while still returning 10 players. Never use `count` as the
  array length; use `players.length`.

---

## 10. Injuries payload (DRAFT-34)

Available and rich. Joins on `player_id`.

```json
{
  "player_id": 23791, "name": "Alec Pierce", "team_id": "IND", "position_id": "WR",
  "status": "PUP", "status_short": "PUP", "injury_type": "", "comment": "",
  "injury_update_date": "2026-08-18 14:10:02", "probability_of_playing": null,
  "ir_weeks": [], "practice_1": null, "practice_2": null, "practice_3": null
}
```

Top-level: `sport`, `count`, `injuries[]`, `covids[]`, `tier`. Use `status_short` for the
badge. `probability_of_playing` is frequently `null` — do not depend on it.

---

## 11. Locked parameters

```
BASE     = https://api.fantasypros.com/public/v2/json/nfl
SCORING  = PPR          // one shared constant; STD toggle = one-line change (DRAFT-41)
WEEK     = 0            // 0 = full-season / draft mode

consensus-rankings  /{season}/consensus-rankings?position=ALL&scoring={SCORING}&week=0
projections         /{season}/projections?positions=QB:RB:WR:TE&week=0   // read stats.points_ppr
player-points       /{season}/player-points?scoring={SCORING}
injuries            /injuries                                            // no season segment
```

`position=ALL` is honoured on consensus. The colon-delimited `positions` list is honoured
on projections and echoed back comma-delimited (`"QB,RB,WR,TE"`).

---

## 12. Open items

- Exact rate-limit threshold not characterised (deliberately — avoiding hammering a paid key).
- Production proxy host not chosen. Needed before deploy, not before DRAFT-9.
- `covids[]` array in the injuries payload not investigated; presumed vestigial.
