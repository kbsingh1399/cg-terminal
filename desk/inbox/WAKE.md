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

## 16:49 UTC — R8 DESK BRIEF (round run 16:46, engine v3)
Bias: BTC −7.2 · LTC −7.1 · ADA −3.8 · XAG −3.3 · AVAX/BNB −2.7 · ETH −2.1 · DOGE −2.0 · XAU +2.0.
No new order passed the gates. Standing orders re-debated: R4-BTC-1 6/1 · R7-LTC-1 6/0 · R4-DOGE-3 4/1.

1. **VERIFY-TASK (when user places BTC)** — R4-BTC-1 BTC SHORT is the only broker-compliant trade.
   Card REFRESHED 16:53 (basis +0.051%, spread 0.032%, spread$ 23.5): SELL LIMIT 0.06 lots ·
   entry 74,308.1 · SL 74,710.2 (ask-trigger, spread-padded; structural stop = perp 74,648.7) ·
   TP 73,001.9 · risk $22.72 = 0.49% equity · expires 18:53 UTC.
   BASIS-DRIFT RULE (verification must use it, not frozen numbers): at click time take the
   LATEST mt5.json BTCUSD.basisPct and compute mt5Level = perpLevel × (1 + basisPct/100)
   for entry/TP, SL = stop×factor + current spread$ (ask-trigger pad). Perp levels: entry
   74,270.3 · stop 74,648.7 · T1 72,964.8. A ±0.05% basis swing moves levels ~$37 — verify
   against the placement-time basis, not this card. When the ticket appears in mt5.json orders[]:
   re-derive ALL levels + lots yourself, check entry/SL/TP translation & spread rule, then write
   desk/outbox/VERIFY-R4-BTC-1.reply.md (VERDICT/CHECKS/REASONING/EVIDENCE) + state.json → placed.
   Tolerances: entry/TP within 0.1% of recomputed, SL within 0.15%, lots ±0.01.
2. **DO NOT place LTC** — R7-LTC-1 is perp-valid (6/0) but broker-blocked: LTCUSD basis +0.841%
   (> 0.5%) AND spread 2.40% (> 0.15%) at 16:40. Same pathology as ADA. Re-check each round.
3. **DO NOT place DOGE** — DOGEUSD still no tick (broker symbol unknown; DIR-0003 open). Expires 18:53.
4. ✅ **XAUUSD BUY 0.01 @ 4022.68 CLOSED by user ~16:52** (realized −$4.46, balance 4,654.42 →
   4,649.96). Account flat, margin 0. Quick exit after the naked-position flag = good discipline.
   Log an EXEC entry recording this close when you next sync.

## Resolved / bookkeeping
- DIR-0001 (cancel ADA 209375723): DONE — orders[] empty at 16:40, no ADA position. state.json → cancelled.
- DIR-0002 (execute BTC): SUPERSEDED by role split above — verify, don't execute. Reply still welcome.

## Still open
- **DIR-0003 · INVESTIGATE** — find tradeable names for DOGEUSD/AVAXUSD/BNBUSD/LINKUSD/SOLUSD
  (mt5.symbols_get('*DOGE*') etc.); propose symbol_map CONFIG? entry in log.md; report account state.
  Reply: desk/outbox/2026-11-10T16-10-00_DIR-0003-broker-symbols-and-status.reply.md

## User-decision items (zai escalation)
- XAU long: add SL 3,999.4? (naked 0.01 lot currently, −$1.54 floating)
- Autonomy is level 1 (REASON-EXECUTE). Say "autonomy 2" to let risk-reducing acts run without directives.
- `wake_cmd` still empty — daemon can toast but cannot launch the agent; set it in desk/daemon.json if a CLI/URL trigger exists.

## Standing rules (unchanged)
- Levels are PERP prices → translate via live basisPct; SHORT fills at bid, SL on ask.
  |basis| > 0.5% or spread > 0.15% → SKIP + log. Sizing: equity × 0.5% risk mandate.
- After any action: state.json update + EXEC/DIALOG entry in log.md + clear handled sections here.
