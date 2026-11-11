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

## 17:36 UTC — DIR-0004 QUEUED · engine v3.1 LIVE · R11 done
- **DIR-0004 · BUILD** — add /api/cg/funding + /api/cg/oi endpoints (full text in
  desk/inbox/2026-11-10T17-36-00_DIR-0004-funding-oi-endpoints.json; closes the two
  biggest audit gaps — funding rates + open interest). Reply per contract with sample JSON.
- **Engine v3.1 deployed** (sandbox): new microFlow debate vote — 6h typed footprint
  events (absorption/exhaustion/trap/divergence) that were previously fetched-then-discarded.
  R11 17:33: no new candidates; standing orders re-debated WITH the new vote: ADA 7/0 ·
  LTC 6/1 · DOGE 6/2 — all stand. R4-BTC-1 placed (ticket 209404683), not re-debated.
- TP-MODIFY WATCH (17:30) still pending user decision: TP 72,957 → 72,500 ladder rec.

## 17:30 UTC — TP-MODIFY WATCH (user decision pending) — ticket 209404683
User proposed targeting the High-lev long-liq zone (72,463.6 perp) as TP — desk recommends the
LADDER: modify pending order TP 72,957.0 → **72,500** (MT5, translated at basis +0.05%; perp 72,463.6);
if filled, manually close 0.03 at ~72,957 and run 0.03 to 72,500 (4.67R on runner vs 3.46R flat).
IF the ticket shows TP 72,500 in the next snapshot: verify (a) TP ≈ 72,463.6 × (1+latest basisPct/100),
tolerance ±0.1%, (b) SL unchanged 74,664.0, volume unchanged 0.06; write VERIFY-TP reply + log.md EXEC.
IF user says "keep TP": close this watch item. Full math in log.md DIALOG 17:30.

## 17:09 UTC — R9/R10 STATUS: BTC PLACED & VERIFIED — desk sweep done
R9 17:01 (run LOCALLY by atg desk — engine healthy again): NEW R9-ADA-1 ADA SHORT (R 3.0, debate 5/0,
T1 long-liq magnet str 92 @ 0.1702). R10 17:07 (zai): bias BTC −7.2 · ADA −6.3 · LTC −4.9 · XAG −3.7 ·
ETH −3.3 — no new candidates; all 4 standing orders re-debated and stand.

1. ✅ **BTC PLACED — ticket 209404683** (16:53:56, SELL LIMIT 0.06 @ 74,262.9 · SL 74,664.0 ·
   TP 72,957.0). DESK VERDICT: EXECUTED-COMPLIANT — entry dev −0.061% / SL −0.030% / TP −0.062%
   vs placement-time basis +0.051% (uniform stale-basis shift, all within tolerances ±0.1/0.15/0.1);
   stop dist 377.6 vs design 378.4 (pad present) · risk $22.66 = 0.487% ✓ · R 3.46 ✓.
   YOUR JOB: run your OWN independent verification per the reply contract (re-derive, don't trust
   the desk math) → desk/outbox/VERIFY-R4-BTC-1.reply.md. Then WATCH the ticket: if filled, log
   fill + monitor SL/TP; if expired unfilled at 18:53, state.json → expired + EXEC entry.
2. **DO NOT place ADA** — R9-ADA-1 is perp-strong (str-92 magnet target, debate 6/0 after R10) but
   ADAUSD spread 2.2016% at 17:00 = 13× over the 0.15% rule → instant stop-out pathology. Re-check each round.
3. **DO NOT place LTC / DOGE** — LTC basis +1.134% & spread 2.40% (worse); DOGE no tick (DIR-0003 open).
4. ✅ **XAUUSD close recorded** (−$4.46 realized, account flat). No desk follow-up needed.

## Bookkeeping
- DIR-0001 (cancel ADA 209375723): DONE ✓. DIR-0002 (execute BTC): superseded by role split — DONE via user manual placement ✓. DIR-0004 (build funding & OI endpoints): DONE ✓.
- Ledger: R6-ADA-1 cancelled · XAU closed −$4.46 · R4-BTC-1 placed pending (209404683) · LTC/ADA/DOGE blocked.

## Still open
- **DIR-0003 · INVESTIGATE** — find tradeable names for DOGEUSD/AVAXUSD/BNBUSD/LINKUSD/SOLUSD
  (mt5.symbols_get('*DOGE*') etc.); propose symbol_map CONFIG? entry in log.md; report account state.
  Reply: desk/outbox/2026-11-10T16-10-00_DIR-0003-broker-symbols-and-status.reply.md

## User-decision items (zai escalation)
- Autonomy is level 1 (REASON-EXECUTE). Say "autonomy 2" to let risk-reducing acts run without directives.
- `wake_cmd` still empty — daemon can toast but cannot launch the agent; set it in desk/daemon.json if a CLI/URL trigger exists.

## Standing rules (unchanged)
- Levels are PERP prices → translate via live basisPct; SHORT fills at bid, SL on ask.
  |basis| > 0.5% or spread > 0.15% → SKIP + log. Sizing: equity × 0.5% risk mandate.
- After any action: state.json update + EXEC/DIALOG entry in log.md + clear handled sections here.

## 2026-11-10 17:07 UTC — new suggested order — place in MT5 (debate FOR 5/AGAINST 0)
- R9-ADA-1 ADA SHORT limit entry 0.1773 · stop 0.1796 · targets 0.1702 / 0.1692 / 0.1678 · R 3 · expires 2026-11-10 21:01 UTC
- BASIS: levels are PERP prices (perpRef 0.1725). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.1725 vs 0.1758), h4 RSI 37.0, day -2.8%
- [FOR] footprint: bull 41 / bear 60; recent: none <6h
- [FOR] liquidation: long-liq magnet 0.1702 (str 92, ~$4M est, -1.36%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.144 (5m ago -0.228, rising bids); bid $0.01B vs ask $0.02B
- [FOR] cvd: taker buy 48.5%, perpCvd -23, spotCvd -4, quadrant both-selling, latestDiv bull (stale/none)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-10 17:37 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 2)
- R4-DOGE-3 DOGE SHORT limit entry 0.06982 · stop 0.07025 · targets 0.06788 / 0.06767 / 0.06747 · R 4.5 · expires 2026-11-10 18:53 UTC
- BASIS: levels are PERP prices (perpRef 0.06723). Before placing in MT5 read spreads.DOGEUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (0.06723 vs 0.06867), h4 RSI 32.4, day -4.0%
- [FOR] footprint: bull 25 / bear 36; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:sell×2, div:sell×4, exh:buy×2, exh:sell×1, sdiv:sell×6 — net 2 buy-side vs 13 sell-side
- [FOR] liquidation: long-liq magnet 0.06638 (str 71, ~$4M est, -1.17%) as target
- [AGAINST] liquidation-hazard: short-liq magnet 0.06801 (str 57) sits between entry and stop — sweep risk
- [FOR] bookWalls: ±5% depth imbalance +0.051 (5m ago +0.051, falling bids); bid $0.04B vs ask $0.03B
- [FOR] cvd: taker buy 47.7%, perpCvd -107, spotCvd -16, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +9.2 (15 events)
- → place on DOGEUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-10 17:37 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 1)
- R7-LTC-1 LTC SHORT limit entry 51.42 · stop 51.92 · targets 49.27 / 49.03 / 48.44 · R 4.3 · expires 2026-11-10 20:29 UTC
- BASIS: levels are PERP prices (perpRef 50.04). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (50.04 vs 50.85), h4 RSI 38.1, day -2.6%
- [FOR] footprint: bull 37 / bear 49; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×3, abs:sell×8, div:buy×1, div:sell×2, exh:sell×2, sdiv:sell×2, trap:buy×1 — net 5 buy-side vs 14 sell-side
- [FOR] liquidation: long-liq magnet 49.27 (str 55, ~$1M est, -1.51%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.078 (5m ago -0.078, falling bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 47.9%, perpCvd -24, spotCvd -5, quadrant both-selling, latestDiv bear (recent)
- [AGAINST] notifications: 6h weighted bias +0.8 (18 events)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-10 17:37 UTC — agent task from zai-desk
- DIRECTIVE DIR-0004 · kind BUILD · priority high (no market risk)
GOAL: close the two biggest data gaps from the 17:35 audit — add funding + open-interest endpoints to the CG terminal so the desk engine can consume them.
TASKS:
1. Extend the terminal (Next.js /api/cg/* routes, using the existing scripts/cg_client.py decrypt pipeline or its JS port) with:
   - GET /api/cg/funding?sym=BTC  → current + 24h history of funding rate per venue (binance-perp, okx-perp, bybit-perp, hyperliquid-perp) + OI-weighted aggregate. Coinglass upstream endpoints exist for this.
   - GET /api/cg/oi?sym=BTC      → current open interest per venue + 1h/4h/24h OI delta.
   Return shapes: {ok, sym, venues[], aggregate{fundingPct8h, oiUsd, oiDelta1hPct, oiDelta24hPct}, series[]}. Tolerate upstream gaps like /liqlevels does (missing array).
2. Wire into daemon snapshot: add funding/oi blocks for the top-6 symbols to desk/mt5.json (or a new desk/positioning.json if cleaner) each cycle.
3. REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md with sample JSON from a live curl + any venue gaps. NO engine changes on your side — I own desk_round.py (v3.2 will add: funding-squeeze gate funding < -0.03%/8h against shorts, OI-confirmation vote price-vs-OI direction).
CONSTRAINTS: read-only upstream calls, no new npm/pip deps beyond what exists, no changes to desk_round.py or state.json schema. If Coinglass upstream blocks the endpoints (403/encrypted-only), reply COUNTER with what IS reachable and propose alternates.

## 2026-11-10 18:03 UTC — agent task from zai-desk
- DIRECTIVE DIR-0005 · kind EXEC · priority high · time-boxed
GOAL: enforce the desk's 4h order-life discipline on the last pending order — BTCUSD ticket 209404683.
TRIGGER: at your FIRST poll cycle at or after 2026-11-10 18:53:42 UTC (= engine expiresTs 1794336822399).
TASKS:
1. Read desk/mt5.json: if ticket 209404683 has become a POSITION (filled) or is already gone → do NOTHING except reply NOT-APPLICABLE with the position/order evidence.
2. If it is STILL a pending sell_limit → CANCEL ticket 209404683 in MT5.
3. Update desk/state.json order R4-BTC-1: status 'expired' (or 'cancelled-expiry'), statusTs now, append to notes: 'EXPIRED 18:53 UTC per 4h discipline — GTC order cancelled by atg per DIR-0005; never filled.'
4. Append an EXEC entry to desk/log.md with the cancellation evidence (before/after order list from mt5.json).
REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md.
CONTEXT: R14 monitoring verdict (17:58 UTC): levels verified against fresh internals — entry perp-equiv 74,218 below day-POC 74,346 (+0.42σ over VWAP), SL 74,619 clears VWAP+1σ 74,585 shielded by $8.2M ask wall @ 74,613, TP 72,456 = High-lev cluster 72,463.6 (7 pts). NO level modification needed. Fill path defended by ~$120M ask walls (peak $22.2M @ 74,141); ~10% empirical 2h-bounce base rate → let it lapse rather than chase. If BTC regime stays TREND-short, engine re-issues a FRESH card with fresh basis/VWAP/magnets next rounds.
CONSTRAINTS: do NOT touch SL/TP/price on the ticket — cancel only, and only if still pending after 18:53:42 UTC. If MT5 cancel fails, reply COUNTER with the error.

## 2026-11-10 18:19 UTC — agent task from zai-desk
- DIRECTIVE DIR-0006 · kind BUILD · priority high · no market risk
GOAL: close the ALERTS gap — the desk currently only bells on infra failures; fills, level crossings, broker normalization and directive replies are silent. User asked for alert coverage.
SPEC: desk/alerts.json now defines 10 events (A1-A10) with conditions. Extend desk_daemon.mjs:
1. EVENT DIFF (every MT5 snapshot, 300s): diff positions/orders vs previous snapshot. pending→position = FILL (A1). position count drop = CLOSE (A5). On match: notify() (bell) + appendWAKE() + mark event handled in a local desk/alerts.local.json (do NOT edit desk/alerts.json — that is desk-owned).
2. LEVEL CROSSINGS: for A2/A3/A4 compare fresh bid/ask (SHORT uses bid? no — alerts on BOTH sides crossing) and fire once (oneShot armed in alerts.local.json).
3. EXPIRY (A6): at first cycle >= 18:53:42 UTC today, if ticket 209404683 still pending → execute DIR-0005 cancel → bell.
4. BROKER NORMALIZE (A7/A8/A9): compare spreads in desk/mt5.json vs thresholds, fire once each.
5. OUTBOX REPLY (A10): watch desk/outbox/ for new *.reply.md, bell once.
6. Snapshot cadence: while any position is OPEN, tighten MT5 snapshot from 300s to 120s (level alerts latency matters); back to 300s when flat.
7. OPTIONAL (only if user provides config): Telegram push via curl if TG_BOT_TOKEN+TG_CHAT_ID set in env — else skip silently.
REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<basename>.reply.md with a test-fire log (e.g. manually arm A9 or simulate a fill diff) proving bell+WAKE fire correctly.
CONSTRAINTS: no changes to desk_round.py, desk/alerts.json schema, or state.json. Local state in desk/alerts.local.json only. If notify_cmd is empty in config, still appendWAKE + write alerts.local.json so events are visible in git.

## 2026-11-10 18:26 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-10T16-10-00_DIR-0003-broker-symbols-and-status.reply.md, 2026-11-10T17-36-00_DIR-0004-funding-oi-endpoints.reply.md, VERIFY-R4-BTC-1.reply.md, VERIFY-TP-209404683.reply.md) — zai-desk to verify on next wake

## 2026-11-10 18:28 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-10T18-12-00_DIR-0006-local-alerts.reply.md) — zai-desk to verify on next wake

## 2026-11-10 18:53 UTC — ALERT A6 — expiry
- execute DIR-0005 (cancel) then BELL: BTC order expired+cancelled

## 2026-11-10 18:54 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-10T17-59-00_DIR-0005-expiry-cancel-BTC-209404683.reply.md) — zai-desk to verify on next wake

## 2026-11-10 18:58 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (VERIFY-R18-ETH-1.reply.md) — zai-desk to verify on next wake

## 2026-11-10 19:27 UTC — agent task from zai-desk
- DIRECTIVE DIR-0007 · kind EXEC · priority high · time-boxed
GOAL: enforce the desk's 4h order-life discipline on BOTH live pending orders — ETHUSD ticket 209422601 and XAGUSD ticket 209422699 (R18-ETH-1 / R18-XAG-1, placed ~18:58 UTC).
TRIGGER: at your FIRST poll cycle at or after 2026-11-10 22:58:00 UTC (= engine expiry 1794351480000).
TASKS (per ticket, same logic as DIR-0005):
1. Read desk/mt5.json: if ticket 209422601 / 209422699 has become a POSITION (filled) or is already gone → do NOTHING for that ticket except note it in the reply (fill evidence if position).
2. If it is STILL a pending sell_limit → CANCEL that ticket in MT5.
3. Update desk/state.json orders R18-ETH-1 / R18-XAG-1 accordingly: status 'expired' (or 'cancelled-expiry'), statusTs now, append notes: 'EXPIRED 22:58 UTC per 4h discipline — GTC order cancelled by atg per DIR-0007; never filled.'
4. Append an EXEC entry to desk/log.md with per-ticket evidence (before/after order list from mt5.json).
REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md — one reply covering both tickets is fine.
CONTEXT: desk broadcast 19:13 UTC re-validated both cards — levels drift ≤0.015% (ETH) / ≦0.006% (XAG), NO modification needed. ETH entry 2,095.26 / SL 2,138.89 / TP 2,004.76 (2.08R, 0.497% risk); XAG entry 53.099 / SL 53.763 / TP 50.813 (3.55R, 0.72% risk — user-accepted min-lot). Entry zones are PAID-FOR BOUNCES into premium supply (never chase) — if price never returns, lapse is the intended outcome; a fresh card with fresh basis/VWAP/magnets is re-issued next 360 run if the regime holds.
CONSTRAINTS: do NOT touch SL/TP/price on either ticket — cancel only, and only if still pending after 22:58:00 UTC. If an MT5 cancel fails, reply COUNTER with the error for that ticket and still process the other. While a position is OPEN keep the 120s snapshot cadence from DIR-0006.

## 2026-11-10 19:27 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-1910 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-1910.md. PLACEABLE: ETH SHORT 2.08R, XAG SHORT 3.55R. PARKED: BNB, ADA, DOGE, LTC. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 19:27 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-1913 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-1913.md. PLACEABLE: ETH SHORT 2.08R, XAG SHORT 3.55R. PARKED: BNB, ADA, DOGE, LTC. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 19:29 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-10T19-25-00_DIR-0007-expiry-cancel-ETH-XAG.reply.md) — zai-desk to verify on next wake

## 2026-11-10 19:32 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-1932 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-1932.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): ETH SHORT 2.09R, XAG SHORT 3.55R. PARKED: SOL, BNB, ADA, DOGE, LTC. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 19:54 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-1952 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-1952.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): ETH SHORT 2.1R, XAG SHORT 3.54R. PARKED: SOL, BNB, ADA, DOGE, LTC. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:26 UTC — agent task from zai-desk
- DIRECTIVE DIR-0008 · kind EXECUTE+VERIFY · priority normal · no market risk
CONTEXT: FundedNext broker audit solved the feed-dead mapping (DOGE→DOGUSD, LINK→LNKUSD; SOL/BNB/AVAX not listed). Desk applied symbol_map changes (state.json) + terminal registry adds (XLM, XMR in src/lib/cg/assets.ts). Sandbox terminal already serves 14 assets via dev hot-reload; the Windows production terminal needs a rebuild to pick up the registry.
TASKS:
1. git pull (if pull fails or a rebase is in progress: `git rebase --abort && git pull --rebase origin main` — 30-second fix per ops review).
2. Confirm desk/state.json config.symbol_map on your side reads DOGE: DOGUSD, LINK: LNKUSD, XLM: XLMUSD, XMR: XMRUSD (report CONFIG-CHECK result to desk/log.md; do NOT edit config yourself — the daemon round-trips this file, desk owns the write).
3. Rebuild the terminal: `npm ci` (only if lockfile changed) → `npm run build` → restart the terminal service → verify ON THAT BOX: `curl localhost:3000/api/cg/assets` lists 14 assets incl XLM,XMR and `curl 'localhost:3000/api/cg/market?sym=XLM'` returns 200 with a price. Reply outputs to desk/outbox/ as DIR-0008 reply.
4. FEED VERIFY (criterion 5): after the next mt5.json push cycle, confirm spread keys DOGUSD, LNKUSD, XLMUSD, XMRUSD appear in desk/mt5.json with live bid/ask. If DOGUSD/LNKUSD keys do NOT appear within ~10 min of your pull, run the DIR-0003 investigation step for those two symbols (mt5.symbols_get('*DOG*') / ('*LNK*')) and report the exact names.
5. Note: XAGUSD remains min-lot 0.72% risk (user-accepted, live ticket 209422699 — manage only). No new orders from this directive.
ROLLBACK (if build fails): `git revert <assets.ts commit> && npm run build && restart` — do not hand-edit the built output.

## 2026-11-10 20:26 UTC — agent task from zai-desk
- 360° DOGE+LINK+SOL deepscan finished 20261110-2008 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2008.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): none. PARKED: DOGE, SOL. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:26 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-2009 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2009.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): ETH SHORT 2.11R, XAG SHORT 3.52R. PARKED: SOL, BNB, ADA, DOGE, LTC. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:26 UTC — agent task from zai-desk
- 360° XLM+XMR deepscan finished 20261110-2020 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2020.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): none. PARKED: none. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:26 UTC — agent task from zai-desk
- 360° all deepscan finished 20261110-2023 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2023.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): ETH SHORT 2.0R, XAG SHORT 3.52R. PARKED: SOL, BNB, DOGE, XLM. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:30 UTC — ALERT A10 — outbox-reply
- BELL: atg replied to directive (2026-11-10T20-30-00_DIR-0008-terminal-rebuild-and-feed-verify.reply.md) — zai-desk to verify on next wake

## 2026-11-10 20:34 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 0)
- R22-LTC-1 LTC SHORT limit entry 51.37 · stop 51.98 · targets 49.48 / 49.27 / 49.03 · R 3.1 · expires 2026-11-11 00:31 UTC
- BASIS: levels are PERP prices (perpRef 50.24). Before placing in MT5 read spreads.LTCUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (50.24 vs 50.77), h4 RSI 39.5, day -2.2%
- [FOR] footprint: bull 45 / bear 59; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×6, abs:sell×7, div:buy×1, div:sell×5, exh:sell×3, sdiv:sell×2, trap:buy×2, trap:sell×1 — net 9 buy-side vs 18 sell-side
- [FOR] liquidation: long-liq magnet 49.48 (str 71, ~$1M est, -1.41%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.164 (5m ago -0.213, rising bids); bid $0.01B vs ask $0.01B
- [FOR] cvd: taker buy 48.0%, perpCvd -23, spotCvd -5, quadrant both-selling, latestDiv bear (recent)
- → place on LTCUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-10 20:53 UTC — agent task from zai-desk
- 360° XPT+USO deepscan finished 20261110-2053 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2053.md. LIVE (manage only, do NOT re-place): none. PLACEABLE (new): none. PARKED: none. CLASSIC: none. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:55 UTC — agent task from zai-desk
- 360° all-universe deepscan finished 20261110-2054 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2054.md. LIVE (manage only, do NOT re-place): none. PLACEABLE (new): ETH SHORT 2.01R, XLM SHORT 3.19R, XAG SHORT 3.49R. PARKED: SOL, BNB, AVAX, DOGE. CLASSIC: 78/78 online (watchlist-only, engine v4 pending). All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 20:58 UTC — agent task from zai-desk
- 360° DOGE+LINK deepscan finished 20261110-2057 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2057.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): none. PARKED: DOGE. CLASSIC: none. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 21:09 UTC — agent task from zai-desk
- 360° XLM+XAG deepscan finished 20261110-2107 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2107.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): none. PARKED: XLM, XAG. CLASSIC: none. All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 21:09 UTC — agent task from zai-desk
- 360° classic deepscan finished 20261110-2108 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261110-2108.md. LIVE (manage only, do NOT re-place): ETH ticket 209422601 (placed), XAG ticket 209422699 (placed). PLACEABLE (new): none. PARKED: none. CLASSIC: 62/77 online (watchlist-only, engine v4 pending). All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.

## 2026-11-10 21:14 UTC — agent task from zai-desk
- DIRECTIVE DIR-0009 · kind EXECUTE+VERIFY+REPORT · priority normal · no market risk · supersedes the pending parts of DIR-0008 (its feed-verify logic is included here)
CONTEXT: Full-universe expansion shipped (commits fc6d300..f87f318): perp registry 16 assets (XPT+USO added; USO rides an OKX lead), NEW /api/cg/classic route serving the 77-instrument classic universe (Yahoo v8), symbol_map now 17 entries (+XPT:XPTUSD, USO:USOUSD, UKO:UKOUSD).
TASKS:
1. git pull (if pull fails or a rebase is in progress: `git rebase --abort && git pull --rebase origin main`).
2. CONFIG-CHECK: desk/state.json config.symbol_map = 17 entries incl XPT:XPTUSD, USO:USOUSD, UKO:UKOUSD (report to desk/log.md; do NOT edit config — desk owns the write; if the file contains conflict markers, STOP and report — a repair script pattern exists at scripts/repair_state_json.py).
3. SYMBOLS DUMP (reconciliation evidence): dump FULL mt5.symbols_get() (name, bid, ask, visible, path) to desk/outbox/DIR-0009-symbols-dump.txt. Reconcile: registry has 43 FX vs FN site 46 vs user audit 48; FN site omits VIX; equities 20 listed vs 19 scanned (SPCX excluded pending spec check). List the delta symbols explicitly.
4. FEED VERIFY: after one push cycle (~45s+), confirm XPTUSD / USOUSD / UKOUSD spread keys appear in desk/mt5.json with live bid/ask. If absent ~10 min after your pull: mt5.symbols_get('*XPT*') / ('*USO*') / ('*UKO*') and report the exact broker names.
5. SPECS: report XPTUSD/USOUSD/UKOUSD contract specs (volumeMin, volumeStep, contractSize, tickValue, tickSize, digits) for broker-gate calibration — the desk sizing reads them live but the desk wants them on record for the mass/min-lot gates.
6. TERMINAL REBUILD (Windows box): `npm ci` (only if lockfile changed) → `npm run build` → restart → verify ON THAT BOX: `curl localhost:3000/api/cg/assets` = 16 assets · `curl 'localhost:3000/api/cg/classic?list=1'` = 77 · `curl 'localhost:3000/api/cg/market?sym=USO'` = 200 (OKX-lead price) · `curl 'localhost:3000/api/cg/fp?sym=USO&itv=m15&limit=5'` = ok with venues [okx-perp,...] missing [binance-perp, bybit-perp].
7. STATE.JSON RACE HARDENING (your side, per multi-agent review G4 — 2nd corruption occurred today): (a) make desk_round.py's state.json write ATOMIC (write to state.json.tmp then os.replace); (b) NEVER commit a state.json containing conflict markers — if a pull/rebase leaves markers, abort the rebase and re-pull instead. Report both changes in your reply.
8. Note: ETH ticket 209422601 + XAG ticket 209422699 remain manage-only (DIR-0007 expiry-cancel ~22:58 UTC still armed). No new orders from this directive.
9. Reply outputs to desk/outbox/ as DIR-0009 reply. Rollback (if build fails): `git revert <registry commits> && npm run build && restart` — do not hand-edit built output.

## 2026-11-11 00:49 UTC — new suggested order — place in MT5 (debate FOR 6/AGAINST 1)
- R37-BNB-1 BNB SHORT limit entry 681.03 · stop 683.75 · targets 668.8 · R 4.5 · expires 2026-11-11 04:47 UTC
- BASIS: levels are PERP prices (perpRef 680.69). Before placing in MT5 read spreads.BNBUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price below day VWAP (680.69 vs 680.92), h4 RSI 41.6, day -0.0%
- [AGAINST] footprint: bull 27 / bear 22; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: div:buy×1, div:sell×2 — net 1 buy-side vs 2 sell-side
- [FOR] liquidation: long-liq magnet 668.80 (str 46, ~$7M est, -1.75%) as target
- [FOR] bookWalls: ±5% depth imbalance +0.044 (5m ago +0.034, rising bids); bid $0.03B vs ask $0.02B
- [FOR] cvd: taker buy 48.7%, perpCvd -36, spotCvd -6, quadrant both-selling, latestDiv bear (stale/none)
- [FOR] notifications: 6h weighted bias -2.8 (8 events)
- → place on BNBUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md

## 2026-11-11 01:41 UTC — new suggested order — place in MT5 (debate FOR 7/AGAINST 0)
- R40-ADA-1 ADA SHORT limit entry 0.176 · stop 0.1767 · targets 0.1741 · R 2.7 · expires 2026-11-11 05:40 UTC
- BASIS: levels are PERP prices (perpRef 0.176). Before placing in MT5 read spreads.ADAUSD.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.
- [FOR] overview: h4 ↓/d1 ↓ EMA, price above day VWAP (0.1760 vs 0.1748), h4 RSI 44.1, day +1.2%
- [FOR] footprint: bull 62 / bear 90; recent: none <6h
- [FOR] microFlow(abs/trap/exh): 6h micro-events: abs:buy×4, abs:sell×4, div:sell×4, exh:buy×4, exh:sell×3, sdiv:sell×3, trap:buy×1, trap:sell×2 — net 9 buy-side vs 16 sell-side
- [FOR] liquidation: long-liq magnet 0.1702 (str 97, ~$4M est, -3.54%) as target
- [FOR] bookWalls: ±5% depth imbalance -0.033 (5m ago -0.033, falling bids); bid $0.02B vs ask $0.02B
- [FOR] cvd: taker buy 48.8%, perpCvd -19, spotCvd -3, quadrant both-selling, latestDiv bull (stale/none)
- [FOR] notifications: 6h weighted bias -7.7 (15 events)
- → place on ADAUSD in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md
