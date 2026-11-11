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


## 2026-11-11 07:18 UTC — atg-exec status (DIR-0001..DIR-0010 cleared)
- Terminal rebuilt & live on :3000 (16 perp + 77 classic endpoints verified; fixed `src/app/api/cg/classic/route.ts` TS build).
- DIR-0009 & DIR-0010 replies filed in `desk/outbox/`. Account flat ($4,649.96); ETH 209422601 & XAG 209422699 cancelled in MT5 (`state=2`) and synced to `cancelled-expiry`.
- Standing R57-BNB-1 (BNB SHORT): BLOCKED (BNB not listed on FundedNext MT5).
- CRITICAL FINDING: `USO` perp ($140.97 OKX = USO ETF) != MT5 `USOUSD` ($86.49 = WTI Crude Cash) — flagged in DIR-0009 reply.

## 2026-11-11 07:31 UTC — agent task from zai-desk
- DIRECTIVE DIR-0011 · kind EXECUTE+VERIFY+REPORT · priority high · no market risk · supersedes DIR-0009 task 6 (rebuild)
CONTEXT: commit 9aea25b shipped the full-universe UI (user: 'still we don't have proper toggle rotate between all assets'). 98 instruments now toggleable: perp quick-bar (15) + ALL-assets searchable palette (type-ahead, grouped, keyboard up/down/enter/esc) + ArrowLeft/Right rotates the whole universe + classic Overview panel (EMA/RSI/VWAP±σ/volume-profile from Yahoo bars, interval presets 5m/15m/1h/1d) + ?sym= deep-links. Data fixes: USO moved perp→classic (DIR-0009 finding: OKX USO perp = USO ETF, +63% off broker USOUSD WTI; WTI now Yahoo CL=F), +5 FX pairs (EURHUF MXNJPY NOKJPY USDHKD ZARJPY → 48 FX, full broker coverage).
TASKS:
1. git pull (rebase-abort+pull-rebase if needed).
2. REBUILD: npm ci (only if lockfile changed) → npm run build → restart :3000.
3. VERIFY on that box: (a) curl localhost:3000/api/cg/assets = 15 assets (USO absent); (b) curl 'localhost:3000/api/cg/classic?list=1' = 83 (index 14 · fx 48 · equity 19 · commodity 2); (c) curl 'localhost:3000/api/cg/classic?sym=USO' price ~86 (CL=F WTI — NOT ~141 ETF); (d) in the browser: ALL ⌄ button → search 'US30' → Enter → classic Overview renders with EMA/RSI table and only the Overview tab visible; (e) click body, press →/← — symbol rotates through the universe and the URL ?sym= follows.
4. Report XAU/XAG/XPT feed sanity in the same reply (spot-check vs mt5.json).
REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md.
CONSTRAINTS: no MT5 actions, no order placement — UI/infra only.
