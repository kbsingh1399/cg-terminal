# MULTI-AGENT ARCHITECTURE REVIEW · ROUND 2 · Full-Universe Expansion

2026-11-10 21:15 UTC · panel: 4 parallel review agents (github.com/cliffano/tech-team-agents personas) · reviewed object: commits fc6d300 + 01a5e8b + f40d1e9 + f87f318 (expansion code), the live terminal, the full-universe run artifacts (DIGEST-20261110-2054/2057/2107/2108), and T3-DATARESEARCH-20261110.md · guidelines: github.com/multica-ai/andrej-karpathy-skills

**Panel**: Gilfoyle (Systems Architect) · Elliot Alderson (Security & Data-Integrity) · Laurie Bream (Quant & Risk) · Jared Dunn (QA & Operations)

**Consolidated verdict: APPROVE-WITH-CONDITIONS (4/4)** — all reviewers verified live claims by curl/probe. Conditions were triaged: **every BLOCKER/MAJOR desk-actionable condition was fixed this run** (commit f87f318 + prior); remaining items are user-side, engine-v4 preconditions, or documented deferrals.

---

## Conditions → desk actions taken THIS RUN

| # | Finding (reviewer) | Action taken (commit) | Verified |
|---|---|---|---|
| L2 [BLOCKER] | Magnet-mass floor (yesterday's rule 2) never shipped — XLM PLACEABLE on a ~$1M T1 cluster (str-85 is rank-normalized; BTC's str-100 = $1,679M) | `usd_raw` added to target cards + **mass floor gate: T1 ≥ max[$5M, 0.25% × perp OI]** in the always-printed DATA-DEPTH GATE section | ✅ XLM 21:07 run: "T1 $0.9M vs floor $5.0M → FAIL · status PARKED" |
| L6 [MAJOR] | XAG PLACEABLE-with-⚠ at 0.72% min-lot risk — advisory, not a gate | min-lot risk > mandate → **status PARKED** with equity-threshold recovery (rule 4) | ✅ XAG 21:07: PARKED (0 placeable) |
| L7 [MINOR] | Sizing rounds to NEAREST step — can round above mandate | **floor-to-step** (`int(x/step)*step`, no +0.5) | ✅ code + XLM sizing re-verified |
| E4 [MAJOR] | SPCX = wrong instrument (Yahoo SPCX is a SPAC ETF); note never surfaced in reports | **Removed from classic registry** (77 instruments); restoration gated on DIR-0009 broker-spec verification | ✅ list=1 → 77, SPCX absent |
| E2 [MAJOR] | `chgPct` labeled "day" is actually the range's previous close (~5-session change on default range) | **chg 24h computed from bars** + relabeled everywhere | ✅ digest rows show 24h figures |
| E3 [MAJOR] | No staleness gate — EU indices served Friday's close as "live" | **fresh_min > 90 → WATCHLIST-STALE** + loud §1 note | ✅ 15/77 STALE at 21:08 UTC (EU closed) — honest |
| E1/J4 [MAJOR] | `CLASSIC={}` silent fallback on terminal-down → false "0/78 online" `all` runs | **sys.exit** on registry fetch failure when `all`/`classic` requested | ✅ guard in place |
| E5 [MINOR] | Parse-guard incomplete — valid-JSON-but-empty map still false-feed-deads | **len(MT5_MAP) < 17 → sys.exit** | ✅ |
| G2 [MAJOR] | 3 more hardcoded `Binance_${sym}USDT` sites (large-orders-tool ×2, server-price ×1) — USO tab chart dead (502 upstream 20001) | routed through **leadInstr()** | ✅ 0 remaining reachable sites |
| G3 [MAJOR] | USO ticker dead — OKX m1 kline empty → price:null forever | **m15 fallback** in ticker refresh | ✅ ticker?sym=USO → ok, 140.92 |
| G5/E7 [MINOR] | classic cache unbounded | **evict-on-expiry + size cap 96** | ✅ |
| E6 [MINOR] | 429 falls through to query2 — doubles requests when rate-limited | **429 returns immediately** | ✅ |
| J9 [MINOR] | Broadcast classic block could leave stale duplicate sections | **single-write restructure** (classic joins B before the one WUP write) | ✅ 21:08 broadcast clean |
| J7 [MINOR] | Flat 0.15s classic pacing burns the budget on 429s | **2s backoff on per-symbol errors** | ✅ |
| J3 [MAJOR] | Stale autostash (the corruption mechanism) sitting in repo | **inspected + dropped** (contents were the already-merged symbol_map edit) | ✅ |
| J2 [BLOCKER] | Parse-guard was uncommitted | committed (f87f318 series) | ✅ |
| G8/E9 [MINOR] | Doc drift 77/42 vs 78/43 | counts corrected with SPCX removal (77/43 FX verified) | ✅ |
| G9 [MINOR] | scan.ts cadence comment stale | updated (13 slow-tier assets) | ✅ |

## Findings documented, NOT desk-actionable now

- **G4 [MAJOR] state.json race is architectural** (2nd corruption occurrence): recommended fix = untrack state.json (or move symbol_map into daemon.json) + atomic writes daemon-side. **Requires daemon-side changes → DIR-0009 task + user decision.** Interim hardening shipped: parse-guards (E5) refuse races loudly instead of printing false data; repair script (scripts/repair_state_json.py) committed as the runbook.
- **L3/L4/L5 [MAJOR] geometry refinements** (stop extension past any magnet within 0.25σ regardless of str; merge magnets within 0.5σ into one target — XLM's 0.1402/0.1401/0.1400 "ladder" is one cluster; digest STANDBY ranking at the concurrency cap): **v3.3 rules 3-5, user approval pending** — they change trade-geometry semantics and touch build_trades' stop/target construction.
- **L8 [MINOR] classic composite is effectively 2-factor** (1 trend + 3 collinear mean-reversion dims on one 24h window; rolling-24h anchor mixes sessions on US assets): accepted for watchlist triage; **engine v4 precondition list below**.
- **L9 [MINOR] UKO BZ=F basis**: roll timespread 0.3-1% ≈ daily σ — v4 precondition: broker-quote anchoring + ≤0.5% basis gate.
- **L10 [MINOR] spread gate functional form**: fixed 0.15% over-blocks tight-stop setups — proposed `spread ≤ min(0.15%, 15% of 1R)` (v3.3 rule, user approval).
- **J5 [MAJOR] CHECKLIST-360 stale** → updated to v1.5 this run.
- **J6 [MAJOR] no retraction record for the false-feed-dead artifacts** → RETRACTION entry appended to desk/log.md this run (20:53-20:54 DOGE/LINK reports + digests superseded by the 20:57 re-run).
- **J8 [MINOR] retention**: policy line added to CHECKLIST-360 (keep last 10 per-symbol reports + all digests; CLASSIC-*.md consolidated files are compact by design).

## Elliot's standing user-side items (round 1, still open, unchanged)
S1 repo public with live telemetry → make private · S2 inbox channel unauthenticated → HMAC · S3 daemon.json shell-exec → local.json+argv · S5 secret hygiene → env. **Round 2 adds: none new** (no new secrets in the diff — verified).

## Engine v4 preconditions (Laurie, all required BEFORE any classic trade construction)
1. Absolute magnet-mass floor — **shipped for perps this run**; v4 must define the classic equivalent (COT/OANDA-book depth floors).
2. Lone-magnet guard: R≥2 needs a second str≥40 cluster within 1.5× T1 distance or T1 ≥$10M.
3. Broker-quote anchoring: classic levels from FundedNext CFD quotes only, never Yahoo; basis gate ≤0.5%; UKO roll-splice documented.
4. Session-anchored VWAP per instrument calendar (9:30 ET / XETRA resets); z on session bars only.
5. Hard correlation matrix: ρ≥0.8 → one slot (GER30/UK100/FRA40 = one position); EU-long + SPX-short nets as one dollar/risk-on factor.
6. Gap model per index/equity (overnight gap distribution; size haircut or flat-overnight rule).
7. Cost gate in R units: spread ≤ min(0.15%, 15% of 1R) + commission, from broker spec.
8. Walk-forward backtest of the composite (≥1y per class) with the collinearity fixed — **no backtest, no v4**.

## Karpathy-compliance statement (round 2 diff)
1. **Think before coding**: the review ran BEFORE the fixes were finalized; every condition maps to a numbered finding with a file:line.
2. **Simplicity first**: classic instruments got a separate registry + one proxy route instead of polluting the perp engine; Yahoo single-source accepted WITH documented plan-B (a fallback chain would be over-engineering for watchlist-only data — Gilfoyle concurred).
3. **Surgical changes**: every fix is one hunk traceable to a reviewer finding; no adjacent refactors (the state.json architectural fix is deferred to the daemon DIR, not improvised).
4. **Goal-driven execution**: all verification cells above are live-checked, not asserted.

## Residual risk register (updated)
| Risk | Owner | Trigger to revisit |
|---|---|---|
| state.json daemon race (3rd occurrence would prove interim guards insufficient) | USER + atg-exec (DIR-0009 task 9) | any future corruption |
| Yahoo unofficial API degradation/limits | desk | WATCHLIST-OFFLINE rows appearing at volume; then activate plan-B (Stooq/Twelve Data evaluation) |
| XMR Binance relisting reverts | desk | XMR market/fp route errors → remove from DECS |
| Engine v4 built without the 8 preconditions | USER gate | any classic trade-construction request |
| FX/equity count discrepancy (43/46/48) | DIR-0009 symbols dump | next daemon reply |
