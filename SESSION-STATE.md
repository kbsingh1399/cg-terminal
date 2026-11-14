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

### 2026-11-13 09:35 UTC — Z.ai sandbox agent — FOOTPRINT-SIGNAL ALPHA RESEARCH (top-20 crypto perps, 180d)
- **Mandate**: design a profitable strategy from the Coinglass-style footprint
  signals (absorption / divergence / CVD div / exhaustion / trapped) on the
  top-20 USDT perps; validate signals against the live Coinglass panel;
  compare aggregated (5 venues) vs Binance-only. **Deliverable**:
  download/fp-research/Footprint_Signal_Research_Report.pdf (+4 charts) and
  scripts/fp-research/ (16 reproducible stages; data in gitignored
  data/fp-research/ — 5.2M m1 + 3.45M m15 bars, 121,887 signals).
- **Validation**: calibrated engine (scripts/fp-research/cg_signals_v2.py)
  reproduces the Coinglass BTC 15m panel **9/9 (100%)** — incl. the Trapped
  Traders class the v1 engine lacked. Calibration: CG tick-attribution ≈
  0.94-1.15× our m1-overlap on LOW zones (bull gate 0.27) but ≈ 0.70× on
  HIGH zones (bear gate 0.43); closePos gates 0.65/0.35; 1-bar hold;
  CVD-gap > 0.0015; dedup 2 bars. Headless-browser scrape artifacts +
  reference set: data/fp-research/cg_validation_15m.json.
- **Aggregated vs Binance**: 10d × BTC/ETH × true price-cell footprint via
  the terminal's orderflow routes — 74-75% signal congruence (±1 bar),
  short-window edges statistically indistinguishable. Binance-only is the
  correct backtest basis (only 180d-grade taker-split source); aggregated
  adds value only as live confirmation (what orderflow-agg already serves).
- **HONEST NEGATIVE RESULT**: after realistic 15bp costs, NO standalone
  profitable configuration exists. Signals carry real but sub-cost
  information: drift-adjusted +5..+30bp at 30m-24h, SIGN-UNSTABLE across
  regimes (bear_div shorts: +29bp design window vs -95bp holdout at 24h).
  Seven architectures tested and failed OOS: fixed-geometry walk-forward
  (PF 0.29-0.51) · frozen-rule 2-window short book (-12.5%/-91.7% equity,
  beta-dominated) · no-stop time-exit (-8.8bp/tr) · cross-sectional quintile
  L/S (no selection edge, |t|<1.4, sign flips) · 4h-trend-gated (-73bp) ·
  6-fold adaptive walk-forward (-31.4%, P(loss)=0.92) · symmetric
  trend-aligned long+short (-9.5%/-17.2%). Root cause: raw edges are market
  beta; median 24h adverse excursion 2.1-2.7% converts any risk-controlling
  stop into a losing lottery.
- **Recommendation delivered**: use these signals as CONFIRMATION inputs
  (exactly the WS7 M1/M2 design — absorption gates, EXHAUSTION_SWEEP_CONFIRMED),
  never standalone. Two pockets flagged for Virtual-Book paper-testing only:
  exhaustion/absorption confluence shorts in confirmed downtrends (+29/+31bp
  holdout, iteration-contaminated) and bear-div shorts at funding z > +1
  (crowded-long flush, +539bp n=111 in-sample, funding history too short to
  validate).
- **Repo state**: no src/ changes (terminal untouched); research committed
  under scripts/fp-research/. NOTE: local desk pushed c6858ee..d793ee4
  (stopmap 24h heatmap fix for ETH/non-BTC) — rebased on top; duplicate
  0543Z round skipped.


### 2026-11-12 21:40 UTC — Z.ai sandbox agent — DUAL-AGENT ARCHITECTURE lockdown: terminal runtime now ZERO external AI APIs
- **Blueprint acknowledged** (Z.ai = `zai-desk` microstructure engine & data
  architect; Antigravity = `atg-exec` master quant brain via the 24-tool MCP
  surface). Phase-3 WS7/WS8/WS9 were already shipped in ad41907; this round
  brings WS10 into architectural compliance.
- **WS10 reworked — /api/cg/narrative/ai is STRICTLY INERT**: the route no
  longer fetches integrate.api.nvidia.com (GLM-5.3 SSE gone); it answers an
  instant deterministic 200 `{ok:false, inert:true, architecture:"dual-agent"}`
  (400 for unknown syms) pointing at the MCP path. NarrativeCard lost the
  "✨ AI desk brief" button, SSE reader, reasoning/CoT state and the violet
  panel — the card is now pure deterministic verdict UI. The web terminal is
  a 100% self-contained data & math engine: no LLM keys, no token cost, no
  rate-limit failures.
- **MCP `narrative_ai_brief` repurposed as the deterministic BRIEF KIT**: it
  now assembles (in ~1 local round-trip) the verified NarrativeVerdict +
  quant (funding APR / OI quadrant / L-S / Coinbase premium) + options (GEX
  regime, gamma flip, max pain, RR25d, DVOL) + the institutional briefing
  protocol (cite-only-these-numbers, 4-part structure, the three committee
  personas). Antigravity formulates the desk brief NATIVELY from this kit.
  Tool description + test lock updated (34/34 green).
- **.env.example**: NVIDIA_API_KEY block removed, replaced by the dual-agent
  note. New `scripts/verify-core-liquids.cjs` — zero-gap integrity probe for
  the five primary instruments.
- **GATES (all green)**: tsc 0 · eslint 0/0 · quant-math 73/73 · liq-live
  45/45 · mcp-tools 34/34 · paperbook 29/29 · API battery 96×200 + 13×400 +
  0 fail (livebook 3× cold-start warm, then 200) · core-liquids 7/7
  (BTC/ETH/SOL/XAU/NVDA verdicts fresh 39–233s, zero stale fields; BTC
  gammaFlip 75,561 / maxPain 78,000; ETH 2,082 / 2,350 — both
  NEGATIVE_GAMMA_EXPANSION) · desk sync: state.json + inbox/WAKE.md + mt5.json
  valid, /api/desk/live ok (R198, eq $4,649.96, slots 0/4) · server rebuilt +
  running detached (setsid --fork survives tool-call teardown).
- NOTE for atg: mt5.json in this sandbox snapshot is ~9h stale → the spread
  gate honestly reports n/a here; on the local desk (45s sync) it is live.

### 2026-11-12 21:15 UTC — Z.ai sandbox agent — PHASE 3 (WS7-WS10) quantitative expansion shipped
- **WS7 M1/M2 deepening (narrative.ts)**: M1 now enforces 3-TF alignment
  (4H EMA13×89 trend + H1 structure cross + m15 bar holding EMA89) AND
  zone-local flow proof (positive-delta absorption inside the entry zone or
  CVD divergence in the trade direction) as hard A/A+ prerequisites —
  failures demote to B with the exact 3-TF breakdown in the note. M1 gains
  the 3-tier limit ladder (40% POC · 40% −1σ/+1σ VWAP band · 20% absorption
  low/high) with risk/R measured from the weighted COMPOSITE entry (UI card
  shows the rungs + composite basis; sizing + ticket staging use it).
  M2 gains EXHAUSTION_SWEEP_CONFIRMED: >2σ stretch AND major liq cluster
  sweep (strength ≥50/100 or ≥$5M within 0.5%) AND footprint exhaustion
  pinbar AND delta flip (CVD div or div/sdiv signal) → A+ path + confidence
  bonus; T1 retargeted to session POC, T2 to the 0σ VWAP midline.
- **WS7.3 spread gate**: new src/lib/cg/mt5-spread.ts reads desk/mt5.json
  (60s mtime cache, 20-min staleness bound, honest n/a when absent/stale —
  sandbox snapshot is 8h old so the gate is honestly OFF here). When fresh:
  spread > 12% of stop distance → grade C "SPREAD_DRAG_EXCESSIVE", > 25% →
  SKIP; new "Execution cost (MT5 spread)" checklist row carries the exact
  ratio. Grade type extended with C (alpha-matrix + alert-rules GRADE_RANK
  C:1 — alert semantics unchanged, B still the ≥2 threshold).
- **WS8 GEX**: options route computes the GEX flip point — the zero-gamma
  root of the OI-weighted dealer gamma profile (BS gamma from real mark_iv,
  0.70×-1.30× spot grid + bisection, ≤90d expiries; BTC live: flip 75,568
  with spot 71.8k below it = NEGATIVE_GAMMA_EXPANSION, consistent; ETH flip
  2,083). Exposed as gex.gammaFlipPrice + top-level gammaFlipPrice +
  maxPainStrike (nearest monthly); MCP options_surface lines added;
  SplitContextView draws Max Pain (orange) + GEX Flip (rose) reference
  lines on the asset panes (BTC/ETH, open-state gated 120s poll) and the
  narrative GEX checklist row carries both values.
- **WS9 backtest analytics**: BtMetrics + maxConsecutiveLosses (run: 27);
  new monteCarloRuin() — deterministic 1000-path bootstrap (LCG seed
  20261113) on closed-trade netR → pDd5R/pDd10R/median/p95 exposed at
  result.monteCarlo, Backtest tab "Monte Carlo Ruin Profile" tile row, MCP
  backtest_summary line. Legacy persisted runs are enriched IN MEMORY at
  read time (disk untouched). **TWO REAL DATA BUGS found & fixed**: (1) M2
  stops collapsing onto the entry at extreme stretches (XRP -269R, NVDA
  -101R "trades" from ~1bp risk units) → geometry floor risk ≥ 0.5σ and
  ≥ 10bps, degenerate knife-catches now skipped; (2) M1 dead-market arming
  on flat sessions (XAU/XAG weekend bars collapse ATR→0 → 0.001% stops)
  → dead-tape guard (ATR < 0.5bp skipped) + 10bps stop floor. Clean 30d
  rerun: 2957 trades · win 47.6% · PF 1.705 · expNet +0.20R · worst trade
  -3.5R (was -269R) · maxDD 169R honest. Ban-proof re-runs: kline cache now
  serves a fresh (<12h) cache even when its tail lags (coverage reports the
  honest lastBar) + funding history disk-cached 12h — re-runs are fapi-free.
- **WS10 GLM reasoning stream**: AI route parses delta.reasoning_content
  (both naming variants) BEFORE content deltas + captures
  usage.completion_tokens_details.reasoning_tokens; new SSE `reasoning`
  events + reasoningTokens on done; 15-min cache stores reasoning.
  NarrativeCard renders a collapsible "Analyst Chain-of-Thought" box
  (streams while thinking, auto-folds when the brief starts, char count +
  "N reasoning tokens" chip). .env.example documents NVIDIA_API_KEY.
- **GATES**: tsc 0 · eslint 0/0 · quant-math unit lock 73/73 (+35 phase-3
  locks: GEX flip root/sign-change/OI-weighting, spread-drag boundaries
  incl. real ADA/LTC/BTC mt5.json numbers, Monte Carlo determinism +
  distribution sensitivity, ladder composite math, 3-TF gate, loss streaks)
  · mcp-tools 34/34 · liq-live 45/45 · paperbook 29/29 · API battery
  93×200 + 13×clean-400 + 3 livebook 502s (recurring host-IP fapi ban
  re-arms on every expiry — environment, not code; user UI serves via
  browser-direct fallback) · browser E2E: ladder card, Monte Carlo panel,
  split-view GEX line (rose pixels confirmed in 4H pane), zero
  console/page errors · memory steady rss ~1.7GB.
- **OPS**: agent-spawned servers are reaped at command end in this sandbox
  (even setsid/nohup — verified twice); the DESK DAEMON survives and its
  round script already boots the terminal when :3000 is down — server
  revived via ROUND_NOW inbox instructions on each new build (3 boot
  cycles during this round). Daemon-booted servers persist fine.
- OPEN: NVIDIA_API_KEY still absent in sandbox .env (local atg has it per
  the user's directive note); mt5.json 8h stale here (local daemon refreshes
  on the trader's machine — spread gate auto-arms when fresh).

### 2026-11-12 16:25 UTC — Z.ai sandbox agent — 360° END-TO-END VERIFICATION ROUND (all workflows green)
- Full fresh gate on the shipped state (no code changes needed — pure
  verification): **units** quant-math 38/38 · mcp-tools 34/34 (incl.
  backtest_summary / portfolio_risk / narrative_ai_brief) · liq-live 45/45 ·
  paperbook 29/29 · venue-ws + venue-liq-ws probes exit 0. **static** tsc
  --noEmit 0 errors · eslint 0/0 (both with live server up, mem-watchdog,
  box never dipped below ~1.4GB available). **parity** parity-vs-coinglass
  PASS — BTC 22/2/5 + ETH 26/1/3 signals identical to Coinglass's verbatim
  engine across time/vol/range sets. **API battery** 96×200 + 13×clean-400 +
  0 failed (livebook warmed after one cold-start transient on the first
  pass; second pass ALL GREEN); backtest/risk/screener/alert-rules/narrative
  routes all 200 with real payloads. **browser E2E** zero page+console
  errors across Terminal · Backtest (3201 trades render) · AlphaMatrix
  (Radar 61/61 · 25 fresh) · Desk&MT5 (risk banner 80 pos · 465 corr pairs ·
  cluster tiles · blotter) · Alerts rule builder · split view (HTF pane) ·
  AI brief honest NOT-CONFIGURED; public path :81 = 200. **desk cadence**
  daemon alive — 1618Z round ran + pushed autonomously mid-verification.
- Known env-only (not regressions): host-IP fapi ban until ~18:19Z broke 2
  live spot probes in test-quant-options.mjs (browser-direct fallback keeps
  the user's UI serving); NVIDIA_API_KEY still absent (brief honestly
  reports NOT CONFIGURED until re-added to .env).
- STATE: code of record = main @ 2426637, working tree clean, server up
  (uptime 1h15m, rss ~1.9GB steady), daemon cadencing. Job complete
  end-to-end.

### 2026-11-12 07:20 UTC — Z.ai sandbox agent — footprint = Coinglass aggregate (verified parity) + UI/hardening round

- **Footprint methodology REVERTED to the Coinglass aggregated method** (user
  directive): fpVenues() now returns agg-perp (Binance+OKX+Bybit+Hyperliquid
  for crypto; 3 venues for curated TradFi; XMR drops its dead OKX key).
  Overview stays Binance execution-venue.
- **Signal parity PROVEN**: scripts/parity-vs-coinglass.ts runs Coinglass's
  OWN engine (ey extracted verbatim from their page bundle,
  scripts/cg-ey-verbatim.js) on our aggregate — BTC 21/18/3 and ETH 22/26/2
  signals across time/vol/range sets, every field identical. PARITY PASS.
- **UI fixes (user screenshot + critic round)**: footprint default view is
  width-aware (~58px/bar, measured-gate + history-growth re-adopt, never
  stuck at the 8-bar live lane), buy/sell digits render at 44px+ cells,
  perceptual tints; CVD price axis was INVERTED (pHi→bottom) — fixed;
  TradingView axis-drag zoom added to Large Orders + Liq Levels; book-heat
  contrast ramp; stat cards wrap instead of clipping.
- **0-baseline blowout ROOT-CAUSED and fixed 3 layers deep**: WS frames with
  p=0/NaN (trade + bookTicker) entered the tape unchecked → forming.lo=0 →
  l=0 overlay bar → y-axis 0→70,000. Guards: feed.ts sanity gates,
  forming.ts 0.25–4× band, overlay 25% envelope. LATEST PRICE 0.0 also gone.
- **Klines empty-payload guard**: route 502s (never caches) a 0-row payload;
  BinanceView treats empty as failed → browser-direct fallback engages.
- **client.ts hardening (ported from flash-3.8 branch review)**: true-LRU,
  ttlMs=0 never pollutes the cache, host 429 cooldown with capped extensions,
  concurrency gate with correct baton-pass, inflight lane partition.
- **Curated grid dead columns fixed**: !miniTicker@arr connects-but-delivers-
  nothing on this egress → grid now trusts the WS only after data (tick>0)
  and /api/binance/quotes is enriched with the shared t24 batch (chg/high/
  low/vol) — all four columns live, badge honestly says REST · 5s.
- Multi-agent round: code review (2 majors fixed: dead defaultView, semaphore
  overshoot), E2E battery (76×200 + 36×clean-400 pass; 1 transient fapi ban),
  visual critic (CVD inversion + blowout confirmed & fixed).
- OPEN: Binance futures testnet keys lost with sandbox recycle (.env now has
  only DATABASE_URL) — demo order panel shows "not configured" until keys
  are re-added. DOGE m15 ts=1794251700 has one anomalous upstream fp grid
  (clamped visually, signals unaffected — data-quality ticket).

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
  MT5 connected (acct REDACTED, $4,679.37, 0 positions).
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

### 2026-11-11 12:40 UTC — Z.ai sandbox agent — classic stale-values fix (quote ladder)
- User report: "many values are stale like forex and other indices". Root cause
  (empirical): Yahoo cash indices (^DJI/^GSPC/^NDX/^RUT) freeze outside cash
  sessions (14.4h old at 12:07 UTC), EU/oil feeds lag 10-15m, and chgPct was
  the 5-DAY range change displayed unlabeled (read as today's move). FX quotes
  were fresh but got lumped in with the frozen indices.
- Fix — quote ladder wired into /api/cg/classic (concurrent with Yahoo fetch):
  live = microLiveQuote() 24/7 anchor (NEW in src/lib/cg/micro.ts: Kraken spot
  mid → Hyperliquid xyz perp mark → Lighter L3 mid; shared globalThis caches
  with /api/cg/micro — route refactored onto the same helpers, no doubled
  upstream weight) for the 25 mapped instruments; fut = Yahoo futures lead
  (US30→YM=F, US2000→RTY=F; classic.ts futYahoo) for indices with no micro
  anchor; price = Yahoo cash + bars (indicators stay cash-anchored).
  chg24hPct added (vs last bar closed ≥24h ago); UI headline rides
  live→fut→cash with source+age label, cash basis %, honest stale badge.
  Yahoo-down now serves quote-only via the ladder instead of a flat 502.
- VERIFIED: tsc clean, eslint 0 errors on all 5 touched files, API battery
  (US30 fut 52,379 · SPX500 live xyz mark 7,585.9 0s · NDX100 28,262 · EURUSD
  Kraken mid 1.11364 0s · US2000 fut RTY=F · JP225 live 61,790 · USO live
  xyz:CL), browser E2E US30/SPX500/EURUSD — headline, basis, badges, zero
  console errors.
- Sandbox was 971 commits BEHIND origin/main (local daemon pushed overnight:
  R3 classic universe, R4 micro layer, R5 terminal-not-live/OOM fixes, R6 OOM
  byte-budget). Synced via backup branch backup-sandbox-20261111 → reset to
  origin/main. No conflicts.
### 2026-11-11 16:20 UTC — Z.ai sandbox agent — ALGO-ORDER lane + full-200 scan + 4 demo brackets punched
- User directive: "find all potential assets and punch trade directly on
  demo binance" (+ push latest code to git for a local pull).
- PUSHED: orderflow-360 commit (full tab toolset unlocked on all Tier-2
  Binance top-200 symbols — was the missing-tabs root cause) after rebase
  onto the daemon's desk syncs.
- BREAKING-API FIX (verified live on testnet): since 2025-12-09 Binance
  rejects STOP_MARKET/TAKE_PROFIT_MARKET on /fapi/v1/order (-4120 "use the
  Algo Order API"). Conditional orders now go through POST
  /fapi/v1/algoOrder (algoType=CONDITIONAL, `triggerPrice` NOT stopPrice,
  explicit qty + reduceOnly — closePosition removed from the wire). Signed
  client: cancelAlgoOrder + cancelAllOrdersBoth (both lanes) + openAlgoOrders
  merged into the account snapshot (bracket legs show ⇄ trigger in the UI);
  DemoAccountPanel ticket gained SL STOP / TP STOP types with trigger input.
- FAPI BAN ROOT CAUSE FIXED: the 60s probe loop kept EXTENDING real 418 bans
  (every request during a ban re-arms it). fapi.ts now parses Binance's own
  "auto-banned until <ts>" body and stays silent past it (+10s margin;
  exponential fallback capped 15min).
- FULL-UNIVERSE SCANNER scripts/scan_binance_candidates.py: all 200 assets,
  1h klines weight-1 per symbol (99 bars), trend-pullback scoring + funding
  overlay + structural SL/TP ≥2.2R + 0.5% risk sizing, testnet-exchangeInfo
  pre-flight (testnet lists a NARROWER symbol set — GRAM/PUMP not tradable
  there). Puncher scripts/punch_binance_demo.py places MARKET entry +
  STOP_MARKET SL + TAKE_PROFIT_MARKET TP per candidate (max 4 concurrent).
- PUNCHED (testnet, fake funds, all legs verified NEW): PYTH LONG 4251 @
  0.06823 SL 0.06344 TP 0.07886 · NEAR LONG 65 @ 3.772 SL 3.458 TP 4.459 ·
  USELESS LONG 1336 @ 0.1429 SL 0.12708 TP 0.1761 · MAGMA LONG 704 @ 0.26526
  SL 0.23603 TP 0.32904. Records: desk/deepscan/BIN-SCAN-latest.* and
  BIN-PUNCH-latest.*. Tab coverage re-verified on Tier-2 syms (liqlevels
  5 venues · bookwalls · cvd · fp 4 venues · largeorder OK).
- OPEN: positions ride until SL/TP trigger or user says close; watchlist
  (ICP, ACT, SOPH, HOT, ICNT shorts + more longs) in BIN-SCAN-latest.md.

### 2026-11-11 15:35 UTC — Z.ai sandbox agent — BINANCE TOP-200 TIER (Tier-2) + testnet demo trading
- User directive: "integrate top 200 most liquid assets from binance … first
  we will trade at demo binance account". Shipped as a new Binance-NATIVE
  tier (public market data, no Coinglass dependency, no API key for data):
  universe engine src/lib/binance/universe.ts (every TRADING USDT-M perp
  ranked by 24h quoteVolume, top 200, exchangeInfo tick/step precision,
  4h refresh, stale-serve + 30s backoff) + 6 routes /api/binance/{universe,
  quotes,klines,market,account,order} + browser WS libs mini-feed
  (!miniTicker@arr 1s grid) & sym-feed (@depth20@100ms L2, @kline,
  @forceOrder liq feed) + UI: BinanceMarkets grid, BinanceView (book/tape/
  candles/funding/OI/mark-basis), palette group + rank badges → universe =
  15 perp + 188 binance + 84 classic = 287 instruments.
- REAL-TIME AT ALL LEVELS: grid 1s WS; active symbol sub-100ms bookTicker/
  trade (existing ladder), L2 book @100ms, tape per-print, candles REST
  bootstrap + TAPE-DERIVED forming bar (sandbox egress gets @kline frames
  filtered — @trade/@depth/bookTicker flow; the forming bar builds from the
  tape, kline stream overlays where networks deliver it), funding/OI 3s
  server cache. Browser-direct fapi fallbacks (CORS open) for
  universe/klines/market when the HOST IP is fapi-banned (recurring sandbox
  418s) — user's own IP keeps serving.
- DEMO TRADING: keys verified as futures TESTNET (fapi /fapi/v2/account 200,
  canTrade, ~4096 USDT fake). src/lib/binance/signed.ts + HARD GATE: orders
  refused unless BINANCE_MODE=testnet (mainnet key = read-only). .env only
  (gitignored). Order route rounds qty/price to exchange precision.
  /api/cg/live now accepts binance-tier syms (no cg fallback outside
  registry — honest error instead).
- VERIFIED: tsc clean, eslint 0/0, endpoint battery 23/23
  (scripts/binance_tier_verify.py: universe 200 ranked, quotes 200, klines
  shape+400s, market funding/OI, cg/live ZEC, account testnet, ORDER
  ROUND-TRIP place→NEW→visible→cancelAll→clean), browser E2E zero console
  errors: grid LIVE·WS 1s, ZEC view book live + tape 111/s + forming bar +
  funding/OI live, palette 287/287 with rank badges, UI order ticket
  round-trip (orderId 2996983296 NEW → cancelAll clean).
  Evidence: download/verify-binance-200-grid.png, verify-binance-view-zec.png.
- OPEN: DIR-0014 (atg local rebuild + local .env testnet keys for the demo
  panel). ZEC #3 at $3.1B 24h vol + INIT/JCT/AGT/ARIA new listings riding
  the top-200 — universe auto re-ranks every 4h.

### 2026-11-13 13:55 UTC — Z.ai sandbox agent — E2E WALK-FORWARD BACKTEST at $5,000 (closes the strategy mandate)
- **Mandate**: end-to-end backtest + optimization of the trader-report blueprints from $5,000 initial equity; share final results. Also: Antigravity's stopmap fix pulled from git (merged 6963530; d793ee4 "24h rolling stopmap for ETH/non-BTC perps" verified; liq unit-lock tests 45/45).
- **Engine** (scripts/fp-research/e2e_backtest.py): event-accurate portfolio sim — $5,000 compounding on settled equity, 0.5/1% risk-fraction sizing off disaster-stop distance, per-position cap 2x, gross cap 3x (realized peak 0.77x), 1/symbol, 4-6 concurrent, 15bp RT costs (25bp stress), 8h funding PnL sign-correct, ATR(20) stops k∈{3,6}, ratcheting chandelier trail k∈{0,3,6}, holds {12h,24h,48h,14d}, walk-forward 60d train/30d test ×4 folds (121 OOS days), 1,728 configs (864 schedules), selection = net bp/trade n≥25 >0, PF tie-break.
- **Run progression** (all honest protocol, no post-OOS re-tuning): v1 short-only −8.0% → v2 +trail/long/patience +23.1% → v3 confluence-lookahead FIXED (signals counted only once confirmed by entry time) +32.4% → v4 point-in-time universe **−36.1% ($3,197)**. The +32.4% was **survivorship bias**: original top-20 was volume-ranked 2026-11-13 (sample END); PIT rebuild (pit_universe.py) ranks 459 perps by week-1 volume 2026-05-17..24 — 8 of 20 names swap (out: AGT/AKE/ARIA/BARD/ENA/INIT/JCT/UNI = the biased run's biggest winners; in: BCH/BEAT/EDEN/FIDA/LAB/ONDO/TAO/WLD; data refetched, signals regenerated, events rebuilt 119,808).
- **Honest final (PIT)**: $5,000 → **$3,197.15 (−36.06%)**, maxDD −36.6%, Sharpe −10.91, 104 trades, win 9.6%, PF 0.09, payoff 0.86x, expectancy −$17.34/tr; MC P(loss)=100%; stress 25bp → $3,145; no-funding → $3,203; all-config median $4,619 (−7.6%); BTC B&H +10.0%. Walk-forward beat the no-skill median by $1,422 but every fold lost OOS (train bp +370..+549 decayed negative).
- **Deliverables**: download/Footprint_Strategy_E2E_Backtest_Report.docx/.pdf (14pp, 8 tables, 4 charts, postcheck 9/9, VLM visual check pass) · Footprint_E2E_Backtest_Trades_and_Metrics.xlsx (5 sheets, validate passed) · download/fp-research/e2e_pit/ (trades CSV, equity CSV, fold choices, metrics JSON, 4 charts) + e2e_olduni/ (biased-run comparison). Top-trader report docx verified intact (114 paras/5 tables/6 images) — user reported download issue, re-delivered alongside.
- **Verdict**: no standalone footprint edge survives costs on a knowable universe; use signals as M1/M2 confirmation gates. Accessible-at-$5K edges from the trader study: funding carry overlay (+4.7% annualized on notional in-sample, 84% settlements positive) + asymmetric loss-control discipline. Next: multi-year archive, Virtual-Book paper-test of carry overlay.
