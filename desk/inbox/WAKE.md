# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)

<!-- zai-desk refreshed this beacon 15:18 UTC after round R6 (full v3 debates).
     Place ONLY what is still `suggested` in desk/state.json. Re-verify against
     state.json at wake time — orders may have been withdrawn/expired since. -->

## 15:18 UTC — SUGGESTED ORDERS awaiting placement (3) — translate levels via live basis FIRST

**MANDATORY before any placement** (desk/PROTOCOL.md "Broker basis"): read
`desk/mt5.json` → `spreads.<SYM>.basisPct` + `spreadPct`; translate every
level `mt5Level = perpLevel × (1 + basisPct/100)`; SHORT fills at bid, SL
triggers on ask. If `|basisPct| > 0.5%` or `spreadPct > 0.15%` → widen stop
or SKIP and log why in `desk/log.md`.
NOTE: `basisPct` requires the NEW `scripts/mt5_report.py` — if your daemon
predates commit 7713c08, RESTART the daemon first (`node scripts/desk_daemon.mjs`).

### 1) R6-ADA-1 · ADA SHORT · limit 0.1772 · stop 0.1783 · T1 0.1709 · R 6.0 (expires 19:18 UTC)
- ⚠️ **SPREAD BLOCK**: last snapshot (15:11 UTC) ADAUSD `spreadPct 2.14%` —
  >10× the 0.15% rule and 3.4× the stop distance (0.62%). Recommendation:
  **SKIP this placement**, log reason. Re-check live spread; only place if
  broker quote normalizes.
- Debate FOR 6 / AGAINST 0:
  [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.1769 vs 0.1773), h4 RSI 42.8, day -0.3%
  [FOR] footprint: bull 37 / bear 55; recent: none <6h
  [FOR] liquidation: long-liq magnet 0.1709 (str 51, ~$2M est, -3.38%) as target
  [FOR] bookWalls: ±5% depth imbalance -0.158 (5m ago -0.283, rising bids)
  [FOR] cvd: taker buy 48.8%, perpCvd -17, spotCvd -3, quadrant both-selling
  [FOR] notifications: 6h weighted bias -5.9 (14 events)
  [NEUTRAL] largeOrders: 8 walls ≥$5M, none within 2% · stops heatmap n/a (BTC-only)
- perpRefPrice 0.1769 · levels are PERP prices · liq clusters are Coinglass estimates

### 2) R4-BTC-1 · BTC SHORT · limit 74,270.3 · stop 74,648.7 · T1 72,964.8 · R 3.5 (expires 18:53 UTC)
- BTCUSD OK at last snapshot (spread 0.033%). Indicative basis from that
  snapshot: MT5 mid 74,585.2 vs perpRef 74,525.6 → **+0.08%** (inside 0.5%
  tolerance) — recompute LIVE at placement.
- Debate FOR 7 / AGAINST 2:
  [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (74,525.6 vs 74,342.1), h4 RSI 41.0, day -1.1%
  [FOR] footprint: bull 14 / bear 15; recent: none <6h
  [FOR] liquidation: long-liq magnet 73,125.0 (str 44, ~$604M est, -1.82%) as target
  [FOR] stops(BTC heatmap): 24h liq exposure below $332M vs above $671M
  [FOR] bookWalls: ±5% imbalance +0.076 (falling bids); bid $1.35B vs ask $1.15B
  [FOR] cvd: taker buy 49.6%, perpCvd -1018, spotCvd +257, latestDiv bear (recent)
  [FOR] notifications: 6h weighted bias -51.2 (39 events)
  [AGAINST] largeOrders: ask wall $22.2M @ 75,812.0 within 2% opposes
  [AGAINST] liquidation-hazard: short-liq magnet 75,126.9 (str 100) between entry and stop — sweep risk
- perpRefPrice 74,525.6 · T1 = long-liq cluster str 47 (~$642M est) · Coinglass estimates

### 3) R4-DOGE-3 · DOGE SHORT · limit 0.06982 · stop 0.07025 · T1 0.06788 (T2 0.06767, T3 0.06747) · R 4.5 (expires 18:53 UTC)
- ⚠️ **NO TICK**: DOGEUSD has no broker quote ("check broker symbol
  name/suffix in config.symbol_map") — resolve the symbol or SKIP and log.
- Debate FOR 5 / AGAINST 1:
  [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.06935 vs 0.06941), h4 RSI 40.3, day -0.9%
  [FOR] footprint: bull 26 / bear 30; recent: none <6h
  [FOR] liquidation: long-liq magnet 0.06787 (str 58, ~$7M est, -2.00%) as target
  [FOR] bookWalls: ±5% imbalance +0.004; bid $0.04B vs ask $0.03B
  [FOR] cvd: taker buy 47.8%, perpCvd -93, spotCvd -13, quadrant both-selling
  [AGAINST] notifications: 6h weighted bias +6.5 (14 events)
  [NEUTRAL] largeOrders: none within 2% · stops heatmap n/a (BTC-only)
- perpRefPrice 0.06935 · targets = long-liq clusters str 61/60/72 · Coinglass estimates

## After placement
- Fill `ticket`, `actualEntry`, `filledTs`, `notes` in `desk/state.json`;
  status → `placed`; append an `EXEC` entry to `desk/log.md`; clear handled
  sections here.

## 2026-11-10 15:33 UTC — agent task from zai-desk
- RESTART the desk daemon — the running process predates commit 7713c08 and still appends the OLD compact WAKE.md template (no debate votes, no basis line). Steps: 1) stop the current node scripts/desk_daemon.mjs process; 2) git pull --rebase origin main; 3) restart: node scripts/desk_daemon.mjs (Git Bash). Verify after one cycle: (a) desk/mt5.json spreads.<SYM>.basisPct present, (b) any FUTURE WAKE.md order entry shows [FOR]/[AGAINST] vote lines + a BASIS: line. Do NOT re-place anything from the old compact entry: the current WAKE.md on origin already carries full debates — R6-ADA-1 SKIP (ADAUSD spread 2.14% >> 0.15% rule), R4-BTC-1 clean (translate levels via live basisPct), R4-DOGE-3 SKIP until DOGEUSD ticks. If you already restarted and see basisPct in mt5.json, ignore this.
