# QA — Quant Positioning + Options API routes

Task ID: **QA** · Agent: quant-options-api · Date: 2026-11-12 · Status: DONE, verified

## Files created (no existing files modified, nothing committed)

1. `src/app/api/cg/quant/route.ts` — GET `/api/cg/quant?sym=`
2. `src/app/api/cg/options/route.ts` — GET `/api/cg/options?sym=`
3. `scripts/test-quant-options.mjs` — upstream smoke test (node, no server needed)

## What was built

### /api/cg/quant (30s TTL cache per upstream, in-flight coalescing)
- **L/S ratios**: 12 Binance fapi `/futures/data/*` calls (global/topAccounts/topPositions/taker × 15m/1h/4h,
  limit=2, last row + chgPct vs previous). Verified live for crypto AND TradFi plain-name perps
  (NVDAUSDT, XAUUSDT, CLUSDT all work).
- **Funding**: Coinglass `/api/fundingRate/v2/home` uMarginList (status=1 venues) → per-venue
  rate/rate8h (interval-normalized), OI-weighted aggregate using per-venue latest USD OI from
  `/api/openInterest/v3/chart?type=0&timeType=2` dataMap; venues missing from the OI map get the
  mean OI weight (documented in `notes`); equal-weight fallback if no OI at all; annualized
  APR = w8h% × 3 × 365; spread bps + [maxVenue, minVenue].
- **OI×price 4-quadrant**: same OI chart, nearest-timestamp index at now−1h/4h/24h →
  NEW_LONGS / SHORT_COVERING / NEW_SHORTS / LONG_LIQUIDATION + oiToVolRatio (OI / fapi
  24h quoteVolume).
- **Basis**: perp lastPrice (fapi ticker/24hr) vs Binance spot — crypto uses the perp pair,
  curated TradFi uses the pinned `spotPair` (NVDABUSDT / XAUTUSDT) from CURATED_BY_SYM, TradFi
  without a spot leg → null + reason (e.g. CL, 1000PEPE which has no spot listing). BTC/ETH/SOL
  also get the Coinbase USD premium in bps.
- Gate order: `anyTerminalSym` → 400; `knownSym` false (SPX500/NDX100/UKO) → 200 supported:false.
- Telemetry: dataAt = oldest contributing payload; L/S rows use bucket-END semantics
  (row ts + period, clamped to now — rows are stamped at bucket start).

### /api/cg/options (Deribit, BTC+ETH only; others → 200 supported:false with the specified reason)
- DVOL via `get_volatility_index_data` (60s cache), chain via `get_book_summary_by_currency`
  (120s cache). Option expiry = 08:00 UTC; monthly = last-Friday detection.
- ATM IV term structure (7d/30d/90d = nearest expiry beyond each horizon, ATM call+put mark_iv avg),
  25d RR (delta-match if rows ever carry deltas — they don't — else approx-strikes 1.1×S/0.9×S,
  labeled + noted), max pain (3 nearest monthly expiries, standard intrinsic-payout minimization),
  top-5 call/put OI walls (nearest expiry with OI ≥ 5% of the max-OI expiry, fallback noted),
  GEX (Σ_call OI×gamma − Σ_put OI×gamma; gamma via Black-Scholes r=q=0 on real mark_iv/und/T since
  summary rows carry NO greeks; plus netGexUsdPer1Pct = ×spot²×1%), put/call OI + vol24h ratios.
- `notes[]` lists every approximation; failures null sections with reasons, route stays 200.

## Shape mismatches discovered (and how handled)

1. **Deribit DVOL wraps the array**: `result` is `{ data: [[ts,o,h,l,c],…] }`, NOT a bare array.
   First run had dvol:null because of this — fixed to accept both shapes (object-wrapped verified live).
2. **Book summary rows have NO greeks** (no delta/gamma/theta/vega keys at all, 896 rows checked) →
   RR uses the documented approx-strikes method, gamma is computed Black-Scholes — both labeled.
3. **Coinglass funding `rate` is PERCENT per interval** (BTC 0.005366 = 0.005366%/8h; cross-checked
   against fapi premiumIndex lastFundingRate 0.00005234 fraction). Task formula's "×100" assumed a
   fraction — annualizedAprPct is computed correctly for percent units (w8h × 1095) and the units are
   documented in `notes`.
4. **Taker volumes are BASE-asset units** (buyVol in BTC/NVDA, not USD) → buyVolUsd/sellVolUsd convert
   at the perp last price, noted. If the ticker fails they go null (ratio stays).
5. **fapi /futures/data rows are stringly-typed** and stamped at bucket START; taker endpoints lag one
   bucket (4h taker's newest row covers the last CLOSED bucket). Handled via Number() everywhere and
   bucket-end dataAt (see above).
6. **Binance spot has no 1000PEPEUSDT / 1000SHIBUSDT** (HTTP 400 -1121) → basis null with honest
   reason; NVDABUSDT / XAUTUSDT / SOLUSDT spot legs verified working.

## Verification

- `npx tsc --noEmit` → **0 errors** (exit 0). NOTE: at task start there were 3 transient errors in
  `src/lib/cg/micro.ts` from a concurrent agent's in-flight edit (not my files); they were resolved
  by that agent during my run — final state is fully clean.
- `npm run lint` → **0 errors, 0 warnings**.
- `node scripts/test-quant-options.mjs` → all upstream probes ok (see file/report for output; the
  1000PEPEUSDT spot 400 is the expected honest-degradation case).
- Route handlers exercised directly via bun harness (dev server was not running): BTC/NVDA/XAU/USO/
  1000PEPE/SPX500/FAKESYM quant + BTC/ETH/SOL/UKO options — all statuses, sections and telemetry
  correct; values cross-checked against premiumIndex and raw payloads.

## Notes for the next agent

- The quant route's `stale:true` on crypto responses is usually driven by the 4h taker bucket
  (oldest contributing payload is up to ~1h old between rolls) — honest by design.
- Route caches live on `globalThis` (`__quantRouteCache`, `__optionsRouteCache`) so dev-mode
  per-bundle module instances share them (project convention).
- No shared libs were touched. `src/lib/binance/aliases.ts` was modified by a concurrent agent
  during this task (not by me) and remains backward-compatible with these routes.
