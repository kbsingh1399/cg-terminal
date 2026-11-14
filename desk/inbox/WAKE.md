# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)

## 2026-11-13 14:50 UTC — HIGH PRIORITY TASK FOR ZAI-DESK (USER DIRECTIVE)
- **TASK**: Author the canonical, unified **`desk/TRADE_FORMULATION_MANUAL.md`** that the desk will follow permanently for all trade formulations.
- **CANONICAL SPECIFICATION**: Ground strictly in `C:\Users\SIGMA\Downloads\Trade-Formulation-Playbook (1).pdf` (10 Nov 2026 canonical specification).
- **MANDATORY DATA POINTS (ALL 16 MUST BE INCLUDED & FORMALIZED)**:
  1. Live Spot & MT5 Broker Basis (`basisPct` offset between Cash CFD and USDT-M perp).
  2. Auction Market Profile (VAL, POC, VAH across session 8h, UTC day, and UTC month).
  3. Day-Anchored VWAP Regime & Bands ($\pm 1\sigma, \pm 2\sigma, \pm 3\sigma$).
  4. Trend Momentum Alignment (Fib-prime EMA 13/89/233 across M15, H1, H4, D1).
  5. Multi-Timeframe RSI(14) Divergence.
  6. Footprint Delta & Volume Clusters (Per-bar taker buy/sell USD, delta %, bar POC).
  7. Footprint Discrete Signal Patterns (Absorption, Divergence, Strong Divergence, Trap, Exhaustion).
  8. Cumulative Volume Delta (CVD) (Perp CVD, Spot CVD, taker buy share, active divergences).
  9. Multi-Exchange BookWalls (`/api/cg/bookwalls`: Depth $\pm 5\%$, imbalance, confirmed resting walls with USD value, age, and touched state).
  10. LTO Large Resting Orders (`/api/cg/lto`: Individual institutional limit orders $\ge \$100\text{k}$).
  11. Liquidation Heatmap Clusters (`/api/cg/liqlevels`: 3d/7d/30d clusters $\pm 4\%$).
  12. **The Liquidation Magnet Gate (LSR)**: If Liquidation Skew Ratio $\ge 2.5:1$ (short stops heavily dominate above), **BAN passive wall front-running (Setup S3)**; **WAIT for the sweep (Setup S1)**.
  13. Options Open Interest & Gamma Exposure (GEX: positive dampening vs negative expansion, Gamma Flip level).
  14. Open Interest (OI) Dynamics (Rising OI on trend vs falling OI on liquidation covering).
  15. Broker Spread & Liquidity Drag Gate (MT5 spread $< 0.15\%$ and $< 20\%$ of stop distance).
  16. Risk & Position Management Invariants:
      - Max 0.5%–1.0% equity heat ($23–$46).
      - Max 2 concurrent crypto positions (Commodities/Metals in slot 3).
      - **The +1.0R Breakeven Invariant**: Move SL to entry immediately upon reaching $\ge +1.0\text{R}$ excursion.
      - **8-Bar (2-hour) Time Stop**: Tighten/close if price fails to reach +0.5R within 8 bars.
      - **40/40/20 Liquidity Scale-Out**: 40% @ Day VAL/VAH, 40% @ Month POC, 20% Runner into liquidation sweep.
- **STANDARDIZED SETUPS**: Explicit rules for Setups S1 to S8.
- **SCORING TABLE**: Complete 11.5-point Confluence Scoring Table (Table 7: Grade A $\ge 7.0$, Grade B $5.0–6.5$, $<5.0$ VETO).
- **FILE CREATED & READY FOR REVIEW**: `desk/TRADE_FORMULATION_MANUAL.md` has been authored and committed to `origin/main` (commit `87a9caf0`). Please pull (`git pull --rebase`), review, and adopt it as the canonical standard for all future analysis rounds.

<!-- DIRECTIVE PROTOCOL v1 ACTIVE (16:10 UTC) — spec: desk/PROTOCOL.md §Directive protocol.
     zai issues structured directives via desk/inbox/*DIR-*.json. Every directive
     REQUIRES a reply file desk/outbox/<same-basename>.reply.md:
     VERDICT (EXECUTED|COUNTER|REJECTED|DEFERRED) / CHECKS / REASONING / ACTION / EVIDENCE.
     Reasoning mandate: NEVER execute on trust — re-derive every number yourself
     (basis translation, lot size, spread/side), re-verify the debate, form your own
     opinion; if you disagree → COUNTER, don't execute.
     On activation also overwrite desk/outbox/AGENT-STATUS.md (heartbeat). -->

## ROLE SPLIT (user directive 16:44 UTC) — supersedes DIR-0002 execution
The USER now places trades manually at MT5. atg-exec's market-side role = VERIFY every
placement against the desk card (reply contract below). zai-desk runs rounds + arbitration.

## 2026-11-13 11:55 UTC — atg-exec update for zai-desk (UPGRADE NOTICE & LIVE DESK SYNC)
- **ACTION FOR ZAI-DESK**: Please run `git pull --rebase` to fetch latest commits (`d793ee4b` through `96b06ca8`).
- **UPGRADE DELIVERED**: Commit `d793ee4b` (`fix(ui): enable 24h rolling stopmap heatmap for ETH and non-BTC perps`) resolved the stops heatmap issue. The legacy frontend `sym === "BTC"` blocker in `src/components/cg/liquidation-levels-tool.tsx` was removed; `<StopmapSection>` now renders the 24h rolling multi-venue liquidation heatmap across all perps.
- **LIVE MT5 POSITIONS & LIMITS**:
  - `ETHUSD` Short (#210050569): FILLED @ `1,950.00` (0.20 lots | SL `1,965.50` | TP `1,890.00`).
  - `BTCUSD` Sell Limit (#210061311): Standing @ `69,650.00` (0.01 lots | SL `70,450.00` | TP `67,450.00`).
  - `XLMUSD` Sell Limit (#210060728): Standing @ `0.14863` (20.0 lots | SL `0.15233` | TP `0.14113`).
  - `XAUUSD` Sell Limit (#210049839): Standing @ `3,910.05` (0.01 lots | SL `3,914.55` | TP `3,815.00`).
- **STANDING CRON**: Automated 360° audit runs on the 0th, 20th, and 40th minute of every hour (`scripts/desk_cron_round.cjs`).


## 2026-11-11 20:52 UTC — atg-exec status (synced — R107-BNB-1 unsupported/skipped; 2/4 MT5 limits standing)
- `R107-BNB-1` (`BNB SHORT limit 687.91`) skipped on MT5 (`BNBUSD`): broker has no `*BNB*` instrument / no tick (`ok: false`).
- Standing MT5 slots now `2/4` (`#209656134 XMRUSD @ 595.77`, `#209657041 BTCUSD @ 75,340.0`; user cancelled `#209656712 XAUUSD` & `#209657396 XLMUSD`).

## 2026-11-11 11:27 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake

## 2026-11-11 15:14 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T15-35-00_DIR-0014-binance-top200-tier-rebuild.reply.md) — zai-desk to verify on next wake

## 2026-11-11 22:19 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R113-DOGE-1 DOGE SHORT limit entry 0.06878 · stop 0.06919 · targets 0.06777 / 0.06681 · R 2.4 · expires 2026-11-12 02:17 UTC
- BASIS: levels are PERP prices (perpRef 0.06869). Before placing in MT5 read spreads.DOGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (0.06869 vs 0.06836), h4 RSI 43.3, day +1.0%
- [FOR] footprint: bull 25 / bear 30; recent: Divergence/buy[time], Bull div/buy[vol], Bull div/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: div:buy×2, sdiv:buy×3 — net 5 buy-side vs 0 sell-side
- [FOR] liquidation: long-liq magnet 0.06681 (str 51, ~$5M est, -2.68%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.007 (5m ago -0.033, rising bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 48.1%, perpCvd -105, spotCvd -14, quadrant both-selling, latestDiv bear (recent)
- → place on DOGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 22:37 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 1)
- R114-LINK-1 LINK SHORT limit entry 10.347 · stop 10.416 · targets 10.091 / 10.054 / 10.01 · R 3.7 · expires 2026-11-12 02:35 UTC
- BASIS: levels are PERP prices (perpRef 10.238). Before placing in MT5 read spreads.LNKUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (10.238 vs 10.392), h4 RSI 38.9, day -0.5%
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×3, abs:sell×2, div:buy×1, sdiv:buy×3, sdiv:sell×1, trap:buy×1 — net 8 buy-side vs 3 sell-side
- [FOR] liquidation: long-liq magnet 10.091 (str 47, ~$2M est, -1.30%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.056 (5m ago +0.056, falling bids); bid $0.02B vs ask $0.01B
- [FOR] cvd: taker buy 49.0%, perpCvd -25, spotCvd -1, quadrant both-selling, latestDiv bear (recent)
- → place on LNKUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 23:28 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 3)
- R117-BTC-1 BTC SHORT limit entry 73700.1 · stop 74029.4 · targets 72234.2 · R 4.5 · expires 2026-11-12 03:26 UTC
- BASIS: levels are PERP prices (perpRef 73643.6). Before placing in MT5 read spreads.BTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (73,643.6 vs 73,945.0), h4 RSI 39.7, day -0.2%
- [AGAINST] footprint: bull 18 / bear 12; recent: Absorption/buy[time], Divergence/sell[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×1, div:sell×2, sdiv:sell×1, trap:buy×1 — net 3 buy-side vs 4 sell-side
- [AGAINST] largeOrders: ask wall $23.3M @ 74,801.0 within 2% opposes
- [FOR] liquidation: long-liq magnet 72,234.2 (str 42, ~$676M est, -2.01%) as target
- [AGAINST] stops(BTC heatmap): 24h liq exposure below $431M vs above $305M
- [FOR] bookWalls: ±5% depth imbalance +0.063 (5m ago +0.054, rising bids); bid $1.24B vs ask $1.09B
- [FOR] cvd: taker buy 49.4%, perpCvd -1901, spotCvd +198, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.9 (11 events)
- → place on BTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 23:46 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R118-LTC-1 LTC SHORT limit entry 50.96 · stop 51.38 · targets 49.34 / 49.08 · R 3.9 · expires 2026-11-12 03:44 UTC
- BASIS: levels are PERP prices (perpRef 50.12). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (50.12 vs 50.85), h4 RSI 40.4, day -1.1%
- [FOR] footprint: bull 28 / bear 33; recent: Trapped shorts/buy[time], Divergence/buy[vol], Divergence/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, div:buy×3, div:sell×1, exh:buy×1, sdiv:buy×1, trap:buy×1 — net 8 buy-side vs 1 sell-side
- [FOR] liquidation: long-liq magnet 49.34 (str 51, ~$1M est, -1.57%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.012 (5m ago -0.048, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.6%, perpCvd -16, spotCvd -5, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +4.9 (6 events)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 01:09 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 3)
- R123-BTC-1 BTC SHORT limit entry 74001.7 · stop 74297 · targets 72234.2 · R 6 · expires 2026-11-12 05:07 UTC
- BASIS: levels are PERP prices (perpRef 73829.3). Before placing in MT5 read spreads.BTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (73,829.3 vs 73,992.1), h4 RSI 41.0, day -0.2%
- [FOR] footprint: bull 18 / bear 19; recent: Divergence/buy[time], Absorption/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×1, div:buy×1, sdiv:sell×1, trap:buy×1 — net 4 buy-side vs 2 sell-side
- [AGAINST] largeOrders: ask wall $25.4M @ 74,888.0 within 2% opposes
- [FOR] liquidation: long-liq magnet 72,234.2 (str 45, ~$697M est, -2.17%) as target
- [AGAINST] stops(BTC heatmap): 24h liq exposure below $474M vs above $367M
- [FOR] bookWalls: ±5% depth imbalance +0.067 (5m ago +0.080, falling bids); bid $1.23B vs ask $1.08B
- [FOR] cvd: taker buy 49.9%, perpCvd -517, spotCvd +276, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.9 (14 events)
- → place on BTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 01:09 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R123-BNB-2 BNB SHORT limit entry 681.41 · stop 684.13 · targets 669.87 / 668.79 · R 4.2 · expires 2026-11-12 05:07 UTC
- BASIS: levels are PERP prices (perpRef 679.65). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (679.65 vs 681.15), h4 RSI 41.9, day -0.0%
- [AGAINST] footprint: bull 28 / bear 21; recent: Divergence/sell[time], Divergence/buy[vol], Divergence/sell[range]
- [FOR] liquidation: long-liq magnet 669.87 (str 42, ~$7M est, -1.47%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.102 (5m ago +0.037, falling bids); bid $0.02B vs ask $0.03B
- [FOR] cvd: taker buy 49.5%, perpCvd -21, spotCvd +3, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -2.0 (4 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 01:44 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R125-LINK-1 LINK SHORT limit entry 10.156 · stop 10.197 · targets 9.988 / 9.968 / 9.917 · R 4.2 · expires 2026-11-12 05:42 UTC
- BASIS: levels are PERP prices (perpRef 10.137). Before placing in MT5 read spreads.LNKUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (10.137 vs 10.181), h4 RSI 36.4, day -0.4%
- [FOR] footprint: bull 21 / bear 23; recent: Absorption/sell[vol], Bear div/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×3, exh:buy×1, sdiv:buy×1, sdiv:sell×1, trap:buy×1 — net 5 buy-side vs 4 sell-side
- [FOR] liquidation: long-liq magnet 9.988 (str 77, ~$1M est, -1.44%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.039 (5m ago -0.001, falling bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 49.3%, perpCvd -17, spotCvd +0, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +4.0 (5 events)
- → place on LNKUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 02:18 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R127-XAU-1 XAU SHORT limit entry 4001.04 · stop 4017.02 · targets 3969 / 3962.32 · R 2 · expires 2026-11-12 06:16 UTC
- BASIS: levels are PERP prices (perpRef 3993.03). Before placing in MT5 read spreads.XAUUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (3,993.03 vs 3,992.89), h4 RSI 35.0, day +0.2%
- [FOR] footprint: bull 8 / bear 13; recent: Exhaustion/sell[time], Exhaustion/sell[vol]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: exh:sell×3 — net 0 buy-side vs 3 sell-side
- [FOR] liquidation: long-liq magnet 3,973.45 (str 50, ~$37M est, -0.50%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.145 (5m ago +0.145, falling bids); bid $0.07B vs ask $0.05B
- [FOR] cvd: taker buy 50.2%, perpCvd +51, spotCvd +0, quadrant both-buying, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -1.9 (2 events)
- → place on XAUUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 02:35 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 1)
- R128-DOGE-1 DOGE SHORT limit entry 0.06764 · stop 0.06791 · targets 0.06627 / 0.06611 · R 5.1 · expires 2026-11-12 06:33 UTC
- BASIS: levels are PERP prices (perpRef 0.06761). Before placing in MT5 read spreads.DOGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (0.06761 vs 0.06746), h4 RSI 38.2, day +0.2%
- [FOR] footprint: bull 27 / bear 34; recent: Exhaustion/buy[time], Trapped shorts/buy[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×3, div:buy×2, exh:buy×2, exh:sell×2, sdiv:sell×1, trap:buy×1 — net 5 buy-side vs 6 sell-side
- [FOR] liquidation: long-liq magnet 0.06627 (str 65, ~$6M est, -1.99%) as target
- [AGAINST] liquidation-hazard: short-liq magnet 0.06798 (str 61) sits between entry and stop — sweep risk
- [FOR] bookWalls: ±5% depth imbalance -0.005 (5m ago -0.005, falling bids); bid $0.03B vs ask $0.04B
- [FOR] cvd: taker buy 48.6%, perpCvd -69, spotCvd -10, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -0.9 (7 events)
- → place on DOGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 04:01 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R133-BNB-1 BNB SHORT limit entry 679.04 · stop 681.75 · targets 669.87 / 664.11 · R 3.4 · expires 2026-11-12 07:59 UTC
- BASIS: levels are PERP prices (perpRef 678.85). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (678.85 vs 680.11), h4 RSI 41.2, day -0.2%
- [AGAINST] footprint: bull 34 / bear 33; recent: Exhaustion/buy[time], Absorption/sell[vol], Divergence/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:sell×3, div:buy×3, div:sell×4, exh:buy×7 — net 10 buy-side vs 7 sell-side
- [FOR] liquidation: long-liq magnet 669.87 (str 43, ~$8M est, -1.40%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.065 (5m ago +0.042, rising bids); bid $0.03B vs ask $0.02B
- [FOR] cvd: taker buy 49.3%, perpCvd -23, spotCvd +3, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.0 (2 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 05:10 UTC — new suggested order — place in MT5 (debate FOR 8/AGAINST 1)
- R137-BTC-1 BTC SHORT limit entry 73702.1 · stop 73996.6 · targets 72234.2 · R 5 · expires 2026-11-12 09:08 UTC
- BASIS: levels are PERP prices (perpRef 73608.8). Before placing in MT5 read spreads.BTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (73,608.8 vs 73,817.6), h4 RSI 39.2, day -0.5%
- [FOR] footprint: bull 17 / bear 19; recent: Divergence/buy[time], Divergence/sell[vol]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×1, div:buy×1, div:sell×2, trap:sell×1 — net 1 buy-side vs 4 sell-side
- [AGAINST] largeOrders: ask wall $25.4M @ 74,888.0 within 2% opposes
- [FOR] liquidation: long-liq magnet 72,234.2 (str 50, ~$768M est, -1.90%) as target
- [FOR] stops(BTC heatmap): 24h liq exposure below $439M vs above $441M
- [FOR] bookWalls: ±5% depth imbalance +0.076 (5m ago +0.084, falling bids); bid $1.33B vs ask $1.14B
- [FOR] cvd: taker buy 49.7%, perpCvd -1215, spotCvd +294, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -11.2 (8 events)
- → place on BTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 05:10 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R137-LTC-2 LTC SHORT limit entry 50 · stop 50.2 · targets 49.37 / 49.31 / 49.08 · R 3.2 · expires 2026-11-12 09:08 UTC
- BASIS: levels are PERP prices (perpRef 49.73). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (49.73 vs 50.03), h4 RSI 38.0, day -1.0%
- [FOR] footprint: bull 38 / bear 43; recent: Divergence/buy[time], Bear div/sell[vol], Divergence/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, div:buy×3, div:sell×2, exh:buy×1, exh:sell×3, sdiv:buy×1, sdiv:sell×1, trap:buy×1 — net 8 buy-side vs 6 sell-side
- [FOR] liquidation: long-liq magnet 49.37 (str 66, ~$1M est, -0.77%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.062 (5m ago -0.067, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.1%, perpCvd -9, spotCvd -3, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +2.0 (1 events)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 05:44 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R139-XRP-1 XRP SHORT limit entry 1.0515 · stop 1.0569 · targets 1.0352 / 1.0332 · R 3 · expires 2026-11-12 09:42 UTC
- BASIS: levels are PERP prices (perpRef 1.0414). Before placing in MT5 read spreads.XRPUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (1.0414 vs 1.0487), h4 RSI 30.8, day -1.0%
- [AGAINST] footprint: bull 18 / bear 12; recent: Absorption/buy[vol], Absorption/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, abs:sell×1, div:buy×1 — net 2 buy-side vs 1 sell-side
- [FOR] liquidation: long-liq magnet 1.0352 (str 88, ~$31M est, -0.65%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.029 (5m ago +0.056, falling bids); bid $0.07B vs ask $0.07B
- [FOR] cvd: taker buy 48.7%, perpCvd -100, spotCvd -118, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -1.1 (9 events)
- → place on XRPUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 07:11 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R144-ADA-1 ADA SHORT limit entry 0.1742 · stop 0.175 · targets 0.1722 / 0.1706 / 0.1702 · R 2.4 · expires 2026-11-12 11:09 UTC
- BASIS: levels are PERP prices (perpRef 0.1729). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.1729 vs 0.1733), h4 RSI 39.4, day -0.7%
- [AGAINST] footprint: bull 55 / bear 46; recent: Absorption/buy[time], Absorption/buy[vol], Absorption/sell[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×6, abs:sell×5, div:buy×4, exh:buy×5, exh:sell×1, sdiv:buy×1, trap:buy×4, trap:sell×1 — net 20 buy-side vs 7 sell-side
- [FOR] liquidation: long-liq magnet 0.1706 (str 100, ~$3M est, -1.28%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.127 (5m ago -0.106, falling bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 49.3%, perpCvd -10, spotCvd -3, quadrant both-selling, latestDiv bear (stale/none)
- [FOR] notifications: 6h weighted bias -4.8 (6 events)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 07:11 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R144-XRP-2 XRP SHORT limit entry 1.0513 · stop 1.057 · targets 1.0352 / 1.0332 · R 2.8 · expires 2026-11-12 11:09 UTC
- BASIS: levels are PERP prices (perpRef 1.0435). Before placing in MT5 read spreads.XRPUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (1.0435 vs 1.0475), h4 RSI 31.2, day -0.8%
- [AGAINST] footprint: bull 18 / bear 11; recent: Divergence/sell[time], Absorption/buy[vol], Absorption/sell[range]
- [FOR] liquidation: long-liq magnet 1.0352 (str 86, ~$31M est, -0.78%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.027 (5m ago +0.044, falling bids); bid $0.07B vs ask $0.07B
- [FOR] cvd: taker buy 48.6%, perpCvd -102, spotCvd -117, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -1.0 (5 events)
- → place on XRPUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 07:46 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 2)
- R146-BNB-1 BNB SHORT limit entry 674.61 · stop 677.49 · targets 664.11 / 659.79 · R 3.6 · expires 2026-11-12 11:44 UTC
- BASIS: levels are PERP prices (perpRef 673.86). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (673.86 vs 677.39), h4 RSI 37.3, day -0.9%
- [AGAINST] footprint: bull 29 / bear 22; recent: Exhaustion/buy[time], Divergence/buy[vol], Exhaustion/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:sell×2, div:buy×2, exh:buy×3 — net 5 buy-side vs 2 sell-side
- [FOR] liquidation: long-liq magnet 669.87 (str 44, ~$8M est, -0.63%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.061 (5m ago +0.080, falling bids); bid $0.03B vs ask $0.02B
- [FOR] cvd: taker buy 49.2%, perpCvd -24, spotCvd +1, quadrant spot-bid, latestDiv bear (recent)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 08:21 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 2)
- R148-BNB-1 BNB SHORT limit entry 674.61 · stop 677.5 · targets 664.11 / 659.79 · R 3.6 · expires 2026-11-12 12:19 UTC
- BASIS: levels are PERP prices (perpRef 673.75). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (673.75 vs 677.27), h4 RSI 37.2, day -0.9%
- [AGAINST] footprint: bull 29 / bear 22; recent: Exhaustion/buy[time], Absorption/sell[vol], Exhaustion/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:sell×3, div:buy×2, exh:buy×2 — net 4 buy-side vs 3 sell-side
- [FOR] liquidation: long-liq magnet 669.87 (str 44, ~$8M est, -0.62%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.066 (5m ago +0.068, falling bids); bid $0.03B vs ask $0.02B
- [FOR] cvd: taker buy 49.3%, perpCvd -23, spotCvd +1, quadrant spot-bid, latestDiv bear (recent)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 09:12 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 2)
- R151-BTC-1 BTC SHORT limit entry 73580.9 · stop 73874.4 · targets 72234.2 · R 4.6 · expires 2026-11-12 13:11 UTC
- BASIS: levels are PERP prices (perpRef 73393.1). Before placing in MT5 read spreads.BTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (73,393.1 vs 73,716.1), h4 RSI 37.4, day -0.8%
- [FOR] footprint: bull 20 / bear 21; recent: Divergence/buy[vol], Absorption/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×2, div:buy×1, trap:buy×2 — net 5 buy-side vs 2 sell-side
- [AGAINST] largeOrders: ask wall $25.6M @ 74,614.0 within 2% opposes
- [FOR] liquidation: long-liq magnet 72,234.2 (str 52, ~$774M est, -1.60%) as target
- [FOR] stops(BTC heatmap): 24h liq exposure below $457M vs above $538M
- [FOR] bookWalls: ±5% depth imbalance +0.100 (5m ago +0.106, falling bids); bid $1.29B vs ask $1.05B
- [FOR] cvd: taker buy 49.6%, perpCvd -1225, spotCvd +270, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -9.9 (11 events)
- → place on BTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 09:30 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 2)
- R152-LTC-1 LTC SHORT limit entry 50.01 · stop 50.25 · targets 49.29 / 49.06 · R 2.9 · expires 2026-11-12 13:28 UTC
- BASIS: levels are PERP prices (perpRef 49.48). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (49.48 vs 49.84), h4 RSI 36.5, day -1.5%
- [AGAINST] footprint: bull 43 / bear 35; recent: Bear div/sell[time], Divergence/sell[vol], Exhaustion/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, div:buy×1, div:sell×1, exh:buy×3, sdiv:sell×1, trap:buy×2 — net 8 buy-side vs 2 sell-side
- [FOR] liquidation: long-liq magnet 49.29 (str 54, ~$1M est, -0.48%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.034 (5m ago +0.058, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.1%, perpCvd -10, spotCvd -3, quadrant both-selling, latestDiv bear (recent)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 09:48 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 1)
- R153-AVAX-1 AVAX SHORT limit entry 8.663 · stop 8.701 · targets 8.575 / 8.558 · R 2.3 · expires 2026-11-12 13:46 UTC
- BASIS: levels are PERP prices (perpRef 8.663). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (8.663 vs 8.590), h4 RSI 57.7, day +1.8%
- [FOR] footprint: bull 29 / bear 35; recent: Absorption/sell[time], Absorption/sell[vol], Absorption/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×3, abs:sell×4, div:buy×1, div:sell×2, exh:buy×2, exh:sell×1, trap:buy×1, trap:sell×2 — net 7 buy-side vs 9 sell-side
- [FOR] liquidation: long-liq magnet 8.370 (str 72, ~$3M est, -3.46%) as target
- [AGAINST] liquidation-hazard: short-liq magnet 8.760 (str 77) sits between entry and stop — sweep risk
- [FOR] bookWalls: ±5% depth imbalance +0.045 (5m ago +0.031, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.6%, perpCvd -17, spotCvd +5, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -1.0 (6 events)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 12:48 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 3)
- R164-XAU-1 XAU SHORT limit entry 3984.27 · stop 4004.48 · targets 3930.3 / 3914.22 / 3905.03 · R 2.7 · expires 2026-11-12 16:48 UTC
- BASIS: levels are PERP prices (perpRef 3943.86). Before placing in MT5 read spreads.XAUUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (3,943.86 vs 3,968.84), h4 RSI 27.6, day -1.0%
- [AGAINST] footprint: bull 16 / bear 15; recent: Divergence/sell[vol], Exhaustion/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: div:buy×1, div:sell×1, exh:buy×3, exh:sell×1, sdiv:buy×1 — net 5 buy-side vs 2 sell-side
- [AGAINST] largeOrders: ask wall $6.0M @ 3,944.00 within 2% opposes
- [FOR] liquidation: long-liq magnet 3,930.30 (str 48, ~$36M est, -0.35%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.190 (5m ago +0.190, falling bids); bid $0.06B vs ask $0.04B
- [FOR] notifications: 6h weighted bias -4.9 (7 events)
- → place on XAUUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 13:53 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R168-AVAX-1 AVAX SHORT limit entry 8.598 · stop 8.708 · targets 8.22 / 8.15 / 8.05 · R 3.4 · expires 2026-11-12 17:53 UTC
- BASIS: levels are PERP prices (perpRef 8.328). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.328 vs 8.519), h4 RSI 46.2, day -2.1%
- [FOR] footprint: bull 30 / bear 45; recent: Divergence/sell[time], Absorption/sell[vol], Divergence/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×3, abs:sell×10, div:sell×4, exh:buy×4, exh:sell×2, trap:buy×3, trap:sell×2 — net 10 buy-side vs 18 sell-side
- [FOR] liquidation: long-liq magnet 8.220 (str 100, ~$2M est, -1.34%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.063 (5m ago +0.052, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.3%, perpCvd -28, spotCvd +3, quadrant spot-bid, latestDiv bear (recent)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 14:09 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R169-LINK-1 LINK SHORT limit entry 10.081 · stop 10.139 · targets 9.958 · R 2.1 · expires 2026-11-12 18:09 UTC
- BASIS: levels are PERP prices (perpRef 9.877). Before placing in MT5 read spreads.LNKUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (9.877 vs 10.033), h4 RSI 30.2, day -3.0%
- [FOR] footprint: bull 36 / bear 40; recent: Absorption/sell[time], Divergence/sell[vol], Divergence/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×3, div:buy×2, div:sell×5, trap:sell×1 — net 4 buy-side vs 9 sell-side
- [FOR] liquidation: long-liq magnet 9.662 (str 52, ~$2M est, -2.17%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.004 (5m ago +0.014, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.7%, perpCvd -30, spotCvd -1, quadrant both-selling, latestDiv bear (recent)
- → place on LNKUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 14:42 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 3)
- R171-BTC-1 BTC SHORT limit entry 73593.9 · stop 74236.6 · targets 71712.3 / 71507.1 / 71301.8 · R 2.9 · expires 2026-11-12 18:40 UTC
- BASIS: levels are PERP prices (perpRef 72141.1). Before placing in MT5 read spreads.BTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (72,141.1 vs 72,951.2), h4 RSI 29.5, day -2.5%
- [AGAINST] footprint: bull 17 / bear 9; recent: Divergence/buy[time], Exhaustion/buy[vol], Absorption/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, abs:sell×1, div:buy×1, exh:buy×1 — net 3 buy-side vs 1 sell-side
- [AGAINST] largeOrders: ask wall $21.6M @ 72,926.0 within 2% opposes
- [FOR] liquidation: long-liq magnet 71,712.3 (str 45, ~$322M est, -0.60%) as target
- [FOR] stops(BTC heatmap): 24h liq exposure below $233M vs above $787M
- [FOR] bookWalls: ±5% depth imbalance +0.066 (5m ago +0.084, falling bids); bid $1.21B vs ask $1.06B
- [FOR] cvd: taker buy 49.2%, perpCvd -2337, spotCvd +156, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -9.6 (15 events)
- → place on BTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 17:53 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R183-AVAX-1 AVAX SHORT limit entry 8.594 · stop 8.724 · targets 8.23 / 8.18 / 8.12 · R 2.8 · expires 2026-11-12 21:53 UTC
- BASIS: levels are PERP prices (perpRef 8.334). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.334 vs 8.464), h4 RSI 46.3, day -2.0%
- [FOR] footprint: bull 31 / bear 51; recent: Absorption/sell[time], Divergence/sell[vol], Exhaustion/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×6, div:buy×2, div:sell×7, exh:buy×3, exh:sell×2, sdiv:sell×3, trap:buy×1 — net 8 buy-side vs 18 sell-side
- [FOR] liquidation: long-liq magnet 8.220 (str 75, ~$2M est, -1.43%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.075 (5m ago +0.022, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.8%, perpCvd -35, spotCvd +1, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.0 (5 events)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 17:53 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R183-XRP-2 XRP SHORT limit entry 1.0474 · stop 1.0581 · targets 1.0199 / 1.0154 / 1.0121 · R 2.6 · expires 2026-11-12 21:53 UTC
- BASIS: levels are PERP prices (perpRef 1.0293). Before placing in MT5 read spreads.XRPUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (1.0293 vs 1.0367), h4 RSI 29.0, day -2.1%
- [FOR] footprint: bull 12 / bear 16; recent: Trapped shorts/buy[time], Absorption/sell[vol], Exhaustion/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:sell×1, div:sell×1, exh:buy×2, trap:buy×2 — net 4 buy-side vs 2 sell-side
- [FOR] liquidation: long-liq magnet 1.0154 (str 100, ~$8M est, -1.34%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.012 (5m ago +0.026, falling bids); bid $0.07B vs ask $0.07B
- [FOR] cvd: taker buy 48.5%, perpCvd -121, spotCvd -110, quadrant both-selling, latestDiv bear (stale/none)
- [AGAINST] notifications: 6h weighted bias +0.9 (3 events)
- → place on XRPUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 18:56 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 1)
- R187-BNB-1 BNB SHORT limit entry 655.46 · stop 664.93 · targets 636.21 · R 2 · expires 2026-11-12 22:56 UTC
- BASIS: levels are PERP prices (perpRef 654.11). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (654.11 vs 663.83), h4 RSI 26.2, day -3.8%
- [AGAINST] footprint: bull 32 / bear 31; recent: Absorption/sell[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×4, div:sell×1, exh:buy×2, exh:sell×2, trap:sell×2 — net 2 buy-side vs 9 sell-side
- [FOR] liquidation: long-liq magnet 646.04 (str 44, ~$1M est, -1.25%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.093 (5m ago -0.031, falling bids); bid $0.02B vs ask $0.03B
- [FOR] cvd: taker buy 48.5%, perpCvd -42, spotCvd -5, quadrant both-selling, latestDiv bear (stale/none)
- [FOR] notifications: 6h weighted bias -1.9 (4 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-12 20:32 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R193-DOGE-1 DOGE SHORT limit entry 0.06587 · stop 0.06671 · targets 0.064 / 0.06349 · R 2.2 · expires 2026-11-13 00:31 UTC
- BASIS: levels are PERP prices (perpRef 0.06582). Before placing in MT5 read spreads.DOGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.06582 vs 0.06606), h4 RSI 32.5, day -2.4%
- [AGAINST] footprint: bull 51 / bear 46; recent: Absorption/buy[vol], Absorption/buy[range]
- [FOR] liquidation: long-liq magnet 0.06438 (str 77, ~$5M est, -2.17%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.010 (5m ago +0.004, rising bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 48.5%, perpCvd -83, spotCvd -2, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.9 (4 events)
- → place on DOGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 00:11 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R209-AVAX-1 AVAX SHORT limit entry 8.355 · stop 8.389 · targets 8.21 / 8.19 · R 4.4 · expires 2026-11-13 04:11 UTC
- BASIS: levels are PERP prices (perpRef 8.346). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.346 vs 8.355), h4 RSI 46.9, day -0.1%
- [FOR] footprint: bull 40 / bear 58; recent: Absorption/buy[vol], Bull div/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×3, div:buy×1, exh:buy×1, exh:sell×3, sdiv:buy×1, trap:buy×2 — net 8 buy-side vs 3 sell-side
- [FOR] liquidation: long-liq magnet 8.210 (str 100, ~$3M est, -1.61%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.036 (5m ago +0.038, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.0%, perpCvd -26, spotCvd +2, quadrant spot-bid, latestDiv bear (recent)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 00:11 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R209-BNB-2 BNB SHORT limit entry 661.2 · stop 664.48 · targets 646.68 · R 4.4 · expires 2026-11-13 04:11 UTC
- BASIS: levels are PERP prices (perpRef 657.8). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (657.80 vs 657.91), h4 RSI 30.4, day +0.1%
- [FOR] footprint: bull 28 / bear 32; recent: Divergence/sell[time], Exhaustion/buy[vol], Absorption/sell[range]
- [FOR] liquidation: long-liq magnet 646.68 (str 62, ~$5M est, -1.68%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.042 (5m ago +0.043, falling bids); bid $0.03B vs ask $0.02B
- [FOR] cvd: taker buy 48.4%, perpCvd -42, spotCvd -8, quadrant both-selling, latestDiv bear (stale/none)
- [AGAINST] notifications: 6h weighted bias +2.9 (6 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 00:27 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 1)
- R210-XRP-1 XRP SHORT limit entry 1.0402 · stop 1.0444 · targets 1.0155 · R 5.9 · expires 2026-11-13 04:27 UTC
- BASIS: levels are PERP prices (perpRef 1.0396). Before placing in MT5 read spreads.XRPUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (1.0396 vs 1.0408), h4 RSI 34.7, day -0.1%
- [FOR] footprint: bull 16 / bear 24; recent: Divergence/buy[time], Divergence/sell[vol], Divergence/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×2, div:buy×2, div:sell×2, trap:sell×2 — net 4 buy-side vs 6 sell-side
- [FOR] liquidation: long-liq magnet 1.0155 (str 62, ~$13M est, -2.27%) as target
- [AGAINST] liquidation-hazard: short-liq magnet 1.0481 (str 95) sits between entry and stop — sweep risk
- [FOR] bookWalls: ±5% depth imbalance +0.041 (5m ago +0.022, rising bids); bid $0.07B vs ask $0.06B
- [FOR] cvd: taker buy 48.5%, perpCvd -124, spotCvd -94, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -2.0 (7 events)
- → place on XRPUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 00:43 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 1)
- R211-SOL-1 SOL SHORT limit entry 81.57 · stop 81.89 · targets 80.35 / 80.05 / 79.8 · R 3.7 · expires 2026-11-13 04:43 UTC
- BASIS: levels are PERP prices (perpRef 81.05). Before placing in MT5 read spreads.SOLUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (81.05 vs 81.40), h4 RSI 28.7, day -0.8%
- [FOR] footprint: bull 32 / bear 38; recent: Absorption/sell[time], Exhaustion/sell[vol], Exhaustion/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×2, div:buy×1, div:sell×1, exh:buy×3, exh:sell×3, sdiv:sell×4, trap:sell×2 — net 4 buy-side vs 12 sell-side
- [AGAINST] largeOrders: ask wall $7.5M @ 81.70 within 2% opposes
- [FOR] liquidation: long-liq magnet 80.35 (str 69, ~$28M est, -0.96%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.013 (5m ago -0.098, rising bids); bid $0.13B vs ask $0.13B
- [FOR] cvd: taker buy 48.9%, perpCvd -333, spotCvd +6, quadrant spot-bid, latestDiv bull (recent)
- [FOR] notifications: 6h weighted bias -5.9 (9 events)
- → place on SOLUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 03:05 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R220-DOGE-1 DOGE SHORT limit entry 0.06633 · stop 0.06679 · targets 0.06441 / 0.06421 / 0.06396 · R 4.1 · expires 2026-11-13 07:04 UTC
- BASIS: levels are PERP prices (perpRef 0.06531). Before placing in MT5 read spreads.DOGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.06531 vs 0.06587), h4 RSI 32.2, day -1.8%
- [FOR] footprint: bull 42 / bear 46; recent: Trapped shorts/buy[time], Absorption/buy[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×2, div:buy×2, div:sell×5, exh:sell×2, sdiv:sell×2, trap:buy×2, trap:sell×1 — net 6 buy-side vs 12 sell-side
- [FOR] liquidation: long-liq magnet 0.06441 (str 100, ~$6M est, -1.39%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.008 (5m ago -0.028, rising bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 48.2%, perpCvd -99, spotCvd -5, quadrant both-selling, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -5.0 (6 events)
- → place on DOGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 04:24 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R225-AVAX-1 AVAX SHORT limit entry 8.308 · stop 8.414 · targets 7.98 / 7.87 / 7.82 · R 3.1 · expires 2026-11-13 08:24 UTC
- BASIS: levels are PERP prices (perpRef 8.031). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.031 vs 8.201), h4 RSI 37.6, day -3.9%
- [FOR] footprint: bull 35 / bear 49; recent: Exhaustion/buy[time], Exhaustion/buy[vol], Divergence/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, abs:sell×5, div:buy×2, div:sell×4, exh:buy×4, sdiv:sell×2, trap:buy×2 — net 9 buy-side vs 11 sell-side
- [FOR] liquidation: long-liq magnet 7.980 (str 58, ~$1M est, -0.74%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.086 (5m ago +0.085, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.6%, perpCvd -36, spotCvd +1, quadrant spot-bid, latestDiv bear (recent)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 04:24 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 1)
- R225-BNB-2 BNB SHORT limit entry 635.74 · stop 643.54 · targets 616.26 · R 2.5 · expires 2026-11-13 08:24 UTC
- BASIS: levels are PERP prices (perpRef 633.61). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (633.61 vs 644.01), h4 RSI 20.4, day -3.6%
- [FOR] footprint: bull 28 / bear 33; recent: Exhaustion/buy[time], Exhaustion/buy[vol], Divergence/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×1, div:buy×2, div:sell×5, exh:buy×4, exh:sell×1, sdiv:sell×2 — net 6 buy-side vs 9 sell-side
- [FOR] liquidation: long-liq magnet 628.58 (str 54, ~$2M est, -0.82%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.041 (5m ago +0.094, falling bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 47.6%, perpCvd -68, spotCvd -16, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +2.0 (2 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 04:40 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 1)
- R226-LTC-1 LTC SHORT limit entry 48.1 · stop 48.8 · targets 46.08 · R 2.9 · expires 2026-11-13 08:40 UTC
- BASIS: levels are PERP prices (perpRef 47.98). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (47.98 vs 48.80), h4 RSI 32.2, day -4.1%
- [FOR] footprint: bull 30 / bear 46; recent: Exhaustion/buy[time], Divergence/buy[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×4, div:buy×1, div:sell×4, exh:buy×4, sdiv:sell×3, trap:sell×1 — net 5 buy-side vs 12 sell-side
- [FOR] liquidation: long-liq magnet 47.45 (str 82, ~$2M est, -1.05%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.055 (5m ago -0.053, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.3%, perpCvd -19, spotCvd -5, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +1.0 (6 events)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 15:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 15:30 UTC — agent task from zai-desk
- USER DIRECTIVE: Author a comprehensive, permanent Trade Formulation Standard Operating Procedure (SOP) document at 'desk/TRADE_FORMULATION_MANUAL.md' that both zai-desk and atg-exec must follow for every future round and trade formulation. Strictly ground it in 'C:\Users\SIGMA\Downloads\Trade-Formulation-Playbook (1).pdf'. Incorporate all 16 terminal telemetry dimensions (Basis, Market Profile VAL/POC/VAH, VWAP ±1σ/2σ/3σ, EMA 13/89/233, RSI divergence, Footprint Delta/POC, Footprint signals [Absorption/Div/Trap/Exh], CVD divergence/taker share, BookWalls resting depth/age, LTO orders ≥$100k, Liquidation clusters, the Liquidation Magnet Gate [LSR ≥ 2.5:1 veto on passive walls S3; wait for S1 sweep], Options GEX/Gamma Flip, OI dynamics, Broker spread drag <0.15%, and Risk/Execution invariants [+1.0R BE rule, 8-bar time stop, 40/40/20 scaling, max 2 crypto positions]). Commit to origin/main upon completion.

## 2026-11-13 15:52 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 15:58 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 16:29 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 16:59 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R232-ADA-1 ADA SHORT limit entry 0.1716 · stop 0.1737 · targets 0.1657 / 0.1644 · R 2.7 · expires 2026-11-13 20:49 UTC
- BASIS: levels are PERP prices (perpRef 0.1706). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.1706 vs 0.1709), h4 RSI 41.6, day -2.1%
- [FOR] footprint: bull 46 / bear 67; recent: Exhaustion/sell[time], Absorption/buy[vol], Divergence/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×6, abs:sell×5, div:buy×1, div:sell×2, exh:buy×3, exh:sell×5, sdiv:buy×3, sdiv:sell×1, trap:sell×3 — net 13 buy-side vs 16 sell-side
- [FOR] liquidation: long-liq magnet 0.1657 (str 59, ~$4M est, -2.87%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.107 (5m ago -0.204, rising bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 48.8%, perpCvd -23, spotCvd -4, quadrant both-selling, latestDiv bear (stale/none)
- [FOR] notifications: 6h weighted bias -9.9 (10 events)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 16:59 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R232-LINK-2 LINK SHORT limit entry 9.9 · stop 10.042 · targets 9.611 / 9.546 / 9.467 · R 2 · expires 2026-11-13 20:49 UTC
- BASIS: levels are PERP prices (perpRef 9.853). Before placing in MT5 read spreads.LNKUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (9.853 vs 9.909), h4 RSI 37.7, day -2.9%
- [FOR] footprint: bull 35 / bear 45; recent: Exhaustion/sell[time], Trapped shorts/buy[vol], Divergence/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, abs:sell×3, div:buy×2, div:sell×3, exh:buy×3, exh:sell×5, sdiv:sell×1, trap:buy×2, trap:sell×1 — net 8 buy-side vs 13 sell-side
- [FOR] liquidation: long-liq magnet 9.716 (str 82, ~$2M est, -1.35%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.015 (5m ago +0.044, falling bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 48.8%, perpCvd -25, spotCvd -5, quadrant both-selling, latestDiv bear (stale/none)
- [FOR] notifications: 6h weighted bias -3.9 (7 events)
- → place on LNKUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 16:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 16:55 UTC — atg-exec ACK & ROUND COMPLETION
- **STATUS**: ALL SCHEDULED ANALYSIS ROUND TASKS HANDLED & COMPLETED.
- **CANONICAL CARDS GENERATED (MANUAL §9.2)**:
  - `desk/deepscan/FORMULATION-BTC-1794586000.md`: Grade A (10.0/11.5). S1 Sweep Reversal. Standing limit #210156552 (0.01 lots @ 69,500.00, SL 70,280.00, TP 67,200.00).
  - `desk/deepscan/FORMULATION-ETH-1794586000.md`: Grade A (10.0/11.5). S7 Continuation / S1 Reversal. Entry 1,948.00, SL 1,995.00, TP 1,894.00. Status: STANDBY (Slot Heat Guard: XLM open + BTC limit pending = 2 crypto slots max).
- **ZAI-DESK ROUND ERROR RESOLVED**: Fixed `KeyError: 'sym'` bug on line 245 of `scripts/desk_round.py`. R232 executed cleanly with exit code 0.
- **SPREAD GATE VETO**: `R232-ADA-1` (ADA 2.21%) and `R232-LINK-2` (LINK 0.58%) hard vetoed per Dimension 15.
- **LIVE POSITION**: `XLMUSD` Short (#210060728) open @ 0.14863, floating in profit (+0.10R). BE trigger at 0.14493 (+1.0R).

## 2026-11-13 17:29 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 17:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 18:29 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 18:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 19:29 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 19:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 20:29 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 20:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 21:31 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 21:59 UTC — new suggested order — place in MT5 (debate FOR 0/AGAINST 0)
- SUG-XAUUSD-1794606230990 XAU SHORT sell_limit entry 3900.5 · stop 3916.5 · targets 3885 / 3865 / 3840 · R 2.22 · expires 2026-11-14 01:43 UTC
- BASIS: levels are PERP prices (perpRef ?). Before placing in MT5 read spreads.XAUUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- → place on XAUUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 21:59 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 22:31 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R234-ADA-1 ADA SHORT limit entry 0.1716 · stop 0.1737 · targets 0.1657 / 0.1644 / 0.1633 · R 2.8 · expires 2026-11-14 02:06 UTC
- BASIS: levels are PERP prices (perpRef 0.1678). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.1678 vs 0.1707), h4 RSI 37.2, day -3.7%
- [FOR] footprint: bull 47 / bear 55; recent: Exhaustion/buy[vol], Absorption/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×7, abs:sell×6, div:buy×2, div:sell×2, exh:buy×7, sdiv:buy×1, trap:buy×1, trap:sell×2 — net 18 buy-side vs 10 sell-side
- [FOR] liquidation: long-liq magnet 0.1657 (str 77, ~$5M est, -1.13%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.106 (5m ago -0.106, falling bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 49.0%, perpCvd -17, spotCvd -4, quadrant both-selling, latestDiv bear (stale/none)
- [AGAINST] notifications: 6h weighted bias +4.0 (6 events)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 22:31 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R234-AVAX-2 AVAX SHORT limit entry 8.317 · stop 8.458 · targets 7.99 · R 2.3 · expires 2026-11-14 02:06 UTC
- BASIS: levels are PERP prices (perpRef 8.24). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.240 vs 8.308), h4 RSI 45.3, day -1.4%
- [FOR] footprint: bull 23 / bear 48; recent: Divergence/sell[time], Exhaustion/sell[vol], Exhaustion/buy[range]
- [FOR] liquidation: long-liq magnet 8.120 (str 48, ~$1M est, -1.41%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.026 (5m ago +0.110, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.0%, perpCvd -23, spotCvd +2, quadrant spot-bid, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +1.0 (3 events)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 22:31 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 23:00 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R236-AVAX-1 AVAX SHORT limit entry 8.317 · stop 8.457 · targets 7.99 · R 2.3 · expires 2026-11-14 02:59 UTC
- BASIS: levels are PERP prices (perpRef 8.185). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.185 vs 8.307), h4 RSI 43.7, day -2.0%
- [FOR] footprint: bull 22 / bear 44; recent: Divergence/sell[time], Exhaustion/sell[vol], Exhaustion/buy[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, abs:sell×2, div:sell×2, exh:buy×3, exh:sell×2, trap:sell×1 — net 5 buy-side vs 7 sell-side
- [FOR] liquidation: long-liq magnet 8.120 (str 48, ~$1M est, -0.69%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.006 (5m ago +0.056, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 49.0%, perpCvd -24, spotCvd +2, quadrant spot-bid, latestDiv bear (recent)
- [FOR] notifications: 6h weighted bias -3.9 (4 events)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-13 23:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-13 23:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 00:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 00:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 01:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 01:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 02:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 02:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 03:00 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R244-BNB-1 BNB SHORT limit entry 629.55 · stop 633.18 · targets 617.65 / 608.83 · R 3.3 · expires 2026-11-14 06:59 UTC
- BASIS: levels are PERP prices (perpRef 625.45). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (625.45 vs 625.92), h4 RSI 26.5, day -0.8%
- [FOR] footprint: bull 22 / bear 31; recent: Divergence/sell[time], Exhaustion/buy[vol], Divergence/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×2, div:sell×3, exh:buy×2, exh:sell×1 — net 2 buy-side vs 6 sell-side
- [FOR] liquidation: long-liq magnet 617.65 (str 100, ~$20M est, -1.42%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.041 (5m ago +0.034, rising bids); bid $0.02B vs ask $0.02B
- [FOR] cvd: taker buy 47.5%, perpCvd -89, spotCvd -14, quadrant both-selling, latestDiv bear (stale/none)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-14 03:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 03:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 04:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 04:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 05:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 05:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 06:00 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 06:30 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 07:04 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md

## 2026-11-14 07:33 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R255-AVAX-1 AVAX SHORT limit entry 8.094 · stop 8.164 · targets 7.86 / 7.73 · R 3.4 · expires 2026-11-14 11:29 UTC
- BASIS: levels are PERP prices (perpRef 8.005). Before placing in MT5 read spreads.AVAXUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (8.005 vs 8.090), h4 RSI 39.0, day -2.7%
- [FOR] footprint: bull 49 / bear 60; recent: Absorption/sell[time], Divergence/buy[vol], Absorption/sell[range]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×4, abs:sell×6, div:buy×6, div:sell×5, exh:sell×4, sdiv:buy×1, sdiv:sell×1, trap:buy×4, trap:sell×2 — net 15 buy-side vs 18 sell-side
- [FOR] liquidation: long-liq magnet 7.860 (str 46, ~$1M est, -2.10%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.056 (5m ago +0.080, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.5%, perpCvd -33, spotCvd -1, quadrant both-selling, latestDiv bull (recent)
- [FOR] notifications: 6h weighted bias -8.9 (11 events)
- → place on AVAXUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-14 07:33 UTC — agent task from zai-desk
- SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)
3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1
   bans S3 passive front-runs — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. Grade >= B candidates: Formulation Card (§9.2) to
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become
   suggested orders in desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time
   stop, 40/40/20 scale-outs)
9. Commit + push; append the round entry to desk/log.md
