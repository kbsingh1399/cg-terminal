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
## DESK BROADCAST · 360 DOGE+LINK · 20261110-2057 UTC — latest deepscan result (auto-refreshed by scripts/desk_deepscan.py)

atg-exec: full justification per trade in desk/deepscan/DIGEST-20261110-2057.md (+ per-asset §9). Do NOT touch MT5 without a user-approved DIR-*. Broker gates re-verified at placement.

### LIVE ORDERS (already working — do NOT re-place)
- ETH: ticket 209422601 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)
- XAG: ticket 209422699 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)

### PARKED (broker blocked — recovery printed)
- DOGE SHORT LIMIT 0.06951 → 0.06952 · SL 0.07061 → 0.07062 · T: 0.06628 str77 / 0.06612 str78 / 0.06578 str64 · 2.93R — blocked: |basis| 0.015% / spread 1.328% outside limits; recovery: re-check when |basis| ≤ 0.5% and spread ≤ 0.15% (now basis +0.015% / spread 1.328%)
### REJECTED (geometry)
- LINK: R to T1 1.402 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.402
- Correlation: all candidates SHORT in one tape — cap NEW entries at 1-2.
<!-- 360-BROADCAST-END -->
### CLASSIC UNIVERSE (Tier-3) — 78/78 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- strong 4-dim leans (|score| ≥ 3): SPX500 SHORT, GER30 LONG, UK100 LONG, FRA40 LONG, EUSTX50 LONG, NTH25 LONG, GBPNZD LONG, NZDCHF SHORT
- full table: desk/deepscan/DIGEST-20261110-2054.md (classic section) — derivatives dims honestly n/a for this class

### CLASSIC UNIVERSE (Tier-3) — 3/3 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- full table: desk/deepscan/DIGEST-20261110-2053.md (classic section) — derivatives dims honestly n/a for this class

