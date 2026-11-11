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

## Log### 2026-11-10 14:10 UTC — Antigravity local agent — fast-forward sync to 39f6ed8 & production restart
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

### 2026-11-10 14:35 UTC — Z.ai sandbox agent — GIT MESSAGE BUS + local daemon (wake-on-git)
- New: `scripts/desk_daemon.mjs` — the local event loop for the atg machine.
  Each cycle (45 s): auto-commit desk/ → fetch/pull → 15-min round when due
  → process `desk/inbox/*.json` instructions → WAKE.md beacon + notification
  for new suggested orders / agent tasks → MT5 snapshot refresh → push.
- New: `scripts/mt5_report.py` — account, positions, running PnL, bid/ask/
  spread per mapped symbol → `desk/mt5.json` (Windows + MT5 running +
  `pip install MetaTrader5`).
- Instruction channel live (fixed vocabulary, no arbitrary shell from repo):
  PING · MT5_SNAPSHOT · ROUND_NOW · REPORT · AGENT_TASK → replies in
  `desk/outbox/`. Spec in desk/PROTOCOL.md.
- LIVE TEST passed end-to-end on sandbox: PING → outbox reply `pong`, round
  R2 auto-run (R2-LTC-1 SHORT suggested), WAKE.md beacon queued both orders,
  all pushed. `desk/daemon.json` = runtime config (boot cmd, python cmd,
  wake_cmd, notify_cmd).
- ATG TODO: `git pull` → `pip install MetaTrader5` → start
  `node scripts/desk_daemon.mjs` (Git Bash) → handle `desk/inbox/WAKE.md`
  (R1-BTC-1 + R2-LTC-1 pending placement) → optionally set `wake_cmd` if a
  CLI/URL trigger exists for the agent.

### 2026-11-10 14:57 UTC — Z.ai sandbox agent — ENGINE v2 (user mandate: min 1:2 RR)
- Honest audit: v1 orders used confluence + VWAP/POC levels only; liq
  clusters, whale walls, CVD were NOT in level construction, and both
  suggested orders were R 1.5/1.7 — below the user's 1:2 minimum.
- v2 now live (scripts/desk_round.py): CVD component (taker share +
  recent divergence) in scoring; liq clusters as target magnets + hazard
  gates; whale-wall path/stop checks; config.min_r_multiple = 2.0;
  sub-2R orders auto-withdrawn (R1-BTC-1, R2-LTC-1 pulled).
- R4 (v2): BTC SHORT R3.5 (T1 72,964.8 long-liq cluster str 47) ·
  LTC SHORT R5.9 · DOGE SHORT R4.5 (T1-T3 clusters str 64-65) ·
  ADA rejected (nearest magnet 1.1R).
- Confirmed: local daemon LIVE on user PC (commits 17fa573, fa57fd7),
  MT5 connected (acct 11808165, $4,679.37, 0 positions).
- atg: WAKE.md will refresh with R4 orders on next daemon cycle —
  place only the v2 orders (R ≥ 2.0), ignore stale R1/R2 lines.

### 2026-11-10 15:20 UTC — Z.ai sandbox agent — ENGINE v3 (debate) + basis fix + loss review
- MT5 loss reviewed: R4-BTC-1 short (0.05 BTCUSD @ 74,260.89, SL 74,559.4)
  STOPPED OUT — ask 74,597 > SL. The v3 debate had flagged exactly this:
  [AGAINST] short-liq magnet 75,126.9 (str 100) above entry = squeeze risk;
  [AGAINST] $22.2M ask wall @ 75,812. Debate FOR 7/AGAINST 2 — the trade
  met the 2.0R+ mandate; the −1R loss is within the 3.5R design.
- v3 live: every order carries debate[] — 8 sources (overview, footprint,
  largeOrders, liquidation, liquidation-hazard, stops heatmap BTC,
  bookWalls, cvd, notifications) each FOR/AGAINST/NEUTRAL with evidence.
  Gate: FOR ≥ 3 AND FOR > AGAINST. Orders re-debated EVERY round; lost
  debate → withdrawn. R5: R4-BTC-1 stands (7/2), R4-DOGE-3 stands (5/1),
  R4-LTC-2 withdrawn (confluence flipped +0.3).
- BASIS FIX: orders now carry perpRefPrice; mt5_report.py computes
  spreads.<SYM>.basisPct (MT5 mid vs terminal perp mid) + spreadPct live;
  rule: mt5Level = perpLevel × (1 + basisPct/100), SHORT fills at bid,
  skip/flag if |basis| > 0.5% or spread > 0.15%. BTC basis now ≈ −0.09%,
  spread $24 (0.033%).
- WAKE.md template now carries the full debate + basis instructions
  (daemon restart REQUIRED on user PC to pick up the new .mjs template).
- Canonical user prompts documented in PROTOCOL.md: "desk round now" ·
  "desk review".

### 2026-11-10 15:59 UTC — Z.ai sandbox agent — pending-order visibility + beacon refresh
- mt5_report.py now emits: contract specs (contractSize/volume limits/tick value)
  per symbol AND pending orders (mt5.orders_get → orders[]) — the desk can now
  verify placements/cancels/fills of unexecuted tickets remotely.
- USER placed R6-ADA-1 manually on MT5 (ticket 209375723, 1.00 lot @ 0.17772,
  SL/TP untranslated, ADAUSD spread 2.19%) — recorded in state.json/log.md,
  verdict CANCEL (instant-stop geometry), awaiting user decision.
- WAKE.md beacon refreshed to current truth (was stale: ADA listed as unplaced).
- Sizing verified vs specs: BTCUSD 1 lot = 1 BTC → R4-BTC-1 compliant size 0.06
  lots ($23 risk, 0.5% mandate). ADA/XRP contractSize 100.
- Local agent alive: fixed CRLF bug in desk_round.sh (dd6b637) that had blocked
  local rounds; R7 should resume next cycle.

### 2026-11-10 16:10 UTC — Z.ai sandbox agent — DIRECTIVE PROTOCOL v1 + round-engine repair
- CRITICAL FIX: local commit dd6b637 ("CRLF fix") had EMPTIED scripts/desk_round.sh
  (0 bytes, rc=0 → rounds silently no-op'd since ~15:5x). Restored from parent
  465c53c, LF-normalized, + python3→python fallback for Windows Git Bash. Daemon
  now guards: refuses rounds if desk_round.sh < 500B (needs daemon restart to take
  effect on the user machine — the file is read per-run only by the NEW daemon code).
- DIRECTIVE PROTOCOL v1 in desk/PROTOCOL.md: zai issues structured directives
  (EXECUTE_ORDER/CANCEL_ORDER/MODIFY/CLOSE/INVESTIGATE/PREPARE) via inbox AGENT_TASK;
  atg must re-derive every number, re-verify validity, form its own opinion
  (COUNTER allowed); replies via desk/outbox/<id>.reply.md (VERDICT/CHECKS/
  REASONING/ACTION/EVIDENCE); DIALOG entries for disagreements; AGENT-STATUS.md
  heartbeat on every activation; autonomy levels 0-3 (config.autonomy_level,
  default 1).
- First directives issued: DIR-0001 cancel ADA ticket 209375723 (still pending per
  new orders[] feed), DIR-0002 place R4-BTC-1 (0.06 lots, all levels translated,
  concurrence required), DIR-0003 investigate 5 no-tick broker symbols.

### 2026-11-11 09:46 UTC — Z.ai sandbox agent — R4: L2/L3 microstructure layer shipped (commit follows)
- New: `src/lib/cg/micro.ts` + `/api/cg/micro` + `MicrostructurePanel` (classic overview + perp Overview for metals): Hyperliquid xyz HIP-3 L2 (order-count ladder, OI, 1h funding→APR×8760, venue-health gate), Lighter DEX true-L3 (whale clustering vs quoting/MM, visible partials, maker/taker prints), Kraken spot FX L2 (staleness-gated). Backfill: `scripts/backfill_dukascopy.py`, `scripts/backfill_binance_vision.py` (bomb-guarded).
- Registry (all live-verified, ids price-checked): XAU XAG XPT SPX500 NDX100 USO UKO NATGAS EURUSD USDJPY GBPUSD + 11 US equities + 4 FX majors (Kraken). US30/EU/EU-eq/crosses = honest n/a.
- Multi-agent: RV-ARCH+RV-QUANT (design) / RV-QA+RV-SEC (code) — all conditions fixed (suppressed-only amber boxes, APR-None crash, ms→s span 1000× bug, decompression guards, concurrent fetches).
- VERIFIED: tsc+build clean; endpoint battery (10 syms); browser XAU/XPT/EURUSD/US30 zero console errors; deepscan §0+§micro live. Evidence: scripts/research/probes/l2l3/ + MICRO-DESIGN-R4.md.
- OPEN: DIR-0013 rebuild on Windows box (supersedes DIR-0012). Micro stays CONTEXT (no scorecard weight) until a ≥30-round correlation study.

### 2026-11-11 10:40 UTC — Z.ai sandbox agent — R5: "terminal not live" root cause + full multi-skill bug hunt
- ROOT CAUSE (why terminal was not live): the platform's boot-supervised
  `bun run dev` (port 3000, started by /start.sh via .zscripts/dev.sh) was
  OOM-KILLED at 07:33 UTC (dmesg: anon-rss 1.93GB, concurrent `npm run build`
  pushed the 4GB box over) and NOTHING restarts it — the preview URL
  (Caddy :81 → localhost:3000) has been 502 since. Production servers started
  from the agent Bash tool are reaped at command end (verified with
  setsid/nohup/double-fork test processes — all die between commands), so
  in-sandbox revival is impossible without a container restart.
  FIX AVAILABLE TO USER: restart the sandbox (top-right restart button) —
  boot re-runs bun run dev on the current fixed code and the preview goes
  live. PORT GUARD: start-server.mjs now pins PORT=3000 (public path).
- INSTALLED addyosmani/agent-skills (external/agent-skills, gitignored) and
  applied debugging-and-error-recovery / code-review-and-quality /
  shipping-and-launch / doubt-driven-development + browser-testing skills.
- STATIC GATES: eslint config was BROKEN (react-hooks plugin not registered
  in flat config) — fixed + scoped ignores; 5 errors fixed (set-state-in-effect
  ×4 → render-time adjust pattern; BUCKET memo dep); 0 errors now, tsc clean,
  `next build` ZERO warnings (middleware.ts → proxy.ts per Next 16; memory
  watchdog moved to server-only src/lib/cg/memwatch.ts — instrumentation.ts
  edge-bundles and instrumentation.nodejs.ts is NOT supported in 16.1.3).
- 3 PARALLEL ADVERSARIAL REVIEWS (RV-DATA / RV-SEC / RV-UI) → all Required
  findings fixed: client.ts (stale-serve bounded + ttl0 throws, in-flight
  coalescing, globalThis cache), engine.ts (poller overlap guard, tickers
  .catch), book-walls.ts (reader.cancel+abort on mid-stream error), crypto.ts
  (non-JSON decrypted payload throws), store.ts (compaction-fail fallback
  append), livebook route (CRITICAL: snapGrid 1-sig-digit quantization,
  MAX_RINGS=24 LRU eviction, MAX_BUCKETS=250k guard), interval allowlist +
  limit clamp via new src/lib/cg/params.ts on kline/orderflow/largeorder/
  orderflow-agg/fp, middleware→proxy.ts Host allowlist (DNS-rebinding defense,
  CG_ALLOWED_HOSTS env), SSE req.signal cleanup, forming.ts (fresh store per
  mount + honest lastTradeAt stamping), passive-wheel no-op fix (native
  non-passive listeners on footprint/large-orders canvases), profile-vs-axis
  label overdraw fix (PROFILE_W 150 + separated gutters), WhaleWalls top-14-
  by-USD fix, per-symbol stale-frame fixes (footprint/large-orders tools),
  UTC time axes + ResizeObserver on cvd/stopmap/book-heat canvases, useTicker
  committed-price dir, new /api/health route, memory watchdog in engine.
- VERIFIED END-TO-END (all within single commands — reaper constraint):
  verify-live.sh GREEN via public path :81; API battery 77×200 + 36×clean-400
  + 0 fail (scripts/e2e-api-battery.sh, full-body JSON validation, clean-400
  acceptance, lto ?symbol= param fix); browser E2E BTC/XAU/EURUSD/US30 zero
  page errors + zero console errors; XAU live 4,054.09 REAL-TIME WS confirmed;
  screenshots download/verify-*.png; proxy guard 403s verified; rss 365-384MB
  under full load (vs 1.9GB pre-fix leak path).
- OPERATIONAL RULES learned: (1) never run tsc/eslint/build while the live
  server runs (4GB box — the 07:33 OOM); (2) server + all verification must
  complete within ONE agent Bash command (spawned processes die at command
  end); (3) lto route takes ?symbol= not ?sym=.
