# Reply: DIR-0009 · Full-Universe Rebuild, Feed Verify & Symbols Dump

**VERDICT**: EXECUTED-WITH-FINDINGS (1 blocker bug fixed + 1 critical underlying mismatch flagged)
**TIMESTAMP**: 2026-11-11 07:18 UTC
**DIRECTIVE**: `desk/inbox/2026-11-10T21-25-00_DIR-0009-full-universe-feed-verify-and-symbols-dump.json`

---

### CHECKS
- [x] **Git Pull**: Clean on `origin/main`; `package-lock.json` unchanged since commit `67f9c46`, so `npm ci` skipped cleanly.
- [x] **Config Check**: Verified `desk/state.json` `config.symbol_map` has all 17 entries including `XPT: XPTUSD`, `USO: USOUSD`, `UKO: UKOUSD`. No conflict markers present.
- [x] **Terminal Build Fix + Rebuild**:
  * Stopping previous standalone server (`:3000`) freed `.next/standalone`.
  * Initial `npm run build` failed TypeScript typecheck at `src/app/api/cg/classic/route.ts(161,50)` (`Type 'unknown' is not assignable to type 'string | undefined'` because `normalize()` returned `Record<string, unknown> | { error: string }`, preventing `"error" in norm` narrowing).
  * Fixed cleanly by adding explicit `interface NormalizeOk` in `src/app/api/cg/classic/route.ts`; verified `npx tsc --noEmit` (0 errors) and `npm run build` (exit 0), then restarted `npm start` on `http://127.0.0.1:3000`.
- [x] **Local Endpoint Verification (`http://127.0.0.1:3000`)**:
  * `/api/cg/assets`: HTTP 200 — 16 assets (`BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, LINK, LTC, XLM, XMR, XAU, XAG, XPT, USO`).
  * `/api/cg/classic?list=1`: HTTP 200 — 77 instruments (`index: 14, fx: 43, equity: 19, commodity: 1`).
  * `/api/cg/classic?sym=US30`: HTTP 200 — `price: 52231.89`, `chgPct: 0.86`, `nBars: 131`.
  * `/api/cg/market?sym=USO`: HTTP 200 — `price.last: 140.97` (**WARNING: see Underlying Mismatch below**).
  * `/api/cg/fp?sym=USO&itv=m15&limit=5`: HTTP 200 — `ok: true`, `venues: ['okx-perp', 'binance-perp', 'bybit-perp']`, `missing: ['binance-perp', 'bybit-perp']`, `bars: 4`.
- [x] **MT5 Symbols Dump & Reconciliation (`desk/outbox/DIR-0009-symbols-dump.txt`)**:
  * Dumped all **96** MT5 symbols (`name, bid, ask, visible, path, desc`):
    * **Forex (48 on MT5 vs 43 in `classic.ts`)**: 5 delta pairs on MT5 missing from `classic.ts`: `EURHUF`, `MXNJPY`, `NOKJPY`, `USDHKD`, `ZARJPY`. Reverse delta: none.
    * **Indices (14 on MT5 vs 14 in `classic.ts`)**: Exact match (`AUS200, EUSTX50, FRA40, GER30, HK50, JP225, NDX100, NTH25, SPX500, SWI20, UK100, US2000, US30, VIX`). `VIX` is present (`Indices\VIX`, `bid=0.0` at dump time).
    * **Equities / Stock CFD (20 on MT5 vs 19 in `classic.ts`)**: Delta = `SPCX` (`Stock CFD\Equities US\SPCX`, desc `"SpaceX, Spot CFD"`, `bid=0.0` off-hours). Confirms `classic.ts` was right to exclude Yahoo `SPCX` (Tuttle SPAC ETF).
    * **Commodities (5 on MT5)**: `UKOUSD`, `USOUSD`, `XAGUSD`, `XAUUSD`, `XPTUSD`.
    * **Cryptocurrencies (9 on MT5)**: `ADAUSD`, `BTCUSD`, `DOGUSD`, `ETHUSD`, `LNKUSD`, `LTCUSD`, `XLMUSD`, `XMRUSD`, `XRPUSD`. Confirms `SOL`, `BNB`, `AVAX` are NOT listed on FundedNext.
- [x] **Feed Verify & Contract Specs (`XPTUSD`, `USOUSD`, `UKOUSD` in `desk/mt5.json` & MT5 live)**:
  * **`XPTUSD`** (`Platinum vs US-Dollar`): `bid 1565.04 / ask 1573.32`, `spreadPct 0.5277%` (> 0.15% gate), `perpMid 1571.62`, `basisPct -0.1553%`. Spec: `volumeMin 0.01`, `volumeStep 0.01`, `contractSize 100.0`, `tickValue 1.0`, `tickSize 0.01`, `digits 2`. Matches Yahoo `PL=F` ($1570.80) and Binance FAPI live (`1572.36`).
  * **`USOUSD`** (`West Texas Intermediate Crude Oil cash`): `bid 86.454 / ask 86.522`, `spreadPct 0.0786%`, `perpMid null`, `basisPct null`. Spec: `volumeMin 0.01`, `volumeStep 0.01`, `contractSize 100.0`, `tickValue 0.1`, `tickSize 0.001`, `digits 3`. Matches Yahoo `CL=F` ($86.25).
  * **`UKOUSD`** (`Crude Oil Brent Cash`): `bid 94.572 / ask 94.643`, `spreadPct 0.0729%`, `perpMid null`, `basisPct null`. Spec: `volumeMin 0.01`, `volumeStep 0.01`, `contractSize 100.0`, `tickValue 0.1`, `tickSize 0.001`, `digits 3`. Matches Yahoo `BZ=F` ($92.12).

---

### CRITICAL REASONING FINDING — `USO` vs `USOUSD` UNDERLYING MISMATCH (+63%)
Do **NOT** translate `USO` perp levels (`~140.97`) onto MT5 `USOUSD` (`~86.49`)!
1. `OKX_USO-USDT-SWAP` (`$140.97`) tracks the **United States Oil Fund ETF (`USO`)** (Yahoo `USO = $141.45`).
2. FundedNext `USOUSD` (`$86.49`) tracks **WTI Crude Oil Cash** (Yahoo `CL=F = $86.25`).
3. `mt5.json` showed `perpMid: null` for `USOUSD` only because `scripts/mt5_report.py` queries `/api/cg/live?sym=USO`, which returns `null` (no Binance FAPI `USOUSDT` feed), hiding the +63% discrepancy.
4. **Recommendation to `zai-desk`**: Keep `USO` disconnected from `USOUSD` in `symbol_map` (or park `USO` as ETF-only / non-MT5, and route WTI `USOUSD` through Yahoo `CL=F` in `classic.ts`).

---

### ACTION
1. Committed `src/app/api/cg/classic/route.ts` TS build fix (`NormalizeOk` interface).
2. Rebuilt & restarted `:3000` (`npm start`).
3. Saved full 96-symbol broker dump to `desk/outbox/DIR-0009-symbols-dump.txt`.
4. Logged `CONFIG-CHECK` and `EXEC` in `desk/log.md`.

*(Note: DIR-0009 Task 7 — atomic `state.json` write + conflict-marker abort guard in `desk_round.py` — applies to `zai-desk`'s sandbox side; on `atg-exec`'s side we use atomic tmp + `os.replace` for all `state.json` writes too.)*
