# MICRO-DESIGN-R4 — L2/L3 microstructure layer (Hyperliquid xyz + Lighter DEX + Kraken spot)

**Round:** R4 · 2026-11-11 · desk: zai-desk
**User directive:** *"continuous fetching live free data via API for forex, indices, metals… at L2, L3 level too"* + *"institutional grade ultimate bugless end to end working terminal"*.
**Prior art:** R3 (commit a33e841) gave classic instruments Coinglass-perp depth + CFTC COT + CNBC futures. R4 adds the layer R3 could not: **true L2/L3 order-book microstructure**, live and free.

## 1. Verified sources (every claim re-probed live from the sandbox 2026-11-11 ~09:00–09:10 UTC)

Evidence: `scripts/research/probes/l2l3/` (hl-l2book-xyzGOLD.json, hl-xyz-dex-universe.json,
lighter-id-verification.json, lighter-l3-samples.json, lighter-xau-trades.json, kraken-depth-eurusd.json,
summary.json) · probe scripts `probe_l2l3_sources.py`, `verify_l2l3_mapping.py`.

| source | what was verified live | limits |
|---|---|---|
| **Hyperliquid HIP-3 xyz dex** — `POST https://api.hyperliquid.xyz/info` | `{"type":"metaAndAssetCtxs","dex":"xyz"}` → **144 markets** w/ mark, oracle, OI, funding, vol24h. `{"type":"l2Book","coin":"xyz:GOLD"}` → 20 levels/side, each `{px, sz, n}` — **n = resting order count**. `candleSnapshot` 1h × 1489 bars. | REST only in v1 (WS later). Book = 20 levels/side. |
| **Lighter DEX (ZK-rollup CLOB)** — `https://mainnet.zklighter.elliot.ai/api/v1` | `orderBookOrders?market_id=&limit=` → `{code, asks[], bids[]}` — **true L3**: `order_id, owner_account_index, initial_base_amount, remaining_base_amount, price, order_expiry`. 60 orders/side verified on 13 markets. `recentTrades` → full **maker/taker attribution** (`ask_account_id, bid_account_id, is_maker_ask, usd_amount, tx_hash`). | REST cap 250/side. `/markets` listing endpoint 403s — ids must be registry-pinned (they are, price-verified). `transaction_time` returns 0 → order AGE not computable, only TTL (`order_expiry`); we do NOT fabricate age. |
| **Kraken spot FX** — `https://api.kraken.com/0/public/Depth?pair=&count=` | ZEURZUSD 25/25 levels, real spot FX limit orders. | REST v0; L2 aggregated (L3 needs auth token — out of scope). |
| **Dukascopy .bi5** — `http://datafeed.dukascopy.com/datafeed/{SYM}/{YYYY}/{MM0}/{DD}/{HH}h_ticks.bi5` | XAUUSD 06h UTC file: 73,138 bytes LZMA → **17,689 ticks** (20-byte `>3i2f` BBO+vol records). Near-real-time (~1h lag). Plain http only; month 0-indexed. | Desk-side backfill script (not a terminal route). |
| **Binance Vision** — `https://data.binance.vision` | XAUUSDT futures-um daily 2026-11-10: trades 13.86 MB, aggTrades 7.73 MB, bookDepth 570 KB — all HTTP 200. | Desk-side backfill script. |

**Cross-source price coherence at probe time** (mapping sanity, the USO-ETF lesson applied):
Lighter XAU mid 4057.87 ↔ HL xyz:GOLD mark 4057.0 ↔ Dukascopy tick 4058.79/4058.33 ↔ broker MT5 4062.74 ·
Lighter Brent 90.22 ↔ xyz:BRENTOIL 90.216 · Lighter NATGAS 3.5686 ↔ xyz:NATGAS 3.5683 ·
Lighter WTI 85.14 ↔ xyz:CL 85.135 · Lighter EURUSD 1.11527 ↔ Kraken 1.11451/53 ↔ xyz:EUR 1.1149 ·
Lighter US500 7579.85 ↔ xyz:SP500 7579.0 · Lighter US100 28203.0 ↔ xyz:XYZ100 28203.0.

## 2. Registry mapping (terminal sym → sources) — `src/lib/cg/micro.ts`

| sym | HL xyz coin (vol24h $) | Lighter id | Kraken pair | notes |
|---|---|---|---|---|
| XAU | xyz:GOLD (97.8M) | 92 | — | perp-registry asset; L3 via this layer |
| XAG | xyz:SILVER (128.5M) | 93 | — | perp-registry asset |
| XPT | xyz:PLATINUM (1.2M) | — | — | THIN — honest label |
| SPX500 | xyz:SP500 (467.8M) | 180 | — | |
| NDX100 | xyz:XYZ100 (567.8M) | 181 | — | XYZ100 = Nasdaq-100 |
| JP225 | xyz:JP225 (1.1M) | — | — | THIN — honest label |
| USO | xyz:CL (138.5M) | 145 | — | WTI |
| UKO | xyz:BRENTOIL (174.7M) | 159 | — | |
| NATGAS | xyz:NATGAS (39.9M) | 158 | — | watchlist (not at broker) |
| EURUSD | xyz:EUR (4.4M) | 96 | EURUSD | |
| USDJPY | xyz:JPY (2.6M) | 98 | USDJPY | |
| GBPUSD | xyz:GBP (37k — dead) | 97 | GBPUSD | HL leg honest-labeled dead |
| AAPL AMZN GOOG* MSFT NVDA TSLA AMD META BABA NFLX INTC | xyz:<TICKER> (NVDA 527M … NFLX 868k) | — | — | *registry GOOG ↔ xyz:GOOGL share-class proxy, labeled |
| AUDUSD USDCAD USDCHF NZDUSD | — | — | pair | Kraken only |
| US30, EU indices (DAX/UKX/F40E/SMI/SX5E…), EU equities, VIX, 41 FX crosses | — | — | — | **no L2/L3 exists free — honest n/a stays** |

Lighter SPY(128)/QQQ(129)/IWM(153) verified alive but have NO 1:1 classic-registry symbol — deferred (future: ETF-flow context card on SPX500/NDX100).

## 3. API — `GET /api/cg/micro?sym=XAU`

- 400 honest when sym has no mapping (list mapped syms in the error, like /cot).
- Per-source independence: `hl`, `lighter`, `kraken` each `{ok, …}` or `{ok:false, error}` — one dead source never kills the others; whole response `ok:true` if any source ok.
- Caches (globalThis TTL, the R3 convention): xyz dex meta+ctxs **60 s** shared across syms; l2Book **10 s**/sym; Lighter book **10 s**/sym; Lighter trades **10 s**; Kraken depth **10 s**; error TTL **30 s** (transient upstreams must not pin dead panels). Cache cap 64 entries, oldest evicted.
- UA header + `AbortSignal.timeout(10_000)` + `cache:"no-store"` on every external fetch (R3 convention).
- Payload (numbers, all computed server-side, UI stays dumb):
  - `hl`: coin, mark, oracle, markVsOraclePct, vol24hUsd, oiBase, **oiNotionalUsd** (mark×OI), funding1hPct, funding8hAprPct (=rate×8×24×365 … carefully: funding interval on HL is 1h; APR = rate×24×365), book {bids/asks[20] {px,sz,n}}, spreadPct, bid/askNotionalUsd(20 levels), imbalance20 (=bid/(bid+ask) notional).
  - `lighter`: marketId, symbol, kind, bestBid/Ask, spreadPct, nResting (bids+asks), bid/askNotionalUsd, imbalance, **whales[≤8]**: {account, orders, notionalUsd, side(dominant), avgPx, pxLo, pxHi, filledPct(avg 1−rem/init)}, **partialFills[≤6]**: orders with initial notional ≥ $10k and fill ≥ 30% {orderId, account, px, initial, remaining, fillPct}, recentTrades[≤10] {px, sz, usd, isMakerAsk, ts}, whaleTopNotionalUsd + whaleSharePct (top-8 share of book).
  - `kraken`: pairKey, bestBid/Ask, spreadPct, bids/asks[10] {px, sz, ts}, imbalance10.
- Funding math check (RV-DATA R3 F1 lesson): HL `funding` is the **1-hour rate** — annualized APR = rate × 24 × 365 × 100 %. Never multiply by 100 twice.

## 4. UI — `src/components/cg/microstructure-panel.tsx` (classic overview, under DerivativesPanel)

- `usePolling('/api/cg/micro?sym=', 15_000)`; hides itself when unmapped or all sources dead (like DerivativesPanel).
- Card 1 **Perp L2 · Hyperliquid xyz**: mark vs oracle Δ, spread, OI notional, funding 1h + APR, vol24h; 10-level ladder with size bars + `n` order-count; 20-level notional imbalance bar (bid/ask split).
- Card 2 **L3 resting orders · Lighter**: BBO + spread, resting count, notional imbalance; whale table (account 6-digit short + …, orders, $, side, px range, fill%); partial-fill list; last prints with maker-side arrow (▲ ask-maker = taker bought).
- Card 3 **Spot L2 · Kraken** (FX only): BBO, spread, 10-level ladder, imbalance.
- Footnote on every card set: *signal-market microstructure — execution stays at broker MT5 (FundedNext); these venues are not execution venues* (Laurie's signal≠execution rule from the R1 review, applied to the new layer).
- THIN markets (XPT, JP225, GBP-HL) get an amber badge like DerivativesPanel's liquidity badge.

## 5. Desk deepscan — `scripts/desk_deepscan.py`

Classic reports for mapped syms gain a **§micro** block: L3 imbalance, top whale notional/share, partial-fill count, HL funding/OI-vs-COT direction note. Metals (XAU/XAG/XPT perp reports) get a compact L3 line. No scorecard weight changes in R4 — microstructure is CONTEXT, not a placement gate (quant rule: signal-market data must not gate execution until correlations are studied).

## 6. Backfill scripts (desk-side, `scripts/`)

- `backfill_dukascopy.py --sym XAUUSD --hours 48 --out data/dukascopy/` — .bi5 hourly pull, LZMA-alone decode, `>3i2f` parse, CSV out (ts_ms, bid, ask, bid_vol, ask_vol). Point-value divisor per instrument family (JPY pairs /100, FX 5-digit /100000, metals /1000, indices /10 or /100 — verified per symbol at runtime by sanity-range check vs Yahoo last close; refuse to write implausible rows).
- `backfill_binance_vision.py --sym XAUUSDT --days 5 --kinds trades,bookDepth` — daily ZIP download + unzip to data/binance-vision/ + row counts logged. No parsing in v1 (raw archives).

## 7. Out of scope (explicit)

- WebSocket streams (REST polling 10–15 s is enough for desk rounds; WS is an R5 lever).
- Lighter SPY/QQQ/IWM ETF-context cards; Lighter market auto-discovery (/markets 403).
- Binance fapi COPPERUSDT/XPDUSDT/PAXGUSDT extra venues (perp-registry change — separate round).
- Bitfinex R0 + Coinbase PAXG L3 (thin; gold already covered 3 ways).

## 8. Verification criteria (all must pass before ship)

1. `npx tsc --noEmit` clean; `npm run build` clean.
2. `/api/cg/micro?sym=XAU` → hl ok (mark within ±1% of Binance fapi XAUUSDT), lighter ok (≥100 resting orders, whales[0].notionalUsd > 0, plausible px), kraken absent-or-ok.
3. `/api/cg/micro?sym=EURUSD` → all three sources ok; Kraken spread < 0.05%.
4. `/api/cg/micro?sym=US30` → 400 with mapped-symbol list (honest gap).
5. Numbers cross-checked against probe evidence files (no invented fields).
6. UI smoke on dev server: classic overview for XAU/SPX500/EURUSD shows the panel; US30 shows nothing (hidden, no console errors).
7. Deepscan emits §micro for a mapped classic sym without breaking existing sections.

## 9. R4 REVIEW ADDENDUM (RV-ARCH + RV-QUANT, 2026-11-11 — both APPROVE-WITH-CONDITIONS; all conditions adopted)

Evidence gap closed: `probe_l2l3_fix.py` re-probed all 13 Lighter markets with correct
`{code, asks[], bids[]}` parsing — full books persisted (`lighter-<NAME>-l3book.json`,
`lighter-<NAME>-trades.json`, `lighter-l3-full-verify.json`). XAU: 250/250 orders, $15.2M ask /
$15.3M bid visible, spread 0.0076%; SPY $15.8M; WTI $10.7M; every market echoes
`market_symbol` (drift guard). Kraken 6 pairs verified (NZDUSD = unknown pair → dropped).

Adopted fixes:
- **B1 (both)** funding APR: single formula `fundingAprPct = funding1hPct × 8760`
  (1h rate, no ×8). Fixtures: GOLD 0.00063→5.51 · NVDA 0.00452→39.58 · BRENT −0.0145→−127.02.
  |APR|>500 → null + data-error note. Label: "APR if current 1h rate persisted".
- **B2 (ARCH)** Lighter id drift guard: `recentTrades[0].market_symbol` echo must match the
  registry symbol; plus Lighter-mid vs HL-mark cross-check, |diff|>1.5% → `ok:false, error:"market id drift suspected"`.
- **B3 (QUANT)** whale floor = max($50k, 5% of visible side notional); thin suppression:
  HL card hidden when vol24h<$5M (hides JP225/XPT/xyz:EUR/BABA/NFLX/QCOM/GME — honest);
  Lighter card hidden when min(bidNtl, askNtl)<$250k; Kraken STALE badge when newest level
  age>120s or spread>0.5% (USDJPY case — real).
- **B4 (QUANT)** Kraken never gates basis when stale; desk rule documented in deepscan.
- **M1 (ARCH)** book TTL 30s (UI polls 15s — cache = multi-client dedupe + upstream protection).
- **M2 (ARCH)** `Promise.allSettled`, per-source timeout 8s, no serial waits.
- **M3 (ARCH)** Card 1 drops nothing but labels venue on every line ("Hyperliquid xyz");
  funding shown as 1h rate primary, APR secondary — DerivativesPanel keeps Coinglass venue table.
- **MM/whale split (QUANT)**: accounts with BOTH sides ≥20% of their notional = "quoting/MM"
  context list; directional whales = one-sided ≥80%. Omnibus #281474976710654 ($18–30M two-sided
  on every market) lands in quoting, not whales.
- **Partials label**: "visible partials only" (censored sample — filled orders vanish).
- **Venue-health gate (QUANT)**: |markVsOraclePct|>0.3% OR |fundingAprPct|>200% → xyz card
  suppressed with reason (NATGAS 574% APR trips it — venue stress is not signal).
- **ΔOI 24h**: hourly in-memory OI history per coin; honest null until ≥23h of history.
- **m-fixes**: SP500 alias · per-source cache maps (cap 128) · fetchedAt/ageMs echo ·
  weekend/closed-session footnote · deepscan Kraken sequential+sleep · taker prints labelled
  with count+span ("last N prints · span Xs") — thin-market trade lists are anecdote, not flow.
- **Scorecard**: §micro stays OUT of the desk scorecard JSON entirely (not zero-weight);
  promotion requires a logged correlation study over ≥30 rounds + user approval.
