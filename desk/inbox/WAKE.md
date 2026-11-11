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
