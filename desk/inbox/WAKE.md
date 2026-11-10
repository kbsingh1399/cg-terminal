# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)

<!-- DIRECTIVE PROTOCOL v1 ACTIVE (16:10 UTC) — spec: desk/PROTOCOL.md §Directive protocol.
     zai now issues structured directives via desk/inbox/*DIR-*.json. Every directive
     REQUIRES a reply file desk/outbox/<same-basename>.reply.md:
     VERDICT (EXECUTED|COUNTER|REJECTED|DEFERRED) / CHECKS / REASONING / ACTION / EVIDENCE.
     Reasoning mandate: NEVER execute on trust — re-derive every number yourself
     (basis translation, lot size, spread/side), re-verify the debate, form your own
     opinion; if you disagree → COUNTER, don't execute.
     On activation also overwrite desk/outbox/AGENT-STATUS.md (heartbeat). -->

## 16:10 UTC — 3 DIRECTIVES QUEUED (full texts in desk/inbox/, appended below by the daemon)

1. **DIR-0001 · URGENT · CANCEL_ORDER** — ADA ticket 209375723 (desk verdict CANCEL:
   spread 2.19% → instant-stop geometry; math in log.md EXEC 15:47). Risk-reducing.
2. **DIR-0002 · HIGH · EXECUTE_ORDER** — R4-BTC-1 BTC SHORT (R 3.5, debate 7/2):
   translate ALL levels via live basisPct, size ≈ 0.06 lots (never 1.00), your
   concurrence required. Expires 18:53 UTC.
3. **DIR-0003 · INVESTIGATE** — find tradeable names for the 5 no-tick symbols
   (DOGE/AVAX/BNB/LINK/SOL) → propose symbol_map CONFIG? entry; confirm ADA cancel;
   verify rounds resumed (desk_round.sh was EMPTIED by the CRLF commit dd6b637 —
   restored + hardened in the commit that carries this beacon; R7 should follow).

## User-decision items (zai escalation)
- ADA cancel: DIR-0001 issued per desk verdict — say **"keep ADA"** to countermand.
- Autonomy is level 1 (REASON-EXECUTE). Say **"autonomy 2"** to let risk-reducing
  acts run without directives, or **"autonomy 3"** for full initiative within caps.
- `wake_cmd` still empty — the daemon can toast but cannot launch the agent itself;
  set it in desk/daemon.json if a CLI/URL trigger exists (uses {msg} placeholder).

## Standing rules (unchanged)
- Levels are PERP prices → translate via live basisPct; SHORT fills at bid, SL on ask.
  |basis| > 0.5% or spread > 0.15% → SKIP + log. Sizing: equity × 0.5% risk mandate.
- After any action: state.json update + EXEC/DIALOG entry in log.md + clear handled
  sections here + heartbeat file refresh.

## 2026-11-10 16:11 UTC — agent task from zai-desk
- DIRECTIVE DIR-0001 · kind CANCEL_ORDER · priority URGENT (risk-reducing)
TARGET: MT5 pending ticket 209375723 — ADAUSD SELL LIMIT 1.00 lot @ 0.17772, SL 0.1783, TP 0.1709 (order R6-ADA-1).
GOAL: cancel the ticket and record it.
WHY (desk math, desk/log.md EXEC entry 15:47): ADAUSD spread 2.19–2.20% vs rule max 0.15%; at any fill bid=0.17772 the ask ≈ 0.1815 > SL 0.1783 → the short's SL triggers on ASK → instant stop-out ≈ −0.0038/unit. SL/TP were also left untranslated (correct translated: SL 0.17882 / TP 0.17139). There is no compliant version of this trade on this broker quote.
CONSTRAINTS (hard):
- Cancel ONLY this ticket. No other MT5 actions.
- If the user has countermanded ("keep ADA"), reply DEFERRED with that note instead.
VERIFY CHECKLIST (do these yourself, log observed values in your reply):
1. Ticket 209375723 still pending (mt5.orders_get / MT5 UI). If it FILLED or is gone, reply EXECUTED with what you found + resulting position state.
2. ADAUSD spread still > 0.15% in a fresh quote you pull yourself.
3. No user countermand received in desk/log.md / WAKE.md since 15:47.
REPLY: desk/outbox/2026-11-10T16-10-00_DIR-0001-cancel-ada-order.reply.md per the reply contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE). Also: state.json R6-ADA-1 → status "cancelled" + EXEC entry in log.md.
AUTONOMY NOTE: at autonomy_level 2+ this action would not even need a directive — it is risk-reducing by definition.

## 2026-11-10 16:11 UTC — agent task from zai-desk
- DIRECTIVE DIR-0002 · kind EXECUTE_ORDER · priority HIGH (risk-adding — full checklist + your concurrence required)
TARGET: order R4-BTC-1 in desk/state.json — BTC SHORT limit 74,270.3 · stop 74,648.7 · T1 72,964.8 · R 3.5 · expires 18:53 UTC (perp levels; perpRefPrice 74,525.6). Debate FOR 7 / AGAINST 2 (full votes in state.json).
GOAL: place it on BTCUSD in MT5 — correctly this time (the ADA placement translated only the entry; ALL THREE levels must be translated).
CONSTRAINTS (hard — any fail → do not place, reply COUNTER/DEFERRED with values):
- Translate EVERY level: mt5Level = perpLevel × (1 + basisPct/100) using LIVE desk/mt5.json BTCUSD.basisPct (was ≈ −0.02% at 16:04; recompute).
- BTCUSD spreadPct ≤ 0.15% and |basisPct| ≤ 0.5% at placement moment.
- SIZING: lots = (equity × 0.5%) / (stopDistance × contractSize 1). Equity ≈ 4,654 → budget ≈ $23.27 → stop dist ≈ 378.4 → ≈ 0.06 lots (verify volumeMin 0.01 / step 0.01). NEVER 1.00 lot (8.1% risk).
- Order still status "suggested", debate still FOR > AGAINST, not expired, positions < max 4.
- SHORT fills at bid; SL triggers on ASK — pad the SL by the spread ($24 ≈ 0.033%).
VERIFY CHECKLIST (re-derive, do not trust my numbers):
1. Recompute all three translated levels yourself from live basisPct.
2. Recompute the lot size from live equity.
3. Re-read the debate[] in state.json — do you agree FOR wins? Note the 2 AGAINST (ask wall $22.2M @ 75,812; short-liq magnet 75,126.9 str 100 between entry and stop — sweep risk).
4. Your OWN read: h4/d1 structure right now, any red-folder news next 30 min, session quality. Would YOU take this short? If NO → COUNTER.
REPLY: desk/outbox/2026-11-10T16-10-00_DIR-0002-place-btc-short.reply.md + state.json updates + EXEC entry.
USER NOTE: the user may countermand anytime; if they have said otherwise anywhere, that wins.

## 2026-11-10 16:11 UTC — agent task from zai-desk
- DIRECTIVE DIR-0003 · kind INVESTIGATE · priority normal (no market risk)
GOAL: make the 5 dead broker symbols tradeable + close the visibility gaps.
TASKS:
1. DOGEUSD / AVAXUSD / BNBUSD / LINKUSD / SOLUSD show "no tick" in desk/mt5.json. Query the broker's symbol universe (python: mt5.symbols_get('*DOGE*') etc.) and find the exact tradeable names (suffixes like .a, .r, .pro are common on FundedNext). Report the correct config.symbol_map edits as a CONFIG? entry in desk/log.md (config is human-owned — do NOT edit state.json config yourself; the user applies it).
2. While you're in MT5: confirm the ADA cancel outcome (DIR-0001) and report account state.
3. Check whether rounds are running again (R7+ in desk/log.md) after the desk_round.sh restore (commit follows this directive) — the CRLF "fix" commit dd6b637 had EMPTIED the file (0 bytes), which is why rounds silently stopped; it is now restored + hardened with a python fallback.
REPLY: desk/outbox/2026-11-10T16-10-00_DIR-0003-broker-symbols-and-status.reply.md with findings + proposed symbol_map table.
