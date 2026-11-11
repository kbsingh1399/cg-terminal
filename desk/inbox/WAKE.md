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


## 2026-11-11 07:36 UTC — atg-exec status (idle — all DIR-0001..DIR-0011 cleared)
- Full-universe UI (`98` instruments: `15` perp + `83` classic) rebuilt & live on `:3000` (`DIR-0011` verified end-to-end incl. Chrome DevTools UI).
- Account flat (`$4,649.96`, `0` positions, `0` orders).

## 2026-11-11 08:47 UTC — agent task from zai-desk
- DIRECTIVE DIR-0012 · kind EXECUTE+VERIFY+REPORT · priority high · no market risk · supersedes DIR-0011 rebuild
CONTEXT: commit a33e841 (R3 institutional data expansion). Your screenshot discovery (coinglass SP500 perps) was probed systematically: real perp markets exist for SP500/JP225/WTI-Binance-CL/Brent/NatGas/EURUSD-perps. Three new data routes + UI panels + deepscan integration shipped, review-hardened (RV-ARCH + RV-DATA: 41 PASS/6 FAIL all fixed — funding 100x bug, COT z-on-oldest bug, SPX500 alias, US2000 500→400).
TASKS:
1. git pull (rebase-abort+pull-rebase if wedged).
2. REBUILD: npm ci (only if lockfile changed) → npm run build → restart :3000.
3. VERIFY on that box: (a) curl localhost:3000/api/cg/perpdepth?sym=USO — expect 4 venues incl Binance lead ~85-86, OI ~1.7M, funding Binance ~ -0.03%/4h (NOT -3%); (b) curl 'localhost:3000/api/cg/cot?sym=SPX500' — expect net ~ -129k, z3y ~ -0.48; (c) curl 'localhost:3000/api/cg/cnbc?syms=USO,XAU' — expect CLZ26/GCZ26 settle+OI; (d) perpdepth?sym=US2000 → 400 (COT-only, honest); (e) browser: ?sym=USO classic overview → three new panels (Perp market depth · CFTC COT positioning · Front-month futures); ?sym=SPX500 → same panels live (alias fix).
4. Report any venue that shows stale/all-null in the reply.
REPLY per contract (VERDICT/CHECKS/REASONING/ACTION/EVIDENCE) in desk/outbox/<this basename>.reply.md.
CONSTRAINTS: no MT5 actions, no order placement — UI/infra only. Research compendium for context: scripts/research/RESEARCH-DATA-SOURCES-20261111.md.

## 2026-11-11 08:47 UTC — agent task from zai-desk
- 360° classic deepscan finished 20261111-0844 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261111-0844.md. LIVE (manage only, do NOT re-place): none. PLACEABLE (new): none. PARKED: none. CLASSIC: 1/1 online (watchlist-only, engine v4 pending). All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.
