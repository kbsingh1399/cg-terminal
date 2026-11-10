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
## DESK BROADCAST · 360 all · 20261110-1932 UTC — latest deepscan result (auto-refreshed by scripts/desk_deepscan.py)

atg-exec: full justification per trade in desk/deepscan/DIGEST-20261110-1932.md (+ per-asset §9). Do NOT touch MT5 without a user-approved DIR-*. Broker gates re-verified at placement.

### LIVE ORDERS (already working — do NOT re-place)
- ETH: ticket 209422601 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)
- XAG: ticket 209422699 (placed) — manage only (fills/expiry/SL per protocol; A1-A6 alerts armed)

### PLACEABLE
- **ETH SHORT LIMIT 2,095.10 → 2,095.46 · SL 2,138.31 → 2,138.68 · T: 2,004.76 str70 / 1,997.52 str51 · 2.09R · 0.54 lots $23.34 = 0.5%** ● LIVE ticket 209422601 (placed)
  - Thesis: 6×SHORT vs 1×LONG scorecard · 24h Δ -399,214 (sell-dominant) · CVD quadrant both-selling
  - Entry 2,095.10 (day VAH+VWAP+1σ, +2.63% from spot): a paid-for bounce into supply — never chase
  - Stop 2,138.31 (VWAP±2σ zone): the idea is wrong only beyond the 2σ premium band, not on noise
  - Targets: T1 2,004.76 str70 · T2 1,997.52 str51 (liquidation magnets price is structurally drawn to unwind)
  - Size: 0.54 lots → $23.34 = 0.5% of $4,649.96
  - Invalidation: BULLISH Δ-divergence (lower high on stronger delta) = counter-trend pressure live → limit-only, cancel if it persists; all desk candidates share one risk-off tape — cap NEW entries at 1-2
- **XAG SHORT LIMIT 53.183 → 53.102 · SL 53.852 → 53.769 · T: 50.808 str74 · 3.55R · 0.01 lots $33.38 = 0.72%** ● LIVE ticket 209422699 (placed) ⚠ lot-step/min-lot floor makes real risk 0.72% > 0.5% mandate — SKIP unless the user explicitly accepts
  - Thesis: 6×SHORT vs 2×LONG scorecard · 24h Δ -120,902 (sell-dominant) · CVD quadrant both-buying
  - Entry 53.183 (VWAP+1σ+day POC, +3.31% from spot): a paid-for bounce into supply — never chase
  - Stop 53.852 (VWAP±2σ zone): the idea is wrong only beyond the 2σ premium band, not on noise
  - Targets: T1 50.808 str74 (liquidation magnets price is structurally drawn to unwind)
  - Size: 0.01 lots → $33.38 = 0.72% of $4,649.96
  - Invalidation: BULLISH Δ-divergence (lower high on stronger delta) = counter-trend pressure live → limit-only, cancel if it persists; all desk candidates share one risk-off tape — cap NEW entries at 1-2
### PARKED (broker blocked — recovery printed)
- SOL SHORT LIMIT 85.09 · SL 86.95 · T: 81.34 str66 / 81.17 str51 / 80.55 str49 · 2.01R — blocked: broker feed dead (no ticks — DIR-0003 open); recovery: needs the broker feed restored (DIR-0003) — levels stay valid on the perp side
- BNB SHORT LIMIT 689.89 · SL 698.70 · T: 668.80 str43 / 666.89 str41 · 2.39R — blocked: broker feed dead (no ticks — DIR-0003 open); recovery: needs the broker feed restored (DIR-0003) — levels stay valid on the perp side
- ADA SHORT LIMIT 0.1773 → 0.1779 · SL 0.1804 → 0.1810 · T: 0.1702 str91 / 0.1699 str44 / 0.1698 str68 · 2.28R — blocked: |basis| 0.347% / spread 2.190% outside limits; recovery: re-check when |basis| ≤ 0.5% and spread ≤ 0.15% (now basis +0.347% / spread 2.190%)
- DOGE SHORT LIMIT 0.06955 · SL 0.07066 · T: 0.06628 str73 / 0.06612 str77 / 0.06607 str62 · 2.95R — blocked: broker feed dead (no ticks — DIR-0003 open); recovery: needs the broker feed restored (DIR-0003) — levels stay valid on the perp side
- LTC SHORT LIMIT 51.40 → 51.95 · SL 52.01 → 52.57 · T: 49.30 str67 / 49.27 str68 / 49.12 str88 · 3.45R — blocked: |basis| 1.077% / spread 2.408% outside limits; recovery: re-check when |basis| ≤ 0.5% and spread ≤ 0.15% (now basis +1.077% / spread 2.408%)
### REJECTED (geometry)
- BTC: no magnet str≥40 on profit side (nearest 72,628.1 str 20) — recovery: re-scan after a str≥40 magnet prints on the profit side — until then R is unquantifiable
- XRP: R to T1 1.354 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.354
- AVAX: R to T1 0.690 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 0.690
- LINK: R to T1 1.510 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.510
### NO-TRADE
- XAU: NO-TRADE — scorecard dimensions disagree; recovery: re-scan after the next impulse or when 2+ dimensions flip — do not force setups in a transition tape
- Correlation: all candidates SHORT in one tape — cap NEW entries at 1-2.
<!-- 360-BROADCAST-END -->
