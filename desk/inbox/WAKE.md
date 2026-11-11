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
