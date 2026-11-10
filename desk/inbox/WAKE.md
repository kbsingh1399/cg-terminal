# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)

<!-- zai-desk beacon refreshed 15:59 UTC (post-R6, post-ADA-placement). The daemon
     picks this file up from GitHub ≤45 s and fires the desktop notification — this
     IS the wake signal. A HARD agent launch still needs wake_cmd (see bottom).
     Verify everything against desk/state.json before acting; orders may have
     changed since this was written. -->

## 15:59 UTC — ACTION ITEMS (current truth)

### 1) URGENT — R6-ADA-1 · ticket 209375723 (pending SELL LIMIT 1.00 lot ADAUSD @ 0.17772)
- Desk verdict: **CANCEL** (full math in desk/log.md EXEC entry 15:47): ADAUSD spread
  2.19–2.20% >> 0.15% rule; at fill ask ≈ 0.1815 > SL 0.1783 → instant stop-out;
  SL/TP were left untranslated (correct: SL 0.17882 / TP 0.17139). 1 lot = 100 ADA
  → worst case small ($0.38) but the trade can never work on this broker quote.
- **Awaiting user decision** — if the user confirms: cancel ticket 209375723 in MT5,
  set order status "cancelled" in desk/state.json, append EXEC entry to desk/log.md.
- mt5_report.py now reports PENDING ORDERS — the next snapshot's `orders[]` array
  will show whether this ticket is still live (also how we detect fills remotely).

### 2) R4-BTC-1 · BTC SHORT · limit 74,270.3 · stop 74,648.7 · T1 72,964.8 · R 3.5 (expires 18:53 UTC)
- BTCUSD is the only clean symbol right now: spread 0.033% ✓ · basis ≈ −0.02% ✓.
- Translate **ALL THREE levels** (the ADA placement translated only the entry):
  `mt5Level = perpLevel × (1 + basisPct/100)` → entry ≈ 74,255 · SL ≈ 74,633 ·
  T1 ≈ 72,950 (recompute from LIVE desk/mt5.json basisPct at placement time).
- **SIZING** (mandate 0.5% of equity): BTCUSD contractSize = 1 (1 lot = 1 BTC),
  stop distance 378.4 → risk budget $23.27 → **0.06 lots** (risk $22.70).
  1.00 lot would risk ~$378 = 8.1% of equity — never.
- Debate FOR 7 / AGAINST 2 — full votes in desk/state.json → orders[R4-BTC-1].debate
  (AGAINST: ask wall $22.2M @ 75,812; short-liq magnet 75,126.9 str 100 between
  entry and stop — sweep risk. Standing because 7 sources vote FOR.)

### 3) R4-DOGE-3 — BLOCKED: DOGEUSD no tick (broker symbol/suffix missing).
- Skip; expires 18:53 UTC. If the user fixes the symbol name in
  config.symbol_map, re-evaluate then.

### 4) Round R7 is overdue (~40 min)
- The CRLF bug (fixed in dd6b637) broke local rounds. After the next daemon cycle,
  verify `## R7` exists in desk/log.md; if not, send a ROUND_NOW inbox instruction
  or run `bash scripts/desk_round.sh` manually.

## Standing rules (desk/PROTOCOL.md)
- Translate every level via live basisPct before placing; SHORT fills at bid, its
  SL triggers on ask. |basis| > 0.5% or spread > 0.15% → SKIP + log why.
- After any placement/fill/cancel: update desk/state.json (status, ticket,
  actualEntry, notes) + EXEC entry in desk/log.md + clear the handled section here.
- suggested orders are proposals — atg may skip any (spread/session/news) but must log why.

## HARD WAKE — still not configured
- `wake_cmd` in desk/daemon.json is EMPTY. The daemon can toast + write this file,
  but it cannot launch/trigger the Antigravity agent itself. If your Antigravity
  install exposes a CLI/URL trigger, set it as wake_cmd (use {msg} placeholder)
  and restart the daemon — that completes the fully-automatic loop.
