# EXPANSION PLAN · 360° Universe Across Verified FundedNext Assets

v2.0 · 2026-11-10 21:20 UTC (T3 un-deferred by explicit user directive: "expand all the mentioned forex, indices and metals along with mentioned cryptos"; XPT/USO/UKO + 77-instrument classic universe SHIPPED — see v2 addendum at bottom) · v1.1 2026-11-10 20:30 UTC (post multi-agent review) · owner: zai-desk · method: Karpathy guidelines (assumptions surfaced, surgical changes, verifiable criteria)
inputs: user broker audit (FundedNext-Server, acct 11808165, 96 instruments) · live Coinglass web-API probe (19:55–20:00 UTC, this desk) · live Yahoo/Binance/terminal probes 2026-11-10 20:40-21:10 UTC (scripts/t3_probe_results.json) · repo source audit (`src/lib/cg/assets.ts`, `src/lib/cg/classic.ts`, `scripts/desk_deepscan.py`, `desk/state.json`)

---

## 0 · Executive summary

The FundedNext 96-instrument universe decomposes into **three data-realities**, not one:

1. **Crypto-style perps with full upstream data** — the only class our Coinglass-backed 8-dimension engine can serve natively. Verified live: **XLM (4-venue) · XMR (3-venue) · XPT (2-venue) · USO (OKX-only, thin)**.
2. **Broker-listed but zero upstream data** — **UKO** (Brent): no kline/funding/liq/CVD on any Coinglass venue. Execution-only, unscannable.
3. **Indices (14) · Forex (48) · Equities (20)** — 82 instruments Coinglass does not carry at all (it is a crypto derivatives aggregator). The current scorecard's funding/OI/liquidation-magnet/CVD dimensions **do not exist** for these classes.

Therefore the architecture is **tiered, data-gated onboarding** — broker listing alone never adds an asset to the deepscan; upstream data coverage does. This is the anti-over-engineering line: we do not build a 96-asset scanner for 14 scannable assets.

**Broker-mapping fixes shipped this run** (the old "feed dead" blocker, solved): `DOGE → DOGUSD`, `LINK → LNKUSD`; `SOL/BNB/AVAX` reclassified **NOT LISTED** (perp-side watchlist only — no execution path at this broker, ever).

---

## 1 · Verified findings

### 1.1 Broker universe (user audit, local MT5)
- 96 instruments, 5 classes: 9 crypto pairs · 5 metals/commodities · 14 indices · 48 forex · 20 equities.
- Feed-dead root cause found: FundedNext tickers `DOGUSD` (not DOGEUSD) and `LNKUSD` (not LINKUSD).
- `SOL`, `AVAX`, `BNB` **are not listed** — no suffix trick exists; they are untradeable at this broker.
- Live and tradeable beyond current 12: `XLMUSD`, `XMRUSD`, `XPTUSD`, `USOUSD`, `UKOUSD`.
- Contract note: `XAGUSD` = 5,000 oz contract (sizing reads live spec — already generic; see §4).

### 1.2 Upstream data probe (live, verified this desk — method: Coinglass web API with the terminal's own auth layer; sanity-passed on BTC/XAU first)

| Asset | Binance perp | OKX swap | Bybit perp | Hyperliquid | funding venues | liq-levels (3d) | CVD tickers | taker-flow #bs_usd |
|---|---|---|---|---|---|---|---|---|
| XLM | ✓ | ✓ | ✓ | ✓ | 4+ (Aster/MEXC/WhiteBIT/Bybit…) | ✓ 2,263 lvls | ✓ 22 rows | ✓ |
| XMR | ✓ | ✗ Not Supported | ✓ | ✓ | ✓ (Aster/MEXC/WhiteBIT/BingX) | ✓ 1,748 lvls | ✓ | ✓ |
| XPT | ✓ | ✓ | ✗ | ✗ | ✓ (Crypto.com/Lighter/Bitget/Binance) | ✓ 1,363 lvls | ✓ 10 rows | ✓ |
| USO | ✗ | ✓ | ✗ | ✗ | ✓ (MEXC/OKX) | ✓ 368 lvls (thin) | ✓ 5 rows | ✓ |
| UKO | ✗ | ✗ | ✗ | ✗ | — | — | — | — |
| *sanity* BTC | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| *sanity* XAU | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |

**Read**: XLM is a drop-in (all four fp venues). XMR drops OKX (3-venue footprint, same shape as metals today). XPT has no Hyperliquid (`hl:false`) and needs heatmap venue care. USO has **no Binance kline** → cannot use the default lead instrument; OKX-lead required. UKO has nothing.

### 1.3 Where the code decides things
- **Terminal registry**: `src/lib/cg/assets.ts` — `ASSETS[]` via `mk()`; the file's own contract says "adding a new asset is a one-line change" and `fpVenues/liqVenues/aggVenues` derive from it. Verified true for XLM/XMR; **false** for XPT/USO (see §3 Phase 2b).
- **Desk engine**: `scripts/desk_deepscan.py` — had two hardcoded `f"{sym}USD"` MT5 lookups (now routed through `config.symbol_map`, fallback legacy form).
- **Directive emitter**: `scripts/desk_round.py:553` already maps via `cfg["symbol_map"]` — DOGE/LINK fix flows through with zero changes.
- **Sizing**: `desk_deepscan.py` §9 reads live broker spec (`tickSize/tickValue/volumeStep/volumeMin/volumeMax`) per symbol — class-agnostic by construction; min-lot risk violations are already flagged (XAG 0.72% precedent).

---

## 2 · Tiered architecture

| Tier | Assets | Data path | Scorecard | Status |
|---|---|---|---|---|
| **T1 — full pipeline** | BTC ETH XRP ADA DOGE LINK LTC XAU XAG | Coinglass 4-venue perp aggregates | full 8-dim | **live** (9 broker-tradeable; DOGE/LINK mapping fixed this run) |
| **T1w — perp-side watchlist** | SOL BNB AVAX | full upstream data, **no broker listing** | full 8-dim, always PARKED (not listed) | **live** (reclassified this run) |
| **T2a — one-line adds** | XLM XMR | 4-venue / 3-venue perps (verified §1.2) | full 8-dim | **code committed, needs terminal rebuild** |
| **T2b — small extension** | XPT USO | 2-venue / OKX-lead | full 8-dim, `hl:false`, USO liq-data thin (368 lvls → weaker magnets) | **planned** — needs `mk()` leadKey override + `aggVenues` branch |
| **T3 — out of scope v1** | UKO + 14 indices + 48 forex + 20 equities | none upstream | would need a non-crypto data stack (session VWAP, no funding/OI/liq/CVD) | **deferred — user decision required** |

### Why T3 is deferred (not built)
The 8-dimension scorecard is crypt-native: 4 of its 8 votes (funding, OI×price, CVD quadrant, footprint Δ) plus the magnet-based target engine **do not exist** for cash indices/forex/equities. Onboarding them means a second, different engine (session-anchored VWAP, range/mean-reversion logic, news-driven catalysts) and a new data vendor. That is a product decision, not a config edit. Surfaced, not silently dropped — per Karpathy rule 1.

---

## 3 · Roadmap

### Phase 1 — DESK symbol layer ✅ SHIPPED (commit this run)
Surgical diff, every line traceable to the directive:
1. `desk/state.json → config.symbol_map`: `DOGE: DOGUSD`, `LINK: LNKUSD` (authorized by this directive; DIR-0003's "config is human-owned" caution overridden by explicit user instruction).
2. `scripts/desk_deepscan.py`: new `mt5sym()` resolver reading `config.symbol_map` (fallback `<SYM>USD`); both hardcoded lookups routed through it; `NOT_LISTED = {SOL, BNB, AVAX}` → §7 prints "NOT LISTED on FundedNext — perp-side watchlist only", §9 status becomes `PARKED (not listed on FundedNext)`, card recovery explains execution impossibility.
3. Regression: `360 all` re-run — **12/12 all sources OK**, digest 20261110-2009, broadcast refreshed.
4. Expected follow-up (atg-exec): next `desk/mt5.json` push should carry `DOGUSD`/`LNKUSD` spread keys; DOGE/LINK §7 then flips from "no ticks" to basis/spread/TRADEABLE-or-BLOCKED.

### Phase 2a — TERMINAL registry adds ✅ CODE COMMITTED, ⏳ REBUILD REQUIRED
`src/lib/cg/assets.ts`: `mk("XLM","Stellar","crypto",4)` + `mk("XMR","Monero","crypto",3)` (both `hl:true` — Hyperliquid verified for both). Verification below (§6). The running sandbox server serves the old standalone build — **takes effect after `next build` + standalone redeploy** (same procedure the daemon used originally).

### Phase 2b — XPT/USO extension (**BLOCKED by multi-agent quant review** — see REVIEW-MULTIAGENT-20261110.md Q1-Q3: str≥40 is rank-normalized per symbol, so thin books pass phantom magnets; ship only after engine v3.3 data-depth gates. Implementation when unblocked: XPT = `mk("XPT","Platinum","metal",2,"slow",false)` — the existing metals branch handles it, NO new abstraction; USO additionally needs centralized lead derivation — 5 hardcoded `Binance_${sym}USDT` call sites)
Two changes, both small but real:
1. `mk()` hardcodes `leadKey = Binance_${s}USDT`. USO has no Binance kline → add an optional lead-override param (default unchanged): `mk("USO","WTI Crude","commodity",2,"slow",false, lead\`OKX_USO-USDT-SWAP\`)`.
2. `aggVenues()`: non-BTC/ETH crypto returns `["Binance","Hyperliquid"]` — Hyperliquid carries neither XPT nor USO → heatmap stream errors ("No supported futures heatmap pair", the exact trap the code comment warns about). Add a commodity branch mirroring the metals branch (`["Binance"]` for XPT; `["OKX"]` for USO).
3. `fpVenues()`/`liqVenues()` derive from `hl` — XPT/USO get 3-/1-venue aggregates automatically once `hl:false`.
Risk note: USO's 368 liq levels (vs XLM's 2,263) means sparser magnets — the str≥40 gate may frequently yield NO-ZONE/REJECTED. That is honest behavior, not a bug.

### Phase 3 — T3 decision (user)
If indices/forex/equities are wanted: commission a data-source evaluation (candidacy: broker-side tick history only → session-VWAP engine, or a vendor like TradingView/Refinitiv). Until then the terminal simply does not serve them, and the deepscan gates on registry membership — nothing scans 82 dead endpoints.

---

## 4 · Sizing & tick math under the wider universe

Current sizing is **spec-driven and class-agnostic**: `lots = risk_usd / (stopDist/tickSize × tickValue)`, floored at `volumeMin`, stepped by `volumeStep`, capped at `volumeMax`, with realized-risk % computed and **min-lot violations flagged** (XAG precedent: 0.72% > 0.5% mandate flagged at placement). What changes per class:

- **XAGUSD (5,000 oz)**: contract size is already inside `tickValue` the daemon pushes; no code change. The 0.72% min-lot floor is a property of the instrument, permanently flagged.
- **Indices (T3, if ever)**: point-value multipliers differ per broker spec (US30 $1/pt vs NDX100 $20/pt typical) — the spec-driven formula handles them unchanged; the risk is humans assuming crypto-lot intuitions. Mitigation: §9 already prints realized risk $ and %.
- **Leverage tiers**: FundedNext prop rules (max simultaneous positions, daily drawdown) are account-level constraints enforced at directive time (correlation cap 1–2 concurrent is already stricter).
- **XPT/USO margin**: broker `spec` arrives with the feed onboarding; sizing stays blind to class.

---

## 5 · Rate-limit & data-integrity budget

- `360 all` = 12 assets × ~10 endpoints ≈ **120 upstream calls, on-demand only** (no schedule). Phase 2a adds XLM/XMR → **~140 (+17%)**. Phase 2b → ~157. Acceptable: runs are user-triggered, terminal caches (`cgGet` ttl: market 2 min, liq 30 s, cvd 120 s…).
- Terminal scan engine (background cadence): XLM/XMR enter as `tier:"slow"` — the scanner already paces slow-tier assets. **Do not promote to fast without a load test.**
- 96-instrument scanning would be ~960 calls for 82 data-less assets — **structurally refused** by registry gating. This is a feature.
- Integrity: every new asset inherits the honesty block (Coinglass estimates, 4-venue aggregates) and the §9 evidence-manifest discipline — no data point dropped, ✗ opposition printed as prominently as ✓.

---

## 6 · Success criteria (verifiable)

| # | Criterion | Verification | State |
|---|---|---|---|
| 1 | DOGE/LINK map | `python3 -c "import json;print(json.load(open('desk/state.json'))['config']['symbol_map'])"` → DOGUSD/LNKUSD | ✅ pass |
| 2 | Resolver correct | `DOGE §7 shows "DOGUSD"`, `LINK §7 shows "LNKUSD"` (reports 20261110-2009) | ✅ pass |
| 3 | NOT_LISTED handling | `SOL §7 "NOT LISTED…"` + §9 `PARKED (not listed on FundedNext)` + card recovery | ✅ pass |
| 4 | No regression | `360 all` → 12/12 "all sources OK", digest+broadcast written | ✅ pass (20261110-2009) |
| 5 | DOGE/LINK + XLM/XMR tradeable | next daemon `mt5.json` push carries DOGUSD/LNKUSD/XLMUSD/XMRUSD spread keys → §7 shows basis/spread/TRADEABLE | ⏳ DIR-0008 verification task |
| 6 | Terminal serves XLM/XMR | `GET /api/cg/assets` includes XLM,XMR; `market?sym=XLM` → 200 | ✅ pass on sandbox terminal (dev hot-reload, verified 20:15 UTC: 14 syms, XLM 0.1448); Windows prod box needs rebuild (DIR-0008) |
| 7 | XLM 360 round-trip | `360 XLM XMR` produces full 8-section reports with no venue-gap errors | ✅ pass (reports 20261110-2020, all sources OK, both scorecards resolve; XLMUSD/XMRUSD broker keys pending feed) |

## 7 · Assumptions (surfaced, per Karpathy rule 1)

1. The 96-instrument list is the user's live broker audit — taken as ground truth for **broker** reality; upstream **data** reality was independently probed by this desk (§1.2).
2. `DOGUSD`/`LNKUSD` spread keys will appear in `desk/mt5.json` once the local daemon maps through `config.symbol_map` (assumption — verify at criterion 5).
3. Coinglass venue coverage is as probed at 19:55–20:00 UTC; venue listings change (XMR relisting on Binance was a surprise to this desk — verified live, timestamped, could revert).
4. The terminal rebuild (`next build` + standalone) is executed on the machine that owns the running server; the desk does not rebuild the sandbox server mid-session (existing build stays authoritative until then).
5. Funding/OI/liq data for XPT/USO perps exists because they are **crypto-venue perps**, not because the commodities themselves have derivatives data — the scorecard reads the perp market, same as XAU/XAG today.

## 8 · Rollback

Phase 1: revert `symbol_map` values + the 3 hunks in `desk_deepscan.py` (self-contained, no schema change). Phase 2a: delete the two `mk()` lines + comment block. Both revertible in one commit; no data migrations involved.

---

# v2.0 ADDENDUM · 2026-11-10 21:20 UTC — FULL-UNIVERSE EXPANSION (user directive)

**User directive 2026-11-11 (IST)**: "we were supposed to expand all the mentioned forex, indices and metals along with mentioned cryptos… extensive research of all market data available from all exchange and integration in our terminal." → **Tier 3 deferral OVERRIDDEN by the decision-maker.** Everything below SHIPPED and verified this run:

| Tier | Assets | Data path | Status v2.0 |
|---|---|---|---|---
| T1 full pipeline | BTC ETH XRP ADA DOGE LINK LTC XAU XAG XLM XMR (11 tradeable + SOL/BNB/AVAX watchlist) | Coinglass 4-venue perps | **live** |
| **T2b (was BLOCKED)** | **XPT USO** | XPT 2-venue · USO OKX-lead (leadInstr centralization, A2 done) | **SHIPPED** — scanned, PARKED under v3.3 data-depth gate (1,592/2v · 358/1v) |
| **T3 (was deferred)** | **77 classic** (14 indices · 43 FX · 19 equities · UKO) | **NEW `/api/cg/classic` Yahoo v8 pipeline** (live-verified 143/143 probes) | **SHIPPED watchlist-only** — full §1-§9 reports, honest n/a derivatives dims, reduced 4-dim scorecard, WATCHLIST-ONLINE/STALE/OFFLINE verdicts |
| Excluded | SPCX | Yahoo SPCX = SPAC ETF (wrong instrument) | removed; restore after DIR-0009 spec check |

**v3.3 gates shipped with it** (multi-agent round 2, REVIEW-MULTIAGENT-20261110-R2.md): data-depth (≥3 venues AND ≥1,000 levels) · **magnet-mass floor (T1 ≥ max[$5M, 0.25% OI] — closes the XLM phantom-geometry blocker)** · min-lot risk → PARKED · floor-to-step sizing · staleness gate · registry/parse hard-fails.

**Research compendium** (the directive's core ask): `desk/deepscan/T3-DATARESEARCH-20261110.md` — per-class coverage of every integrated + researched source (Coinglass, Binance, Yahoo, OANDA v20 books, CFTC semiweekly COT, Twelve Data, Finnhub, Alpha Vantage, Dukascopy, Stooq, MT5 DOM/tick-volume), scorecard mapping, rate-limit budget, sources.

**Engine v4 gate**: classic instruments NEVER construct trades until the 8 Laurie preconditions ship (R2 doc) — watchlist data first, honesty always.

**Verification (v2 criteria, all live)**: `/api/cg/assets` = 16 · `/api/cg/classic?list=1` = 77 · market/fp/ticker 200 on XPT+USO (OKX lead) · `360 all` = 16 perp + 77 classic (62 online + 15 STALE at 21:08 UTC, EU closed — honest) · XLM mass-floor PARK verified · XAG min-lot PARK verified · DOGE/LINK correct spread-gate readings after the state.json race repair (RETRACTION logged) · commits fc6d300, 01a5e8b, f40d1e9, f87f318.
