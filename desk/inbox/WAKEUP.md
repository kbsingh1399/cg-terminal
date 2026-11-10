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
## DESK BROADCAST · 360 all-universe · 20261110-2054 UTC — latest deepscan result (auto-refreshed by scripts/desk_deepscan.py)

atg-exec: full justification per trade in desk/deepscan/DIGEST-20261110-2054.md (+ per-asset §9). Do NOT touch MT5 without a user-approved DIR-*. Broker gates re-verified at placement.

### PLACEABLE
- **ETH SHORT LIMIT 2,095.10 → 2,095.74 · SL 2,140.15 → 2,140.81 · T: 2,004.76 str57 / 1,997.52 str42 · 2.01R · 0.52 lots $23.44 = 0.5%**
  - Thesis: 6×SHORT vs 1×LONG scorecard · 24h Δ -361,267 (sell-dominant) · CVD quadrant both-selling
  - Entry 2,095.10 (day VAH+VWAP+1σ, +1.63% from spot): a paid-for bounce into supply — never chase
  - Stop 2,140.15 (beyond Low magnet 2,134.97 (str 100)): the idea is wrong only beyond the 2σ premium band, not on noise
  - Targets: T1 2,004.76 str57 · T2 1,997.52 str42 (liquidation magnets price is structurally drawn to unwind)
  - Size: 0.52 lots → $23.44 = 0.5% of $4,649.96
  - Invalidation: BULLISH Δ-divergence (lower high on stronger delta) = counter-trend pressure live → limit-only, cancel if it persists; all desk candidates share one risk-off tape — cap NEW entries at 1-2
- **XLM SHORT LIMIT 0.1471 → 0.1471 · SL 0.1492 → 0.1493 · T: 0.1402 str85 / 0.1401 str100 / 0.1400 str90 · 3.19R · 10.81 lots $23.25 = 0.5%**
  - Thesis: 7×SHORT vs 0×LONG scorecard · 24h Δ -19,847,297 (sell-dominant) · CVD quadrant spot-bid
  - Entry 0.1471 (day VAH+VWAP+1σ, +2.00% from spot): a paid-for bounce into supply — never chase
  - Stop 0.1492 (VWAP±2σ zone): the idea is wrong only beyond the 2σ premium band, not on noise
  - Targets: T1 0.1402 str85 · T2 0.1401 str100 · T3 0.1400 str90 (liquidation magnets price is structurally drawn to unwind)
  - Size: 10.81 lots → $23.25 = 0.5% of $4,649.96
  - Invalidation: BULLISH Δ-divergence (lower high on stronger delta) = counter-trend pressure live → limit-only, cancel if it persists; all desk candidates share one risk-off tape — cap NEW entries at 1-2
- **XAG SHORT LIMIT 53.169 → 53.083 · SL 53.844 → 53.757 · T: 50.813 str87 · 3.49R · 0.01 lots $33.70 = 0.72%** ⚠ lot-step/min-lot floor makes real risk 0.72% > 0.5% mandate — SKIP unless the user explicitly accepts
  - Thesis: 6×SHORT vs 2×LONG scorecard · 24h Δ -143,827 (sell-dominant) · CVD quadrant both-buying
  - Entry 53.169 (VWAP+1σ+day POC, +2.92% from spot): a paid-for bounce into supply — never chase
  - Stop 53.844 (VWAP±2σ zone): the idea is wrong only beyond the 2σ premium band, not on noise
  - Targets: T1 50.813 str87 (liquidation magnets price is structurally drawn to unwind)
  - Size: 0.01 lots → $33.70 = 0.72% of $4,649.96
  - Invalidation: BULLISH Δ-divergence (lower high on stronger delta) = counter-trend pressure live → limit-only, cancel if it persists; all desk candidates share one risk-off tape — cap NEW entries at 1-2
### PARKED (broker blocked — recovery printed)
- SOL SHORT LIMIT 85.09 · SL 86.88 · T: 81.34 str65 / 81.17 str56 / 80.55 str48 · 2.09R — blocked: broker: symbol not listed on FundedNext (audit 2026-11-10); recovery: execution impossible at FundedNext — perp-side levels remain watchlist-only
- BNB SHORT LIMIT 689.89 · SL 698.71 · T: 668.80 str43 / 666.89 str41 · 2.39R — blocked: broker: symbol not listed on FundedNext (audit 2026-11-10); recovery: execution impossible at FundedNext — perp-side levels remain watchlist-only
- AVAX SHORT LIMIT 8.497 · SL 8.708 · T: 8.000 str100 · 2.35R — blocked: broker: symbol not listed on FundedNext (audit 2026-11-10); recovery: execution impossible at FundedNext — perp-side levels remain watchlist-only
- DOGE SHORT LIMIT 0.06951 · SL 0.07061 · T: 0.06628 str77 / 0.06612 str78 / 0.06578 str64 · 2.93R — blocked: broker feed dead (no ticks — DIR-0003 open); recovery: needs the broker feed restored (DIR-0003) — levels stay valid on the perp side
### REJECTED (geometry)
- BTC: no magnet str≥40 on profit side (nearest 72,628.1 str 20) — recovery: re-scan after a str≥40 magnet prints on the profit side — until then R is unquantifiable
- XRP: R to T1 0.596 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 0.596
- ADA: R to T1 1.645 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.645
- LINK: R to T1 1.313 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.313
- LTC: R to T1 1.922 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.922
- XMR: R to T1 1.502 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 1.502
- XAU: R to T1 0.762 < 2.0 — recovery: re-check on σ-compression (tighter stop) or T1 extension — needs R ≥ 2.0, now 0.762
### NO-TRADE
- XPT: NO-TRADE — scorecard dimensions disagree; recovery: re-scan after the next impulse or when 2+ dimensions flip — do not force setups in a transition tape
- USO: NO-TRADE — scorecard dimensions disagree; recovery: re-scan after the next impulse or when 2+ dimensions flip — do not force setups in a transition tape
- Correlation: all candidates SHORT in one tape — cap NEW entries at 1-2.
<!-- 360-BROADCAST-END -->
### CLASSIC UNIVERSE (Tier-3) — 78/78 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- strong 4-dim leans (|score| ≥ 3): SPX500 SHORT, GER30 LONG, UK100 LONG, FRA40 LONG, EUSTX50 LONG, NTH25 LONG, GBPNZD LONG, NZDCHF SHORT
- full table: desk/deepscan/DIGEST-20261110-2054.md (classic section) — derivatives dims honestly n/a for this class

### CLASSIC UNIVERSE (Tier-3) — 3/3 online (watchlist-only, engine v4 pending) · quotes via /api/cg/classic (Yahoo v8) · NO trade construction
- full table: desk/deepscan/DIGEST-20261110-2053.md (classic section) — derivatives dims honestly n/a for this class

