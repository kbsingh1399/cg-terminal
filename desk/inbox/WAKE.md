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
