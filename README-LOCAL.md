# BTC Order-Flow Terminal — Local Hosting & Scalability Guide

Pure-API replica of five Coinglass views for BTC, running entirely on your PC,
plus a **continuity engine** that restarts gap-free. Every displayed value
comes from the Coinglass web API (capi/fapi.coinglass.com) through this app's
own route handlers — no mock, cached-dump or synthetic data anywhere.

## 1. Run it locally

Requirements: [Bun](https://bun.sh) (or Node 20+) and internet access to
`capi.coinglass.com` / `fapi.coinglass.com`.

```bash
bun install          # once
bun dev              # dev server on http://localhost:3000
```

Production (self-contained, what you should run long-term):

```bash
bun run build        # next build → .next/standalone
bun run start        # serves http://localhost:3000
```

The app needs **no Coinglass account** for everything below. The web client's
`obe` TOTP token is generated locally (`src/lib/cg/crypto.ts`), encrypted
responses are decrypted in-process with the same key-derivation chain the
browser uses.

### The continuity engine

The engine starts automatically with the server (Next.js instrumentation
hook, `src/instrumentation.ts`). On boot it pages upstream history from each
series' last stored timestamp (so a restart after downtime loses nothing that
the API still serves), then polls and appends only new rows:

| Series | Upstream | Poll | Backfillable |
|---|---|---|---|
| `kline:Binance_BTCUSDT:m15` | `#kline` | 60 s | ✅ endTime pagination |
| `bs_usd:<21 venues>:m15` | `#bs_usd` taker flows | 60 s | ✅ |
| `stopmap` (liquidation heat) | `/api/index/v2/liqHeatMap` | 5 min | ✅ 24h windows |
| `bookwalls` (depth snapshots) | aggregate NDJSON stream | 2 min | ✅ |
| `lto:open` (whale orders) | `largeTakerOrder/v3` | 60 s | ❌ current-state only |
| `liqlevels:3d` | `liquidationLevels/v2` | 2 min | ❌ point-in-time |

Data lives in `data/cg-series/*.jsonl` (plain JSON lines — inspect/backup
freely). `GET /api/cg/engine/status` reports per-series coverage, gaps and
last errors (also shown live in the header indicator);
`POST /api/cg/engine/backfill` triggers a gap-fill pass on demand.

Env knobs: `CG_ENGINE=off` (disable), `CG_ENGINE_BACKFILL_DAYS=3` (boot
backfill depth), `CG_ENGINE_BOOT_DELAY_MS`, `CG_DATA_DIR`.

## 2. The five tools and their parity guarantees

### Footprint — Signals (`Footprint` tab)
Coinglass computes footprint signals **in the browser** — there is no server
"signals" endpoint. This app runs their exact engine, ported line-by-line
into `src/lib/cg/cg-signals.ts`, on all three bar types (time / volume /
range, auto thresholds). **Verified parity**: identical signal counts, types,
prices and attached data points as the live page.

### Whale / Large Orders (`Large Orders` tab)
Open large resting orders across **all 14 exchanges** with Perp/Spot
variants, thresholds and filters, plus the **Whale-order walls** panel —
bid/ask wall levels aggregated at $50 buckets from the open whale orders only
(the subset of the book made of single large resting orders).

Source: `fapi /api/largeTakerOrder/v3` + `support/v3`. **Verified parity**:
all venue cards matched a simultaneous live capture.

### Liquidation Levels + Stops (`Liq Levels + Stops` tab)
- **Levels 3D/7D/30D**: estimated clusters within ±1..8% of price, aggregated
  over Binance + OKX + Bybit + Hyperliquid, using the live page's exact
  520-row grid model (`src/lib/cg/liq-model.ts`). **Verified parity**: key
  levels matched to the decimal.
- **Stops heatmap 24h**: the /pro/futures/LiquidationHeatMap model — 288
  5-minute bars of estimated liquidation exposure per price level
  (`/api/index/v2/liqHeatMap`, the page's default anonymous window), with
  sweep-magnet clusters, distance bands and the honest framing note below.
  Anonymous access = 24h window; longer windows need a Coinglass login
  (the credentials on file currently return "Incorrect password" — update
  `.env`/CG creds if you have an account). The engine archives every 24h
  window, so your multi-day stop map accumulates locally regardless.

### Book Walls (`Book Walls` tab)
The aggregate order-book heatmap of the /LiquidityHeatmap page: bid/ask depth
within ±0.5–5%, imbalance (now + 5 minutes ago), largest bid/ask wall, the
wall list within ±3% and the add/fill/pull event feed — computed with their
exact wall scanner (`src/lib/cg/book-walls.ts`: adaptive threshold ≥ 6× the
±1% local median, $1.5M minimum for BTC, 2-snapshot confirmation) over the
**server-side aggregate depth stream** (futures: Binance+OKX+Gate+Bitget+
Hyperliquid, mid-shift aligned).

**Verified live parity (same minute, futures aggregate, ±1%)**: bid depth
587M vs 583–595M, ask depth 634M vs 641M, imbalance −3.8% vs −3.7/−4.7%,
7.8K/8.4K BTC vs 7.8K/8.5K BTC — within ~1%. Largest-wall cards on their
page flip second-by-second on live WebSocket data (walls "up 27s"); our list
is the confirmed-snapshot set, matching their own historical scan semantics.

### CVD (`CVD` tab)
Cumulative Volume Delta from the /cvd/BTC page: futures CVD, spot CVD,
taker-buy share, spot-vs-futures quadrant, Bull/Bear divergences with
12-bar hit tracking — their exact client engine (`src/lib/cg/cvd.ts`:
5-bar swing pivots, 4–60 bar spacing, confirm at pivot+5, no repaint) over
per-venue `#bs_usd` taker flows (21 venues).

**Verified live parity**: latest divergence matched exactly (Bull div,
confirmed 11-08 03:30 on both sides); taker-buy share 49.5% vs 49.6%;
day-window quadrant "Spot bid" = their "Spot bid".

## 3. API routes (all server-side, cached)

| Route | Upstream calls (per refresh) | TTL cache |
|---|---|---|
| `/api/cg/ticker?sym` | 1× kline m1 (limit 2) | 3 s (`CG_TICKER_TTL_MS`) |
| `/api/cg/fp?sym&itv&limit` | 4× orderFlow + 2× kline (+4× oi_kline) | 20–30 s |
| `/api/cg/lto?minVolUsd` | 1× support + 14× largeTakerOrder/v3 | 10 min / 30 s |
| `/api/cg/liqlevels?range&lvR` | 4× liquidationLevels/v2 | 60 s |
| `/api/cg/stopmap?endTime` | 1× liqHeatMap v2 (24h window) | 30 s |
| `/api/cg/bookwalls?market&interval&limit&band` | aggregate NDJSON stream + kline | 45 s |
| `/api/cg/cvd?itv&limit&mode&anchor` | 2× tickers + 1× kline + 21× #bs_usd | 45 s |
| `/api/cg/market?sym` | 4× kline (m15/h1/h4/d1) | 60 s |
| `/api/cg/engine/status` · `/backfill` | store health / gap fill | — |

### Live refresh cadence (what updates how fast)

| Data | UI refresh | Server cache | Effectively live to |
|---|---|---|---|
| **Header price + Overview big price (all tabs)** | **1 s** | 3 s shared (`/api/cg/ticker`) | **≤ 4 s** |
| Overview auction/EMA/RSI/VWAP | 30 s | 60 s | ~1 min |
| Footprint signals & charts | 30–45 s | 20–30 s | ~1 min |
| Whale open orders | 45 s | 30 s–10 min | ~1–2 min |
| Liquidation levels | 45 s | 60 s | ~2 min |
| Stops map | 60 s | 30 s | ~2 min |
| Book walls / CVD | 45–60 s | 45 s | ~2 min |
| Alerts feed | **push (SSE)** the moment detected | — | seconds |

The price feed reads the forming m1 candle close from Coinglass — the
same number their site charts show — so the header ticks every second
while staying gentle on upstream (one shared fetch per ~3 s regardless
of how many tabs or agents poll).

Scalability properties:

- **In-memory TTL cache per URL** — N browser tabs share one upstream call;
  insertion-order eviction past 800 entries (`CG_CLIENT_CACHE_MAX`).
- **Bounded continuity store** — per-series row cap (`CG_STORE_MAX_ROWS`,
  default 60k) with automatic file compaction; on-disk filenames are
  Windows-safe (`:` flattened to `_`, legacy stores auto-migrate).
- **Stale-soft-fail** — upstream errors serve the last good payload.
- **AllSettled fan-out** — one failing venue never fails the aggregate.
- **Continuity engine** — append-only JSONL store, dedup by key, boot
  backfill, so local history is restart-safe and grows without gaps.
- **Multi-symbol ready** — everything is parameterised (`?sym=ETH`); the UIs
  pin BTC per project scope.

## 4. Honest data framing (read this once)

- **Liquidation levels & stops map**: model *estimates* from aggregate open
  interest, funding and leverage tiers — exchanges do not publish individual
  liquidation prices. Strong clusters are liquidity **magnets** that attract
  sweeps; they are not guaranteed targets. We reproduce Coinglass's numbers
  exactly, and their number is itself an estimate.
- **Whale-order walls** cover only single resting orders above the threshold;
  **Book Walls** covers the complete aggregated depth — use both.
- **CVD divergences** confirm 5 bars after the second pivot and never
  repaint; the hit rate is measured on the loaded window (history, not a
  promise).
- Figures are upstream estimates for personal analysis, not investment
  advice.

## 5. Troubleshooting

- **502 from a route** — Coinglass API hiccup; the route retries on the next
  poll. Persistent failure usually means IP rate-limiting: wait a few minutes.
- **"this window needs a Coinglass login" (stopmap)** — only the >24h
  heatmap windows need an account; the 24h default works anonymously.
- **A venue shows no data** — that exchange returned nothing this poll (same
  banner as the live page).
- **Engine indicator amber** — a series' last poll errored; hover the header
  chip for per-series detail, or `POST /api/cg/engine/backfill`.
- **Memory on small hosts** — the dev server (Turbopack) plus boot backfill
  can exceed ~4 GB; run `bun run build && bun run start` (production uses far
  less) and/or set `CG_ENGINE_BACKFILL_DAYS=1`.
