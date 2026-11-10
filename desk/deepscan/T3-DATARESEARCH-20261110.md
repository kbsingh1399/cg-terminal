# T3 MARKET-DATA RESEARCH COMPENDIUM · Full FundedNext Universe

2026-11-10 21:10 UTC · zai-desk · scope: **extensive research of all market data available from all exchanges and integrations in our terminal** for the 96-instrument FundedNext universe (user directive 2026-11-11: "expand all the mentioned forex, indices and metals along with mentioned cryptos")
method: live probes from this desk (terminal route matrix, Yahoo/Binance/Coinglass HTTP probes — every ✓ below was verified live, timestamps in scripts/t3_probe_results.json) + web research (sources linked, §6) + repo source audit
guidelines: Karpathy (assumptions surfaced, verifiable criteria, no silent gaps)

---

## 0 · Executive summary

1. **The FundedNext universe decomposes into two data worlds, now both integrated**: (a) crypto-venue perps — served natively by the existing Coinglass 8-dimension engine (now 16 assets incl. XPT/USO); (b) classic cash instruments — 77 scanned via a NEW Yahoo-anchored quote pipeline (`/api/cg/classic`), watchlist-only with an honest reduced 4-dim scorecard. **One instrument (SPCX) is excluded** — Yahoo's SPCX ticker is a different instrument (SPAC ETF), and wrong-instrument data is worse than no data.
2. **No single free API covers the classic classes except Yahoo Finance** (unofficial chart v8): 143/143 live probes passed across indices/FX/equities/commodity futures. Volume exists on equities, US cash indices and CME futures; FX/VIX/EU-Asian cash indices are price-only upstream.
3. **The derivatives dimensions (funding/OI/liquidations/CVD/walls) do not exist for cash instruments at any integrated source.** The classic analogs exist but are slower/coarser: CFTC COT (semiweekly since late-2026), OANDA v20 OrderBook/PositionBook (FX majors, free practice token), short-interest/put-call (equities). They are documented in every classic report as "researched, not integrated".
4. **v3.3 honesty gates shipped with the expansion** (multi-agent-reviewed): data-depth gate (≥3 fp venues AND ≥1,000 open liq levels), magnet-mass floor (T1 ≥ max[$5M, 0.25% OI]), min-lot risk gate (PARKED, not advisory), floor-to-step sizing.

---

## 1 · The verified instrument universe (broker: FundedNext-Server, acct 11808165)

| Class | Count | Symbols (broker tickers) | Source of truth | In terminal |
|---|---|---|---|---|
| Crypto | 9 | BTCUSD ETHUSD XRPUSD ADAUSD DOGUSD(DOG) LNKUSD(LINK) LTCUSD XLMUSD XMRUSD | user MT5 audit + DIR-0003 reply | perp registry (full 8-dim) |
| Metals/Energy | 5 | XAUUSD XAGUSD(5,000oz) XPTUSD USOUSD UKOUSD | user MT5 audit + FN site | XAU/XAG/XPT/USO perp registry · **UKO classic only** (zero perp data anywhere — verified) |
| Indices | 14 | US30 SPX500 NDX100 US2000 VIX GER30 UK100 FRA40 EUSTX50 SWI20 NTH25 JP225 HK50 AUS200 | user MT5 audit (VIX) — FN site lists 13, omits VIX | classic registry |
| Forex | 43 verified (FN site says 46; user audit said 48) | EURUSD GBPUSD USDJPY … full list in src/lib/cg/classic.ts | FN help-centre article + live Yahoo probe 43/43 | classic registry |
| Equities | 19 scanned (FN lists 20 incl. SPCX) | AAPL AMZN GOOG MSFT NVDA TSLA AMD META BABA NFLX INTC NKE KO + MBG BAYN MC VOW3 ADS BMW (EUR-denominated) | FN help-centre + live Yahoo probe 20/20 (SPCX then removed — §3.4) | classic registry |
| Not listed at broker | 3 | SOL BNB AVAX | DIR-0003 (mt5.symbols_get) | perp watchlist only (T1w) |

**Count discrepancy (flagged, not silently resolved)**: FX 43 (FN site verifiable list) vs 46 (FN site's own headline) vs 48 (user audit); equities 20 listed vs 19 scanned. Resolution path: **DIR-0009 asks atg-exec for the full `mt5.symbols_get()` dump** — broker reality is ground truth; the classic registry extends by one line per confirmed symbol.

---

## 2 · What our terminal already integrates (live capability matrix, probed 2026-11-10 20:40 UTC)

### 2.1 Terminal routes (localhost:3000/api/cg/*) — BTC sanity 19/20 × 200; unknown-symbol rejection verified on every sym-gated route

| Route | Serves | Perp assets | Classic |
|---|---|---|---|
| `/market` | EMA stack 4TF, RSI 4TF, VWAP±σ, day/month POC-VAH-VAL, session profile | 16 (XPT/USO verified 200 w/ prices) | ✗ (registry gate) |
| `/fp` | 300 m15 footprint bars, per-level buy/sell, Δ, absorption, POC migration, Δ-div | 16 (USO 1-venue OKX-lead; XPT 2-venue) | ✗ |
| `/signals` | typed micro events 24h | 16 | ✗ |
| `/cvd` | perp/spot CVD, quadrant, divergence | 16 (XAU transient 502s possible) | ✗ |
| `/liqlevels` | liquidation magnets + squeeze fuel + **perVenue raw counts + open/hit level counts** (feeds the v3.3 gate) | 16 | ✗ |
| `/lto` | whale large-trade orders | 16 | ✗ |
| `/bookwalls` | depth-imbalance walls (heatmap aggregate) | 16 (USO: honest 400 "no aggregate" — by design) | ✗ |
| `/funding` `/oi` | funding venues + OI aggregates (**oiUsd feeds the mass floor**) | 16 | ✗ |
| `/stopmap` | stop clusters | BTC only (upstream limitation, marked in every report) | ✗ |
| `/ticker` `/kline` `/live` `/livebook` `/stream` `/orderflow` `/orderflow-agg` `/largeorder` `/notifications` `/engine/*` | live prices, candles, streams, news, engine status | 16 (USO ticker via m15 fallback — G3 fix) | ✗ |
| **`/classic` (NEW)** | **registry-gated Yahoo v8 proxy: quote + OHLCV bars + session metadata, 60s cache, query2 fallback** | — | **77 (62 online + 15 stale at probe hour — EU closed)** |

### 2.2 Upstream integrations behind the routes
- **Coinglass web API** (capi/fapi, encrypted responses, auth layer in `src/lib/cg/crypto.ts`): futures klines, order-flow buckets, liq heatmaps/levels, funding, OI, large orders, stopmap — crypto perps only (verified: it carries NOTHING for cash indices/FX/equities; UKO has zero data on every venue).
- **Binance fapi** (`src/lib/live/fapi.ts`): live prices/WS for perp assets. Sandbox IP collected a blanket 418 auto-ban during rapid probing — rate-limit finding: aggressive parallel probing gets banned; the terminal's paced/authenticated calls are unaffected.
- **Yahoo Finance chart v8** (NEW, `/classic` route): quotes + OHLCV for all classic classes. Unofficial + keyless + unauthenticated — documented risks in §5.

---

## 3 · External market-data coverage, per class (the extensive research)

### 3.1 Crypto perps (9 broker-listed) — FULL coverage, already integrated
- **Coinglass** (integrated): klines/funding/OI/liq-levels/CVD/LTO/walls per venue aggregates. Venue footprints verified: BTC/ETH/XRP/ADA/DOGE/LINK/LTC/XLM 4-venue; XMR 3-venue (no OKX swap); XPT 2-venue (Binance+OKX, no Bybit/HL); USO 1-venue (OKX only — OKX-lead implemented).
- **Binance** (integrated): perp klines, premium/funding, OI public endpoints — all 9 cryptos confirmed (XMR: privacy-coin relisting is volatile — watch criterion in risk register).
- Verdict: nothing external needed; the v3.3 gates handle the thin tails (XPT/USO PARK until depth grows).

### 3.2 Metals & energy (XAU XAG XPT USO UKO)
- **Perp path** (integrated): XAU/XAG/XPT/USO have crypto-venue USDT perps (Coinglass). XAU 2,942 open levels/3v · XAG 1,715/3v · XPT 1,592/2v · USO 358/1v — the last two PARK under the data-depth gate.
- **Futures reference markets** (Yahoo, integrated as classic cross-check + UKO's only path): GC=F (gold) · SI=F (silver) · PL=F (platinum) · CL=F (WTI) · **BZ=F (Brent — UKO's reference market, volume-bearing, 448×15m bars)**. All verified live with volume and 1y history.
- **CFTC COT** (researched, not integrated): **semiweekly since late-2026** (press release 9316-26, Oct 27 2026: Monday data → Wednesday release, Wednesday data → Friday release, 15:30 ET) — positioning analog for the futures legs. Free public datasets.
- Basis note (Laurie): front-month future ≠ continuous CFD quote — roll timespread typically $0.3–1.0/bbl on Brent (0.3–1%), same order as daily σ. Engine v4 precondition: broker-quote anchoring + |CFD−BZ=F| ≤ 0.5% basis gate.

### 3.3 Indices (14)
- **Yahoo cash quotes** (integrated): all 14 verified 200. **Volume exists only on US30/SPX500/NDX100** (DJI/GSPC/NDX cash carry volume); US2000/VIX/EU-Asian cash are price-only → session stats print price-only anchors (never faked).
- **CME index futures** (Yahoo, cross-check path): ES=F NQ=F YM=F RTY=F all verified with volume (VIX futures VX=F not on Yahoo). Session-VWAP-grade data for the US complex.
- **Staleness reality**: EU/Asian cash indices serve last-session closes outside market hours → the staleness gate (E3) prints WATCHLIST-STALE (verified live: 15/77 stale at 21:08 UTC with EU closed).
- **COT**: equity-index futures positioning (CME) — semiweekly, per §3.2.
- Not viable from our stack: Stooq (connection times out from sandbox — documented), CME direct (delayed quotes need scraping), Refinitiv/TradingView (paid — out of scope).

### 3.4 Forex (43 verified)
- **Yahoo FX** (integrated): all 43 FN-listed pairs verified 200, 15m/5d bars (~470 bars), 24h market → always fresh. **No volume upstream** (true for all retail FX quote feeds) → price-only session stats; MT5 tick volume is the daemon-side analog when it returns.
- **OANDA v20 REST** (researched, not integrated): free practice account + API token; **InstrumentsOrderBook + InstrumentsPositionBook** endpoints = the only free FX positioning/order-book analog (maps conceptually to our walls/sentiment dims). Rate limits: practice tier is generous (docs: developer.oanda.com).
- **Dukascopy** (researched): free historical tick + OHLC data for 1,499 FX pairs (dukascopy-node CLI) — backtest-grade history, not real-time.
- **COT**: currency futures positioning (CME) — semiweekly.
- Paid tier documented but not integrated: Twelve Data (800 calls/day free — FX+stocks+indices), Finnhub (60/min free — stocks/FX quotes), Alpha Vantage (25/day free — too thin for a 43-pair universe), TraderMade (paid FX).

### 3.5 Equities (19 scanned)
- **Yahoo** (integrated): all 20 FN-listed tickers verified 200 **with volume**, incl. the 6 EUR-denominated (MBG.DE BAYN.DE MC.PA VOW3.DE ADS.DE BMW.DE — XETRA/Euronext, EUR currency confirmed in responses). **SPCX removed**: Yahoo's SPCX = Tuttle SPAC/New-Issue ETF — a different instrument from whatever FundedNext lists under that name; restore only after DIR-0009 verifies the broker contract spec.
- Classic analogs (researched, not integrated): FINRA short-interest (biweekly), options put/call ratios (CBOE/OCC), ETF flows. These are the equity-side "positioning" dims for engine v4.

### 3.6 MT5 broker feed itself (daemon-side, currently the missing piece)
- mt5.json pushes (45s cadence, currently live again after a 14h daemon gap) provide bid/ask/spread/basis + full contract specs for **mapped perp symbols** — the sizing and broker-gate layer. XPTUSD/USOUSD/UKOUSD keys pending the daemon pulling the new 17-entry symbol_map (**DIR-0009**).
- MT5 tick volume: the volume analog for FX/EU indices when the daemon covers them.
- MT5 DOM: per MetaQuotes docs, on brokers without real depth the DOM is **synthetic bid/ask-derived levels** — CFD brokers typically qualify; reports state this as desk research, not fact.

---

## 4 · Scorecard mapping — what each dimension becomes per class

| Dimension | Crypto perps (16) | Classic (77) |
|---|---|---|
| trend (EMA stack 4TF) | ✓ live | ✓ EMA20/50 (15m) — computed from Yahoo bars |
| VWAP ± σ / session | ✓ live (UTC-day anchored) | ✓ vol-weighted VWAP+POC (US indices, equities, UKO) · price-only anchor (FX, EU/Asian indices) — labeled, never faked |
| RSI | ✓ 4TF | ✓ RSI(14) 15m |
| signals/microFlow (fp Δ, absorption) | ✓ 4→2→1-venue aggregates | **n/a — no perp order-flow exists** (CVD/taker-split analogs: MT5 tick-volume delta, daemon-side) |
| CVD quadrant/divergence | ✓ | **n/a** |
| funding / OI | ✓ (context-only when OI<$100M or ≤2 venues — v3.3 rule 7 proposal) | **n/a** — analogs: COT semiweekly, OANDA books (FX), short-interest/put-call (equities) — researched, not integrated |
| liquidation magnets (targets) | ✓ with v3.3 mass floor | **n/a** — no leveraged-perp liquidations; structural levels (24h/5d extremes) printed as reference only |
| bookwalls / LTO / stopmap | ✓ (USO: honest no-aggregate) | **n/a** — MT5 DOM synthetic at best |
| Verdicts | PLACEABLE / PARKED / REJECTED / NO-TRADE | **WATCHLIST-ONLINE / WATCHLIST-STALE / WATCHLIST-OFFLINE** — no trade construction until engine v4 (user gate) |

---

## 5 · Rate-limit & data-integrity budget (post-expansion)

- **`360 all` full universe**: 16 perp × ~10 Coinglass calls (~160, unchanged pace, cached) + 77 Yahoo calls (60s server cache; 0.15s spacing, 2s backoff on errors). Yahoo precedent: a user pulling ~7,000 tickers/day was cut (Nov 2024) — our ~77/scan, user-triggered, is ~2 orders of magnitude under.
- **Binance**: sandbox probing earned a blanket 418 auto-ban — lesson: never parallel-probe fapi; the terminal's paced calls are unaffected.
- **Integrity rules shipped**: staleness gate (>90 min → STALE), registry/parse hard-fails (no silent empty-map/empty-registry scans), SPCX wrong-instrument removal, chg-24h honest labeling (range-previous-close ≠ day change), cache eviction + 429 no-fallthrough.
- **Known residual gaps (printed, never dropped)**: stopmap BTC-only; UKO no perp data (classic-only); FX no volume upstream; 3 FX pairs + VIX + SPCX pending broker-dump reconciliation.

---

## 6 · Sources (opened during this research)

- FundedNext instrument lists: help.fundednext.com/en/articles/8224087 (46 FX headline, 43-pair verifiable list, 20 equities, 13 indices) · fundednext.com/general-rules/cfds/symbols-and-conditions · fundednext.com/symbols
- Yahoo Finance chart API: query1.finance.yahoo.com/v8/finance/chart (live-verified; scrapfly.io "Yahoo Finance API in Python 2026" + algotrading101.com guide for rate-limit context)
- CFTC COT semiweekly: cftc.gov/PressRoom/PressReleases/9316-26 (Oct 27, 2026) · cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule
- OANDA v20: developer.oanda.com/rest-live-v20/introduction · oanda.com orderbook/positionbook docs
- Twelve Data: twelvedata.com/docs + codewords.ai (free tier 800/day, 8/min)
- Finnhub: finnhub.io/pricing (free 60/min) · Alpha Vantage: alphavantage.co (free 25/day)
- Dukascopy: dukascopy.com/swiss/english/marketwatch/historical · dukascopy-node.app
- MetaTrader 5 DOM: metatrader5.com/en/terminal/help/trading/depth_of_market
- Live probe artifact: scripts/t3_probe_results.json (terminal matrix + 143 Yahoo probes + Binance + Stooq, timestamped)

## 7 · Assumptions (surfaced)

1. Broker universe per user audit + FN site; the FX/equity count discrepancies resolve via DIR-0009's symbols dump (ground truth = MT5).
2. Yahoo unofficial API remains keyless at our call volume; if it degrades, the classic universe goes WATCHLIST-OFFLINE loudly (never fake-quiet), and the plan-B candidates are documented (Stooq — currently unreachable from sandbox; Twelve Data free tier).
3. UKO = BZ=F front-month as reference market; the CFD-vs-future basis is a v4-precondition, not a today-problem (watchlist-only).
4. EU/Asian index "staleness" is market-hours reality, not a data fault — the STALE verdict encodes it.
