# CG Order-Flow Terminal V2 — Architecture & Upgrade Spec

**Date**: 2026-11-12  
**Scope**: Option A (Core Terminal + Alpha Cockpit) — Curated Top 30 Crypto + High-OI TradFi + Memory/Cache Scaling + Cross-Asset Alpha Matrix + Read-Only Live Desk/MT5 Blotter + Full ESLint Remediation.

---

## 1. Curated Asset Universes

### 1.1 Tier-1 Perp Registry (`src/lib/cg/assets.ts` — 33 Assets: 30 Crypto + 3 Metals)
All 30 crypto symbols are live-verified on Binance USDT-M Perpetuals and Coinglass multi-venue derivatives APIs (`orderFlow`, `liquidationLevels/v2`, `fundingRate/v2/home`, `openInterest/v3/chart`):

- **`fast` tier (8 primary movers — high-frequency background scan)**:
  `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`, `SUI`, `HYPE`
- **`slow` tier (22 crucial sector crypto + 3 core metals — staggered background scan + on-demand warm-up)**:
  - Majors & PoW: `ADA`, `AVAX`, `LINK`, `LTC`, `BCH`, `XLM`, `XMR`, `ZEC`, `TRX`
  - L1 / L2 / Infra: `NEAR`, `ARB`, `OP`, `APT`, `ZRO`
  - DeFi / RWA / AI / Meme: `UNI`, `AAVE`, `ENA`, `TAO`, `INJ`, `ONDO`, `WLD`, `1000PEPE`
  - Metals: `XAU`, `XAG`, `XPT`

### 1.2 Curated TradFi Registry (`src/lib/cg/classic.ts` & `src/lib/cg/micro.ts`)
Preserve all 84 existing instruments (`14` indices, `48` FX, `19` broker equities, `UKO`, `USO`, `NATGAS`) for full `desk_deepscan.py` and MT5 parity. Promote 10 live-verified high-OI/high-volume TradFi equities/ETFs with `broker: null` (signal/watchlist-only, non-MT5) and `tradfiCore: true`:
- `MU` (`xyz:MU`, Lighter #164)
- `SNDK` (`xyz:SNDK`, Lighter #139)
- `CRCL` (`xyz:CRCL`, Lighter #121)
- `MSTR` (`xyz:MSTR`, Lighter #122)
- `NBIS` (`xyz:NBIS`, Lighter #189)
- `COIN` (`xyz:COIN`, Lighter #109)
- `AVGO` (`xyz:AVGO`, Lighter #210)
- `TSM` (`xyz:TSM`, Lighter #168)
- `SOXL` (`xyz:SOXL`, Lighter #197)
- `SOXS` (Lighter #222)

Alias hygiene preserved: `SP500`→`SPX500`, `XYZ100`→`NDX100`, `GOLD`→`XAU`, `SILVER`→`XAG`, `CL`/`USOIL`→`USO`, `BZ`/`UKOIL`→`UKO`, unbacked pre-IPO synthetics excluded.

---

## 2. Engine, Cache & Memory Scaling

1. **Client Cache Leak Fix (`src/lib/cg/client.ts`)**:
   - `cgGet(path, 0)` (used by uncached backfill & poller loops) previously inserted huge pagination responses into `__cgClientCache`, saturating `800 / 800` entries and `81 / 96 MB` even with 15 assets. Only cache responses when `ttlMs > 0`.
   - Convert Map insertion eviction to true LRU on cache hits (`delete` + re-`set` on hit) and scale defaults (`CACHE_MAX = 1500`, `CACHE_MAX_BYTES = 128 MB`).
2. **Tiered Boot & Scanner (`src/lib/cg/engine.ts`, `src/lib/cg/scan.ts`)**:
   - Boot backfill (`backfillAllAssets`) covers `"fast"` assets + core metals (`XAU`, `XAG`) to prevent startup OOM/rate bursts; remaining crucial alts fill lazily via round-robin `pollAssetKlines` and on-demand routes.
   - `scanMarket` retains full `MarketSnapshot` in `S.market` (`ScanGlobal`) so the Screener compiles cross-asset telemetry with zero duplicate fetches.
   - Add `warmAssetScan(sym)` for instant single-asset warm-up from UI.

---

## 3. V2 API Surface

- **`GET /api/cg/screener`**: Returns live ranked rows for all 33 Tier-1 assets (`MarketSnapshot`, active footprint signals, nearest liquidation magnets above/below, funding 8h mean, CVD 24h delta, objective 5-factor Confluence Score, and optional `deskOrder` overlay badge) + Curated TradFi Core live snapshot powered by Hyperliquid `xyz` dex snapshot + Yahoo quotes. Supports `?warm=SYM`.
- **`GET /api/desk/live`**: Strictly read-only bridge over `desk/state.json`, `desk/mt5.json`, and `desk/log.md` returning active MT5 positions, suggested/placed orders with live terminal price distance/R-progress, risk slot usage, and recent round digests.

---

## 4. V2 UI & Code Health

- **Workspace Shell (`src/app/page.tsx`)**: Sticky Command Header with customizable Pinned Watchlist (`useSyncExternalStore` + `localStorage`), Category Drawer/Tabs (`Alpha Matrix` · `Desk & MT5` · `Crypto 30` · `TradFi Core` · `Binance 200` · `FX 48`), `Ctrl+K` Command Palette (`asset-palette.tsx`), and live Macro Regime Ribbon.
- **`AlphaMatrix` (`src/components/cg/alpha-matrix.tsx`)**: Sortable, sector-filterable cross-asset cockpit with Binance `!miniTicker@arr` 1s WS live ticks + TradFi Core tab.
- **`DeskBlotter` (`src/components/cg/desk-blotter.tsx`)**: Read-only institutional blotter visualizing MT5 execution, limit distance-to-fill, SL/TP R bars, and Z.ai / Antigravity round logs.
- **ESLint Zero-Error Target**: Resolve all 28 React Compiler / hooks errors and warnings across `page.tsx`, `use-cg-data.ts`, `BinanceView.tsx`, `carousel.tsx`, `use-mobile.ts`, and CG canvas/route warnings.
