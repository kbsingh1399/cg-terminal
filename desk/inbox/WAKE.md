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

## 2026-11-11 08:23 UTC — agent task from zai-desk
- 360° classic deepscan finished 20261111-0821 UTC — broadcast refreshed in desk/inbox/WAKEUP.md (DESK BROADCAST section), digest desk/deepscan/DIGEST-20261111-0821.md. LIVE (manage only, do NOT re-place): none. PLACEABLE (new): none. PARKED: none. CLASSIC: 1/1 online (watchlist-only, engine v4 pending). All candidates are pullback LIMIT orders (never market); broker gates |basis|≤0.5% & spread≤0.15% must be re-verified at placement; await user-approved DIR-* before any MT5 action.
