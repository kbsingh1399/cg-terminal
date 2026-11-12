# QB — Microstructure full-universe expansion (implementation record)

Task ID: QB · Agent: implementation (Z.ai Code) · Date: 2026-11-12

## Scope delivered

Expanded the L2/L3 microstructure layer from ~30 TradFi instruments to the full
curated universe (30 crypto perps + 28 TradFi perps + 3 classics), plus a new
multi-venue BBO section and freshness telemetry, in:

- `src/lib/cg/micro.ts` (map + fetchers; 29 → 65 keys)
- `src/app/api/cg/micro/route.ts` (bbo + dataAt/ageMs/stale/source/missingVenues)
- `src/lib/binance/aliases.ts` (HL_XYZ_MAP verified additions only)
- `scripts/verify-micro-map.mjs` (NEW — live verification evidence)

## Live verification method (zero fabricated ids)

All checks done 2026-11-12 against the real APIs; the method is repeated in
code comments and in `scripts/verify-micro-map.mjs` (which parses the shipped
MICRO_MAP source so it can never drift):

1. `POST https://api.hyperliquid.xyz/info {"type":"metaAndAssetCtxs"}` → 235-coin MAIN dex.
2. `POST ... {"type":"metaAndAssetCtxs","dex":"xyz"}` → 144-market xyz dex.
3. `POST ... {"type":"l2Book","coin":X}` for "BTC", "kPEPE", "xyz:SPCX" (all three dexes route by coin name).
4. OKX `/api/v5/market/ticker?instId=<SYM>-USDT-SWAP` sweep over all 58 curated perps (missing: VET, 1000PEPE, 1000SHIB).
5. Bybit `/v5/market/tickers?category=linear&symbol=<SYM>USDT` sweep (missing: 1000SHIB, AMD).
6. Coinbase `/products/<SYM>-USD/ticker` for BTC/ETH/SOL/DOGE/XRP/LINK (all quote).
7. Binance fapi `bookTicker` for 1000PEPEUSDT/1000SHIBUSDT vs HL kPEPE/kSHIB marks → SAME 1000×-denominated quote scale (0.0044842 vs 0.004486; 0.004318 vs 0.004322) → no scale factor needed. OKX PEPE/SHIB swaps are spot-scale (1/1000) and are NOT scaled into the BBO (venue note instead).

## HL main-dex coins ADDED (crypto, verified in the 235-coin universe)

BTC ETH BNB SOL XRP ADA DOGE TRX LINK LTC AVAX DOT NEAR UNI ATOM XLM ETC FIL
ICP HBAR APT ARB OP SUI SEI INJ TIA (27 plain names) + 1000PEPE→kPEPE +
1000SHIB→kSHIB. VET has NO HL market on either dex (verified absent) → stays
unmapped with `MICRO_UNMAPPED_NOTES` reason + BBO.

## HL xyz coins ADDED (TradFi, verified in the 144-market universe)

SPCX→xyz:SPCX, SKHY→xyz:SKHY, NFLX→xyz:NFLX, DRAM→xyz:DRAM, KORU→xyz:KORU,
GOOGL→xyz:GOOGL (new canonical key; GOOG kept), CL→xyz:CL (new canonical key,
USO kept as alias, both carry Lighter WTI id 145).
All pre-existing xyz entries re-verified EXIST. QQQ and ANTHROPIC have NO xyz
market (xyz:ANT is a different instrument — $104 mark vs ANTHROPICUSDT $1382)
→ unmapped with notes + BBO.

## BBO section design (route response `bbo` field)

```
bbo: {
  sym, binancePair, okxInstId, bybitSymbol, coinbaseProduct,
  venues: [{ venue: binance|okx|bybit|coinbase, ok, bid, ask, mid, spreadBps,
             reason?, note?, at }],       // at = fetch completion time
  best: { venue, bid, ask, mid, spreadBps } | null,   // tightest spreadBps
  missingVenues: string[], at
}
```

- Binance via `fapiFetch` (shared IP-weight breaker), 5s cache; OKX 10s (ok only
  when code==="0"); Bybit 10s (ok only when retCode===0); Coinbase spot 10s and
  only for BTC/ETH/SOL/DOGE/XRP/LINK. Never throws; failures are ok:false+reason.
- Served for every micro-mapped sym AND every curated perp (58), including
  VET/QQQ/ANTHROPIC which get `200 {ok:true, supported:false, bbo, reason}`.
- Top-level telemetry: `dataAt` (oldest successful upstream fetch completion
  time — cache hits count at their original store time), `ageMs`, `stale`
  (>90s = STALE_MS), `source` (e.g. "hl-main+bbo"), `missingVenues`.
- Route concurrency: HL snap+book, Lighter book+trades and all 4 BBO venues run
  concurrently; assembly stays ordered (Lighter drift guard consumes the HL mark).

## Contract preservation (regression-checked via direct handler invocation)

- Unmapped unknown sym (US30): 200 {ok:true, supported:false, mapped:[…]} — unchanged.
- XAU: 200, hl xyz:GOLD + Lighter XAU + bbo — unchanged legs, new bbo field.
- SPX500/NDX100/UKO: existing xyz+Lighter cards preserved; UKO BBO rides BZUSDT.
- Thin markets (kSHIB, xyz NFLX, …): mapped but auto-suppressed with the amber
  THIN reason (wording now dex-aware: "thin HL main-dex market" vs "thin xyz market").
- `microLiveQuote` is now dex-aware (source union gained "hl-main"); screener/
  bookwalls/lto/cvd/ticker/livebook/fp-load consumers unaffected (they key off
  `hlCoinOf`/xyz only; new HL_XYZ_MAP entries are xyz coins, all with live
  Binance perps, so their fallback branches engage only when Binance data is gone).

## Verification results

- `node scripts/verify-micro-map.mjs` → 65 map keys parsed; 64 hl coins ALL
  "EXISTS" on their dex; VET/QQQ/ANTHROPIC "CORRECTLY ABSENT"; BBO probes:
  BTC ok on all 4 venues, NVDA/GOOGL/CL ok on binance+okx+bybit, 1000PEPE ok on
  binance+bybit with the expected OKX 51001 fail (+ scale note).
- End-to-end route handler test (bun, direct GET invocations): BTC 200
  (hl-main+bbo, coinbase tightest), XAU 200 (hl-xyz+lighter+bbo), 1000PEPE 200
  (kPEPE card + bbo), SPCX 200, VET/QQQ 200 supported:false+bbo, SPX500 200
  (cards + all-fail bbo telemetry), US30 200 supported:false.
- `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors 0 warnings.
- Dev server on :3000 NOT running during this task (curl /api/health → connection
  refused), so the live `curl 127.0.0.1:3000/api/cg/micro?sym=BTC` check was
  skipped per instructions; the bun handler invocation above covers the same path.
- Nothing committed (per constraint). Note: dev.log shows an OLD 500 for `/`
  from a transient mid-edit state of `src/components/cg/charts/cvd-canvas.tsx`
  (another agent's file); its current on-disk content type-checks clean.

## Pointers for later agents

- `MICRO_MAP` (micro.ts) is the single source of truth; `hlDexOf(coin)` picks
  the snapshot; `getHlSnapshot("main"|"xyz")` is the cached snapshot accessor.
- BBO caches: `__microBboBin` (5s), `__microBboOkx`/`__microBboBybit`/`__microBboCb` (10s).
- Do NOT add main-dex coins (BTC, kPEPE…) to `HL_XYZ_MAP` in aliases.ts — that
  map feeds xyz-snapshot consumers.
- OKX spot-scale PEPE/SHIB must not be scaled into the BBO (see OKX_SCALE_NOTES).
