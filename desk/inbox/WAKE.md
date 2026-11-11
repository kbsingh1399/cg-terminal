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
