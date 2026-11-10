# Session State — shared log for distributed agents

This file is the **common ground** between the sandbox agent (Z.ai) and the
local Antigravity agent working on this repo. Read it before acting; append a
dated entry after each meaningful change; keep only the last 10 entries.

## Handoff protocol

- Entry format: `### YYYY-MM-DD HH:MM UTC — <agent> — <one-line change>`
- Include: what changed (commits/files), what was verified, what is open.
- Never edit or delete another agent's entries.
- **Code of record = `main` on GitHub.** Never rely on uncommitted local
  state; if it matters, commit and push it first.
- `.env` is untracked on purpose (contains secrets). Copy from
  `.env.example` on a fresh clone.

## Entry points (unchanged)

- Protocol for agents: `AGENTS.md` (wake-up protocol, MCP tools, trade card
  format, data-honesty rules).
- Quick pointer: `README-ANTIGRAVITY.md` → full docs in `README.md`.
- Install: `INSTALL-GUIDE.md`.

## Log

### 2026-11-10 14:10 UTC — Antigravity local agent — fast-forward sync to 39f6ed8 & production restart
- Pulled latest 3 commits from GitHub (`06099fc`, `4220ebe`, `39f6ed8`).
- Verified clean TypeScript compilation (`tsc --noEmit` exit 0).
- Rebuilt standalone production bundle (`npm run build`) and restarted daemon on `127.0.0.1:3000`.
- Verified live sub-second price (`/api/cg/live`), live book (`/api/cg/livebook`), and live-anchored liquidation levels (`/api/cg/liqlevels?sym=XRP` @ 1.0654).
- MCP server verified active and operational.

### 2026-11-10 14:05 UTC — Z.ai sandbox agent — full sync confirmed, log created
- Verified `origin/main` == local HEAD `4220ebe` (`git push`: Everything
  up-to-date). Clean tree, no stash, single branch.
- Latest two commits since the first push (`67f9c46`):
  - `06099fc` `scripts/scan_opportunities.py` (cross-asset signal scan).
  - `4220ebe` signal-integrity fix: liq clusters + whale walls anchored to
    LIVE price (`src/lib/live/server-price.ts`, shared 250 ms fapi bookTicker
    w/ TTL), plausible() wall filter (asks below market / bids above market
    rejected — 32 stale walls purged from the 6h feed), priceDecs-aware liq
    dedup + cluster display. Fixes XRP/ADA false alerts. `tsc --noEmit` clean.
- Added this `SESSION-STATE.md` to make cross-agent handoff explicit.
- OPEN: cross-asset trading-opportunity report — round-1 scan done; awaiting
  live-price + indicator confluence pass (RSI/VWAP/POC/CVD) on top candidates.

### 2026-11-10 14:25 UTC — Z.ai sandbox agent — TRADE DESK created (zai ↔ atg coordination)
- New `desk/` layer: `PROTOCOL.md` (operating contract: roles, field
  ownership, order lifecycle suggested→placed→filled→closed, risk rules,
  git discipline), `state.json` (machine truth: config/analysis/orders/
  positions/closed), `log.md` (append-only journal).
- New `scripts/desk_round.sh` + `desk_round.py`: 15-min round = pull
  --rebase → terminal health (auto-boot npm run dev ≤150s) → 12-asset
  confluence scoring (notif bias recency-weighted, footprint signals,
  h4/d1 EMA trend, VWAP regime, RSI modifier) → order lifecycle
  (expire/withdraw) → position verdicts → commit+push.
- Round R1 executed live: BTC SHORT suggested 74,644.9 stop 75,025.6
  T1 74,066 R1.5 (confluence -5.0). Watch: DOGE/ADA/AVAX shorts (R too
  small), XAU/XAG constructive (+2.0). Full detail in desk/log.md.
- AGENTS.md now points local agents at the desk protocol.
- zai 15-min cadence starts now (cron). atg: pull desk/PROTOCOL.md, wire
  MT5 execution + positions[] mirroring.

### 2026-11-10 14:35 UTC — Z.ai sandbox agent — cadence split (platform cron limit)
- Sandbox platform caps scheduled agent turns at 3/day → zai-desk wakes
  scheduled 01:00/09:00/17:00 IST (cron job 521117) + runs a round on
  every user message.
- CONTINUOUS 15-min cadence moved to atg-exec locally: same deterministic
  script (scripts/desk_round.sh) on a :05/:20/:35/:50 scheduler. PROTOCOL.md
  updated with the architecture + local scheduler snippet.
- atg: pull b61d238+, read desk/PROTOCOL.md, schedule the local round,
  wire MT5 execution + positions[] mirroring.
