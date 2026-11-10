# CHECKLIST-360 · Master checklist for a 360° deep-research run

v1.0 · 2026-11-10 · owner: zai-desk · engine: v3.2 · review: after every 10 runs or on data-source change

**360° = all 12 assets × 8 dimensions × every data point the terminal exposes.**
Universe: BTC · ETH · SOL · BNB · XRP · ADA · AVAX · DOGE · LINK · LTC · XAU · XAG
Report per asset: `desk/deepscan/<SYM>-<YYYYMMDD-HHMM>.md`

---

## A · One-liner triggers (chat or `desk/inbox/WAKEUP.md` queue)

| Type this | What happens |
|---|---|
| `360 all` | **Full 360° — all 12 assets**, one report each, ranked digest |
| `360 top` | Top-3 assets by \|confluence score\| (from state.json) |
| `360 BTC ETH XAU` | Named subset only |

- Typed **in chat** → instant desk wake → run starts immediately (preferred).
- Written in **WAKEUP.md queue** → runs on next wake (cron 3×/day or next chat message).
- Raw command (desk/atg shell): `python3 scripts/desk_deepscan.py [SYMS\|all\|--top N] [--dry-run]`
  (`--dry-run` = report written but NOT committed → **sandbox recycling deletes it** — use only for debugging).

## B · Preflight (before running — desk)

- [ ] `git pull --rebase` — sync daemon pushes (45s poll, 300s mt5 push)
- [ ] Terminal server health: `curl -s -m 3 localhost:3000/api/cg/market?sym=BTC` → HTTP 200
      (if down: `node scripts/start-server.mjs` from repo root, wait for 200; needs `.next/standalone`)
- [ ] `desk/mt5.json` fresh (< 5 min old) — broker basis/spread/exposure sections depend on it
- [ ] Note `state.json → analysis.last_round` + watchlist (for `360 top` ranking and cross-checks)
- [ ] Check WAKEUP.md queue for URGENT items that outrank the scan

## C · Run

- [ ] Execute trigger / command; expect per-symbol stdout: `=== SYM → path (N lines, all sources OK | k gap(s))`
- [ ] Any endpoint gap → re-run that one symbol once; persistent gap stays visible in the report header (`data gaps:`)
- [ ] 12-asset full run ≈ 2-4 min (10 endpoints per asset, up to 90s timeout each)

## D · Per-asset review — the 8 sections every report contains

- [ ] **1 Trend & regime** — EMA stack (e13/e89/e233) + RSI on m15/h1/h4/d1 · VWAP z-score (premium/discount) · day & month POC/VAH/VAL → pick template: trend-pullback vs mean-revert
- [ ] **2 Candle history + footprint forensics** — last 16 m15 bars (O/H/L/C, Δ, vol, bar-POC, CPR) · net Δ 6h/24h · absorption / exhaustion events (12h) · Δ-divergence · bar-POC migration (bp/bar)
- [ ] **3 Order flow** — perp/spot CVD + quadrant · taker-buy % · latest CVD div freshness · typed micro-events 24h (abs/trap/exh/div/sdiv)
- [ ] **4 Positioning** — funding per venue + OI-weighted (crowded longs/shorts = squeeze fuel) · OI Δ1h/Δ24h · OI×price read (forced liquidation vs fresh positioning)
- [ ] **5 Liquidity map** — magnets above/below (str, $ est) · squeeze-fuel ratio · whale walls ≥$5M within ±4% · book ±5% imbalance · stopmap heat (BTC only)
- [ ] **6 News & notifications** — 24h items that could invalidate the technical read
- [ ] **7 Broker state** — basis/spread → TRADEABLE or BLOCKED · live positions + pending orders on the symbol
- [ ] **8 Synthesis** — 8-dimension scorecard (bias / h4 EMA / d1 EMA / CVD / footprint Δ24h / signals / funding / OI×price) → **bias** (net ≥3 votes) or **NO-TRADE** + attack zone + magnet targets

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
- [ ] Chat digest: ranked table (asset · bias · conviction · tradeable?) + top setup details + blocked list + data gaps
- [ ] Actionable setup → full level plan (entry/SL/TP perp AND broker levels, size, ladder) → user decides
- [ ] Nothing left uncommitted — uncommitted files die with the sandbox (lesson: ETH-20261110-1827.md lost to recycling)

## H · Honesty rules (fixed footer in every report)

- Liq clusters, whale walls, stopmap, squeeze fuel = **Coinglass estimates**, not facts
- Footprint volumes = 4-venue perp aggregates (XAU/XAG venues may differ)
- No number without a live API pull behind it; stale (>5 min) or missing data is marked, never guessed
- NO-TRADE is a valid, expected verdict — the scan serves the playbook, not the urge to trade

## I · Changelog

- v1.0 · 2026-11-10 — initial, post playbook-audit DIALOG; pipeline validated end-to-end (BTC desk runs 18:28/18:33, BTC atg-exec run 18:35, ETH desk run 18:36 incl. daemon log.md race resolution)
