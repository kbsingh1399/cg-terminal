# CHECKLIST-360 · Master checklist for a 360° deep-research run

v1.4 · 2026-11-10 20:30 UTC · owner: zai-desk · engine: v3.2 (deepscan v3.3 symbols) · review: after every 10 runs or on data-source change

**360° = all 12 assets × 8 dimensions × every data point the terminal exposes,
ending in a fully constructed limit-trade list where EVERY tab carries a verdict
(✓/✗/○) and a WRITTEN justification tied to the trade's levels, plus a
"WHY THIS TRADE" narrative — no data point may be silently dropped, no
number may go unexplained (user mandate 2026-11-10, reinforced 18:55 UTC).**
Universe (14, v1.4): BTC · ETH · SOL† · BNB† · XRP · ADA · AVAX† · DOGE · LINK · LTC · XLM · XMR · XAU · XAG († NOT LISTED on FundedNext — perp-side watchlist only, always PARKED-not-listed)
Report per asset: `desk/deepscan/<SYM>-<YYYYMMDD-HHMM>.md`

---

## A · One-liner triggers (chat or `desk/inbox/WAKEUP.md` queue)

| Type this | What happens |
|---|---|
| `360 all` | **Full 360° — all 12 assets**: 8-section report each + §9 limit-trade candidates + evidence manifests + ranked digest with the complete trade list (PLACEABLE / PARKED / REJECTED / NO-TRADE, reasons printed) |
| `360 top` | Top-3 assets by \|confluence score\| (from state.json) |
| `360 BTC ETH XAU` | Named subset only |

- Typed **in chat** → instant desk wake → run starts immediately (preferred).
- Written in **WAKEUP.md queue** → runs on next wake (cron 3×/day or next chat message).
- Raw command (desk/atg shell): `python3 scripts/desk_deepscan.py [SYMS\|all\|--top N] [--dry-run]`
  (`--dry-run` = report written but NOT committed → **sandbox recycling deletes it** — use only for debugging).

## B · Preflight (before running — desk)

- [ ] `git pull --rebase` — sync daemon pushes (45s poll, 300s mt5 push)
- [ ] Terminal server health: `curl -s -m 3 localhost:3000/api/cg/market?sym=BTC` → HTTP 200
      (sandbox: dev server `npm run dev` — hot-reloads src/lib/cg/assets.ts; start-server.mjs + `.next/standalone`
      applies to the production box only. Record which terminal served the run.)
- [ ] `desk/mt5.json` fresh (< 5 min old) — broker basis/spread/exposure sections depend on it
- [ ] Note `state.json → analysis.last_round` + watchlist (for `360 top` ranking and cross-checks)
- [ ] Check WAKEUP.md queue for URGENT items that outrank the scan

## C · Run

- [ ] Execute trigger / command; expect per-symbol stdout: `=== SYM → path (N lines, all sources OK | k gap(s))`
- [ ] Any endpoint gap → re-run that one symbol once; persistent gap stays visible in the report header (`data gaps:`)
- [ ] 14-asset full run ≈ 2.5-4.5 min (10 endpoints per asset, up to 90s timeout each); unknown
      symbols now HARD-ERROR (staging gate = DECS entry; legacy silent BTC fallback removed)

## D · Per-asset review — the 8 sections every report contains

- [ ] **1 Trend & regime** — EMA stack (e13/e89/e233) + RSI on m15/h1/h4/d1 · VWAP z-score (premium/discount) · day & month POC/VAH/VAL → pick template: trend-pullback vs mean-revert
- [ ] **2 Candle history + footprint forensics** — last 16 m15 bars (O/H/L/C, Δ, vol, bar-POC, CPR) · net Δ 6h/24h · absorption / exhaustion events (12h) · Δ-divergence · bar-POC migration (bp/bar)
- [ ] **3 Order flow** — perp/spot CVD + quadrant · taker-buy % · latest CVD div freshness · typed micro-events 24h (abs/trap/exh/div/sdiv)
- [ ] **4 Positioning** — funding per venue + OI-weighted (crowded longs/shorts = squeeze fuel) · OI Δ1h/Δ24h · OI×price read (forced liquidation vs fresh positioning)
- [ ] **5 Liquidity map** — magnets above/below (str, $ est) · squeeze-fuel ratio · whale walls ≥$5M within ±4% · book ±5% imbalance · stopmap heat (BTC only)
- [ ] **6 News & notifications** — 24h items that could invalidate the technical read
- [ ] **7 Broker state** — basis/spread → TRADEABLE or BLOCKED · live positions + pending orders on the symbol
- [ ] **8 Synthesis** — 8-dimension scorecard (bias / h4 EMA / d1 EMA / CVD / footprint Δ24h / signals / funding / OI×price) → **bias** (net ≥3 votes) or **NO-TRADE** + attack zone + magnet targets
- [ ] **9 Limit-trade candidates** — full construction per asset: entry zone confluence (day POC / VWAP±1σ / VAH-VAL), structural stop (VWAP±2σ, extended past str≥40 opposing magnet), targets (str≥40 magnets, R≥2.0 gate), size from broker spec (0.5% equity mandate — flag min-lot violations), broker translation (`mt5Level = perpLevel×(1+basis/100)`, SHORT SL on ASK), status PLACEABLE / PARKED (broker) / REJECTED (geometry, reason printed)
- [ ] **9 WHY THIS TRADE** — written narrative per constructed candidate: Thesis (scorecard + Δ + CVD) · Entry (why this confluence, distance from spot) · Stop (why beyond this band/magnet, what invalidates vs noise) · Targets (why these magnet clusters) · Size · Invalidation (Δ-div, funding/squeeze fuel, correlation cap). Explain — never just tabulate.
- [ ] **9 Evidence manifest** — EVERY fetched tab appears with reading + verdict (✓ supports / ✗ opposes / ○ neutral) + written justification tied to THIS trade's levels (market·EMA/RSI/VWAP · auction day+month · footprint Δ/events/Δdiv/POC-migr · cvd+div · signals · funding · oi · liq·magnets/squeeze · lto·walls · bookwalls · stopmap (n/a marked for non-BTC) · news · broker) — including for NO-TRADE / REJECTED / PARKED outcomes. Opposing data (✗) is printed just as prominently as supporting data

## E · Cross-asset synthesis (desk layer, after all reports exist)

- [ ] Rank all assets: scorecard margin × data quality × broker tradeability
- [ ] Correlation check — most crypto assets are one BTC trade; don't stack correlated positions beyond risk budget
- [ ] Cross-check vs 15-min round engine (state.json watchlist); deepscan is the richer layer (fp forensics + funding/OI the rounds lack) — flag any disagreement and say which is fresher
- [ ] Blocked-assets list with recovery condition (feed dead / spread / basis)
- [ ] Open-position / pending-order impact: does any finding change management of live tickets (ladder, SL, expiry)?

## F · Gates — before any trade idea leaves the desk (engine v3.2 rules)

- [ ] Confluence \|score\| ≥ 3.0 AND debate FOR ≥ 3 / FOR > AGAINST
- [ ] R → T1 ≥ 2.0; target is a magnet str ≥ 40 or structural (VAH/VAL/wall/POC)
- [ ] Broker TRADEABLE: \|basis\| ≤ 0.5% AND spread ≤ 0.15% — else the idea is PARKED, not pitched
- [ ] Risk 0.5% equity per trade · max 4 concurrent positions
- [ ] Order construction via round engine (`scripts/desk_round.sh`) — applies debate gates + broker translation
      `mt5Level = perpLevel × (1 + basisPct/100)` · SHORT SL triggers on ASK · user places manually in MT5

## G · Delivery

- [ ] Reports **committed + pushed** (script auto-commits; if push loses the daemon race → `pull --rebase`, on `log.md` conflict keep BOTH records timestamp-ordered, rebase --continue, push)
- [ ] `log.md` DEEPSCAN entry exists (auto)
- [ ] **DIGEST with justification (auto)** — `desk_deepscan.py` now writes `DIGEST-<ts>.md` itself: complete trade list (PLACEABLE/PARKED/REJECTED/NO-TRADE tables) **plus a "Why each trade" block per asset** (thesis / entry / stop / targets / size / invalidation); blocked + rejected assets carry reason → recovery condition
- [ ] Chat digest: **the complete trade list** (PLACEABLE with levels+size+why / PARKED with blocker / REJECTED with reason / NO-TRADE) + correlation warning + data gaps — the user must see every potential trade WITH its reasoning in chat, not just in files
- [ ] **WAKEUP.md broadcast + AGENT_TASK wake (atg local wake, auto)** — `desk_deepscan.py` appends the complete trade list (PLACEABLE with levels/size/why · PARKED with blocker+recovery · REJECTED with reason · NO-TRADE) to the DESK BROADCAST section of `desk/inbox/WAKEUP.md` (marker-scoped, latest run wins) AND drops `<ts>_AGENT_TASK-360-broadcast.json` in the same inbox — the Windows daemon's 45s poll + AGENT_TASK handler (wakeAdd + bell + fireWake) wakes atg-exec locally (user directive 2026-11-11: "are you pushing all such reply to wakeup.md — it will automatically wake up antigravity"). No hand-editing of the broadcast section.
- [ ] Actionable setup → full level plan (entry/SL/TP perp AND broker levels, size, ladder) → user decides
- [ ] Nothing left uncommitted — uncommitted files die with the sandbox (lesson: ETH-20261110-1827.md lost to recycling)

## H · Honesty rules (fixed footer in every report)

- Liq clusters, whale walls, stopmap, squeeze fuel = **Coinglass estimates**, not facts
- Footprint volumes = 4-venue perp aggregates (XAU/XAG venues may differ)
- No number without a live API pull behind it; stale (>5 min) or missing data is marked, never guessed
- NO-TRADE is a valid, expected verdict — the scan serves the playbook, not the urge to trade

## I · Changelog

- v1.3 · 2026-11-11 — **broadcast + auto-digest implemented in code** (was checklist-only in v1.2): `desk_deepscan.py` builds a machine trade-card per asset → auto-writes `DIGEST-<ts>.md` (trade tables + "Why each trade" justification blocks + reason→recovery for every non-trade) → refreshes the DESK BROADCAST section in `desk/inbox/WAKEUP.md` and drops an AGENT_TASK json so atg-exec auto-wakes locally on its 45s poll (bell + fireWake). First wired run: 360 all 19:1x UTC 2026-11-10.
- v1.2 · 2026-11-10 — v3 justification layer: §9 now emits "WHY THIS TRADE" narrative + evidence manifest upgraded to reading/verdict(✓✗○)/written-justification per tab (opposing data flagged as prominently as supporting). Delivery upgraded: every 360 digest also lands as a WAKE.md beacon section so atg-exec wakes locally on the 45s poll.
- v1.1 · 2026-11-10 — §9 limit-trade construction + evidence manifest added to every report; `360 all` now prints the complete trade list (user mandate: all potential limit trades, proper justification across all tabs, no data missed). First v2 run: 12× desk/deepscan/*-1848.md + DIGEST-20261110-1848.md (2 PLACEABLE, 4 PARKED, 5 REJECTED, 1 NO-TRADE; XAG min-lot risk mandate violation caught).
- v1.0 · 2026-11-10 — initial, post playbook-audit DIALOG; pipeline validated end-to-end (BTC desk runs 18:28/18:33, BTC atg-exec run 18:35, ETH desk run 18:36 incl. daemon log.md race resolution)
