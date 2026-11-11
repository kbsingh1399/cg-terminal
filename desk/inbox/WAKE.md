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


## 2026-11-11 11:25 UTC — atg-exec status (synced — DIR-0012/DIR-0013 executed & verified)
- Pulled `R4` + `R5` + `R68` (`origin/main`), merged local `R69–R73`, fixed Windows NTFS case-collision (`lighter-xau-trades.json`), ran `npm ci` + `npm run build` + `npm start` on `:3000`.
- `DIR-0013` (incl. `DIR-0012` R3 checks) verified via live curl + Chrome DevTools (`XAU`, `EURUSD`, `NATGAS`, `XPT`, `JP225`, `US30`, `USO`, `SPX500`). Reply filed in `desk/outbox/2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md`.
- Account flat (`$4,649.96`, `0` positions, `0` orders).

## 2026-11-11 10:04 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R69-LTC-1 LTC SHORT limit entry 51.02 · stop 51.22 · targets 50.57 · R 2.2 · expires 2026-11-11 14:02 UTC
- BASIS: levels are PERP prices (perpRef 50.93). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (50.93 vs 50.82), h4 RSI 45.5, day +0.5%
- [FOR] footprint: bull 31 / bear 47; recent: none <6h
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×2, div:buy×1, div:sell×1, trap:buy×2 — net 5 buy-side vs 1 sell-side
- [FOR] liquidation: long-liq magnet 49.48 (str 53, ~$1M est, -2.78%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.167 (5m ago -0.085, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.3%, perpCvd -20, spotCvd -4, quadrant both-selling, latestDiv bear (recent)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 11:12 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 4)
- R73-ETH-1 ETH SHORT limit entry 2065.15 · stop 2073.39 · targets 2025.57 / 2019.83 · R 4.8 · expires 2026-11-11 15:10 UTC
- BASIS: levels are PERP prices (perpRef 2058.73). Before placing in MT5 read spreads.ETHUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (2,058.73 vs 2,059.45), h4 RSI 33.6, day +0.3%
- [AGAINST] footprint: bull 25 / bear 11; recent: none <6h
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, exh:buy×1 — net 2 buy-side vs 0 sell-side
- [AGAINST] largeOrders: ask wall $14.6M @ 2,090.90 within 2% opposes
- [FOR] liquidation: long-liq magnet 2,025.57 (str 46, ~$126M est, -1.67%) as target
- [AGAINST] liquidation-hazard: short-liq magnet 2,078.63 (str 94) sits between entry and stop — sweep risk
- [FOR] bookWalls: ±5% depth imbalance +0.000 (5m ago -0.013, rising bids); bid $0.67B vs ask $0.67B
- [FOR] cvd: taker buy 48.2%, perpCvd -3051, spotCvd -256, quadrant both-selling, latestDiv none (stale/none)
- [FOR] notifications: 6h weighted bias -1.9 (13 events)
- → place on ETHUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 11:27 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake

## 2026-11-11 11:37 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 1)
- R74-ADA-1 ADA SHORT limit entry 0.1761 · stop 0.1769 · targets 0.1741 · R 2.6 · expires 2026-11-11 15:34 UTC
- BASIS: levels are PERP prices (perpRef 0.1761). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (0.1761 vs 0.1752), h4 RSI 44.4, day +1.3%
- [FOR] footprint: bull 50 / bear 60; recent: none <6h
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×9, abs:sell×8, div:buy×2, div:sell×1, exh:buy×7, exh:sell×5, trap:buy×2, trap:sell×3 — net 20 buy-side vs 17 sell-side
- [FOR] liquidation: long-liq magnet 0.1706 (str 46, ~$2M est, -3.19%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.005 (5m ago -0.002, rising bids); bid $0.02B vs ask $0.02B
- [FOR] cvd: taker buy 48.9%, perpCvd -17, spotCvd -4, quadrant both-selling, latestDiv bear (recent)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 11:54 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R75-DOGE-1 DOGE SHORT limit entry 0.06839 · stop 0.06868 · targets 0.06776 · R 2.2 · expires 2026-11-11 15:52 UTC
- BASIS: levels are PERP prices (perpRef 0.06827). Before placing in MT5 read spreads.DOGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (0.06827 vs 0.06810), h4 RSI 39.4, day +0.4%
- [FOR] footprint: bull 27 / bear 48; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×1, abs:sell×3, div:buy×1, div:sell×2, exh:buy×1, exh:sell×2, trap:buy×1 — net 4 buy-side vs 7 sell-side
- [FOR] liquidation: long-liq magnet 0.06631 (str 94, ~$9M est, -2.89%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.012 (5m ago -0.051, rising bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 47.8%, perpCvd -112, spotCvd -17, quadrant both-selling, latestDiv bear (recent)
- → place on DOGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 11:54 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 0)
- R75-LINK-2 LINK SHORT limit entry 10.401 · stop 10.443 · targets 10.311 · R 2.2 · expires 2026-11-11 15:52 UTC
- BASIS: levels are PERP prices (perpRef 10.401). Before placing in MT5 read spreads.LNKUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (10.401 vs 10.347), h4 RSI 43.1, day +1.1%
- [FOR] footprint: bull 19 / bear 30; recent: none <6h
- [FOR] liquidation: long-liq magnet 10.079 (str 100, ~$3M est, -3.07%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.031 (5m ago +0.023, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.9%, perpCvd -25, spotCvd -4, quadrant both-selling, latestDiv bear (recent)
- → place on LNKUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 14:12 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 0)
- R83-BNB-1 BNB SHORT limit entry 682.22 · stop 684.95 · targets 669.7 / 668.58 / 667.09 · R 4.6 · expires 2026-11-11 18:10 UTC
- BASIS: levels are PERP prices (perpRef 681.31). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (681.31 vs 681.39), h4 RSI 42.6, day +0.0%
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×1, div:buy×1, div:sell×1, sdiv:sell×3 — net 1 buy-side vs 5 sell-side
- [FOR] liquidation: long-liq magnet 669.70 (str 49, ~$7M est, -1.75%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.019 (5m ago +0.014, rising bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 48.6%, perpCvd -40, spotCvd -6, quadrant both-selling, latestDiv bear (recent)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 15:05 UTC — agent task from zai-desk
- DIRECTIVE DIR-0014 · kind EXECUTE+VERIFY+REPORT · priority high · no real-money risk (testnet only). CONTEXT: user directive 'integrate top 200 most liquid assets from binance in our terminal across crypto, indices, metals, forex etc. — we will trade at demo binance account first'. Shipped in the sandbox as Tier-2 of the terminal (commit follows this directive): Binance-NATIVE top-200 universe (every TRADING USDT-M perp ranked by rolling 24h quote volume; re-ranked every 4h; exchangeInfo tick/step precision), 6 new routes /api/binance/{universe,quotes,klines,market,account,order}, browser WebSocket feeds (!miniTicker@arr 1s grid · @depth20@100ms L2 · @trade tape · @forceOrder liquidations), UI (BINANCE 200 grid button, BinanceView symbol page, palette group + rank badges — 287 instruments total), and the TESTNET demo order ticket (DemoAccountPanel) gated server-side by BINANCE_MODE=testnet. No new npm dependencies (package-lock.json unchanged). TASKS: 1. git pull --rebase. 2. npm ci ONLY if package-lock.json changed (it should NOT change). 3. npm run build, restart :3000. 4. ADD DEMO KEYS LOCALLY: the user provided futures-TESTNET API keys on 2026-11-11 (chat). Ask the user to paste them into the local .env as BINANCE_API_KEY / BINANCE_API_SECRET / BINANCE_MODE=testnet (NEVER commit — .env is gitignored). Without keys the market data works fully; only the demo order panel shows 'not configured'. Keys were verified on the sandbox against https://testnet.binancefuture.com/fapi/v2/account → 200, canTrade=true, ~4096 USDT fake balance. 5. VERIFY endpoints (curl 127.0.0.1:3000): (a) /api/binance/universe expect ok:true n:200 assets ranked (BTC #1); (b) /api/binance/market?sym=ZEC expect ok:true with ticker.last ~950-1000, mark.fundingRatePct, oi.usd ~$400-500M; (c) /api/binance/klines?sym=ZEC&interval=15m&limit=120 expect 120 rows; (d) /api/binance/account expect ok:true mode:testnet (with local keys) or ok:false honest 'not configured' (without); (e) /api/cg/live?sym=ZEC expect ok:true source binance-fapi; (f) regression: /api/cg/assets 15, /api/cg/classic?list=1 84, /api/health 200. 6. VERIFY browser (Chrome DevTools MCP): (a) header shows '15 perp + 188 binance + 84 classic = 287 instruments'; (b) BINANCE 200 button → grid with LIVE · WS 1s badge and ~200 rows; (c) click ZEC row (or ?sym=ZEC) → BinanceView: ORDER BOOK 'L2 depth20 @100ms · live' with 20-level ladder + spread + imbalance, TRADE TAPE with N/s counter, chart 300 bars with 'forming O … H …' live candle, funding/next-funding/OI stats populated, BINANCE DEMO ACCOUNT 'TESTNET · LIVE' with wallet + order ticket (if keys configured: place a far-from-market LIMIT, verify orderId accepted, then cancel all — fake funds only); (d) ALL ⌄ palette shows 'Binance perps (top-200 liquidity) · 188' group with #rank badges; (e) zero console errors on all views. 7. Note for your egress: if YOUR host IP ever gets an fapi 429/418 weight ban, the Binance stats/klines fall back to browser-direct fapi automatically (badge: 'browser-direct (host fapi-banned)') and the shared breaker recovers within ~60s — do not restart for that. REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md.
