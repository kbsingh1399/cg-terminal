# REPLY · DIRECTIVE DIR-0004 · BUILD Funding & Open-Interest Endpoints

- **Directive ID**: `2026-11-10T17-36-00_DIR-0004-funding-oi-endpoints`
- **Timestamp**: `2026-11-10T18:18:00Z`
- **Author**: `atg-exec`
- **Verdict**: `EXECUTED`

---

## 1. CHECKS & VERIFICATION
* **Coinglass Upstream Reachability**:
  * Funding rates endpoint: `https://capi.coinglass.com/api/fundingRate/v2/home` and `/api/fundingRate/chart?symbol=<SYM>` tested and verified live with full AES-256 decryption.
  * Open Interest endpoint: `https://capi.coinglass.com/api/openInterest/v3/chart?symbol=<SYM>&type=0&timeType=2` (1h cadence) tested and verified live across BTC, ETH, SOL, BNB, DOGE, and XAU.
* **Format & Precision**:
  * 8h normalized funding rates computed correctly (converting 1h intervals via `rate * 8` for Hyperliquid/Kraken/dYdX, 8h native for Binance/OKX/Bybit).
  * Open interest aggregated across all 21 venues, with 1h, 4h, and 24h percentage deltas calculated and rounded.
* **Constraints Compliance**:
  * Zero new npm/pip packages installed.
  * Read-only upstream calls.
  * No modifications made to `desk_round.py` or `desk/state.json` schema.

---

## 2. ACTIONS TAKEN
1. **Created Next.js Route `/api/cg/funding`**:
   * File: `src/app/api/cg/funding/route.ts`
   * Method: `GET /api/cg/funding?sym=<SYM>`
   * Returns: `{ ok: true, sym, venues: [...], aggregate: { fundingPct8h }, series: [...], updatedAt }`
2. **Created Next.js Route `/api/cg/oi`**:
   * File: `src/app/api/cg/oi/route.ts`
   * Method: `GET /api/cg/oi?sym=<SYM>`
   * Returns: `{ ok: true, sym, venues: [...], aggregate: { oiUsd, oiDelta1hPct, oiDelta4hPct, oiDelta24hPct }, series: [...], updatedAt }`
3. **Compiled Production Standalone Server**:
   * Rebuilt `.next/standalone/server.js` with TypeScript pass (`npx next build`).
   * Restarted standalone server on `http://127.0.0.1:3000` (PID 1917).
4. **Wired into Daemon Snapshot**:
   * Updated `scripts/mt5_report.py` to fetch funding and open interest for top-6 assets (`BTC`, `ETH`, `SOL`, `BNB`, `DOGE`, `XAU`).
   * Embedded `"positioning"` block directly into `desk/mt5.json` on every 45s cycle.
   * Also written to standalone `desk/positioning.json`.

---

## 3. EVIDENCE (Live CURL Outputs)

### A. Live Curl `/api/cg/funding?sym=BTC`
```json
{
  "ok": true,
  "sym": "BTC",
  "venues": [
    { "name": "Binance", "rate": 0.00629, "rate8h": 0.00629, "fundingIntervalHours": 8, "status": 1 },
    { "name": "OKX", "rate": 0.008479, "rate8h": 0.008479, "fundingIntervalHours": 8, "status": 1 },
    { "name": "Bybit", "rate": 0.01, "rate8h": 0.01, "fundingIntervalHours": 8, "status": 1 },
    { "name": "Hyperliquid", "rate": 0.000893, "rate8h": 0.007143, "fundingIntervalHours": 1, "status": 1 }
  ],
  "aggregate": {
    "fundingPct8h": 0.007978
  },
  "updatedAt": 1794334520031
}
```

### B. Live Curl `/api/cg/oi?sym=BTC`
```json
{
  "ok": true,
  "sym": "BTC",
  "venues": [
    { "name": "Binance", "oiUsd": 10772390074, "sharePct": 20.71 },
    { "name": "CME", "oiUsd": 7162814628, "sharePct": 13.77 },
    { "name": "Bybit", "oiUsd": 6106047937, "sharePct": 11.74 },
    { "name": "MEXC", "oiUsd": 5142525995, "sharePct": 9.89 },
    { "name": "Gate", "oiUsd": 4702004144, "sharePct": 9.04 },
    { "name": "OKX", "oiUsd": 3660741850, "sharePct": 7.04 },
    { "name": "Hyperliquid", "oiUsd": 3059189660, "sharePct": 5.88 }
  ],
  "aggregate": {
    "oiUsd": 52009295098,
    "oiDelta1hPct": 0.35,
    "oiDelta4hPct": 0.42,
    "oiDelta24hPct": 0.03
  },
  "updatedAt": 1794334526344
}
```

### C. Live `desk/mt5.json` Positioning Block
```json
"positioning": {
  "BTC": { "fundingPct8h": 0.008015, "oiUsd": 52044700002, "oiDelta1hPct": 0.42, "oiDelta4hPct": 0.49, "oiDelta24hPct": 0.1 },
  "ETH": { "fundingPct8h": -0.000386, "oiUsd": 24892012653, "oiDelta1hPct": 0.34, "oiDelta4hPct": -4.13, "oiDelta24hPct": -5.24 },
  "SOL": { "fundingPct8h": -0.006032, "oiUsd": 5214070816, "oiDelta1hPct": 0.44, "oiDelta4hPct": 0.1, "oiDelta24hPct": -1.45 },
  "BNB": { "fundingPct8h": 0.000593, "oiUsd": 1081091509, "oiDelta1hPct": 0.51, "oiDelta4hPct": -0.68, "oiDelta24hPct": -1.15 },
  "DOGE": { "fundingPct8h": -0.013065, "oiUsd": 911077251, "oiDelta1hPct": 0.33, "oiDelta4hPct": -1.46, "oiDelta24hPct": -2.7 },
  "XAU": { "fundingPct8h": 0.010959, "oiUsd": 1495461308, "oiDelta1hPct": 0.07, "oiDelta4hPct": -2.95, "oiDelta24hPct": -1.44 }
}
```

---

## 4. DESK STATUS
Directive DIR-0004 is **COMPLETE** and verified in production. Engine v3.2 can now consume both `/api/cg/funding` and `/api/cg/oi` directly from the local terminal.
