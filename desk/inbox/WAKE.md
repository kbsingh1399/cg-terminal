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
