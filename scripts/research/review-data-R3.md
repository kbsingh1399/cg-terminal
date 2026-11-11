# RV-DATA · Data-Integrity Review R3 — perpdepth / COT / CNBC / deepscan-USO

- **Reviewer:** QUANT TRADER + DATA-INTEGRITY (Task RV-DATA)
- **Date:** 2026-11-11 ~08:23–08:40 UTC (epoch ms 1794385404 → 1794386400)
- **Target:** trading terminal `http://127.0.0.1:3000` (read-only curl; server untouched)
- **Method:** curl (UA `Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/124.0 Safari/537.36`) + python3 recomputation. Independent references: Binance fapi, Bybit v5, OKX v5, Bitget v2, CFTC Socrata `6dca-aqww`, CNBC quote-webservice, Yahoo chart v8 (via terminal `/api/cg/classic`).
- **Route cache TTLs encountered:** perpdepth 60 s · cnbc 60 s · cot 6 h. Time-varying fields were compared with tight-pair fetches (route + reference seconds apart) and drift-bounded comparisons.

## 0 · Endpoint-path note (ops)

The task-specified paths `/api/cot` and `/api/cnbc` return the Next.js **404 HTML page** (all four probes byte-identical, md5 `bf2e2354…`). The routes are actually mounted at **`/api/cg/cot`** and **`/api/cg/cnbc`** (perpdepth is at `/api/cg/perpdepth`, as given). All verification below uses the real mounted paths. Documentation/task sheets should be updated to `/api/cg/…`.

---

## 1 · TASK 1 — `/api/cg/perpdepth` (USO, SP500, EURUSD)

### 1.1 Lead close vs independent venue klines (tolerance ±0.3%)

| sym | route lead (venue) | independent reference | diff | verdict |
|---|---|---|---|---|
| USO | **85.42** @08:23:24 · **85.49** @08:28:11 (Binance CLUSDT, forming 15m bar t=1794384900) | Binance fapi klines CLUSDT 15m: forming bar close **85.49** @08:28:20 (o 85.66, h 85.67, l 85.38); prior bar close 85.67 | **0.00%** (tight pair 85.49 vs 85.49); lagged snapshot 85.42 vs 85.49 = −0.08% | **PASS** |
| SP500 | **7573.3** (tradeXYZ SP500-USD) | no external reference exists (Binance/Bybit list no S&P perp; perpmap documents “SPX” ≈ $0.37 memecoin trap). Sanity: Bitget SP500USDT **7597** (+0.31%); CNBC .SPX **7520.93** is the 11-10 cash close → +0.70% after-hours perp premium | n/a | **N/A** (sanity consistent) |
| EURUSD | **1.11528** @08:23:24 (Bybit EURUSDUSDT, forming 15m bar) | Bybit v5 kline EURUSDUSDT 15m: latest close **1.11528** @08:23:25 | **0.00%** (exact) | **PASS** |

Prior-bar cross-check (USO): route priceSeries t=1794384000 → c 85.68 vs Binance completed-bar close 85.67 = 0.012% (Coinglass close-snapshot timing) — immaterial.

### 1.2 OI last vs Binance fapi openInterest (tolerance ±5%)

| route `oi.last` | Binance `openInterest` (fapi) | diff |
|---|---|---|
| 1,734,091.57 @08:23:25 · 1,732,421.16 @08:28:11 | **1,735,086.52** @08:35:35 (retried through an IP rate-ban) | **−0.06% / −0.15%** |

**PASS.** (Route OI is Coinglass `Binance_CLUSDT#oi_kline` last close; matches Binance’s own OI within 0.15% at 7–12 min staleness.)

### 1.3 Funding plausibility vs `premiumIndex.lastFundingRate` — **FAIL (systemic 100× overstatement)**

Route funding block (`fundingSym=CL`), pull @08:23 / @08:28, vs independent venue APIs:

| venue | route `ratePct` / interval | independent actual | ratio | independent cap |
|---|---|---|---|---|
| Binance | **−3.1325% … −3.185% / 4h** | `premiumIndex` lastFundingRate **−0.00032489 = −0.032489%/4h** (settled 08:00 UTC, next 12:00 UTC) | **≈97–98×** | (typ. ±2%) |
| Bybit | **−9.7005% / −9.2411% / 8h** | Bybit v5 tickers CLUSDT fundingRate **−0.00091804 = −0.0918%/8h** | **≈101×** | fundingCap **0.267%** — route value exceeds cap 34× |
| OKX | **−2.8155% / −2.8416% / 4h** | OKX v5 funding-rate CL-USDT-SWAP **−0.00028541 = −0.0285%/4h** | **≈99×** | maxFundingRate **±1%** — route value exceeds cap |
| Bitget | **−1.93% / 4h** | Bitget v2 mix ticker CLUSDT fundingRate **−0.000204 = −0.0204%** | **≈95×** | — |
| Crypto.com | −1.1316%/1h | (implied actual −0.0113%/1h — typical) | ~100× | — |

- The task’s plausibility gate (|rate| < 0.1%/interval typical) **holds for the true market rates** (−0.03%/4h etc. — WTI perps are cheap-to-short right now, but in normal range) and **fails for the route’s displayed values**.
- **Root cause** (`src/app/api/cg/perpdepth/route.ts` L146): `ratePct: +(x.rate * 100).toFixed(4)` — the Coinglass `rate` field is **already in percent units** (e.g. −0.03185 for Binance), so the ×100 inflates every venue ~100×. Evidence: route −3.185 ⟺ Coinglass rate −0.03185 ⟺ Binance actual −0.0325%; same 1:100 mapping reproduces on Bybit, OKX and Bitget to within quote drift.
- Funding **intervals are labeled correctly** (Binance 4h ✓ per premiumIndex cadence 1794398400000−1794384000000, Bybit 8h ✓, OKX 4h ✓).

### 1.4 ΔOI 24h — oiSeries integrity + d24h arithmetic

| sym | oiSeries | timestamps strictly increasing | non-empty |
|---|---|---|---|
| USO / SP500 / EURUSD | 96 × 15m bars, t 1794299400000 → 1794384900000 (23.75 h) | **yes (×3)** | **yes (×3)** |

`d24h` vs the task heuristic `(last / first_of_96 − 1)`:

| sym | route d24h | heuristic (first_of_96) | gap | verdict |
|---|---|---|---|---|
| USO | **+5.75%** (@08:23; +5.64% @08:28) | +5.92% | 0.17 pp | **PASS** |
| SP500 | **+0.71%** | +0.70% | 0.01 pp | **PASS** |
| EURUSD | **−1.70%** | −3.05% | 1.35 pp | **PASS** (route correct — see proof) |

**Proof the route is right and the heuristic is 15 minutes short:** `oiDeltas()` uses `at(96)` = the 97th bar (fetch `limit=97`), i.e. a true 24 h lookback, while `oiSeries` exposes only the last 96 bars. Raw upstream re-pull (`/api/cg/kline?type=oi&limit=97`, same Coinglass source) confirms bar chaining:
- USO: hidden 97th-bar close = open of t=1794299400 bar = **1,639,853.78** → 1,734,091.57/1,639,853.78 − 1 = **+5.746% → 5.75** — exact match to route.
- EURUSD: hidden 97th-bar close = **360,405.4** → 354,291.6/360,405.4 − 1 = **−1.696% → −1.70** — exact match to route. OI genuinely jumped +1.4% (360,405 → 365,433) inside the first *visible* bar, which is what breaks the first_of_96 heuristic.
- d1h/d4h also reproduce exactly from the visible series (USO −1.78/−1.71; SP500 +0.23/+0.65; EURUSD +2.92/+4.87).

**Transparency note:** the oiSeries output hides the very bar d24h is computed from (96 of 97). Consider exposing 97 bars or documenting the lookback.

---

## 2 · TASK 2 — `/api/cg/cot` (SP500=13874A, XAU=088691, USO=067651)

Reference: CFTC Socrata `6dca-aqww`, `$order=report_date_as_yyyy_mm_dd DESC` (latest report **2026-11-03**, prior **2026-10-27**; 170-row pull for z-scores, population std as in route).

| check | SP500 | XAU | USO |
|---|---|---|---|
| noncomm net = long − short | route −129,414 = CFTC 229,322 − 358,736 ✓ | route +179,548 = 220,530 − 40,982 ✓ | route +80,289 = 324,523 − 244,234 ✓ → **PASS ×3** |
| asOf | 2026-11-03 ✓ | 2026-11-03 ✓ | 2026-11-03 ✓ → **PASS ×3** |
| openInterest | 1,986,532 ✓ | 399,169 ✓ | 1,908,732 ✓ → **PASS ×3** |
| netChgWk = this wk − last wk | +4,954 = −129,414 − (−134,368) ✓ | −6,903 = 179,548 − 186,451 ✓ | +5,946 = 80,289 − 74,343 ✓ → **PASS ×3** |
| commercial net (bonus) | +5,195 ✓ | −204,902 ✓ | −111,277 ✓ → **PASS ×3** |
| z3y ±0.15 abs | route **−0.89** vs recomputed **−0.48** (Δ0.41) **FAIL** | route **−1.37** vs **−0.61** (Δ0.76) **FAIL** | route **+1.07** vs **−1.39** (Δ2.46, **sign flipped**) **FAIL** |
| history newest-first, 78 pts | 78, 2026-11-03→2025-05-13 strictly desc ✓ | ✓ | ✓ → **PASS ×3** |

### 2.1 z3y FAIL — root cause (array-order bug)

Recomputed from the same 170-row CFTC pull (population std, n=170, window 2023-08-08 → 2026-11-03):

| sym | mean(net) | sd | **z(latest net)** | z(oldest net, 2023-08-08) | route z3y |
|---|---|---|---|---|---|
| SP500 | −93,415.6 | 74,381.4 | **−0.48** | −0.889 | −0.89 (Δ 0.001) |
| XAU | 209,123.7 | 48,128.8 | **−0.61** | −1.374 | −1.37 (Δ 0.004) |
| USO | 179,506.8 | 71,457.7 | **−1.39** | +1.069 | +1.07 (Δ 0.001) |

Route z3y matches **z(oldest-of-170)** to ±0.004 on all three symbols — definitive. `zscore()` (`src/app/api/cg/cot/route.ts` L43–49) returns `(vals[vals.length − 1] − mean)/sd`, but the series is **newest-first** (Socrata DESC), so `vals[last]` is the **August-2023** net, not the latest. The same wrong ASC assumption appears in the L139 comment “oldest→newest for charts”, while `history` is actually newest-first (the task’s expected order — data is fine, comment is wrong, and any chart consumer assuming chronological order must reverse).

**Impact:** USO positioning is reported as **+1.07σ above** the 3y mean when it is actually **−1.39σ below** (large specs least net-long in 3 years — a materially different signal). SP500/XAU magnitudes are also ~2× off.

---

## 3 · TASK 3 — `/api/cg/cnbc?syms=USO,XAU,SP500` vs CNBC direct

Tight pair: route @08:27:32 (fetchedAt 1794385652448) vs direct webservice `@CL.1|@GC.1|.SPX` @08:27:33 (identical `last_time` 2026-11-11T03:17:29-0500 on all three).

| field | USO `@CL.1` | XAU `@GC.1` | SP500 `.SPX` |
|---|---|---|---|
| last | route **86.23** = direct **86.23** ✓ | **4067.6** = **4,066.40→(pull-2) 4,067.60** ✓ | **7520.93** = **7,520.93** ✓ |
| settle | **86.04** = **86.04** ✓ | **4030.2** = **4030.20** ✓ | null = null ✓ |
| openInterest | **178,034** = **178,034** ✓ | **238,712** = **238,712** ✓ | null = null ✓ |
| activeContract | **CLZ26** = **CLZ26** ✓ | **GCZ26** = **GCZ26** ✓ | **.SPX** = **.SPX** ✓ |
| expiry | 2026-11-20 ✓ | 2026-12-29 ✓ | null ✓ |
| change (bonus) | 0.19 = +0.19 ✓ | 37.4 = +37.40 ✓ | −29.01 = −29.01 ✓ |

**All four required fields match on all three symbols → 12/12 PASS.** (String-form mismatches are only CNBC’s thousands separators/`+` signs; route `num()` strips commas.)

Minor defect: route `changePct` is **null on all three** — CNBC sends `change_pct` as `"+0.31%"` and `num()` does not strip the `%` sign → `Number("+0.31%") = NaN → null`. One-line fix (strip `%`).

Drift note: an earlier unsynchronized pair (route 86.40 @08:24 vs direct 86.31 @08:26) differed 0.10% purely from quote/cache timing (route TTL 60 s, CNBC edge ~5 s) — resolved by the tight pair above.

---

## 4 · TASK 4 — `desk/deepscan/USO-20261111-0821.md` vs live routes

Report scanned 08:21 UTC (evidence fetchedAt 1794385249443); live route pulls @08:23–08:28. Time-varying fields verified as drift-consistent, stable fields exact.

| report claim (§) | live route value(s) | verdict |
|---|---|---|
| §2 lead Binance close 85.55 | 85.42 (@08:23) → 85.49 (@08:28); priceSeries 85.68 (08:00 bar) → 85.42–85.49 (08:15 forming bar) — 85.55 sits on the 08:21 trajectory | **PASS** |
| §2 venues 85.55 / 85.55 / 85.53 / 85.552 (vols 772.5M / 100.4M / 89.1M / 35.1M) | 85.42 / 85.43 / 85.41 / 85.421 (773.9M / 100.5M / 89.3M / 35.1M) | **PASS** (drift only; Bitget cross-verified 85.416) |
| §2 open interest 1,732,686 | 1,734,091.57 → 1,732,421.16 (Binance actual 1,735,086.52) | **PASS** |
| §2 ΔOI 1h/4h/24h −1.86 / −1.79 / +5.66 % | −1.78…−1.87 / −1.71…−1.81 / +5.64…+5.75 % | **PASS** |
| §2 taker flow 15m +113,518 USD (Binance) | −184,353 (@08:23) / −160,809 (@08:28) — rolling last-15m-bar quantity; sign flips between windows, magnitude consistent | **PASS** (time-varying by construction) |
| §2 funding Binance −3.0946%/4h · OKX −2.7872 · Bybit −9.7647 · KuCoin −2.47 · Gate −6.26 · Crypto.com −1.1316 | route now −3.1325…−3.185 / −2.8416 / −9.2411 / −2.57 / −6.40 / −1.1316 — faithfully relayed, **but the whole table inherits the 100× bug** (§1.3): true Binance −0.0325%/4h, OKX −0.0285%, Bybit −0.0918% | **FAIL (inherited F1)** |
| §2 “liq levels / walls / CVD / whale LTO n/a” | matches route `unavailable` field verbatim | **PASS** (honest) |
| §3 COT: as of 2026-11-03, net +80,289, chg +5,946, commercial −111,277, OI 1,908,732, %OI 17.0/12.8 | exact match vs `/api/cg/cot?sym=USO` and vs CFTC Socrata (§2 above) | **PASS** (exact) |
| §3 “3y z **+1.07σ**” | matches route z3y 1.07 — but route z3y is wrong (§2.1); **correct value −1.39σ** (sign flipped) | **FAIL (inherited F2)** |
| §4 CNBC: last 86.32 · settle 86.04 · OI 178,034 · active CLZ26 · expiry 2026-11-20 | live route 86.23–86.40 (drift) / **86.04 exact** / **178,034 exact** / CLZ26 / 2026-11-20; CNBC direct settle 86.04, OI 178,034 | **PASS** |
| §4 futures−cash basis **−0.07%** | arithmetic: (86.32 − 86.38) / 86.38 = **−0.0695% → −0.07%** (86.32 = CNBC front-month last; 86.38 = §1 Yahoo `CL=F` price at scan) | **PASS** (correct; note both legs are futures quotes — “cash” is Yahoo’s continuous front-month, so the label is loose but the number is right) |
| §5–§6 residual-gaps statement | consistent with route `unavailable` + perpmap probe notes (2026-11-11) | **PASS** |

Also confirmed: report §2 funding lists 6 venues vs route’s 10 — **by design** (`desk_deepscan.py` L1369 slices `fund[:6]`), not a discrepancy. §1 Yahoo quote (86.38 @08:20:39, prevClose 90.83) reproduces via `/api/cg/classic?sym=USO` (86.26 @08:30, same prevClose 90.83 — a contract-roll artifact on Yahoo’s side, outside §2–§6 scope).

---

## 5 · Summary table

| # | check | verdict |
|---|---|---|
| T1.1 | USO lead close vs Binance fapi klines (±0.3%) | **PASS** (0.00% tight pair) |
| T1.2 | SP500 lead close vs external ref | **N/A** — no independent reference exists (sanity: Bitget +0.31%, stale .SPX +0.70%) |
| T1.3 | EURUSD lead close vs Bybit kline (±0.3%) | **PASS** (exact) |
| T1.4 | USO OI vs Binance openInterest (±5%) | **PASS** (−0.06…−0.15%) |
| T1.5 | Funding plausible / vs premiumIndex | **FAIL** — ~100× overstated on every venue (F1) |
| T1.6 | oiSeries monotonic-in-time + non-empty (×3 syms) | **PASS ×3** |
| T1.7 | d24h ≈ (last/first_of_96 − 1) (×3 syms) | **PASS ×3** (route exact vs true 24h bar; heuristic 15m short — EURUSD gap 1.35pp explained) |
| T2.1 | COT noncomm net = long − short (×3) | **PASS ×3** |
| T2.2 | COT asOf (×3) | **PASS ×3** |
| T2.3 | COT openInterest (×3) | **PASS ×3** |
| T2.4 | COT netChgWk (×3) | **PASS ×3** |
| T2.5 | COT z3y ±0.15 (×3) | **FAIL ×3** (F2; USO sign flipped +1.07σ vs −1.39σ) |
| T2.6 | COT history newest-first, 78 pts (×3) | **PASS ×3** |
| T3.1–3.4 | CNBC last/settle/openInterest/activeContract (4 fields × 3 syms) | **PASS ×12** |
| T4.1 | deepscan §2 perp values vs live routes | **PASS** |
| T4.2 | deepscan §2 funding values | **FAIL** (inherits F1) |
| T4.3 | deepscan §3 COT values | **PASS** (exact) |
| T4.4 | deepscan §3 z +1.07σ | **FAIL** (inherits F2; correct −1.39σ) |
| T4.5 | deepscan §4 CNBC fields | **PASS** |
| T4.6 | deepscan §4 basis −0.07% arithmetic | **PASS** (−0.0695%) |
| T4.7 | deepscan §5/§6 honesty/gaps | **PASS** |

**Totals: 41 PASS · 6 FAIL · 1 N/A** (supplementary bonus checks all PASS: commercial net ×3, funding intervals ×3, CNBC change ×3).

## 6 · Discrepancies & required fixes

1. **F1 (HIGH) — perpdepth funding 100× overstatement.** `perpdepth/route.ts` L146: `ratePct = x.rate * 100` applied to a Coinglass `rate` field that is already in percent. Verified against four independent venue APIs (Binance −0.0325%/4h vs shown −3.13…−3.19%; Bybit −0.0918%/8h vs −9.24…−9.70% (exceeds Bybit’s 0.267% cap 34×); OKX −0.0285%/4h vs −2.82…−2.84% (exceeds OKX ±1% cap); Bitget −0.0204% vs −1.93%). Fix: drop the ×100 (display `rate` directly as percent). Consumers (deepscan §2, any funding-gate logic) inherit the error.
2. **F2 (HIGH) — COT z3y uses the oldest of the 170-row window.** `cot/route.ts` `zscore()` reads `vals[vals.length − 1]` on a newest-first (DESC) array → z-score of the 2023-08-08 net, not the latest. SP500 −0.89 shown vs −0.48 actual; XAU −1.37 vs −0.61; **USO +1.07 vs −1.39 (sign flip)**. Fix: use `vals[0]` (or sort ASC first). Also fix the L139 comment (“oldest→newest” — data is newest-first) before a chart consumer plots it backwards.
3. **Inherited F1/F2 in `desk/deepscan/USO-20261111-0821.md`** §2 funding table and §3 “3y z” — regenerate after route fixes.
4. **Minor — CNBC `changePct` always null:** `num()` doesn’t strip CNBC’s trailing `%` (`"+0.31%"` → NaN). One-line fix.
5. **Minor — path/docs drift:** `/api/cot`, `/api/cnbc` 404; real mounts are `/api/cg/cot`, `/api/cg/cnbc`.
6. **Transparency — d24h lookback bar hidden:** oiSeries serves 96 of the 97 bars used for d24h; expose 97 or document (EURUSD heuristic check diverged 1.35pp solely because of this + a genuine +1.4% OI jump in the first visible bar — route arithmetic verified exact).

## 7 · Environment notes for reproducibility

- Binance fapi rate-bans this sandbox’s shared egress IPs aggressively (bans observed on 47.57.232.232, 47.57.242.119, 8.212.10.159); the OI/premiumIndex references were obtained via spaced single-request retries (~every 20 s, 6–7 attempts).
- CFTC Socrata needs URL-encoded `$`/space params; values arrive as strings — parse before arithmetic.
- The deepscan basis line and funding slice formatting were confirmed against `scripts/desk_deepscan.py` (L1369 `fund[:6]`, L1396 basis formula `(fut_last/cash − 1)*100`).
