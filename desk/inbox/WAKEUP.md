# WAKEUP.md — user → zai-desk instruction channel

> Write instructions below. zai-desk reads this file FIRST on every wake
> (cron auto-wakes 3x/day at 00:30/08:30/16:30 IST, or any chat message
> for an instant wake). Desk marks items [DONE <ts>] with results in
> desk/log.md; nothing here is ever ignored silently.

## Queue

- (empty — user: add instructions here, one block each; you can also just
  type "check wakeup" in chat to wake zai-desk instantly)

## Convention

0. CHAT TRIGGERS (user can type these in chat anytime for an instant deep analysis):
   `360 <SYM>` (e.g. `360 BTC` or `360 BTC ETH XAU`) · `360 top` (top-3 by |score|) · `360 all` (all 12)
   → desk runs scripts/desk_deepscan.py — full 8-section report per asset:
   trend/regime (EMA+RSI 4 TFs, VWAP σ, POC/VAH/VAL) · candle history + per-level footprint
   forensics (Δ, absorption, exhaustion, POC migration, Δ-divergence) · order flow (CVD, micro
   events) · positioning (funding, OI deltas) · liquidity map (magnets, walls, stopmap) · news ·
   broker state · 8-dimension synthesis verdict. Output: desk/deepscan/<SYM>-<ts>.md.
   Master checklist (preflight → run → 8-section review → synthesis → gates → delivery):
   **desk/deepscan/CHECKLIST-360.md** — follow it on every 360 trigger.

1. One instruction block per task. Prefix `URGENT:` if it should also ping
   the local atg daemon outside its normal 45s poll cycle.
2. Desk actions on wake: git pull → read this file top-to-bottom → execute
   each un-DONE block → append [DONE] + timestamp → commit/push → results
   logged to desk/log.md (MONITOR/DIALOG entries) → concise chat digest.
3. Anything the desk cannot do itself (place/modify/cancel MT5 orders) is
   converted into a DIR-*.json directive for atg-exec in this same inbox.
4. DESK BROADCAST section below (between the 360-BROADCAST markers) is
   **desk-managed**: every 360° run auto-refreshes it with the complete
   limit-trade list + per-trade justification. atg-exec should read it on
   every 45s poll (git pull) — an AGENT_TASK json in this inbox fires the
   bell + local wake for each run. User instructions go in the Queue above;
   never edit the broadcast section by hand.

<!-- 360-BROADCAST-START (desk-managed — latest run wins; atg-exec: read on every poll) -->
## DESK BROADCAST · 360 XLM+XAG · 20261110-2107 UTC — latest deepscan result (auto-refreshed by scripts/desk_deepscan.py)

atg-exec: full justification per trade in desk/deepscan/DIGEST-20261110-2107.md (+ per-asset §9). Do NOT touch MT5 without a user-approved DIR-*. Broker gates re-verified at placement.

### LIVE ORDERS (already working — do NOT re-place)
- ETH: ticket 209422601 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)
- XAG: ticket 209422699 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)

### PARKED (broker blocked — recovery printed)
- XLM SHORT LIMIT 0.1471 → 0.1471 · SL 0.1492 → 0.1493 · T: 0.1402 str85 / 0.1401 str100 / 0.1400 str90 · 3.22R — blocked: T1 magnet mass $0.9M < floor $5.0M (max[$5M, 0.25% × OI $0.19B]) — rank-normalized strength (str 85) has no leverage mass behind it at this depth; recovery: T1 cluster grows to ≥ the mass floor (natural OI growth or larger liquidation build), or user accepts thin-mass targets explicitly
- XAG SHORT LIMIT 53.167 → 53.081 · SL 53.843 → 53.756 · T: 50.813 str87 · 3.48R — blocked: min-lot floor forces 0.73% risk > 0.5% mandate (volumeMin 0.01 — instrument property, not a choice); recovery: re-check when |basis| ≤ 0.5% and spread ≤ 0.15% (now basis -0.162% / spread 0.145%)
- Correlation: all candidates SHORT in one tape — cap NEW entries at 1-2.
<!-- 360-BROADCAST-END -->
### CLASSIC UNIVERSE (Tier-3) — 78/78 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- strong 4-dim leans (|score| ≥ 3): SPX500 SHORT, GER30 LONG, UK100 LONG, FRA40 LONG, EUSTX50 LONG, NTH25 LONG, GBPNZD LONG, NZDCHF SHORT
- full table: desk/deepscan/DIGEST-20261110-2054.md (classic section) — derivatives dims honestly n/a for this class

### CLASSIC UNIVERSE (Tier-3) — 3/3 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- full table: desk/deepscan/DIGEST-20261110-2053.md (classic section) — derivatives dims honestly n/a for this class

