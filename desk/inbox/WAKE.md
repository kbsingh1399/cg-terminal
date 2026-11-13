# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)

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
