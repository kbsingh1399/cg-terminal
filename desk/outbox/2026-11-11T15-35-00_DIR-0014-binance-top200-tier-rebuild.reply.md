# DIR-0014 Reply — Binance Top-200 Tier-2 Rebuild & Verification

**VERDICT**: PARTIAL (SYNC + BUILD + MARKET DATA + UI VERIFIED; TESTNET EXECUTION PENDING LOCAL `.env` KEYS; `BinanceView.tsx` HAS 14 ESLINT ERRORS TO CLEAN UP)

## CHECKS

1. **Git Sync & Dependencies**:
   - Pulled `origin/main` through `4404aaa` (`feat(binance-tier): top-200 liquidity universe + realtime L2/tape/candles + testnet demo trading`) and synced daemon state (`fef6210`, `23b458b`).
   - `package-lock.json`: unchanged -> skipped `npm ci`.
2. **Static Typecheck, Lint & Production Build**:
   - `npx tsc --noEmit`: PASS (exit 0).
   - `npx eslint` on `4404aaa` files: FAIL (exit 1 — `14 problems (14 errors, 0 warnings)` in `src/components/binance/BinanceView.tsx`: 3 `react-hooks/set-state-in-effect` at L83/L127/L147 and 11 `react-hooks/static-components` from defining `const Stat = ...` inside render at L195 used at L227/L232–237/L243/L249/L255–256).
   - `npm run build` (`next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`): PASS (exit 0; all 6 `/api/binance/*` routes compiled).
   - Daemons restarted cleanly: standalone `:3000` (`npm start`) and `node scripts/desk_daemon.mjs` (plus `python scripts/wake_watcher.py` running).
3. **Local `.env` Credentials Check**:
   - Inspected local `.env` key names only: contains only `DATABASE_URL` and `CG_ENGINE_BACKFILL_DAYS`. No `BINANCE_API_KEY`, `BINANCE_API_SECRET`, or `BINANCE_MODE` present on disk (nor found in local Antigravity conversation history).
4. **Endpoint Verification (`http://127.0.0.1:3000`)**:
   - `GET /api/binance/universe`: `200`, `ok=true`, `n=200`, `#1 BTC` (`vol=10.50B`, `decs=1`).
   - `GET /api/binance/market?sym=ZEC`: `200`, `ok=true`, `ticker.last=969.55`, `mark.fundingRatePct=0.004466`, `oi.usd=467578108.13`.
   - `GET /api/binance/klines?sym=ZEC&interval=15m&limit=120`: `200`, `ok=true`, `120` rows.
   - `GET /api/binance/account`: `200`, `ok=false`, `mode=null`, honest unconfigured message (`no BINANCE_API_KEY/SECRET in .env...`).
   - `GET /api/cg/live?sym=ZEC`: `200`, `ok=true`, `price=970.84`, `source="binance-fapi"`, `stale=false`.
   - Regression: `GET /api/cg/assets` (`200`, `15`), `GET /api/cg/classic?list=1` (`200`, `84`), `GET /api/health` (`200`, `ok=true`).
   - `python scripts/binance_tier_verify.py`: **19 passed, 4 failed**. All 19 market-data, bulk quotes, kline/market validation, `cg/live`, and regression assertions passed; the 4 failures (`account testnet`, `testnet place LIMIT`, `order visible on account`, `testnet cancelAll`) correspond solely to missing `.env` Testnet keys.
5. **Browser Verification (Chrome DevTools MCP on `http://127.0.0.1:3000`)**:
   - (a) Header: renders `"15 perp + 188 binance + 84 classic = 287 instruments"`.
   - (b) `BINANCE 200` grid: renders `200` rows (`#1 BTCUSDT $10.50B` through `#200 KMNOUSDT $3.3M`); initially showed `LIVE · WS 1s` then fell back to `REST · 5s` with `LAST` & `24H VOL` populated while `24H CHG` & `24H RANGE` stayed `–`.
   - (c) `?sym=ZEC` (`BinanceView`): verified live `ORDER BOOK` (`L2 depth20 @100ms · live`, 20 levels, `spread 0.08 | mid 977.27 | 0.8 bps`, `$44.9k bids | 20-level imbalance | $39.1k asks`), `TRADE TAPE` (`346/s · fstream @trade` live prints), `300 bars · 15m · UTC` canvas + `forming O 974.81 H 978.84 L 974.24 C 977.31`, stats strip (`-17.43%`, `$3.09B`, `MARK 977.70`, `FUNDING / 8H +0.0046%`, `NEXT FUNDING 47m 29s`, `OPEN INTEREST $472.0M`), and `BINANCE DEMO ACCOUNT` showing honest `NOT CONFIGURED`.
   - (d) `ALL ⌄` palette: shows `287 / 287` and `"BINANCE PERPS (TOP-200 LIQUIDITY) · 188"` group with `#rank` badges (`#3`..`#200`).
   - (e) Console errors: **0** console errors on `?sym=ZEC` (`BinanceView`) and palette; initial `/?sym=BTC` page logged 4 HTTP resource-status errors (`GET /favicon.ico 404` ×2, `GET /api/cg/micro?sym=BTC 400` ×2) with zero uncaught JS/React runtime exceptions.

## REASONING

- Tier-2 Binance USDT-M market data (`universe`, `market`, `klines`, `quotes`, `/api/cg/live`), browser WebSocket streams (`@depth20@100ms`, `@trade`), and UI navigation all work end-to-end on `:3000`.
- Testnet order round-trip checks (`binance_tier_verify.py` steps 6–7 and UI `DemoAccountPanel` `TESTNET · LIVE` order test) cannot execute locally until the user adds their `BINANCE_API_KEY`, `BINANCE_API_SECRET`, and `BINANCE_MODE=testnet` into local `.env`.
- Reported the 14 ESLint errors in `src/components/binance/BinanceView.tsx` and the `BINANCE 200` grid WS-to-REST fallback (`24H CHG` / `24H RANGE` showing `–`) transparently rather than silently modifying `zai-desk` application files during verification.

## ACTION

- Asked the user directly to paste `BINANCE_API_KEY`, `BINANCE_API_SECRET`, and `BINANCE_MODE=testnet` into local `.env` (gitignored) and let us know once added so we can run Testnet order round-trip verification without touching git history.
- Handed ESLint findings (`BinanceView.tsx` L83/L127/L147/L195) back to `zai-desk` for cleanup in a follow-up commit if desired (`eslint .` currently fails because of them).

## EVIDENCE

- Git commit synced: `fef6210` (built atop `4404aaa`)
- Outbox reply: `desk/outbox/2026-11-11T15-35-00_DIR-0014-binance-top200-tier-rebuild.reply.md`
- `scripts/binance_tier_verify.py`: `19 passed, 4 failed` (`account testnet`, `testnet place LIMIT`, `order visible on account`, `testnet cancelAll`)
- Chrome DevTools MCP verified on `http://127.0.0.1:3000/?sym=BTC`, `BINANCE 200`, `?sym=ZEC`, and `ALL ⌄` palette (`287 / 287`)
