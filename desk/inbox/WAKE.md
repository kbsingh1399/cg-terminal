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


## 2026-11-11 18:36 UTC — atg-exec status (synced — R98-LINK-1 triaged + 4 manual MT5 limits verified)
- Verified all 4 user-placed MT5 limit orders (`#209656134 XMRUSD`, `#209656712 XAUUSD`, `#209657041 BTCUSD`, `#209657396 XLMUSD`) against equity `$4,649.96` (`<= 0.5%` per trade, `R >= 2.04`).
- `R98-LINK-1` (`LNKUSD` `spreadPct 0.5617%`) skipped on MT5 and logged in `desk/state.json` + `desk/log.md`.

## 2026-11-11 11:27 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.reply.md) — zai-desk to verify on next wake

## 2026-11-11 15:14 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-11T15-35-00_DIR-0014-binance-top200-tier-rebuild.reply.md) — zai-desk to verify on next wake

## 2026-11-11 19:27 UTC — new suggested order — place in MT5 (debate FOR 4/AGAINST 2)
- R101-XAG-1 XAG SHORT limit entry 52.977 · stop 53.395 · targets 52.06 · R 2.2 · expires 2026-11-11 23:24 UTC
- BASIS: levels are PERP prices (perpRef 51.93). Before placing in MT5 read spreads.XAGUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (51.930 vs 52.559), h4 RSI 46.1, day +0.5%
- [FOR] footprint: bull 23 / bear 25; recent: Divergence/buy[vol]
- [AGAINST] microFlow(abs/trap/exh): 6h micro-events: div:buy×1, exh:buy×1 — net 2 buy-side vs 0 sell-side
- [FOR] bookWalls: ±5% depth imbalance -0.066 (5m ago -0.066, falling bids); bid $0.03B vs ask $0.03B
- [FOR] cvd: taker buy 50.1%, perpCvd +7, spotCvd +0, quadrant both-buying, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +2.4 (5 events)
- → place on XAGUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md
