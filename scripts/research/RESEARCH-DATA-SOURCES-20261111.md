# Data-Source Research Compendium — 2026-11-11 (R3 round)

> User directive: *"find multiple resources more like CME etc from where we can plug the data
> information... intensive research to find sources via api free we can plug information which
> could help us do better trade formulation."* Every source below was **LIVE-PROBED** from the
> sandbox (curl/python) — nothing here is second-hand documentation. Evidence files:
> `scripts/research/{cme-api-findings,free-api-landscape,cg-classic-perp-coverage,cg-classic-perp-keys,cg-engine-surface,review-arch-R3,review-data-R3}.*`
> and probe scripts `scripts/probe_cg_{index_perps,funding_enumerate,venue_keys,engine_surface}.py`.

## 1. The headline discovery — Coinglass carries REAL perps for classic instruments

The user's screenshot (coinglass.com search for "sp500": tradeXYZ SP500-USD $463M vol) overturned
the Tier-3 assumption ("no perp data anywhere"). Systematic probe results (venue grammars ×
`/api/v2/kline`, decrypted through the terminal's client chain):

| instrument | live perp venues | OI klines | order_flow | funding | liquidity |
|---|---|---|---|---|---|
| **SP500 / SPX500** | tradeXYZ (lead), Bitget | ✅ | ❌ tradeXYZ | ❌ | REAL (153k ctc/15m) |
| NDX100 | Bitget | ✅ | ❌ | ❌ | thin (0 vol) |
| US2000 | — none — | — | — | — | COT only |
| **JP225** | tradeXYZ (lead), Bitget, OKX | ✅ | ❌ | ✅ OKX 0%/8h | REAL |
| HK50 | Bitget (HSI) | ✅ | ❌ | ❌ | thin |
| **USO (WTI)** | **Binance CLUSDT (lead), OKX, Bybit, Bitget** | ✅ | ✅ | ✅ (10 venues) | **REAL — Binance $771M vol/24h, OI 1.73M ≈ CFTC** |
| **UKO (Brent)** | tradeXYZ BRENTOIL | ✅ | ❌ | ❌ | REAL (565k ctc/15m) |
| **NATGAS** | Binance (lead), Bitget, tradeXYZ | ✅ | ✅ | ✅ | REAL — **not listed at FundedNext, watchlist only** |
| **EURUSD** | Bybit (lead), Bitget, tradeXYZ EUR | ✅ | ✅ | ❌ | REAL (14k ctc/15m) |
| USDJPY | Bybit, Bitget, tradeXYZ JPY | ✅ | ✅ | ❌ | thin |
| GBPUSD | Bybit, Bitget | ✅ | ✅ | ❌ | thin |
| XAU/XAG/XPT | +tradeXYZ GOLD/SILVER/PLATINUM | ✅ | ❌ | ✅ (0.0%) | extra venue on top of perp registry |

**Traps probed and EXCLUDED (wrong-instrument data is worse than no data):**
- `SPX` on Binance/OKX/Bybit @ ~$0.37 = **SPX6900 memecoin**, not the S&P 500
- Bitget `ASXUSDT` @ ~36.89 = wrong instrument (ASX200 ≈ 8,000+)
- OKX `USO-USDT-SWAP` @ ~$141 = **United States Oil Fund ETF** (DIR-0009), +63% off WTI —
  superseded by the Binance CLUSDT market above

## 2. Free-source landscape (all live-verified 2026-11-11)

| source | verdict | role in trade formulation |
|---|---|---|
| **CFTC COT** (Socrata `6dca-aqww`, Legacy Futures-Only) | ✅ no key, 40y history, Fri 15:30 ET | weekly positioning dimension: large-spec net, hedger skew, **3y z-score** (contrarian/squeeze) |
| **CNBC quote webservice** | ✅ keyless, ~5s cache | front-month futures: settle, OI, roll calendar (`@GC.1`→GCZ26), live index/FX |
| **Coinbase Exchange public** | ✅ keyless | regulated US spot reference (basis cross-check vs perps) |
| **Frankfurter (ECB)** | ✅ keyless (follow 301) | independent FX sanity anchor, T-1 reference |
| **CME** | ⚠️ www JSON **hard-blocked** (Akamai IP-level 403); `ftp.cmegroup.com` anonymous FTP works | daily-volume xlsx T+1 (ES/NQ/RTY/YM/CL/BZ/GC/SI/PL/6E/6B/6J verified) — ADV context only, no prices |
| Stooq CSV | ❌ TCP-blocked from sandbox egress | retest from production box; overlaps Yahoo anyway |
| FRED | ⚠️ fredgraph blocked (egress); `api.stlouisfed.org` alive, needs **free key** | macro regime panel (DTWEXBGS, VIXCLS, DGS10, T10Y2Y) once key provided |
| Finnhub demo | ❌ dead (401) | skip |

**CFTC codes verified live:** ES 13874A · NQ 20974+ · RTY 239742 · NKY 240743 · GC 088691 ·
SI 084691 · PL 076651 · CL 067651 · BZ 06765T · EC 099741 · JY 097741 · BP 096742.
**CNBC symbols verified live:** `.SPX .NDX .DJI .DXY @GC.1 @CL.1 @SI.1 @PL.1 @BZ.1 @NG.1 EUR= JPY= GBP=`
(`@ES.1` returns empty — the S&P futures reference is `.SPX`).

## 3. What was INTEGRATED this round (all built, tested, review-hardened)

1. **`src/lib/cg/perpmap.ts`** — verified registry: perp venue keys + funding symbols + COT codes +
   CNBC symbols + liquidity verdicts + trap documentation.
2. **`/api/cg/perpdepth?sym=`** — per-venue close/vol24h, lead OI series with Δ1h/4h/24h, funding
   (where published), 15m taker-flow USD (flow venues). 60s cache, honest-400 unmapped, honest-502
   when upstream empty.
3. **`/api/cg/cot?sym=`** — CFTC positioning: large-spec/commercial net, weekly change, spec %OI,
   traders, **3y z-score**, 78-week history. 6h cache (5min error cache).
4. **`/api/cg/cnbc?syms=`** — futures reference (settle/OI/active contract/expiry) + index/FX
   quotes, futures−cash basis computed downstream. 60s cache.
5. **UI `DerivativesPanel`** — three panels on every classic Overview: *Perp market depth*,
   *CFTC COT positioning*, *Front-month futures* (each auto-hidden when unmapped; n/a lines
   where upstream carries nothing).
6. **Deepscan classic reports** — §2–§6 upgraded from "n/a (honest gaps)" to the live derivatives
   sections above; residual gaps still printed with reasons.
7. **NATGAS** added to the classic registry (3-venue perp market; not broker-listed → watchlist).

## 4. Multi-agent review (tech-team-agents round 3) — findings & fixes

Reviewers: RV-ARCH (architecture) + RV-DATA (numbers vs independent references).
**41 PASS · 6 FAIL → all fixed and re-verified:**
- B1 COT z-score used the OLDEST of 170 records (DESC series) → now latest; USO z flipped
  +1.07→**−1.39** (sign error corrected; SP500 −0.48)
- B2 US2000 (COT-only, zero venues) crashed perpdepth 500 → honest 400
- B3 classic UI sends **SPX500**, perpmap keyed SP500 → alias added; S&P panels live
- F1 funding was **100× overstated** (Coinglass `rate` is already %) → Binance CL now −0.0327%/4h
  vs Binance premiumIndex −0.0325% ✓
- M1 COT errors negative-cached 6h → 5min · M2 deepscan `z` shadowing → `cot_z` · M3 all-null
  ok:true → honest 502 · M4 flow USD-column only · CNBC %-sign parse

## 5. Coverage after this round

- **Full perp engine (8-dim):** 15 assets (12 crypto + XAU/XAG/XPT)
- **Derivatives-enhanced classic (price/OI/funding/flow + COT + futures ref):** SPX500, NDX100,
  JP225, HK50, USO, UKO, NATGAS, EURUSD, USDJPY, GBPUSD (+XAU/XAG/XPT get extra venue panels)
- **Quotes+bars only:** remaining 69 classic instruments (US30, VIX, EU indices, 43 FX, equities)
- **Honest n/a everywhere else** — never fabricated

## 6. Next levers (not yet built, for the user to prioritize)

1. **FRED macro panel** — needs a free API key (signup outside sandbox); adds DXY/VIX/yields/curve
   as a regime filter over the whole book.
2. **Coinbase spot-basis column** for the 15 perp assets (endpoint verified, not yet wired).
3. **tradeXYZ footprint-style depth** — the order_flow buckets don't exist for tradeXYZ venues,
   but Binance/Bybit venues (USO, NATGAS, EURUSD) could feed the FULL footprint engine — i.e.
   promote USO/NATGAS/EURUSD from "classic" to a hybrid engine tier.
4. **COT-triggered desk verdicts** — z-score ≥ 2 as a scorecard dimension in the desk round engine.
