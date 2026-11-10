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

1. One instruction block per task. Prefix `URGENT:` if it should also ping
   the local atg daemon outside its normal 45s poll cycle.
2. Desk actions on wake: git pull → read this file top-to-bottom → execute
   each un-DONE block → append [DONE] + timestamp → commit/push → results
   logged to desk/log.md (MONITOR/DIALOG entries) → concise chat digest.
3. Anything the desk cannot do itself (place/modify/cancel MT5 orders) is
   converted into a DIR-*.json directive for atg-exec in this same inbox.
