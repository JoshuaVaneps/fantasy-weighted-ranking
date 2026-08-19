# Jira key mapping — historical lookup only

**Plan IDs are retired as of build-plan revision 2 (2026-08-19).**

This table exists to decode M1-era documents — the DRAFT-6 spike handoff, the project
handoff, the M1 wrap-up — which carried both a plan ID and a Jira key. `docs/build-plan.html`
now uses Jira keys exclusively, and nothing new should introduce a plan ID.

**Why it was retired:** M2 spans plan DRAFT-12 to 20 and Jira DRAFT-17 to 25. Those ranges
overlap, so eight distinct tickets were competing for four names inside a single milestone —
and "DRAFT-17" meant z-score normalization as a Jira key and weight rebalance as a plan ID,
which were the two tickets most likely to be picked up next.

**Formula:** `Jira key = plan ID + 5`. It applies to nothing numbered above DRAFT-41.

| Plan ID | Jira Key | Title |
|---|---|---|
| DRAFT-1 | **DRAFT-6** | Spike: verify tier endpoints, parameters, and CORS |
| DRAFT-2 | **DRAFT-7** | Scaffold repo on Vite vanilla template |
| DRAFT-3 | **DRAFT-8** | Add Vitest and coverage |
| DRAFT-4 | **DRAFT-9** | Dev proxy and API key configuration |
| DRAFT-5 | **DRAFT-10** | API client with structured errors |
| DRAFT-6 | **DRAFT-11** | Endpoint modules for the four datasets |
| DRAFT-7 | **DRAFT-12** | Fixture capture script |
| DRAFT-8 | **DRAFT-13** | Join the feeds into one Player list |
| DRAFT-9 | **DRAFT-14** | App shell, layout, and design tokens |
| DRAFT-10 | **DRAFT-15** | Hand-rolled state store |
| DRAFT-11 | **DRAFT-16** | Render the board from state |
| DRAFT-12 | **DRAFT-17** | Z-score normalization within position |
| DRAFT-13 | **DRAFT-18** | Apply the games-played floor to last season |
| DRAFT-14 | **DRAFT-19** | Missing-factor weight redistribution |
| DRAFT-15 | **DRAFT-20** | Weighted blend and ranking |
| DRAFT-16 | **DRAFT-21** | App state shape and memoized selector |
| DRAFT-17 | **DRAFT-22** | Weight rebalance function |
| DRAFT-18 | **DRAFT-23** | Draggable three-segment mix bar |
| DRAFT-19 | **DRAFT-24** | Numeric weight inputs synced to the bar |
| DRAFT-20 | **DRAFT-25** | Keyed DOM reordering instead of full re-render |
| DRAFT-21 | **DRAFT-26** | Value over replacement for the overall board |
| DRAFT-22 | **DRAFT-27** | Position filter and name search |
| DRAFT-23 | **DRAFT-28** | Per-player contribution bar |
| DRAFT-24 | **DRAFT-29** | Apply validated factor palette |
| DRAFT-25 | **DRAFT-30** | Pin model in state and ranking |
| DRAFT-26 | **DRAFT-31** | Drag to reorder |
| DRAFT-27 | **DRAFT-32** | Pin affordances and keyboard alternative |
| DRAFT-28 | **DRAFT-33** | Persistence layer with schema versioning |
| DRAFT-29 | **DRAFT-34** | Board manager UI |
| DRAFT-30 | **DRAFT-35** | Cache API responses with a TTL |
| DRAFT-31 | **DRAFT-36** | Loading, empty, and per-factor error states |
| DRAFT-32 | **DRAFT-37** | Accessibility pass |
| DRAFT-33 | **DRAFT-38** | Draft-day mode |
| DRAFT-34 | **DRAFT-39** | Injury status badge on the board |
| DRAFT-35 | **DRAFT-40** | README, architecture note, and capstone write-up |
| DRAFT-36 | **DRAFT-41** | Scoring format toggle (STD and PPR) |

## Off-plan tickets

These have no plan ID and never did. The formula does not apply to them.

| Jira Key | Title | Status |
|---|---|---|
| **DRAFT-47** | Add minimal setup README | Merged (PR #3) |
| **DRAFT-48** | Extend API to pull ADP | PR #13 open |
| **DRAFT-49** | Production proxy and first deploy | Not started — added in revision 2 |

## Reading M1-era documents

These carry plan IDs and need this table:

- `docs/api-notes.md` — mixed; §5 and §10 reference Jira keys, the header references both
- the DRAFT-6 spike handoff — §4 uses "plan / Jira" pairs, §6 uses bare Jira keys
- the project handoff — uses "plan DRAFT-n" prefixed throughout
- the M1 wrap-up — Jira keys with plan IDs in parentheses

When one of these says a bare "DRAFT-n" without saying which scheme, check whether the
title matches the plan-ID row or the Jira-key row above. The titles disambiguate; the
numbers do not.
