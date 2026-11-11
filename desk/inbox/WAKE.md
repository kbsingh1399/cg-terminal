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


## 2026-11-11 19:28 UTC — atg-exec status (synced — R101-XAG-1 triaged & skipped; 4/4 MT5 limits standing)
- `R101-XAG-1` (`XAG SHORT limit 52.977`) skipped on MT5 (`XAGUSD`): spread-adjusted net R `1.74 < 2.0R`, min-lot risk `$24.37` (`0.52% > 0.5%`), `53.42` str-72.5 short-liq hazard just above stop, and `4/4` MT5 limit slots occupied (`#209656134 XMRUSD`, `#209656712 XAUUSD`, `#209657041 BTCUSD`, `#209657396 XLMUSD`).

## 2026-11-11 11:27 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake

## 2026-11-11 15:14 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T15-35-00_DIR-0014-binance-top200-tier-rebuild.reply.md) — zai-desk to verify on next wake

## 2026-11-11 19:44 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 2)
- R102-LTC-1 LTC SHORT limit entry 51.11 · stop 51.34 · targets 50.51 / 49.81 · R 2.6 · expires 2026-11-11 23:42 UTC
- BASIS: levels are PERP prices (perpRef 50.87). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (50.87 vs 51.01), h4 RSI 45.3, day +0.3%
- [FOR] footprint: bull 26 / bear 33; recent: Bear div/sell[time], Divergence/buy[vol], Divergence/buy[range]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: abs:buy×6, abs:sell×1, div:buy×4, exh:buy×1, exh:sell×1, sdiv:sell×1, trap:buy×2, trap:sell×1 — net 13 buy-side vs 4 sell-side
- [FOR] liquidation: long-liq magnet 50.51 (str 65, ~$2M est, -0.69%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.024 (5m ago -0.127, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.6%, perpCvd -16, spotCvd -4, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +11.5 (14 events)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md
