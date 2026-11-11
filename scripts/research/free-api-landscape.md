# Free (No-Paid-Key) Institutional Data Source Landscape — LIVE VERIFIED

**Task:** R-FREE — additional free data sources for the multi-asset trading terminal (indices, FX, metals, commodities, equities, crypto).
**Existing stack:** Yahoo Finance chart v8 (quotes+bars), Coinglass (perp analytics), Binance/OKX/Bybit public APIs.
**Verification environment:** sandbox, `curl 8.14.1`, UA `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`.
**Sandbox clock during tests:** 2026-11-11 ~07:49–07:53 UTC (per response `Date:` headers). Egress note: general internet OK (`example.com` → 200 in 0.03 s); two hosts (stooq.com, fred.stlouisfed.org) are unreachable from this sandbox — details per source below.

Legend: ✅ verified live · ❌ verified dead/blocked · ⚠️ partially verified / documented-but-not-live-verified

---

## (a) Verified results table

| # | Source | Endpoint(s) tested | HTTP status | Shape (as returned) | Freshness | Rate limit (observed) |
|---|--------|--------------------|-------------|---------------------|-----------|----------------------|
| A | Stooq CSV | `https://stooq.com/q/l/?s=^spx&f=sd2t2ohlcv&h&e=csv` (quote), `https://stooq.com/q/d/l/?s=^spx&i=d` (history) | ❌ **connection timed out** (curl exit 28) on both IPs `159.69.202.225`, `78.47.47.99`, ports 443 & 80 — TCP never established | n/a — no response received | n/a | n/a |
| B | FRED (St. Louis Fed) | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS` (+ DTWEXBGS, DGS10, T10Y2Y) | ❌ **blocked from sandbox egress** — HTTP/2: `curl: (92) HTTP/2 stream 1 was not closed cleanly: INTERNAL_ERROR (err 2)`; HTTP/1.1 & HTTP/1.0 & forced-IPv4 & TLS1.2-max & full-browser-headers & `/data/VIXCLS.csv` path: all 0 bytes → timeout (exit 28). Same Akamai edge (`173.223.87.182`) | n/a — no body received | n/a | n/a |
| B′ | FRED API (key path) | `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&file_type=json` | ⚠️ **400** (host reachable; key required) — `{"error_code":400,"error_message":"Bad Request.  Variable api_key is not set.  Read https://fred.stlouisfed.org/docs/api/api_key.html for more information."}` | JSON error | n/a | free key required (signup outside sandbox) |
| C | CFTC COT (Socrata) | `https://publicreporting.cftc.gov/resource/6dca-aqww.json` (Legacy **Futures-Only**) w/ `$limit`, `$order`, `$select`, `cftc_contract_market_code`, `contract_market_name` filters | ✅ **200** | JSON array; ~120 fields per record (see §C) | latest report `2026-11-03` (weekly, Tue data); `X-SODA2-Truth-Last-Modified: Fri, 06 Nov 2026 20:30:33 GMT`, `X-SODA2-Data-Out-Of-Date: false`; history back to **1986-01-15** | 15/15 rapid requests → all 200, no throttle; no `429`; CORS `*` |
| D | Finnhub (demo token) | `https://finnhub.io/api/v1/quote?symbol=AAPL&token=demo`, `/stock/candle?...&token=demo` | ❌ **401** `{"error":"Invalid API key."}` (both endpoints, both symbols) | JSON error only | n/a | demo path dead; free tier requires signup (not possible in sandbox) |
| E | CNBC unofficial quote webservice | `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=…&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1` | ✅ **200** for `.SPX`, `.NDX`, `.DXY`, `@GC.1`, `@CL.1`, `EUR=`, `AAPL`, and pipe-batches; ⚠️ raw `^SPX` → **400** Tomcat page; URL-encoded `%5ESPX` → 200 but `code:1` empty quote (wrong symbol form); `CL.1`/`GC.1` without `@` → `code:1` empty | JSON `FormattedQuoteResult.FormattedQuote[]`; futures records include last, settle, OI, roll info (see §E) | `cache-control: max-age=5`, `x-ttl: 10.000` → ~5–10 s server cache; live prices observed pre-market (e.g. `@GC.1` last_time `2026-11-11T02:41:34-0500`) | no rate-limit headers; Akamai edge, CORS `*` |
| F | Coinbase Exchange (public) | `https://api.exchange.coinbase.com/products/BTC-USD/ticker`, `/candles?granularity=900`, `/candles?granularity=86400&start=…&end=…`, `/stats` | ✅ **200** all | ticker: flat JSON (bid/ask/price/size/volume/time); candles: array of `[time, low, high, open, close, volume]`; stats: 24h OHLC + 30d volume | ticker `time` = request moment (live); 15-min candle bucket current at fetch (newest ts `2026-11-11T07:45Z`, fetched 07:52Z); `cache-control: public, max-age=1` | no rate-limit headers returned (documented public limit 10 req/s — docs claim, not header-verified) |
| G | Frankfurter (ECB) | `https://api.frankfurter.app/latest?from=EUR&to=USD`, `/latest` (all), `/2026-10-01..2026-11-10?from=EUR&to=USD,GBP` | ✅ **200** (after following **301** → `https://api.frankfurter.dev/v1/...`; must use `-L` or the new host) | JSON: `{"amount","base","date","rates":{...}}`; ~30 currencies on `/latest`; time-series keyed by date | ECB reference rate, **T-1**: `date: 2026-11-10` when fetched 2026-11-11 07:52 UTC (ECB publishes ~16:00 CET) | no rate-limit headers; ~40 ms/response |

---

## (b) Per-source integration verdicts

### A. Stooq CSV — **SKIP (from this sandbox) / re-test from prod egress**
Unreachable: TCP connect timeout to both A records on 443 and 80 (Hetzner DE IPs). Verified sandbox networking itself is fine (`example.com` 200/0.03 s; six other hosts below worked). Every documented variant (`q/l/` quote, `q/d/l/` history, http, https) timed out, so **no shape/freshness could be verified** — anything you read about its CSV layout must be treated as unverified. Also: its core value (free daily history for `^spx`, `cl.f`, `xauusd`, `eurusd`) substantially overlaps Yahoo v8, which we already have and which works. Re-probe once from production egress before deciding; if reachable there, it's a good offline-history backup, not a primary feed.

### B. FRED — **USE (macro/regime panel) — but requires (1) free API key and (2) egress that can reach it**
`fredgraph.csv` (no-key CSV) and even `api.stlouisfed.org` root are broken/limited through this sandbox's egress path (Akamai edge misbehaves: H2 stream reset err 92, H1 hangs at 0 bytes). The **key-path is confirmed alive**: `api.stlouisfed.org` responds properly with a clear 400 when `api_key` is missing — so from production, sign up for a free key (instant, email-only) and use `api.stlouisfed.org/fred/series/observations?series_id=…&api_key=…&file_type=json` (or `.csv` via `fredgraph.csv` from a normal egress). Series DTWEXBGS (real broad dollar), VIXCLS, DGS10, T10Y2Y are exactly the regime inputs we want; daily frequency, decades of history. Nothing else free gives us treasury yields + dollar index. Verdict: USE for the macro panel once key + reachable egress exist; document the sandbox limitation.

### C. CFTC Commitments of Traders (Socrata `6dca-aqww`, Legacy Futures-Only) — **USE (top pick)**
Fully verified, no key, JSON, filterable, 40 years of history (earliest record `1986-01-15`), weekly cadence with Friday 3:30 pm ET release freshness (`X-SODA2-Truth-Last-Modified` matched). Gives the positioning dimension none of our current sources provide: non-commercial (large spec) net long/short, commercial hedging, spread, open interest, weekly changes, % of OI, trader counts, and 4/8-trader concentration. Verified contract aggregations (latest report 2026-11-03):

- **ES** — `cftc_contract_market_code=13874A` → "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE": noncomm L 229,322 / S 358,736 (net −129,414), OI 1,986,532
- **GC** — `088691` → "GOLD - COMMODITY EXCHANGE INC.": noncomm net +179,548, OI 399,169, 282 traders
- **CL** — `067651` → "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE": noncomm net +80,289, OI 1,908,732
- **EUR** — `contract_market_name=EURO FX` (code `099741`) → "EURO FX - CHICAGO MERCANTILE EXCHANGE": noncomm net −157,791, OI 876,122
  ⚠️ Gotcha: code `098732` returned an **empty array** for this dataset — filter by `contract_market_name=EURO FX` or use `099741`.

This is the single most differentiated free input for trade formulation (positioning extremes/z-scores per asset, spec-vs-hedger skew, concentration risk).

### D. Finnhub free tier — **SKIP**
The `token=demo` path is dead (401 "Invalid API key." on quote and candle endpoints — verified twice). Free tier requires signup (not allowed in sandbox), so nothing could be live-verified. Even with a free key, its covered value for us (US equity quotes/candles) duplicates Yahoo Finance chart v8, which works keyless. No unique institutional input → SKIP. (Their docs claim 60 calls/min free tier — unverifiable here; the pricing page is JS-rendered and returned no readable limits.)

### E. CNBC unofficial quote webservice — **USE (second pick; front-month futures gap-filler)**
Verified working and rich. Key findings:
- Correct symbol grammar: indices `.SPX` `.NDX` `.DXY`; futures need `@` prefix → `@CL.1` `@GC.1` (front month); FX like `EUR=`; plain equities `AAPL`. Raw `^SPX` → HTTP 400 (unencoded caret); encoded `^SPX`/`CL.1`/`GC.1` → `code:1` empty quotes.
- Batching works with **pipe** separator (`symbols=.SPX|.NDX|@GC.1`); comma does not (treated as one symbol → `code:1`).
- Futures responses are institutional-grade metadata: last, `settlePrice` + `settleDate`, `open_interest`, `expiration_date`, active contract (`altSymbol: GCZ26`, `feedSymbol: /GCZ26`), year high/low, volume, exchange, `realTime:false` (cached), halt flag.
  - Example captured: `@GC.1` "Gold COMEX (Dec'26)" last 4,069.00, settle 4,030.20 (2026-11-10), OI 238,712, exp 2026-12-29; `@CL.1` "WTI Crude (Dec'26)" last 86.49, settle 86.04, OI 178,034, exp 2026-11-20.
- 5 s edge cache (`cache-control: max-age=5`, `x-ttl: 10.000`) — fine for a terminal refresh loop, not for tick data.
- Caveat: **unofficial** API (no SLA, partnerId=2 is CNBC's web client). Build a parser tolerant of field drift; keep Yahoo as fallback. Settlement prices + OI + roll calendar for CL/GC (and other `@XX.1` chains) are things Yahoo does not give us → genuinely additive.

### F. Coinbase Exchange public (spot crypto) — **USE (third pick)**
Verified: top-of-book `ticker` (bid 73,853.37 / ask 73,853.38 / price 73,854.33, ns-precision timestamp), `candles` (15-min granularity → **350** candles returned covering ~3.65 days; daily granularity with `start`/`end` → 32 candles for Oct 2026), `stats` (24 h open/high/low/last + volume + 30-day volume). `cache-control: max-age=1`. Value vs. existing stack: Binance/OKX/Bybit are perp/major-venue-centric; Coinbase is the regulated US spot venue — its book is a clean institutional reference price for basis/fair-value cross-checks against perps (pairs with Coinglass). No key for public endpoints.

### G. Frankfurter (ECB FX) — **USE-BACKUP (FX cross-check only)**
Verified (must follow 301 to `api.frankfurter.dev/v1`): `/latest?from=EUR&to=USD` → `{"amount":1.0,"base":"EUR","date":"2026-11-10","rates":{"USD":1.1214}}`; ~30 currencies on default `/latest`; time-series range endpoint works. Freshness is **ECB daily reference, T-1** — not tradable realtime (compare: CNBC `EUR=` showed live 1.1152 while Frankfurter's T-1 ref was 1.1214). Role: independent sanity anchor for FX quotes and historical FX for P&L/backtest conversion. Cheap, stable, no key.

---

## (c) Working curl examples (all executed from sandbox; UA shortened to `$UA`)

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

# --- C. CFTC Legacy Futures-Only COT (VERIFIED 200) ---
# Latest E-mini S&P 500 positioning (filter + order):
curl -sS -A "$UA" \
  'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=3&$order=report_date_as_yyyy_mm_dd%20DESC&cftc_contract_market_code=13874A'
# Gold / WTI by code:
curl -sS -A "$UA" \
  'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1&$order=report_date_as_yyyy_mm_dd%20DESC&cftc_contract_market_code=088691'
curl -sS -A "$UA" \
  'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1&$order=report_date_as_yyyy_mm_dd%20DESC&cftc_contract_market_code=067651'
# EUR: use NAME filter (code 099741; 098732 returns empty):
curl -sS -A "$UA" \
  'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1&$order=report_date_as_yyyy_mm_dd%20DESC&contract_market_name=EURO%20FX'
# Slim projection for a positioning panel:
curl -sS -A "$UA" \
  'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC&$select=report_date_as_yyyy_mm_dd,market_and_exchange_names,noncomm_positions_long_all,noncomm_positions_short_all,comm_positions_long_all,comm_positions_short_all,open_interest_all,change_in_noncomm_long_all,change_in_noncomm_short_all&cftc_contract_market_code=13874A'

# --- E. CNBC quote webservice (VERIFIED 200; pipe-batch, URL-encode symbols) ---
curl -sS -A "$UA" \
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=.SPX%7C.NDX%7C.DXY%7C@GC.1%7C@CL.1%7CEUR%3D&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'
# (raw '^SPX' without encoding → HTTP 400; encoded '^SPX' → code:1 empty. Use .SPX / @CL.1 forms.)

# --- F. Coinbase Exchange public (VERIFIED 200) ---
curl -sS -A "$UA" 'https://api.exchange.coinbase.com/products/BTC-USD/ticker'
curl -sS -A "$UA" 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=900'
curl -sS -A "$UA" 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2026-10-01T00:00:00Z&end=2026-11-01T00:00:00Z'
curl -sS -A "$UA" 'https://api.exchange.coinbase.com/products/BTC-USD/stats'

# --- G. Frankfurter / ECB (VERIFIED 200 after 301; use -L) ---
curl -sSL -A "$UA" 'https://api.frankfurter.app/latest?from=EUR&to=USD'
curl -sSL -A "$UA" 'https://api.frankfurter.app/2026-10-01..2026-11-10?from=EUR&to=USD,GBP'

# --- B. FRED: works only with key + reachable egress (from sandbox: blocked) ---
curl -sS -A "$UA" 'https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=<FREE_KEY>&file_type=json'
# no-key CSV path (blocked from THIS sandbox, valid elsewhere):
curl -sSL -A "$UA" 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXBGS'

# --- A. Stooq (UNREACHABLE from sandbox — re-test from prod; documented form only) ---
curl -sS -A "$UA" 'https://stooq.com/q/l/?s=%5Espx+cl.f+xauusd&f=sd2t2ohlcv&h&e=csv'   # quotes
curl -sS -A "$UA" 'https://stooq.com/q/d/l/?s=cl.f&i=d'                                # daily history

# --- D. Finnhub demo (DEAD: 401 {"error":"Invalid API key."}) ---
curl -sS -A "$UA" 'https://finnhub.io/api/v1/quote?symbol=AAPL&token=demo'
```

### Captured response snippets (truncated to essentials)

CFTC — first record of `$limit=1` unordered (Legacy Futures-Only schema):
```json
[{"id":"220913001602F","market_and_exchange_names":"WHEAT-SRW - CHICAGO BOARD OF TRADE",
  "report_date_as_yyyy_mm_dd":"2022-09-13T00:00:00.000","yyyy_report_week_ww":"2022 Report Week 37",
  "contract_market_name":"WHEAT-SRW","cftc_contract_market_code":"001602","cftc_market_code":"CBT ",
  "open_interest_all":"287046","noncomm_positions_long_all":"88091","noncomm_positions_short_all":"96219",
  "noncomm_postions_spread_all":"51534","comm_positions_long_all":"119219","comm_positions_short_all":"106242",
  "change_in_open_interest_all":"-2283","change_in_noncomm_long_all":"-520",
  "pct_of_oi_noncomm_long_all":"30.7","traders_tot_all":"315",
  "conc_gross_le_4_tdr_long":"...","futonly_or_combined":"Futures Only", ...}]
```
(≈120 fields total — `X-SODA2-Fields` header lists them all; includes `open_interest_old/other`, `%_of_oi_*`, `traders_*`, and `conc_{gross,net}_le_{4,8}_tdr_{long,short}` concentration blocks.)

CNBC — `@GC.1` (Gold COMEX front month):
```json
{"FormattedQuoteResult":{"FormattedQuote":[{
  "symbol":"@GC.1","code":0,"name":"Gold COMEX (Dec'26)","shortName":"GOLD",
  "last":"4,069.00","last_time":"2026-11-11T02:41:34.000-0500","changetype":"UP",
  "type":"DERIVATIVE","subType":"Future","exchange":"CEC:Commodities Exchange Centre",
  "source":"Exchange","open":"4,043.70","high":"4,074.70","low":"4,034.10",
  "change":"+38.80","change_pct":"+0.96%","volume":"33,694",
  "previous_day_closing":"4,030.20","altSymbol":"GCZ26","realTime":"false",
  "curmktstatus":"REG_MKT","yrhiprice":"5,586.20","yrloprice":"3,879.30",
  "open_interest":"238712","expiration_date":"2026-12-29",
  "settlePrice":"4030.20","settleDate":"2026-11-10","feedSymbol":"/GCZ26",
  "EventData":{"is_halted":"N"}}]}}
```

Coinbase — ticker / candles / stats:
```json
{"ask":"73853.38","bid":"73853.37","volume":"10587.08223825","trade_id":1118637096,
 "price":"73854.33","size":"0.00001349","time":"2026-11-11T07:52:15.831657239Z","rfq_volume":"87.525438"}
```
```json
[[1794383100,73769.54,73878.66,73776.93,73865.32,4.85416322],
 [1794382200,73730.3,73859.32,73825.51,73776.94,84.3551982], ...]   // [time,low,high,open,close,volume]; 350 rows @900s
```
```json
{"open":"74736.85","high":"74789.32","low":"72643.48","last":"73848.22",
 "volume":"10587.95505593","volume_30day":"189365.84110046"}
```

Frankfurter:
```json
{"amount":1.0,"base":"EUR","date":"2026-11-10","rates":{"USD":1.1214}}
```

Finnhub (dead):
```json
{"error":"Invalid API key."}    // HTTP 401, quote and candle endpoints
```

FRED api-key path (alive, needs key):
```json
{"error_code":400,"error_message":"Bad Request.  Variable api_key is not set.  Read https://fred.stlouisfed.org/docs/api/api_key.html for more information."}
```

Stooq / fredgraph.csv (blocked — verbatim errors):
```
curl: (28) Connection timed out after 45001 milliseconds          # stooq https (both IPs)
curl: (28) Operation timed out after 20002 milliseconds with 0 bytes received   # fred http1.1
curl: (92) HTTP/2 stream 1 was not closed cleanly: INTERNAL_ERROR (err 2)       # fred http2
```

---

## (d) Ranked shortlist — 3 most valuable additions for trade formulation

**1. CFTC Commitments of Traders — Socrata `6dca-aqww` (Legacy Futures-Only). USE now.**
The only source in this study that adds a genuinely new *dimension* (positioning/flows) rather than another price feed. Weekly non-commercial net positioning, commercial hedger skew, OI changes, trader counts and 4/8-trader concentration for ES, GC, CL, EUR (and every other CFTC market), with 40 years of history (1986→) enabling percentile/z-score context. Directly formulates views: spec-extreme contrarian fades, OI-confirmed breakouts, hedger-pressure regime filters. Verified: no key, JSON with server-side filtering (`$where`/`$select`/`$order`), fresh every Friday 3:30 pm ET, no throttling in a 15-request burst. Integration cost is one weekly batch job + a per-asset code map (ES=13874A, GC=088691, CL=067651, EUR via name "EURO FX"=099741; avoid 098732).

**2. CNBC quote-html-webservice (unofficial). USE with a defensive parser.**
Fills our biggest real-time gap: **front-month futures chains with settlement price, open interest, active-contract symbol (GCZ26/CLZ26) and expiration/roll calendar** — Yahoo gives `CL=F`/`GC=F` prices but not settle/OI/roll metadata. Also free quotes for `.SPX`, `.NDX`, `.DXY` (dollar index), FX (`EUR=`), and equities in one batched pipe-separated call with ~5 s cache — a clean cross-check for Yahoo and a fallback path. Risks: unofficial (no SLA, partnerId=2 borrowed from CNBC's web client), field drift possible, symbols need exact grammar (`@` prefix for futures, `.` for indices). Mitigate with tolerant parsing + Yahoo fallback; keep poll frequency ≥5 s.

**3. Coinbase Exchange public API (spot). USE.**
Regulated US institutional spot venue: top-of-book bid/ask ticker (ns timestamps), 350×15-min candle window, daily history via `start`/`end`, and 24 h/30 d stats. Complements the existing perp-centric stack (Binance/OKX/Bybit + Coinglass): use Coinbase spot as the reference price for perp basis/fair-value and funding sanity checks, and as venue-diversified volume confirmation. No key, 1 s cache, fast (sub-0.4 s responses).

**Runner-up (4th): FRED** — DTWEXBGS + VIXCLS + DGS10 + T10Y2Y would power the macro/regime panel (risk-on/off classification, dollar-regime gating). Blocked from this sandbox's egress and needs a free API key signup (verified the API host itself responds). Action: register a key outside the sandbox, verify `api.stlouisfed.org` from prod egress, then adopt. Stooq (re-probe from prod; overlaps Yahoo) and Finnhub (demo dead, duplicates Yahoo) are SKIP for now.

---

## Integration notes for the terminal (all observed, not assumed)

- **UTC dates in this file reflect sandbox clock (2026-11-11).** Response timestamps above are verbatim from the live endpoints.
- **CFTC:** values arrive as JSON *strings* (e.g. `"229322"`) — coerce to int. Weekly report date = Tuesday; publish Friday. Use `$select` to slim payloads (~120 fields otherwise).
- **CNBC:** numeric fields are display-formatted strings with commas (`"4,069.00"`, `"+0.96%"`) — strip separators/plus/signs before parsing. `code:0` = OK, `code:1` = unknown symbol (still HTTP 200).
- **Coinbase:** candles are **descending** by time (newest first) and capped at 350 per request (observed; docs say 300 — trust the observed 350 with graceful paging via `start`/`end`). Granularity values accepted: `900` and `86400` verified live.
- **Frankfurter:** always `-L` (301 to `api.frankfurter.dev/v1`) or call the new host directly; rates are ECB T-1 references, not live mid.
- **FRED/Stooq:** before writing any integration code, re-verify from production egress — sandbox egress is provably filtered (2 of 9 hosts TCP-dead; example.com and 7 others fine).
