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
- DIR-0001 (cancel ADA 209375723): DONE ✓. DIR-0002 (execute BTC): superseded by role split — DONE via user manual placement ✓.
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
