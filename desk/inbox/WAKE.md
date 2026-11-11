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

## 2026-11-11 11:25 UTC — agent task from zai-desk
- DIRECTIVE DIR-0013 (re-issue, valid JSON — the 09-46 emission was malformed and correctly rejected) · kind EXECUTE+VERIFY+REPORT · priority high · no market risk · supersedes DIR-0012 (R3 rebuild — its checks included; DIR-0012 reply may be skipped if this executes). CONTEXT: R4 shipped in commit 22198de — L2/L3 microstructure layer per user directive 'continuous fetching live free data via API for forex, indices, metals at L2/L3 level too'. Three live-verified free sources: Hyperliquid xyz HIP-3 perps (L2 ladder w/ order count, OI, 1h funding, mark-vs-oracle, venue-health gate), Lighter DEX true-L3 resting orders (owner-account whale clustering vs quoting/MM, visible partials, maker/taker prints), Kraken spot FX L2 (6 majors, staleness-gated). Multi-agent reviewed (RV-ARCH/RV-QUANT/RV-QA/RV-SEC — all conditions fixed). Sandbox-verified end-to-end; your box should behave identically. TASKS: 1. git pull (rebase-abort + pull-rebase if wedged; log.md conflicts: keep BOTH entries). 2. REBUILD: npm ci ONLY if package-lock.json changed (no new deps — it should NOT change), then npm run build, then restart :3000. 3. VERIFY endpoints (curl localhost:3000): (a) /api/cg/micro?sym=XAU expect ok:true, hl ok (coin xyz:GOLD, mark in the 4050-4070 zone, funding 1h ~0.0006%, APR ~5.5%), lighter ok (XAU id 92, ~500 resting, visible book $10-20M/side), NO kraken field; (b) /api/cg/micro?sym=EURUSD expect lighter ok (typically 1 directional whale), kraken ok (ZEURZUSD spread <0.05%), hl SUPPRESSED-thin (xyz:EUR ~$4M/24h — amber reason, not an error); (c) /api/cg/micro?sym=NATGAS expect hl suppressed 'venue dislocation' (mark vs oracle >0.3%), Lighter leg still ok; (d) /api/cg/micro?sym=XPT AND ?sym=JP225 expect HTTP 200 with ok:true and hl.suppressed 'thin xyz market' (amber box, NOT a 502); (e) /api/cg/micro?sym=US30 expect HTTP 400 honest with mapped list; (f) R3 regression: /api/cg/perpdepth?sym=USO (4 venues, Binance lead) + /api/cg/cot?sym=SPX500 (z3y ~ -0.5 zone) + /api/cg/cnbc?syms=USO (CLZ26). 4. VERIFY browser (Chrome DevTools MCP): (a) ?sym=XAU perp view Overview tab, below the perp cards expect 'Perp L2 - Hyperliquid xyz:GOLD' + 'L3 resting orders - Lighter XAU' cards; (b) ?sym=EURUSD expect 3 cards: HL amber thin-market box + Lighter whale/MM + 'Spot L2 - Kraken ZEURZUSD'; (c) ?sym=XPT expect amber thin-market box only; (d) ?sym=US30 expect NO micro panel at all; (e) zero console errors on all four. 5. Report any source that 429s or times out from your egress (new dependencies: api.hyperliquid.xyz, mainnet.zklighter.elliot.ai, api.kraken.com — sandbox verified all three, but your network is authoritative; if Hyperliquid 429s during the sweep, wait 60s and retry that endpoint before reporting it failed). REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md.

## 2026-11-11 11:26 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake
