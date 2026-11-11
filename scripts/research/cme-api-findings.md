# CME Group Free Programmatic Access — Live Verification Findings

**Task ID:** R-CME • **Sandbox date:** 2026-11-11 (UTC) • **Probed from:** Linux sandbox, curl 8.14.1
**Scope:** free/no-key futures reference data for ES, NQ, YM, RTY, CL, BZ, GC, SI, PL, 6E, 6B, 6J
**Method:** every claim below was live-probed with curl; raw evidence in `probes/` (sibling directory).

---

## Executive summary

| Channel | Verdict |
|---|---|
| `www.cmegroup.com` CmeWS JSON quotes / ProductSlate / Settlements | **BLOCKED — hard HTTP 403, IP-level anti-scraping block** (not a rate limit; request #1 fails) |
| `api.cmegroup.com`, `marketdata.*`, `developer.*`, `data.*` | **NXDOMAIN — hosts do not exist publicly** |
| `datamine.cmegroup.com` | Resolves (CloudFront) but **TLS handshake fails from sandbox** |
| **`ftp.cmegroup.com` — anonymous FTP/FTPS** | **WORKS.** Verified EOD volume (+ asset-class OI) per product, T+1. The only machine-readable free CME channel verified from this sandbox. |
| Live or delayed *prices* (last/change) via free CME channel | **NOT VERIFIED / NOT AVAILABLE** — quotes endpoints are IP-blocked; FTP carries no prices (except Treasury conversion factors) |

Bottom line: from this sandbox IP, the famous "CmeWS delayed quotes JSON" endpoints are dead on arrival (403 anti-scraping). Free anonymous FTP works and is a legitimate published channel, but it is **EOD volume/OI only** — no quotes, no OHLC, no settlement prices for ES/NQ/CL/etc. A trading terminal needing futures *prices* for free must look outside CME (e.g., Databento free sample, stooq, Yahoo — separate verification task) or license CME data (CME DataMine / Smart Stream, or contact gcc@cmegroup.com per the block message).

---

## (a) Verified endpoint table

| # | URL / channel | HTTP status | Result / data shape | Freshness (observed) |
|---|---|---|---|---|
| 1 | `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/305/G` (ES) | **403** (602 B, `application/json`) | Anti-scraping block JSON (see §BLOCKED). Same for any UA, HTTP/1.1, port 80. Plain curl UA → connection reset (curl exit 92, HTTP/2 INTERNAL_ERROR) | n/a — blocked |
| 2 | `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/4707/G` | **403** (602 B) | Same block JSON | n/a |
| 3 | `https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V1/List?pageNumber=1&searchText=E-mini%20S%26P%20500` | **403** (602 B) | Same block JSON | n/a |
| 4 | `https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/305` | **403** (602 B) | Same block JSON | n/a |
| 5 | `https://www.cmegroup.com/services/product-slate` | **403** (602 B) | Same block JSON | n/a |
| 6 | `https://www.cmegroup.com/robots.txt` | **403** (602 B) | Same block JSON — proves the block is IP/domain-wide, not path-specific | n/a |
| 7 | `https://api.cmegroup.com/api/rest/` | **DNS NXDOMAIN** | Host does not exist | n/a |
| 8 | `https://datamine.cmegroup.com/` | TLS alert (curl 000) | `SSL routines::tls handshake failure` — CloudFront front door refuses this sandbox | n/a |
| 9 | **`ftp://ftp.cmegroup.com/daily_volume/`** (anonymous) | FTP 226/250 OK | Dir of `daily_volume_YYYYMMDD.xlsx` (~100 KB each, back to 2013 + `daily_volume_reports_2013.zip`) | Newest file for trade date 2026-11-09 posted **2026-11-10 03:31 UTC (T+1)** (MDTM `20261110033109`) |
| 10 | `ftp://ftp.cmegroup.com/daily_volume/daily_volume_20261109.xlsx` | RETR OK (99,648 B, 1.3 s) | XLSX, 2 sheets (see shape below) | Trade date 11/09, volume + MTD ADV per product, OI per asset class |
| 11 | `ftp://ftp.cmegroup.com/settle/TCF/` | LIST OK | Daily Treasury-futures **conversion factors** only: `TCF_YYYYMMDD.csv` (~06:30 UTC) + `.xlsx` (~19:00 UTC). NOT general settlements | Daily |
| 12 | `ftp://ftp.cmegroup.com/span/` (`archive/cme`, `util`) | LIST OK | SPAN risk arrays **archive frozen** (latest year dir `2025`, mtime 2025-10-13). `util/product-calendar-new.xml` (37 MB) IS actively updated (mtime 2026-11-10 16:33) but is a product calendar, no prices | Stale except calendar |
| 13 | `ftp://ftp.cmegroup.com/webmthly/` | LIST OK | Monthly zips `YYYYMM.zip` (2013→202610) containing **PDF reports**: Web_{ADV,Volume,Volume_Comparison,OI}_Report_{CME,CBOT,NYMEX_COMEX,CMEG}_YYYYMM.pdf | Monthly, ~5th of month |
| 14 | FTPS: `curl --ssl ftp://ftp.cmegroup.com/...` | OK (226) | Explicit TLS on control channel works — use it | — |

Other verified FTP dirs (less relevant): `SBEFix`, `cash_settled_commodity_index_prices`, `delivery_reports`, `efrp`, `fix`, `fprf`, `grs`, `irs`, `sdr`.

### Shape of `daily_volume_YYYYMMDD.xlsx` (sheet 2, "CME Group Vol and OI by Product")

Header (row 3), verbatim:
```
Description | Exchange Name | Commodity Indicator | Product Description |
Future/Option Indicator | CME® Globex® Volume | Pit Volume | ExPit Volume |
OTC Volume | Total Volume | MTD ADV
```
Sample rows (trade date **2026-11-09**, from `probes/dv2.xlsx`):
```
EQUITY INDEX | CME (STATS) | ES | E-MINI S&P 500 FUTURE        | F | globex 1,981,248 | total 1,993,834 | MTD ADV 2,267,839.5
EQUITY INDEX | CME (STATS) | NQ | E-MINI NASDAQ 100 FUTURE      | F | globex   798,911 | total   805,186 | MTD ADV   897,288.5
EQUITY INDEX | CME (STATS) | RTY| EMINI RUSSELL 2000 INDEX FUTURES | F | globex   219,468 | total   222,718 | MTD ADV   252,280.7
ENERGY       | NYMEX(STATS)| CL | CRUDE OIL LIGHT SWEET FUTURES  | F | globex   911,674 | total   928,338 | MTD ADV 1,026,587.2
METALS       | COMEX(STATS)| GC | GOLD FUTURES                   | F | globex   248,816 | total   249,833 | MTD ADV   233,360.2
FX           | CME (STATS) | EC | EURO FX FUTURE                 | F | globex   177,289 | total   179,203 | MTD ADV   (per sheet)
```
Sheet 1 ("CME Group Volume and OI") adds **Open Interest but only per asset class** (e.g. EQUITY INDEX OI 11,955,803; FX OI 3,851,957; ENERGY 16,167,097; METALS 2,733,723). **Per-product OI is NOT in the daily file** — monthly OI exists only in the `/webmthly` PDFs.

### TASK 2 answers (per product found)
- **Quote freshness / delay:** could not be measured — quotes endpoints are IP-blocked. (CME's website UI states 10-minute delay for non-subscribers; **unverified programmatically**.)
- **Volume/OI included:** volume YES (daily FTP, T+1, per product incl. weekly options); OI per product NO (asset-class only daily; product-level only in monthly PDFs).
- **Free intraday OHLC history:** NOT FOUND via any verified free CME channel. Charts/Settlements JSON endpoints are blocked; FTP has no OHLC.
- **Rate-limit behavior:** never observed a 429 — the very first request returns a permanent 403. It is an Akamai IP block ("This IP address is blocked..."), not a rate limit. On FTP, ~30% of fresh PASV connections stall (measured 7/10 successes on LIST); retries fix it.

---

## (b) Product-ID map for the 10 target instruments

CmeWS numeric product IDs **could not be verified** (endpoint 403). Widely-cited community values are listed for reference and are **UNVERIFIED — do not build on them**:

| Instrument | CmeWS product ID | Status | FTP `Commodity Indicator` (VERIFIED from daily_volume xlsx) | Product description (verbatim) |
|---|---|---|---|---|
| ES — E-mini S&P 500 | 305 | UNVERIFIED (blocked) | **ES** | E-MINI S&P 500 FUTURE |
| NQ — E-mini Nasdaq-100 | 1607 | UNVERIFIED (blocked) | **NQ** | E-MINI NASDAQ 100 FUTURE |
| YM — Mini Dow ($5) | — | unknown | **YM** | MINI $5 DOW FUTURE |
| RTY — E-mini Russell 2000 | — | unknown | **RTY** | EMINI RUSSELL 2000 INDEX FUTURES |
| CL — WTI crude | — | unknown | **CL** | CRUDE OIL LIGHT SWEET FUTURES |
| BZ — Brent | — | unknown | **BZ** | BRENT CRUDE OIL FUTURES |
| GC — Gold | — | unknown | **GC** | GOLD FUTURES |
| SI — Silver | — | unknown | **SI** | SILVER FUTURES |
| PL — Platinum | — | unknown | **PL** | PLATINUM FUTURES |
| 6E — EUR FX | — | unknown | **EC** | EURO FX FUTURE |
| 6B — GBP FX | — | unknown | **BP** | BRITISH POUND FUTURE |
| 6J — JPY FX | — | unknown | **J1** | JAPANESE YEN FUTURE |

Note: CME's stats reporting uses legacy "commodity indicators" (EC/BP/J1) rather than Globex tickers (6E/6B/6J); map them in code. Extra verified neighbors: MES (micro ES), E2A (ES weeklies), LO1–LO4 (CL weekly options).

---

## (c) curl examples (as actually executed)

**1. Delayed-quotes JSON (BLOCKED — shows exact failure):**
```bash
curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
     -H "Accept: application/json" \
     "https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/305/G"
# → HTTP 403, body:
# {"message": "This IP address is blocked due to suspected web scraping activity associated with it on this CMEgroup.com page. Use of scripts, software, spiders, robots, avatars, agents, tools or other scraping mechanisms is strictly prohibited by CME Group's website Data Terms of Use. If you are attempting to access data or content from the website via automated means or for commercial purposes, CME has numerous other methods to deliver the content you require. Please contact CME Group's Global Command Center (GCC) at gcc@cmegroup.com and your inquiry will be directed to the appropriate team."}
```

**2. Daily volume + OI (WORKS — the usable channel):**
```bash
# list recent files (retry ~3x; PASV stalls ~30% of the time)
curl -s --ftp-pasv --max-time 35 "ftp://ftp.cmegroup.com/daily_volume/" | tail -3
# download trade-date 2026-11-09 report (FTPS control channel variant preferred)
curl -s --ssl --ftp-pasv --max-time 60 \
  -o daily_volume_20261109.xlsx \
  "ftp://ftp.cmegroup.com/daily_volume/daily_volume_20261109.xlsx"
# parse: python3 + openpyxl, sheet "CME Group Vol and OI by Product",
#   col 2 = commodity indicator (ES/NQ/.../EC/BP/J1), col 4 = 'F' (future),
#   col 5 = Globex volume, col 9 = Total volume, col 10 = MTD ADV
```

**3. Product slate (BLOCKED):**
```bash
curl -s -H "User-Agent: Mozilla/5.0 ... Chrome/124.0 Safari/537.36" \
  "https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V1/List?pageNumber=1&searchText=E-mini%20S%26P%20500"
# → HTTP 403 (same block JSON)
```

**4. Settlements (BLOCKED on web; FTP TCF is Treasuries-only):**
```bash
curl -s -H "User-Agent: Mozilla/5.0 ... Chrome/124.0 Safari/537.36" \
  "https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/305"          # → 403
curl -s --ssl --ftp-pasv "ftp://ftp.cmegroup.com/settle/TCF/TCF_20261110.csv" -o tcf.csv
# → Exch,Period,PFCode,CUSIP,Invoice_Conversion_Factor,Create_Time  (bond conversion factors ONLY)
```

**5. Monthly OI/ADV PDFs (WORKS):**
```bash
curl -s --ssl --ftp-pasv -o 202610.zip "ftp://ftp.cmegroup.com/webmthly/202610.zip"
# contains Web_OI_Report_{CME,CBOT,NYMEX_COMEX}.pdf, Web_ADV_Report_*.pdf, Web_Volume_Report_*.pdf
```

**6. File timestamp check (freshness):**
```bash
# MDTM via ftplib → daily_volume_20261109.xlsx = 20261110033109 (2026-11-10 03:31:09 UTC)
```

---

## (d) BLOCKED list (honest)

| Target | Failure mode | Retry-ability |
|---|---|---|
| `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/305/G` (ES quotes) | 403 anti-scraping JSON; with default curl UA instead: HTTP/2 stream reset (curl exit 92). Same over HTTP/1.1 and port 80 | No — IP-level; UA/headers/path changes do not help |
| `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/4707/G` | 403 (identical) | No |
| `https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V1/List` | 403 (identical) | No |
| `https://www.cmegroup.com/CmeWS/mvc/Settlements/...` | 403 (identical) | No |
| `https://www.cmegroup.com/services/...` and even `/robots.txt` | 403 (identical) | No |
| `https://api.cmegroup.com/*` | DNS NXDOMAIN | n/a |
| `https://marketdata.cmegroup.com`, `developer.cmegroup.com`, `data.cmegroup.com`, `m.cmegroup.com`, `cdn.cmegroup.com`, `quotes.cmegroup.com` | DNS NXDOMAIN | n/a |
| `https://datamine.cmegroup.com` | Resolves (CloudFront/AWS) but TLS handshake failure | Maybe from another network; CME DataMine is a paid catalog anyway |
| Any live/delayed last-price, change, or OHLC data | No free channel verified | — |

Escalation path stated by CME in the block body itself: contact **gcc@cmegroup.com** (Global Command Center) for legitimate data-delivery options.

---

## (e) Integration notes (trading terminal)

**What you can legitimately build free from this sandbox:**
1. **EOD volume/liquidity enrichment** from `/daily_volume/*.xlsx`: schedule fetch at **~04:30 UTC** (files observed at 03:31 UTC) for prior trade date; cache **24 h** (immutable once published). Use `--ssl --ftp-pasv` with **3–5 retries + jitter** (30% connection-stall rate measured); keep each connection to a single file (server dislikes rapid sequential sessions — reuse one ftplib session when downloading several files).
2. **Asset-class OI** (daily) and **monthly per-product OI/ADV** (PDFs, ~5th of month) — cache 24 h / 7 d respectively.
3. **Product metadata**: `span/util/product-calendar-new.xml` (37 MB, updated daily ~16:30 UTC) → contract calendars/expiries. Cache 24 h.

**What you cannot build free from here:** futures *prices* (live, delayed, or settlement) for the 10 instruments. No 429-style rate limit exists to engineer around — the web JSON API is a hard 403 at the Akamai edge for this IP.

**Recommended poll cadence:** FTP directory poll once daily 04:30 UTC (volume), once weekly for webmthly; do NOT poll www.cmegroup.com at all from server IPs (it will only feed the block). Cache TTLs: volume file 24 h; MTD ADV recompute from same file; calendar 24 h.

**Next actions proposed:**
- Probe non-CME free sources for futures lead prices (to be verified separately — do not assume): e.g., Databento free samples, stooq delayed futures, Yahoo Finance futures quotes (`ES=F`, `CL=F`, `GC=F`...), TradingView unofficial — each needs its own live verification pass from this sandbox.
- If CME-brand data is mandatory: request licensed delayed feed via gcc@cmegroup.com / CME DataMine (paid), or test the quotes endpoints from a residential/office egress IP — the block message is IP-scoped, so a different egress may pass (unverified).
- Re-test `www.cmegroup.com` monthly — the IP block may be temporary.

**Evidence files:** `probes/block_403.json` (full 403 body), `probes/dv2.xlsx` (parsed daily volume), `probes/TCF_20261110.csv`, `probes/webmthly_202610.zip`, `probes/*.json|txt` (raw HTTP/FTP responses).
