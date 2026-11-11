# Reply: DIR-0013 · Rebuild R4 Microstructure Layer (Supersedes DIR-0012)

**VERDICT**: EXECUTED
**TIMESTAMP**: 2026-11-11 11:25 UTC
**DIRECTIVE**: `desk/inbox/2026-11-11T09-50-00_DIR-0013-rebuild-r4-microstructure-layer.json` (supersedes `DIR-0012` R3 rebuild & covers its checks)

---

### CHECKS
- [x] **1. Git Sync & Windows Case-Collision Fix**:
  * Resolved Windows NTFS case-collision introduced in `22198de` where both `scripts/research/probes/l2l3/lighter-XAU-trades.json` and `scripts/research/probes/l2l3/lighter-xau-trades.json` were tracked (`core.ignorecase = true` caused `git pull --rebase` in `desk_daemon.mjs` to fail continuously since 09:45 UTC).
  * Merged local `R69–R73` (`R69-LTC-1`, `R73-ETH-1`) onto `origin/main` (`5a116e3`: `R4` + `R5` + `R68`), removed the duplicate lowercase `lighter-xau-trades.json` (`6067c18`), verified `git pull --rebase origin main` reports clean `Current branch main is up to date.`
- [x] **2. Dependencies, Build & Production Restart**:
  * Stopped prior `:3000` server cleanly, ran `npm ci` (`package-lock.json` present — 841 packages installed cleanly), `npm run build` (Turbopack compiled in `3.9s`, TypeScript finished in `10.5s`, `/api/cg/micro` + `/api/health` + R3 routes built cleanly), and restarted `npm start` on `http://127.0.0.1:3000`.
  * `/api/health`: `HTTP 200`, `{'ok': True, 'uptimeSec': 19, 'rssMb': 83, 'heapUsedMb': 27}`.
- [x] **3. Endpoint Verification (`127.0.0.1:3000`)**:
  * **(a) `/api/cg/micro?sym=XAU`**: `HTTP 200 ok:true` · `hl` (`xyz:GOLD`, mark `4055.8`, oracle `4055.1`, `+0.017%`, vol24h `$91.24M`, funding 1h `0.00063%`, APR `5.52%`) · `lighter` (`XAU` id `92`, `nResting=500`, bidNtl `$14.71M`, askNtl `$16.30M`, 3 MMs, 1 visible partial, 10 prints) · `kraken` absent.
  * **(b) `/api/cg/micro?sym=EURUSD`**: `HTTP 200 ok:true` · `lighter` (`id=96`, `n=281`, bidNtl `$2.80M`, askNtl `$2.89M`, 1 directional whale, 3 MMs) · `kraken` (`ZEURZUSD`, bid `1.11377` / ask `1.11381`, spread `0.00359%`, `stale:false`) · `hl` (`xyz:EUR`, vol24h `$6.08M` — now above the `$5M` thin gate, so HL card is live alongside Lighter + Kraken!).
  * **(c) `/api/cg/micro?sym=NATGAS`**: `HTTP 200 ok:true` · `hl` suppressed as designed (`venue dislocation: mark 1.225% vs oracle (|>0.3%|) — xyz reads suppressed`) · `lighter` (`id=158`, `n=137`, `$1.44M` bid / `$0.86M` ask) live.
  * **(d) `/api/cg/micro?sym=XPT` & `?sym=JP225`**: `HTTP 200 ok:true` · `XPT` (`hl.suppressed="thin xyz market: $1.83M/24h < $5M"`) · `JP225` (`hl.suppressed="thin xyz market: $1.28M/24h < $5M"`). Honest amber suppression, no `502`.
  * **(e) `/api/cg/micro?sym=US30`**: `HTTP 400 ok:false` (`no L2/L3 microstructure mapped for US30 — mapped: ...`).
  * **(f) R3 Regression (DIR-0012 checks)**:
    * `/api/cg/perpdepth?sym=USO`: `200`, 4 venues (`Binance` lead `85.98` vol `$717.07M`, `OKX`, `Bybit`, `Bitget`), OI `1,740,089` (`-1.25%`/`-1.44%`/`+5.42%`), Binance funding `-0.038775%/4h` (not `-3%`).
    * `/api/cg/perpdepth?sym=SPX500`: `200`, 2 venues (`tradeXYZ` lead `7585` vol `$459.12M`, `Bitget`).
    * `/api/cg/perpdepth?sym=US2000`: `400` honest (`COT-only instrument`).
    * `/api/cg/cot?sym=SPX500`: `200`, `E-MINI S&P 500` (`asOf 2026-11-03`), `net=-129414`, `z3y=-0.48`.
    * `/api/cg/cnbc?syms=USO,XAU`: `200`, `CLZ26` (`last 86.85, settle 86.04, OI 178034`) & `GCZ26` (`last 4059.8, settle 4030.2, OI 238712`).
- [x] **4. Browser Verification (Chrome DevTools MCP on `127.0.0.1:3000`)**:
  * **`?sym=XAU`**: Rendered `Perp L2 · Hyperliquid xyz:GOLD` + `L3 resting orders · Lighter XAU` (`500 orders (250/side cap)`, `sys#710654`, visible partials, 10 prints).
  * **`?sym=EURUSD`**: Rendered all 3 live cards (`Hyperliquid xyz:EUR`, `Lighter EURUSD`, `Kraken ZEURZUSD`) with zero console errors.
  * **`?sym=XPT`**: Rendered amber `Hyperliquid xyz:PLATINUM — thin xyz market: $1.83M/24h < $5M` suppression card.
  * **`?sym=US30`**: No microstructure panel rendered; zero console errors.
  * **`?sym=USO` & `?sym=SPX500`** (DIR-0012 UI verify): All 3 R3 panels (`Perp market depth`, `CFTC COT POSITIONING`, `FRONT-MONTH FUTURES`) + R4 micro panels (`xyz:CL` / `Lighter WTI`, `xyz:SP500` / `Lighter US500`) rendered with zero console errors.
  * *Minor network note*: Fresh `new_page` / initial mount before `?sym=` query hydration triggers one transient `GET /api/cg/micro?sym=BTC [400]` before switching to the URL sym (`?sym=EURUSD`/`US30`/`USO`/`SPX500` showed zero console errors once navigated).
- [x] **5. Upstream Health**:
  * Zero `429`s or timeouts observed from local Windows egress against `api.hyperliquid.xyz`, `mainnet.zklighter.elliot.ai`, or `api.kraken.com`.

---

### REASONING
All three R4 microstructure sources (`Hyperliquid xyz`, `Lighter DEX`, `Kraken Spot FX`) and all three R3 classic data routes (`perpdepth`, `cot`, `cnbc`) behave cleanly on local Windows egress with identical suppression/error semantics to sandbox. Removing the duplicate case-colliding `lighter-xau-trades.json` entry fixes the `git pull --rebase` blocker that had paused `desk_daemon.mjs` sync since `09:45 UTC`.

---

### ACTION
1. Synced repository onto `origin/main` (`5a116e3`), preserved `R69–R73` local rounds/orders, removed case-colliding `lighter-xau-trades.json`.
2. Executed `npm ci`, `npm run build`, restarted `:3000`.
3. Verified all `DIR-0013` + `DIR-0012` endpoints, `/api/health`, and Chrome DevTools browser renders.
4. Refreshed `desk/mt5.json` (`$4,649.96`, `0` positions, `0` orders), updated `AGENT-STATUS.md`, logged `EXEC` in `desk/log.md`, cleared handled directives from `desk/inbox/WAKE.md`, and restarted `desk_daemon.mjs`.

---

### EVIDENCE
```
git pull --rebase: 6067c18 -> Current branch main is up to date
/api/health: 200 ok=True rssMb=83 heapUsedMb=27
/api/cg/micro?sym=XAU: 200 HL(xyz:GOLD mark=4055.8 apr=5.52%) LO(500 resting bid=$14.71M ask=$16.30M mm=3 partials=1)
/api/cg/micro?sym=EURUSD: 200 HL(xyz:EUR vol=$6.08M) LO(n=281 whales=1 mm=3) KR(ZEURZUSD spr=0.00359%)
/api/cg/micro?sym=NATGAS: 200 HL suppressed(mark 1.225% vs oracle) LO(n=137)
/api/cg/micro?sym=XPT: 200 HL suppressed($1.83M < $5M) | ?sym=JP225: 200 HL suppressed($1.28M < $5M) | ?sym=US30: 400 honest
R3 regression: perpdepth USO 200 (4 venues, lead Binance 85.98, OI 1,740,089, fund -0.038775%/4h) | cot SPX500 net=-129414 z3y=-0.48 | cnbc CLZ26/GCZ26 200
MT5: equity=balance=$4,649.96 pos=0 ord=0 | LTCUSD spread=2.1957% basis=+0.9712% (blocked) | ETHUSD spread=0.0267% basis=+0.0153%
```
