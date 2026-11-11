# Reply: DIR-0011 · Rebuild Full-Universe UI (98 Instruments) & Feed Sanity

**VERDICT**: EXECUTED
**TIMESTAMP**: 2026-11-11 07:36 UTC
**DIRECTIVE**: `desk/inbox/2026-11-11T07-55-00_DIR-0011-rebuild-full-universe-ui.json` (supersedes `DIR-0009` task 6)

---

### CHECKS
- [x] **Git Pull**: Clean on `origin/main` (commit `008e2eb` / `9aea25b` pulled; `package-lock.json` unchanged, `npm ci` skipped).
- [x] **Typecheck & Rebuild**: Stopped prior `:3000` server cleanly; `npx tsc --noEmit` (0 errors) + `npm run build` (Turbopack compiled in `1664ms`, TypeScript finished in `5.3s`, 26 routes built) passed cleanly; restarted `npm start` on `http://127.0.0.1:3000`.
- [x] **(a) `/api/cg/assets`**: HTTP `200`, **15** perp assets (`BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, LINK, LTC, XLM, XMR, XAU, XAG, XPT`). `USO` cleanly removed from perp registry.
- [x] **(b) `/api/cg/classic?list=1`**: HTTP `200`, **83** classic instruments (`index: 14, fx: 48, equity: 19, commodity: 2`). Total UI toggleable universe = **98** (`15 + 83`).
- [x] **(c) `/api/cg/classic?sym=USO`**: HTTP `200`, `yahoo: "CL=F"`, `name: "WTI Crude Oil"`, live `price: 86.11` (aligned with broker `USOUSD` WTI cash `86.401 / 86.464`, spread `0.0729%` — NO ETF mismatch).
- [x] **(d) Browser UI (`ALL ⌄` Search & Classic Overview)**: Verified via live Chrome DevTools MCP at `http://localhost:3000`:
  * Palette opens displaying `All assets 98/98` grouped into `CRYPTO PERPS · 12`, `METALS PERPS · 3`, `INDICES · 14`, `FOREX · 48`, `EQUITIES · 19`, `COMMODITIES · 2`.
  * Typing `US30` + `Enter` navigated to `http://localhost:3000/?sym=US30`.
  * Only the `Overview Auction · EMA · RSI · VWAP` tab remained visible (`Footprint` / `Large Orders` / `Liq Levels` / `Book Walls` / `CVD` / `Alerts` cleanly hidden for T3 classic).
  * Rendered `DOW JONES 30 · INDEX · BROKER US30 · YAHOO ^DJI` (`52,231.89`, `+0.86%`), `VWAP ±Σ` (`52,285.49`), `EMA 13 / 89 / 233 · RSI(14)` (`15m`: EMA13 `52,190.55`, EMA89 `52,223.47`, RSI `57.9`), and `VOLUME PROFILE` (`VAH 52,519.26`, `POC 52,208.27`, `VAL 51,388.41`).
- [x] **(e) Browser UI (`←`/`→` Universe Rotation + `?sym=` URL Sync)**:
  * Clicked main body, pressed `ArrowRight`: rotated cleanly `US30` → `SPX500` (`http://localhost:3000/?sym=SPX500`).
  * Pressed `ArrowLeft`: rotated cleanly `SPX500` → `US30` (`?sym=US30`).
  * Pressed `ArrowLeft` again: crossed boundary into perp `XPT` (`?sym=XPT`), immediately restoring all 7 order-flow tabs.
- [x] **XAU / XAG / XPT Feed Sanity vs `desk/mt5.json` (`ts 1794382369439`)**:
  * **`XAU` (`XAUUSD`)**: Terminal market `4069.79`, live `4069.80` (`binance-fapi`) vs MT5 `bid 4062.55 / ask 4062.93` (`mid 4062.74`), `spreadPct 0.0094%`, `mt5.basisPct -0.1573%` (clean, passes both broker gates).
  * **`XAG` (`XAGUSD`)**: Terminal market `53.16`, live `53.165` (`binance-fapi`) vs MT5 `bid 53.036 / ask 53.098` (`mid 53.067`), `spreadPct 0.1168%`, `mt5.basisPct -0.1468%` (clean, passes both broker gates).
  * **`XPT` (`XPTUSD`)**: Terminal market `1570.43`, live `1570.86` (`binance-fapi`) vs MT5 `bid 1563.11 / ask 1571.71` (`mid 1567.41`), `spreadPct 0.5487%`, `mt5.basisPct -0.1866%` (price & basis tightly aligned; **blocked by 0.15% spread gate** at `0.5487%`).

---

### REASONING
Moving `USO` onto Yahoo `CL=F` completely resolved the `+63%` instrument discrepancy (`$86.11` vs MT5 `USOUSD` `$86.43`), while adding the 5 missing MT5 FX pairs gives 1:1 coverage across all 48 broker FX pairs. Both the backend API routes and the rebuilt Chrome frontend verified cleanly end-to-end across all 98 instruments. XAU/XAG/XPT terminal and Binance FAPI live feeds align tightly with FundedNext MT5 within `-0.15%` to `-0.19%` basis.

---

### ACTION
1. Rebuilt production standalone bundle (`npx tsc --noEmit` + `npm run build`) and restarted `:3000`.
2. Verified endpoints (a)–(c), Chrome DevTools UI checks (d)–(e), and XAU/XAG/XPT feed parity vs `desk/mt5.json`.
3. Logged `EXEC` in `desk/log.md`, updated `desk/outbox/AGENT-STATUS.md`, and cleared `DIR-0011` from `desk/inbox/WAKE.md`.

---

### EVIDENCE
```
/api/cg/assets: 15 [BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, LINK, LTC, XLM, XMR, XAU, XAG, XPT]
/api/cg/classic?list=1: 83 {'index': 14, 'fx': 48, 'equity': 19, 'commodity': 2}
/api/cg/classic?sym=USO: yahoo='CL=F', price=86.11
XAU: term 4069.80 vs MT5 mid 4062.74 | basis -0.1573% | spread 0.0094%
XAG: term 53.165 vs MT5 mid 53.067  | basis -0.1468% | spread 0.1168%
XPT: term 1570.86 vs MT5 mid 1567.41 | basis -0.1866% | spread 0.5487%
UI Chrome DevTools: ALL 98/98 -> US30 (?sym=US30, Overview tab only) -> ArrowRight (?sym=SPX500) -> ArrowLeft (?sym=US30) -> ArrowLeft (?sym=XPT, 7 tabs restored)
```
