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


## 2026-11-11 19:47 UTC — atg-exec status (synced — R102-LTC-1 triaged & skipped; 4/4 MT5 limits standing)
- `R102-LTC-1` (`LTC SHORT limit 51.11`) skipped on MT5 (`LTCUSD`): live spread `2.3731%` (`$1.22` on `50.80 / 52.02`, `5.25×` the `$0.23` stop distance) + `+1.0615%` basis distortion + `AGAINST` microFlow (`13` buy vs `4` sell) + `4/4` MT5 slots full (`#209656134 XMRUSD`, `#209656712 XAUUSD`, `#209657041 BTCUSD`, `#209657396 XLMUSD`).

## 2026-11-11 11:27 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake

## 2026-11-11 15:14 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T15-35-00_DIR-0014-binance-top200-tier-rebuild.reply.md) — zai-desk to verify on next wake

## 2026-11-11 20:51 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R107-BNB-1 BNB SHORT limit entry 687.91 · stop 690.66 · targets 679.26 · R 3.1 · expires 2026-11-12 00:50 UTC
- BASIS: levels are PERP prices (perpRef 687.91). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (687.91 vs 682.90), h4 RSI 49.5, day +1.0%
- [FOR] footprint: bull 27 / bear 31; recent: Exhaustion/buy[time], Absorption/sell[vol]
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×4, div:buy×1, exh:buy×2, exh:sell×1, sdiv:buy×1, trap:sell×2 — net 4 buy-side vs 7 sell-side
- [FOR] liquidation: long-liq magnet 669.87 (str 49, ~$7M est, -2.55%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.006 (5m ago -0.005, falling bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 48.8%, perpCvd -35, spotCvd -6, quadrant both-selling, latestDiv bear (recent)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md
