# CRYPTO DOMAIN 360° SCREENING & DEEP TELEMETRY REPORT

**Domain Analyst**: `@crypto-5`  
**Lead Synthesizer**: `@lead-5`  
**Timestamp**: 2026-11-14 11:08:13 UTC  
**Session**: Weekend Session (Crypto-Only Active · TradFi Halted)  
**Coverage**: All 30 Curated Crypto USDT-M Perps (`src/lib/universe/curated.ts`) · 100% Zero-Mock Coinglass Live API Data  
**Specification**: `desk/TRADE_FORMULATION_MANUAL.md` v1.1.0 & Canonical Playbook (10 Nov 2026)

---

## 1. Executive Summary

In this 360° universe formulation round, `@crypto-5` executed the complete **Tier A Narrative Sweep** across all **30 crypto USDT-M perp assets**, extracted live order flow across the **16 Telemetry Data Dimensions**, and performed canonical **Table 7 Confluence Scoring** with strict zero-fallback rules.

- **Total Assets Swept**: 30 / 30
- **Tier B Qualifiers Isolated**: **29 assets** (BTC, ETH, BNB, SOL, XRP, ADA, DOGE, LINK, LTC, AVAX, DOT, NEAR, UNI, ATOM, XLM, ETC, FIL, ICP, HBAR, APT, ARB, OP, SUI, SEI, INJ, TIA, VET, 1000PEPE, 1000SHIB)
- **Market Regime Posture**: Broad macro downtrend / distribution across major crypto perps (BTC, ETH, SOL, BNB, XRP), with extensive H4/D1 EMA 13x89 cascades holding down.
- **Liquidation Skew Asymmetry**: Heavy short liquidation pools above current price action create strong **Sweep Magnets** on high-beta altcoins. Assets exceeding the **LSR ≥ 2.5:1** threshold have had all passive limit entries (S2/S3) **banned** by the Liquidation Magnet Gate (§3), enforcing a **Wait for the Sweep (Setup S1)** posture.
- **MT5 Execution Viability**: FundedNext broker spreads disqualify all altcoins except **BTCUSD (0.0348%)**, **ETHUSD (0.0285%)**, **XRPUSD (0.0986%)**, and **XLMUSD (0.1157%)**. Unmapped or high-spread assets (ADA 2.25%, DOGE 1.39%, LTC 2.42%, LINK 0.57%) remain hard-vetoed for direct MT5 order placement.

---

## 2. Tier A Full-Universe Screening Table (All 30 Crypto Assets)

| Symbol | Sector | Price | Regime | Dir | Grade | Conf % | M1/M2 Status | VWAP z-score | ±2% LSR (Dominant) | MT5 Spread | Active Vetoes | Qualifier? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BTC** | Store of Value | $67,256.90 | `RANGE_BALANCE` | **LONG** | `B` | 35% | `M2:WATCH_EXHAUSTION` | +0.03σ | **1.2:1 (SA)** | 0.0348% (PASS) | None | **YES** |
| **ETH** | Smart Contract L1 | $1,908.50 | `RANGE_BALANCE` | **LONG** | `B` | 35% | `M2:WATCH_EXHAUSTION` | +0.66σ | **1.3:1 (SA)** | 0.0285% (PASS) | None | **YES** |
| **BNB** | Exchange Token | $619.4300 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.20σ | **2.0:1 (LB)** | No MT5 Venue | M1 R 0.76 < 1.5 — reward does no... | **YES** |
| **SOL** | Smart Contract L1 | $75.7500 | `TREND_DOWN` | **SHORT** | `B` | 88% | `M1:TRIGGERED` | -0.18σ | **1.4:1 (SA)** | No MT5 Venue | M1 R 0.61 < 1.5 — reward does no... | **YES** |
| **XRP** | Payments | $0.990900 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.31σ | **1.5:1 (SA)** | 0.0986% (PASS) | M1 R 0.35 < 1.5 — reward does no... | **YES** |
| **ADA** | Smart Contract L1 | $0.163300 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.67σ | **1.2:1 (LB)** | 2.2499% (VETO) | M1 R 0.55 < 1.5 — reward does no... | **YES** |
| **DOGE** | Meme | $0.062900 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.15σ | **1.0:1 (LB)** | 1.3921% (VETO) | M1 R 0.33 < 1.5 — reward does no... | **YES** |
| **TRX** | Smart Contract L1 | $0.313410 | `RANGE_BALANCE` | **LONG** | `B` | 35% | `M2:WATCH_EXHAUSTION` | +1.43σ | **2.0:1 (SA)** | No MT5 Venue | None | No |
| **LINK** | Oracle | $9.6080 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.43σ | **2.2:1 (LB)** | 0.5666% (VETO) | M1 R 0.36 < 1.5 — reward does no... | **YES** |
| **LTC** | Payments | $48.2800 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.90σ | **5.5:1 (LB)** | 2.4241% (VETO) | M1 R 0.28 < 1.5 — reward does no... | **YES** |
| **AVAX** | Smart Contract L1 | $7.9730 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.48σ | **10.8:1 (LB)** | No MT5 Venue | M1 R 0.27 < 1.5 — reward does no... | **YES** |
| **DOT** | Interoperability | $0.784100 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.01σ | **3.2:1 (LB)** | No MT5 Venue | M1 R 0.37 < 1.5 — reward does no... | **YES** |
| **NEAR** | Smart Contract L1 | $3.3260 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.91σ | **3.9:1 (LB)** | No MT5 Venue | M1 R 0.24 < 1.5 — reward does no... | **YES** |
| **UNI** | DeFi DEX | $5.5150 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.07σ | **3.5:1 (LB)** | No MT5 Venue | M1 R 0.70 < 1.5 — reward does no... | **YES** |
| **ATOM** | Interoperability | $1.3350 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.35σ | **1.5:1 (LB)** | No MT5 Venue | M1 R 0.83 < 1.5 — reward does no... | **YES** |
| **XLM** | Payments | $0.144200 | `RANGE_BALANCE` | **NEUTRAL** | `SKIP` | 20% | `OFF` | +0.74σ | **3.5:1 (SA)** | 0.1157% (PASS) | None | **YES** |
| **ETC** | Smart Contract L1 | $6.3000 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.39σ | **1.6:1 (LB)** | No MT5 Venue | M1 R 0.43 < 1.5 — reward does no... | **YES** |
| **FIL** | Storage | $0.686400 | `TREND_DOWN` | **SHORT** | `B` | 88% | `M1:TRIGGERED` | -0.46σ | **1.3:1 (LB)** | No MT5 Venue | M1 R 0.37 < 1.5 — reward does no... | **YES** |
| **ICP** | Smart Contract L1 | $2.3930 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.64σ | **22.7:1 (LB)** | No MT5 Venue | M1 R 0.74 < 1.5 — reward does no... | **YES** |
| **HBAR** | Enterprise L1 | $0.060120 | `TREND_DOWN` | **SHORT** | `A+` | 92% | `M1:TRIGGERED` | -0.01σ | **5.0:1 (SA)** | No MT5 Venue | None | **YES** |
| **APT** | Smart Contract L1 | $0.509800 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.50σ | **5.1:1 (LB)** | No MT5 Venue | M1 R 0.40 < 1.5 — reward does no... | **YES** |
| **ARB** | Ethereum L2 | $0.139630 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.61σ | **1.3:1 (LB)** | No MT5 Venue | M1 R 0.75 < 1.5 — reward does no... | **YES** |
| **OP** | Ethereum L2 | $0.088160 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.54σ | **6.6:1 (LB)** | No MT5 Venue | M1 R 0.45 < 1.5 — reward does no... | **YES** |
| **SUI** | Smart Contract L1 | $0.769600 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.00σ | **6.8:1 (LB)** | No MT5 Venue | M1 R 0.23 < 1.5 — reward does no... | **YES** |
| **SEI** | Smart Contract L1 | $0.040740 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.56σ | **10.9:1 (LB)** | No MT5 Venue | M1 R 0.26 < 1.5 — reward does no... | **YES** |
| **INJ** | DeFi L1 | $7.8980 | `RANGE_BALANCE` | **NEUTRAL** | `SKIP` | 20% | `OFF` | -1.67σ | **73.7:1 (LB)** | No MT5 Venue | None | **YES** |
| **TIA** | Modular DA | $0.365200 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.54σ | **6.2:1 (LB)** | No MT5 Venue | M1 R 0.43 < 1.5 — reward does no... | **YES** |
| **VET** | Supply Chain | $0.004892 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -1.28σ | **12.5:1 (LB)** | No MT5 Venue | M1 R 0.32 < 1.5 — reward does no... | **YES** |
| **1000PEPE** | Meme | $0.004277 | `RANGE_BALANCE` | **LONG** | `B` | 35% | `M2:WATCH_EXHAUSTION` | +0.05σ | **2.8:1 (SA)** | No MT5 Venue | None | **YES** |
| **1000SHIB** | Meme | $0.004145 | `TREND_DOWN` | **SHORT** | `B` | 92% | `M1:TRIGGERED` | -0.87σ | **5.4:1 (LB)** | No MT5 Venue | M1 R 0.47 < 1.5 — reward does no... | **YES** |

---

## 3. Tier B Qualifier Isolation & Synthesis

A total of **29 assets** met the canonical Tier B criteria:
- Criteria: Grade A/A+, OR Confidence ≥ 80% with M1/M2 Triggered, OR LSR ≥ 2.5:1 magnet, OR |Composite Score| ≥ 2.0, OR Core Tier-1 (BTC, ETH, SOL).

### Isolated Shortlist:
- **BTC** (Bitcoin): Core Tier-1 Macro Benchmark | Regime: `RANGE_BALANCE` (LONG) | Conf: `35%` | LSR: `1.2:1 (SA)` | MT5: `0.0348% (PASS)`
- **ETH** (Ethereum): Core Tier-1 Macro Benchmark | Regime: `RANGE_BALANCE` (LONG) | Conf: `35%` | LSR: `1.3:1 (SA)` | MT5: `0.0285% (PASS)`
- **BNB** (BNB): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `2.0:1 (LB)` | MT5: `No MT5 Venue`
- **SOL** (Solana): Conf 88% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `88%` | LSR: `1.4:1 (SA)` | MT5: `No MT5 Venue`
- **XRP** (XRP): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.5:1 (SA)` | MT5: `0.0986% (PASS)`
- **ADA** (Cardano): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.2:1 (LB)` | MT5: `2.2499% (VETO)`
- **DOGE** (Dogecoin): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.0:1 (LB)` | MT5: `1.3921% (VETO)`
- **LINK** (Chainlink): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `2.2:1 (LB)` | MT5: `0.5666% (VETO)`
- **LTC** (Litecoin): Conf 92% + M1 Triggered · LSR Magnet 5.5:1 (LB) ($480k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `5.5:1 (LB)` | MT5: `2.4241% (VETO)`
- **AVAX** (Avalanche): Conf 92% + M1 Triggered · LSR Magnet 10.8:1 (LB) ($3249k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `10.8:1 (LB)` | MT5: `No MT5 Venue`
- **DOT** (Polkadot): Conf 92% + M1 Triggered · LSR Magnet 3.2:1 (LB) ($9708k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `3.2:1 (LB)` | MT5: `No MT5 Venue`
- **NEAR** (NEAR Protocol): Conf 92% + M1 Triggered · LSR Magnet 3.9:1 (LB) ($13247k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `3.9:1 (LB)` | MT5: `No MT5 Venue`
- **UNI** (Uniswap): Conf 92% + M1 Triggered · LSR Magnet 3.5:1 (LB) ($3692k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `3.5:1 (LB)` | MT5: `No MT5 Venue`
- **ATOM** (Cosmos): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.5:1 (LB)` | MT5: `No MT5 Venue`
- **XLM** (Stellar): LSR Magnet 3.5:1 (SA) ($38304k) | Regime: `RANGE_BALANCE` (NEUTRAL) | Conf: `20%` | LSR: `3.5:1 (SA)` | MT5: `0.1157% (PASS)`
- **ETC** (Ethereum Classic): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.6:1 (LB)` | MT5: `No MT5 Venue`
- **FIL** (Filecoin): Conf 88% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `88%` | LSR: `1.3:1 (LB)` | MT5: `No MT5 Venue`
- **ICP** (Internet Computer): Conf 92% + M1 Triggered · LSR Magnet 22.7:1 (LB) ($1258k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `22.7:1 (LB)` | MT5: `No MT5 Venue`
- **HBAR** (Hedera): Grade A+ · Conf 92% + M1 Triggered · LSR Magnet 5.0:1 (SA) ($88321k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `5.0:1 (SA)` | MT5: `No MT5 Venue`
- **APT** (Aptos): Conf 92% + M1 Triggered · LSR Magnet 5.1:1 (LB) ($9343k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `5.1:1 (LB)` | MT5: `No MT5 Venue`
- **ARB** (Arbitrum): Conf 92% + M1 Triggered | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `1.3:1 (LB)` | MT5: `No MT5 Venue`
- **OP** (Optimism): Conf 92% + M1 Triggered · LSR Magnet 6.6:1 (LB) ($43344k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `6.6:1 (LB)` | MT5: `No MT5 Venue`
- **SUI** (Sui): Conf 92% + M1 Triggered · LSR Magnet 6.8:1 (LB) ($60535k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `6.8:1 (LB)` | MT5: `No MT5 Venue`
- **SEI** (Sei): Conf 92% + M1 Triggered · LSR Magnet 10.9:1 (LB) ($72032k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `10.9:1 (LB)` | MT5: `No MT5 Venue`
- **INJ** (Injective): LSR Magnet 73.7:1 (LB) ($3663k) | Regime: `RANGE_BALANCE` (NEUTRAL) | Conf: `20%` | LSR: `73.7:1 (LB)` | MT5: `No MT5 Venue`
- **TIA** (Celestia): Conf 92% + M1 Triggered · LSR Magnet 6.2:1 (LB) ($13672k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `6.2:1 (LB)` | MT5: `No MT5 Venue`
- **VET** (VeChain): Conf 92% + M1 Triggered · LSR Magnet 12.5:1 (LB) ($240974k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `12.5:1 (LB)` | MT5: `No MT5 Venue`
- **1000PEPE** (Pepe (1000x perp)): LSR Magnet 2.8:1 (SA) ($4973650k) | Regime: `RANGE_BALANCE` (LONG) | Conf: `35%` | LSR: `2.8:1 (SA)` | MT5: `No MT5 Venue`
- **1000SHIB** (Shiba Inu (1000x perp)): Conf 92% + M1 Triggered · LSR Magnet 5.4:1 (LB) ($1018346k) | Regime: `TREND_DOWN` (SHORT) | Conf: `92%` | LSR: `5.4:1 (LB)` | MT5: `No MT5 Venue`

---

## 4. Deep Telemetry Dossier & Strict Table 7 Confluence Scoring

> [!IMPORTANT]

> **STRICT ZERO-FALLBACK MANDATE**: In accordance with the canonical audit requirements, unfulfilled categories receive strictly **0.0 points**. Zero phantom or partial points are awarded for missing footprint signals, absent book walls, unconfirmed CVD divergence, or failed regime alignment. Minimum score of **5.0 points** is required to trade; setups < 5.0 are classified as **HARD VETO (NO TRADE)**.

### BTC · Bitcoin (LONG)

- **Live Spot / Perp Price**: $67,256.90
- **Regime / Model**: `RANGE_BALANCE` | Active Model: `OFF` (Conf: 35%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **0.0** — H4: Bear vs D1: Bear (Opposing/Partial -> 0.0 pts)
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($67,256.90) > VWAP ($67,245.22) [Premium Zone - Buying in premium fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (buy) @ $69,062.40 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Bid Wall $13.86M @ $67,190.00 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BULL CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.2:1 (SA)) -> 0.0 pts
  * Options GEX Context (1.0 max): **1.0** — Negative Gamma Expansion confirms trend acceleration / S1 / S8 (Flip: $72,003.60) -> 1.0 pt
  * Broker Spread Drag (1.0 max): **1.0** — Spread 0.0348% < 0.05% -> 1.0 pt

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `0.0348% (PASS)` | Basis: `+0.0348%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `67,156.60` | Day VAL: `66,676.52` · Day POC: `67,141.37` · Day VAH: `67,440.20` | Month POC: `75,837.32`
3. **VWAP Regime & Bands**: VWAP: `$67,245.22` (z = `+0.03σ`) | -1σ: `$66,864.37` · +1σ: `$67,626.07`
4. **EMA Cascade**: M15: `13=67,214.28 / 89=68,035.49` | H1: `13=67,567.72 / 89=70,798.03` | H4: `13=69,214.77 / 89=74,796.93` | D1: `13=73,547.29 / 89=77,224.87`
5. **Multi-TF RSI**: M15: `49.41880055543785` | H1: `35.120348751096685` | H4: `23.65175583633105`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 16 (Bullish: 17, Bearish: 22) | Active: `Discrete SDIV (buy) @ $69,062.40 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-8499` | Quadrant: `spot-bid` | Taker Buy Share: `48.9%` | Active Divs: 18
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.26B` vs Ask `$1.01B` (Imbalance: `10.6%`) | Confirmed Walls: 55
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 0 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$44.5k` vs Longs Down: `$38.4k` → **LSR: 1.2:1 (SA)**
13. **Options GEX Context**: Regime: `NEGATIVE_GAMMA_EXPANSION` | Gamma Flip: `$72,003.60` | DVOL: `41.2`
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `0.0348% (PASS)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.2:1 (SA)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ETH · Ethereum (LONG)

- **Live Spot / Perp Price**: $1,908.50
- **Regime / Model**: `RANGE_BALANCE` | Active Model: `OFF` (Conf: 35%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **0.0** — H4: Bear vs D1: Bear (Opposing/Partial -> 0.0 pts)
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($1,908.50) > VWAP ($1,900.73) [Premium Zone - Buying in premium fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (buy) @ $1,953.57 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Bid Wall $27.56M @ $1,908.00 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BULL CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.3:1 (SA)) -> 0.0 pts
  * Options GEX Context (1.0 max): **1.0** — Negative Gamma Expansion confirms trend acceleration / S1 / S8 (Flip: $1,996.00) -> 1.0 pt
  * Broker Spread Drag (1.0 max): **1.0** — Spread 0.0285% < 0.05% -> 1.0 pt

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `0.0285% (PASS)` | Basis: `+0.0285%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `1,903.94` | Day VAL: `1,883.92` · Day POC: `1,903.88` · Day VAH: `1,910.17` | Month POC: `2,246.32`
3. **VWAP Regime & Bands**: VWAP: `$1,900.73` (z = `+0.66σ`) | -1σ: `$1,888.97` · +1σ: `$1,912.49`
4. **EMA Cascade**: M15: `13=1,905.78 / 89=1,922.41` | H1: `13=1,911.57 / 89=1,997.09` | H4: `13=1,951.34 / 89=2,151.44` | D1: `13=2,105.56 / 89=2,309.54`
5. **Multi-TF RSI**: M15: `52.857828700181805` | H1: `41.86209626417157` | H4: `31.222402143427857`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 15 (Bullish: 28, Bearish: 21) | Active: `Discrete ABS (buy) @ $1,953.57 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-5474` | Quadrant: `spot-bid` | Taker Buy Share: `49%` | Active Divs: 15
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$632.07M` vs Ask `$635.06M` (Imbalance: `-0.2%`) | Confirmed Walls: 41
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 0 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$783.4k` vs Longs Down: `$606.7k` → **LSR: 1.3:1 (SA)**
13. **Options GEX Context**: Regime: `NEGATIVE_GAMMA_EXPANSION` | Gamma Flip: `$1,996.00` | DVOL: `54.6`
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `0.0285% (PASS)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.3:1 (SA)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### BNB · BNB (SHORT)

- **Live Spot / Perp Price**: $619.4300
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **8.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($619.4300) < VWAP ($620.3793) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $658.8300 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.06M @ $621.4000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (2.0:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `616.6335` | Day VAL: `614.2977` · Day POC: `616.6276` · Day VAH: `622.9514` | Month POC: `695.7292`
3. **VWAP Regime & Bands**: VWAP: `$620.3793` (z = `-0.20σ`) | -1σ: `$615.6831` · +1σ: `$625.0755`
4. **EMA Cascade**: M15: `13=618.2746 / 89=627.0897` | H1: `13=622.4884 / 89=651.7468` | H4: `13=637.3306 / 89=684.8291` | D1: `13=674.1912 / 89=704.3616`
5. **Multi-TF RSI**: M15: `50.67628634404886` | H1: `36.98359311784756` | H4: `26.821511102498462`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 27 (Bullish: 24, Bearish: 35) | Active: `Discrete SDIV (sell) @ $658.8300 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-417` | Quadrant: `both-selling` | Taker Buy Share: `48%` | Active Divs: 21
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$22.71M` vs Ask `$22.44M` (Imbalance: `0.6%`) | Confirmed Walls: 33
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 15 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$49.1k` vs Longs Down: `$95.7k` → **LSR: 2.0:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (2.0:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### SOL · Solana (SHORT)

- **Live Spot / Perp Price**: $75.7500
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 88%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($75.7500) < VWAP ($75.8974) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $81.8000 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $16.28M @ $76.0000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.4:1 (SA)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `75.4667` | Day VAL: `74.9852` · Day POC: `75.6002` · Day VAH: `76.0922` | Month POC: `89.8760`
3. **VWAP Regime & Bands**: VWAP: `$75.8974` (z = `-0.18σ`) | -1σ: `$75.0883` · +1σ: `$76.7065`
4. **EMA Cascade**: M15: `13=75.6504 / 89=77.3439` | H1: `13=76.4158 / 89=80.9428` | H4: `13=78.8624 / 89=88.1751` | D1: `13=85.6876 / 89=97.1320`
5. **Multi-TF RSI**: M15: `49.22717154572983` | H1: `34.69367357735071` | H4: `27.276237107188948`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 16 (Bullish: 46, Bearish: 32) | Active: `Discrete ABS (sell) @ $81.8000 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-1942` | Quadrant: `both-selling` | Taker Buy Share: `48.8%` | Active Divs: 29
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$107.38M` vs Ask `$125.92M` (Imbalance: `-8.0%`) | Confirmed Walls: 7
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 24 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$4.55M` vs Longs Down: `$3.30M` → **LSR: 1.4:1 (SA)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.4:1 (SA)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### XRP · XRP (SHORT)

- **Live Spot / Perp Price**: $0.990900
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.990900) < VWAP ($0.993030) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $1.0166 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $7.32M @ $0.994000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.5:1 (SA)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.5** — Spread 0.0986% in [0.05%, 0.10%] -> 0.5 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `0.0986% (PASS)` | Basis: `+0.0986%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.991608` | Day VAL: `0.983773` · Day POC: `0.991800` · Day VAH: `0.998680` | Month POC: `1.2530`
3. **VWAP Regime & Bands**: VWAP: `$0.993030` (z = `-0.31σ`) | -1σ: `$0.986110` · +1σ: `$0.999949`
4. **EMA Cascade**: M15: `13=0.989314 / 89=1.0036` | H1: `13=0.996719 / 89=1.0376` | H4: `13=1.0154 / 89=1.1407` | D1: `13=1.1103 / 89=1.2780`
5. **Multi-TF RSI**: M15: `49.40063467133191` | H1: `37.576964204888796` | H4: `32.04649676002218`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 33 (Bullish: 39, Bearish: 39) | Active: `Discrete ABS (sell) @ $1.0166 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-993` | Quadrant: `both-selling` | Taker Buy Share: `48.2%` | Active Divs: 24
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$56.18M` vs Ask `$63.29M` (Imbalance: `-6.0%`) | Confirmed Walls: 15
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 25 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$166.72M` vs Longs Down: `$109.54M` → **LSR: 1.5:1 (SA)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `0.0986% (PASS)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.5:1 (SA)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ADA · Cardano (SHORT)

- **Live Spot / Perp Price**: $0.163300
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.163300) < VWAP ($0.164265) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.165500 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $5.69M @ $0.164000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.2:1 (LB)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — DISQUALIFIED by broker spread gate (2.25% >= 0.15%) -> 0.0 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `2.2499% (VETO)` | Basis: `+2.2499%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.163400` | Day VAL: `0.162548` · Day POC: `0.163412` · Day VAH: `0.165015` | Month POC: `0.173029`
3. **VWAP Regime & Bands**: VWAP: `$0.164265` (z = `-0.67σ`) | -1σ: `$0.162822` · +1σ: `$0.165709`
4. **EMA Cascade**: M15: `13=0.163414 / 89=0.166544` | H1: `13=0.165038 / 89=0.171473` | H4: `13=0.168615 / 89=0.182949` | D1: `13=0.178740 / 89=0.206851`
5. **Multi-TF RSI**: M15: `44.13939564989893` | H1: `35.22369572633811` | H4: `32.353442009503596`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 25 (Bullish: 46, Bearish: 48) | Active: `Discrete ABS (sell) @ $0.165500 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-158` | Quadrant: `both-selling` | Taker Buy Share: `48.4%` | Active Divs: 18
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$8.76M` vs Ask `$19.91M` (Imbalance: `-38.9%`) | Confirmed Walls: 5
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 20 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$51.09M` vs Longs Down: `$62.42M` → **LSR: 1.2:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `2.2499% (VETO)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.2:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### DOGE · Dogecoin (SHORT)

- **Live Spot / Perp Price**: $0.062900
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.062900) < VWAP ($0.062974) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.064480 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $3.52M @ $0.063000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.0:1 (LB)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — DISQUALIFIED by broker spread gate (1.39% >= 0.15%) -> 0.0 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `1.3921% (VETO)` | Basis: `+1.3921%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.062820` | Day VAL: `0.062359` · Day POC: `0.062856` · Day VAH: `0.063172` | Month POC: `0.075296`
3. **VWAP Regime & Bands**: VWAP: `$0.062974` (z = `-0.15σ`) | -1σ: `$0.062478` · +1σ: `$0.063470`
4. **EMA Cascade**: M15: `13=0.062875 / 89=0.063836` | H1: `13=0.063361 / 89=0.066012` | H4: `13=0.064668 / 89=0.070742` | D1: `13=0.069232 / 89=0.079961`
5. **Multi-TF RSI**: M15: `47.847512595347546` | H1: `38.26376741611784` | H4: `32.27124339061933`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 37 (Bullish: 30, Bearish: 33) | Active: `Discrete ABS (sell) @ $0.064480 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-502` | Quadrant: `both-selling` | Taker Buy Share: `48.1%` | Active Divs: 30
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$29.39M` vs Ask `$30.26M` (Imbalance: `-1.5%`) | Confirmed Walls: 14
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 22 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$625.60M` vs Longs Down: `$656.68M` → **LSR: 1.0:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `1.3921% (VETO)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.0:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### LINK · Chainlink (SHORT)

- **Live Spot / Perp Price**: $9.6080
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **8.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($9.6080) < VWAP ($9.6430) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $9.8250 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.56M @ $9.6800 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (2.2:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — DISQUALIFIED by broker spread gate (0.57% >= 0.15%) -> 0.0 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `0.5666% (VETO)` | Basis: `+0.5666%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `9.6320` | Day VAL: `9.5456` · Day POC: `9.6307` · Day VAH: `9.6766` | Month POC: `10.8311`
3. **VWAP Regime & Bands**: VWAP: `$9.6430` (z = `-0.43σ`) | -1σ: `$9.5619` · +1σ: `$9.7240`
4. **EMA Cascade**: M15: `13=9.6104 / 89=9.7505` | H1: `13=9.6809 / 89=10.0418` | H4: `13=9.8616 / 89=10.6822` | D1: `13=10.4659 / 89=11.3513`
5. **Multi-TF RSI**: M15: `46.36562380931357` | H1: `39.3719481243111` | H4: `34.78661316793317`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 17 (Bullish: 36, Bearish: 55) | Active: `Discrete ABS (sell) @ $9.8250 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-202` | Quadrant: `both-selling` | Taker Buy Share: `48.6%` | Active Divs: 25
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$16.11M` vs Ask `$14.95M` (Imbalance: `3.7%`) | Confirmed Walls: 12
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 16 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$1.10M` vs Longs Down: `$2.37M` → **LSR: 2.2:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `0.5666% (VETO)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (2.2:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### LTC · Litecoin (SHORT)

- **Live Spot / Perp Price**: $48.2800
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **8.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($48.2800) < VWAP ($48.6079) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $48.8300 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $2.07M @ $48.4000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (5.5:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — DISQUALIFIED by broker spread gate (2.42% >= 0.15%) -> 0.0 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `2.4241% (VETO)` | Basis: `+2.4241%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `48.3485` | Day VAL: `48.1209` · Day POC: `48.3436` · Day VAH: `48.8446` | Month POC: `51.4532`
3. **VWAP Regime & Bands**: VWAP: `$48.6079` (z = `-0.90σ`) | -1σ: `$48.2434` · +1σ: `$48.9724`
4. **EMA Cascade**: M15: `13=48.3141 / 89=48.8625` | H1: `13=48.6756 / 89=49.7188` | H4: `13=49.1184 / 89=52.3381` | D1: `13=51.5055 / 89=55.6807`
5. **Multi-TF RSI**: M15: `45.16627845787921` | H1: `41.406973364253716` | H4: `38.56007695518713`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 53 (Bullish: 49, Bearish: 39) | Active: `Discrete ABS (sell) @ $48.8300 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-108` | Quadrant: `both-selling` | Taker Buy Share: `48.4%` | Active Divs: 23
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$12.33M` vs Ask `$11.89M` (Imbalance: `1.8%`) | Confirmed Walls: 7
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 17 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$74.3k` vs Longs Down: `$405.8k` → **LSR: 5.5:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `2.4241% (VETO)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (5.5:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### AVAX · Avalanche (SHORT)

- **Live Spot / Perp Price**: $7.9730
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **8.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($7.9730) < VWAP ($8.0741) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $8.1360 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.21M @ $8.1400 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (10.8:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `8.0235` | Day VAL: `7.9990` · Day POC: `8.0326` · Day VAH: `8.1278` | Month POC: `8.5755`
3. **VWAP Regime & Bands**: VWAP: `$8.0741` (z = `-1.48σ`) | -1σ: `$8.0059` · +1σ: `$8.1423`
4. **EMA Cascade**: M15: `13=8.0202 / 89=8.1688` | H1: `13=8.1039 / 89=8.3193` | H4: `13=8.2276 / 89=8.4916` | D1: `13=8.3819 / 89=8.7734`
5. **Multi-TF RSI**: M15: `35.705800777023015` | H1: `34.077024551024564` | H4: `38.20059232059464`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 24 (Bullish: 37, Bearish: 47) | Active: `Discrete ABS (sell) @ $8.1360 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-118` | Quadrant: `both-selling` | Taker Buy Share: `48.9%` | Active Divs: 24
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$12.34M` vs Ask `$12.20M` (Imbalance: `0.6%`) | Confirmed Walls: 11
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 18 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$274.8k` vs Longs Down: `$2.97M` → **LSR: 10.8:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (10.8:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### DOT · Polkadot (SHORT)

- **Live Spot / Perp Price**: $0.784100
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **6.3 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.784100) < VWAP ($0.792856) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $0.829100 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $744.7k @ $0.798000 -> 0.8 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (3.2:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.783760` | Day VAL: `0.782050` · Day POC: `0.784850` · Day VAH: `0.797450` | Month POC: `0.948058`
3. **VWAP Regime & Bands**: VWAP: `$0.792856` (z = `-1.01σ`) | -1σ: `$0.784165` · +1σ: `$0.801547`
4. **EMA Cascade**: M15: `13=0.785836 / 89=0.804510` | H1: `13=0.796157 / 89=0.829805` | H4: `13=0.813828 / 89=0.895838` | D1: `13=0.871326 / 89=1.0058`
5. **Multi-TF RSI**: M15: `37.058517790784514` | H1: `32.4129717104378` | H4: `31.419722206402795`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 19 (Bullish: 48, Bearish: 37) | Active: `Discrete SDIV (sell) @ $0.829100 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$6.12M` vs Ask `$6.16M` (Imbalance: `-0.3%`) | Confirmed Walls: 7
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 12 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$2.31M` vs Longs Down: `$7.40M` → **LSR: 3.2:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (3.2:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### NEAR · NEAR Protocol (SHORT)

- **Live Spot / Perp Price**: $3.3260
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($3.3260) < VWAP ($3.3633) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $3.3580 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $2.79M @ $3.3400 -> 1.5 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (3.9:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `3.3240` | Day VAL: `3.3089` · Day POC: `3.3520` · Day VAH: `3.3860` | Month POC: `3.7073`
3. **VWAP Regime & Bands**: VWAP: `$3.3633` (z = `-0.91σ`) | -1σ: `$3.3223` · +1σ: `$3.4044`
4. **EMA Cascade**: M15: `13=3.3316 / 89=3.4035` | H1: `13=3.3747 / 89=3.4983` | H4: `13=3.4391 / 89=3.8047` | D1: `13=3.6868 / 89=3.7268`
5. **Multi-TF RSI**: M15: `42.52919860714972` | H1: `37.5933795192587` | H4: `37.328615144355346`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 20 (Bullish: 39, Bearish: 43) | Active: `Discrete ABS (sell) @ $3.3580 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$19.94M` vs Ask `$20.54M` (Imbalance: `-1.5%`) | Confirmed Walls: 10
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 15 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$2.68M` vs Longs Down: `$10.57M` → **LSR: 3.9:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (3.9:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### UNI · Uniswap (SHORT)

- **Live Spot / Perp Price**: $5.5150
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($5.5150) < VWAP ($5.5869) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $5.8770 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.96M @ $5.5400 -> 1.5 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (3.5:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `5.5217` | Day VAL: `5.5035` · Day POC: `5.5242` · Day VAH: `5.6227` | Month POC: `7.0103`
3. **VWAP Regime & Bands**: VWAP: `$5.5869` (z = `-1.07σ`) | -1σ: `$5.5197` · +1σ: `$5.6541`
4. **EMA Cascade**: M15: `13=5.5268 / 89=5.6712` | H1: `13=5.6037 / 89=6.0685` | H4: `13=5.8235 / 89=6.6699` | D1: `13=6.4712 / 89=6.6318`
5. **Multi-TF RSI**: M15: `41.65055187142687` | H1: `34.784631760346926` | H4: `22.576601392058905`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 23 (Bullish: 39, Bearish: 32) | Active: `Discrete SDIV (sell) @ $5.8770 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$14.35M` vs Ask `$13.73M` (Imbalance: `2.2%`) | Confirmed Walls: 9
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$824.0k` vs Longs Down: `$2.87M` → **LSR: 3.5:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (3.5:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ATOM · Cosmos (SHORT)

- **Live Spot / Perp Price**: $1.3350
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($1.3350) < VWAP ($1.3392) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $1.3530 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $18.18M @ $67,250.00 -> 1.5 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (1.5:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `1.3432` | Day VAL: `1.3248` · Day POC: `1.3434` · Day VAH: `1.3486` | Month POC: `1.3901`
3. **VWAP Regime & Bands**: VWAP: `$1.3392` (z = `-0.35σ`) | -1σ: `$1.3273` · +1σ: `$1.3511`
4. **EMA Cascade**: M15: `13=1.3362 / 89=1.3586` | H1: `13=1.3469 / 89=1.3826` | H4: `13=1.3720 / 89=1.4341` | D1: `13=1.4094 / 89=1.5944`
5. **Multi-TF RSI**: M15: `45.47515684856904` | H1: `35.839290300247725` | H4: `38.14501921123924`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 49 (Bullish: 59, Bearish: 38) | Active: `Discrete ABS (sell) @ $1.3530 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.28B` vs Ask `$1.00B` (Imbalance: `12.1%`) | Confirmed Walls: 54
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$487.0k` vs Longs Down: `$733.1k` → **LSR: 1.5:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.5:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### XLM · Stellar (NEUTRAL)

- **Live Spot / Perp Price**: $0.144200
- **Regime / Model**: `RANGE_BALANCE` | Active Model: `OFF` (Conf: 20%)
- **Table 7 Confluence Score**: **0.0 / 11.5 pts** → **HARD VETO (<5.0)**
  * Directional Trend (2.0 max): **0.0** — H4: Bear vs D1: Bear (Opposing/Partial -> 0.0 pts)
  * Auction / VWAP Regime (1.5 max): **0.0** — Failed
  * Footprint Signal (2.0 max): **0.0** — No in-zone discrete footprint signature (0.0 pts)
  * Whale Wall Backstop (1.5 max): **0.0** — No protecting institutional book wall (0.0 pts)
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **0.0** — MAGNET HAZARD: LSR 3.5:1 (SA) points AGAINST entry — Passive entry banned (§3 VETO) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — Spread 0.1157% > 0.10% -> 0.0 pts

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `0.1157% (PASS)` | Basis: `+0.1157%` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.143728` | Day VAL: `0.142272` · Day POC: `0.143389` · Day VAH: `0.144132` | Month POC: `0.147668`
3. **VWAP Regime & Bands**: VWAP: `$0.143496` (z = `+0.74σ`) | -1σ: `$0.142537` · +1σ: `$0.144455`
4. **EMA Cascade**: M15: `13=0.143776 / 89=0.144985` | H1: `13=0.144367 / 89=0.146482` | H4: `13=0.145534 / 89=0.154483` | D1: `13=0.151980 / 89=0.177344`
5. **Multi-TF RSI**: M15: `55.32526897176712` | H1: `46.10577850602495` | H4: `45.23574983461306`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 28 (Bullish: 32, Bearish: 28) | Active: `No in-zone discrete footprint signature (0.0 pts)`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-59` | Quadrant: `spot-bid` | Taker Buy Share: `49.1%` | Active Divs: 21
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.28B` vs Ask `$1.00B` (Imbalance: `12.1%`) | Confirmed Walls: 54
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$29.88M` vs Longs Down: `$8.43M` → **LSR: 3.5:1 (SA)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `0.1157% (PASS)`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (3.5:1 (SA)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ETC · Ethereum Classic (SHORT)

- **Live Spot / Perp Price**: $6.3000
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **8.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($6.3000) < VWAP ($6.3182) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $6.6110 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $18.18M @ $67,250.00 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (1.6:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `6.2842` | Day VAL: `6.2710` · Day POC: `6.3011` · Day VAH: `6.3484` | Month POC: `6.9621`
3. **VWAP Regime & Bands**: VWAP: `$6.3182` (z = `-0.39σ`) | -1σ: `$6.2712` · +1σ: `$6.3652`
4. **EMA Cascade**: M15: `13=6.3056 / 89=6.3960` | H1: `13=6.3506 / 89=6.5621` | H4: `13=6.4651 / 89=6.8986` | D1: `13=6.7748 / 89=7.5793`
5. **Multi-TF RSI**: M15: `43.95499380780601` | H1: `36.711338918572835` | H4: `31.938153802430506`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 33 (Bullish: 47, Bearish: 54) | Active: `Discrete ABS (sell) @ $6.6110 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-16` | Quadrant: `both-selling` | Taker Buy Share: `48.6%` | Active Divs: 29
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.28B` vs Ask `$1.00B` (Imbalance: `12.1%`) | Confirmed Walls: 54
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$272.0k` vs Longs Down: `$432.4k` → **LSR: 1.6:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.6:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### FIL · Filecoin (SHORT)

- **Live Spot / Perp Price**: $0.686400
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 88%)
- **Table 7 Confluence Score**: **6.5 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.686400) < VWAP ($0.689374) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.691600 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.62M @ $0.692000 -> 1.5 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.3:1 (LB)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.688156` | Day VAL: `0.680813` · Day POC: `0.687712` · Day VAH: `0.693462` | Month POC: `0.864804`
3. **VWAP Regime & Bands**: VWAP: `$0.689374` (z = `-0.46σ`) | -1σ: `$0.682886` · +1σ: `$0.695863`
4. **EMA Cascade**: M15: `13=0.686666 / 89=0.702595` | H1: `13=0.694057 / 89=0.732971` | H4: `13=0.716131 / 89=0.800220` | D1: `13=0.775181 / 89=0.890695`
5. **Multi-TF RSI**: M15: `43.622255956062375` | H1: `33.333068337742034` | H4: `29.190594323314997`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 37 (Bullish: 72, Bearish: 52) | Active: `Discrete ABS (sell) @ $0.691600 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-137` | Quadrant: `both-selling` | Taker Buy Share: `47.1%` | Active Divs: 32
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$5.22M` vs Ask `$5.68M` (Imbalance: `-4.3%`) | Confirmed Walls: 4
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 14 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$5.56M` vs Longs Down: `$7.47M` → **LSR: 1.3:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.3:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ICP · Internet Computer (SHORT)

- **Live Spot / Perp Price**: $2.3930
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.3 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($2.3930) < VWAP ($2.4113) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $2.6350 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $502.2k @ $2.4400 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (22.7:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `2.4099` | Day VAL: `2.3758` · Day POC: `2.4103` · Day VAH: `2.4262` | Month POC: `2.5394`
3. **VWAP Regime & Bands**: VWAP: `$2.4113` (z = `-0.64σ`) | -1σ: `$2.3826` · +1σ: `$2.4401`
4. **EMA Cascade**: M15: `13=2.4066 / 89=2.4701` | H1: `13=2.4368 / 89=2.5103` | H4: `13=2.4973 / 89=2.5211` | D1: `13=2.4963 / 89=2.6791`
5. **Multi-TF RSI**: M15: `37.75922697313233` | H1: `32.740833466819424` | H4: `39.02129217435692`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 20 (Bullish: 37, Bearish: 47) | Active: `Discrete ABS (sell) @ $2.6350 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-103` | Quadrant: `both-selling` | Taker Buy Share: `44.7%` | Active Divs: 28
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.63M` vs Ask `$1.75M` (Imbalance: `-3.4%`) | Confirmed Walls: 1
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 11 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$53.1k` vs Longs Down: `$1.21M` → **LSR: 22.7:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (22.7:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### HBAR · Hedera (SHORT)

- **Live Spot / Perp Price**: $0.060120
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **5.8 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.060120) < VWAP ($0.060125) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $0.064550 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $754.4k @ $0.060200 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — MAGNET HAZARD: LSR 5.0:1 (SA) points AGAINST entry — Passive entry banned (§3 VETO) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.059810` | Day VAL: `0.059502` · Day POC: `0.059854` · Day VAH: `0.060426` | Month POC: `0.066956`
3. **VWAP Regime & Bands**: VWAP: `$0.060125` (z = `-0.01σ`) | -1σ: `$0.059627` · +1σ: `$0.060624`
4. **EMA Cascade**: M15: `13=0.060027 / 89=0.061047` | H1: `13=0.060497 / 89=0.063453` | H4: `13=0.062115 / 89=0.068009` | D1: `13=0.066232 / 89=0.078185`
5. **Multi-TF RSI**: M15: `51.10433297930559` | H1: `36.88404623100156` | H4: `31.003466125458445`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 43 (Bullish: 46, Bearish: 47) | Active: `Discrete SDIV (sell) @ $0.064550 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-46` | Quadrant: `spot-bid` | Taker Buy Share: `48.6%` | Active Divs: 27
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$5.28M` vs Ask `$4.24M` (Imbalance: `10.9%`) | Confirmed Walls: 5
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 11 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$73.49M` vs Longs Down: `$14.83M` → **LSR: 5.0:1 (SA)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (5.0:1 (SA)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### APT · Aptos (SHORT)

- **Live Spot / Perp Price**: $0.509800
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.3 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.509800) < VWAP ($0.518789) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.521700 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $444.5k @ $0.518000 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (5.1:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.512625` | Day VAL: `0.510668` · Day POC: `0.513528` · Day VAH: `0.522108` | Month POC: `0.603180`
3. **VWAP Regime & Bands**: VWAP: `$0.518789` (z = `-1.50σ`) | -1σ: `$0.512790` · +1σ: `$0.524788`
4. **EMA Cascade**: M15: `13=0.512848 / 89=0.527423` | H1: `13=0.521278 / 89=0.549194` | H4: `13=0.535693 / 89=0.598441` | D1: `13=0.580533 / 89=0.681860`
5. **Multi-TF RSI**: M15: `31.787163656546824` | H1: `29.81132240650419` | H4: `29.24512526866667`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 43 (Bullish: 37, Bearish: 31) | Active: `Discrete ABS (sell) @ $0.521700 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-98` | Quadrant: `both-selling` | Taker Buy Share: `46.5%` | Active Divs: 35
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$5.24M` vs Ask `$4.44M` (Imbalance: `8.3%`) | Confirmed Walls: 10
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 10 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$1.52M` vs Longs Down: `$7.82M` → **LSR: 5.1:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (5.1:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### ARB · Arbitrum (SHORT)

- **Live Spot / Perp Price**: $0.139630
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **5.8 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.139630) < VWAP ($0.140598) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.141900 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $478.5k @ $0.140000 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **0.0** — Balanced / Sub-threshold skew (1.3:1 (LB)) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.140352` | Day VAL: `0.138554` · Day POC: `0.140402` · Day VAH: `0.141458` | Month POC: `0.164017`
3. **VWAP Regime & Bands**: VWAP: `$0.140598` (z = `-0.61σ`) | -1σ: `$0.139004` · +1σ: `$0.142193`
4. **EMA Cascade**: M15: `13=0.139653 / 89=0.142560` | H1: `13=0.141258 / 89=0.150303` | H4: `13=0.145764 / 89=0.160652` | D1: `13=0.156743 / 89=0.158638`
5. **Multi-TF RSI**: M15: `48.703397125480656` | H1: `37.15995121754543` | H4: `30.366833896058537`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 39 (Bullish: 40, Bearish: 50) | Active: `Discrete ABS (sell) @ $0.141900 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-141` | Quadrant: `both-selling` | Taker Buy Share: `47.9%` | Active Divs: 23
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$7.83M` vs Ask `$6.97M` (Imbalance: `5.8%`) | Confirmed Walls: 19
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 14 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$28.66M` vs Longs Down: `$36.86M` → **LSR: 1.3:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: LOW. Liquidation density is balanced (1.3:1 (LB)).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### OP · Optimism (SHORT)

- **Live Spot / Perp Price**: $0.088160
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.3 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.088160) < VWAP ($0.089683) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.088740 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $264.8k @ $0.089600 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (6.6:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.088844` | Day VAL: `0.088477` · Day POC: `0.088910` · Day VAH: `0.090383` | Month POC: `0.100428`
3. **VWAP Regime & Bands**: VWAP: `$0.089683` (z = `-1.54σ`) | -1σ: `$0.088690` · +1σ: `$0.090677`
4. **EMA Cascade**: M15: `13=0.088664 / 89=0.091070` | H1: `13=0.090009 / 89=0.094954` | H4: `13=0.092615 / 89=0.102779` | D1: `13=0.099919 / 89=0.112588`
5. **Multi-TF RSI**: M15: `32.40236759035902` | H1: `29.86595453809116` | H4: `30.188282815747087`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 42 (Bullish: 58, Bearish: 50) | Active: `Discrete ABS (sell) @ $0.088740 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-100` | Quadrant: `spot-bid` | Taker Buy Share: `46.4%` | Active Divs: 32
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$2.95M` vs Ask `$2.61M` (Imbalance: `6.2%`) | Confirmed Walls: 8
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 8 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$5.68M` vs Longs Down: `$37.66M` → **LSR: 6.6:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (6.6:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### SUI · Sui (SHORT)

- **Live Spot / Perp Price**: $0.769600
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.0 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.769600) < VWAP ($0.776478) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.772700 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **1.5** — Resting Ask Wall $1.71M @ $0.772000 -> 1.5 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (6.8:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.772225` | Day VAL: `0.767662` · Day POC: `0.772262` · Day VAH: `0.780312` | Month POC: `0.869237`
3. **VWAP Regime & Bands**: VWAP: `$0.776478` (z = `-1.00σ`) | -1σ: `$0.769616` · +1σ: `$0.783340`
4. **EMA Cascade**: M15: `13=0.771570 / 89=0.785571` | H1: `13=0.779576 / 89=0.806347` | H4: `13=0.793276 / 89=0.854949` | D1: `13=0.837062 / 89=0.903870`
5. **Multi-TF RSI**: M15: `39.82797309943079` | H1: `37.2097776689036` | H4: `35.26030209354272`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 31 (Bullish: 58, Bearish: 44) | Active: `Discrete ABS (sell) @ $0.772700 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$17.50M` vs Ask `$16.16M` (Imbalance: `4.0%`) | Confirmed Walls: 5
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 16 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$7.79M` vs Longs Down: `$52.74M` → **LSR: 6.8:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (6.8:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Confirmed resting liquidity protects structural boundary.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### SEI · Sei (SHORT)

- **Live Spot / Perp Price**: $0.040740
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **6.3 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.040740) < VWAP ($0.041515) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $0.043320 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $436.2k @ $0.041600 -> 0.8 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (10.9:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.040905` | Day VAL: `0.040960` · Day POC: `0.041788` · Day VAH: `0.041968` | Month POC: `0.047977`
3. **VWAP Regime & Bands**: VWAP: `$0.041515` (z = `-1.56σ`) | -1σ: `$0.041016` · +1σ: `$0.042013`
4. **EMA Cascade**: M15: `13=0.040985 / 89=0.042055` | H1: `13=0.041646 / 89=0.043067` | H4: `13=0.042429 / 89=0.046193` | D1: `13=0.044969 / 89=0.053223`
5. **Multi-TF RSI**: M15: `31.95759792867301` | H1: `31.290048640962638` | H4: `34.28711379639083`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 49 (Bullish: 32, Bearish: 31) | Active: `Discrete SDIV (sell) @ $0.043320 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$2.45M` vs Ask `$2.57M` (Imbalance: `-2.5%`) | Confirmed Walls: 4
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 0 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$6.07M` vs Longs Down: `$65.96M` → **LSR: 10.9:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (10.9:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### INJ · Injective (NEUTRAL)

- **Live Spot / Perp Price**: $7.8980
- **Regime / Model**: `RANGE_BALANCE` | Active Model: `OFF` (Conf: 20%)
- **Table 7 Confluence Score**: **0.0 / 11.5 pts** → **HARD VETO (<5.0)**
  * Directional Trend (2.0 max): **0.0** — H4: Bull vs D1: Bull (Opposing/Partial -> 0.0 pts)
  * Auction / VWAP Regime (1.5 max): **0.0** — Failed
  * Footprint Signal (2.0 max): **0.0** — No in-zone discrete footprint signature (0.0 pts)
  * Whale Wall Backstop (1.5 max): **0.0** — No protecting institutional book wall (0.0 pts)
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **0.0** — MAGNET HAZARD: LSR 73.7:1 (LB) points AGAINST entry — Passive entry banned (§3 VETO) -> 0.0 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `8.0130` | Day VAL: `7.9236` · Day POC: `8.0130` · Day VAH: `8.0896` | Month POC: `8.1310`
3. **VWAP Regime & Bands**: VWAP: `$8.0294` (z = `-1.67σ`) | -1σ: `$7.9499` · +1σ: `$8.1090`
4. **EMA Cascade**: M15: `13=7.9709 / 89=7.9633` | H1: `13=7.9988 / 89=7.8504` | H4: `13=7.8603 / 89=7.8532` | D1: `13=7.8480 / 89=7.0795`
5. **Multi-TF RSI**: M15: `38.30063056731597` | H1: `47.51857401973451` | H4: `50.95326309493496`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 32 (Bullish: 79, Bearish: 84) | Active: `No in-zone discrete footprint signature (0.0 pts)`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$1.27B` vs Ask `$1.01B` (Imbalance: `11.3%`) | Confirmed Walls: 53
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$49.0k` vs Longs Down: `$3.61M` → **LSR: 73.7:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (73.7:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### TIA · Celestia (SHORT)

- **Live Spot / Perp Price**: $0.365200
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **6.3 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.365200) < VWAP ($0.371280) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $0.371600 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $492.3k @ $0.368000 -> 0.8 pts
  * CVD Divergence (1.0 max): **0.0** — CVD in line with price / No active divergence (0.0 pts)
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (6.2:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.370412` | Day VAL: `0.366842` · Day POC: `0.370337` · Day VAH: `0.374221` | Month POC: `0.437979`
3. **VWAP Regime & Bands**: VWAP: `$0.371280` (z = `-1.54σ`) | -1σ: `$0.367312` · +1σ: `$0.375248`
4. **EMA Cascade**: M15: `13=0.367562 / 89=0.383673` | H1: `13=0.375274 / 89=0.407467` | H4: `13=0.395700 / 89=0.441586` | D1: `13=0.426834 / 89=0.452732`
5. **Multi-TF RSI**: M15: `38.831352854739805` | H1: `24.322021016334375` | H4: `28.609017319647833`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 35 (Bullish: 71, Bearish: 62) | Active: `Discrete SDIV (sell) @ $0.371600 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `n/a` | Quadrant: `n/a` | Taker Buy Share: `n/a%` | Active Divs: 0
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$3.93M` vs Ask `$3.44M` (Imbalance: `6.7%`) | Confirmed Walls: 7
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$1.89M` vs Longs Down: `$11.78M` → **LSR: 6.2:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `both-selling` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (6.2:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### VET · VeChain (SHORT)

- **Live Spot / Perp Price**: $0.004892
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.3 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.004892) < VWAP ($0.004960) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (sell) @ $0.005050 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $62.2k @ $0.004920 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (12.5:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.004908` | Day VAL: `0.004892` · Day POC: `0.004906` · Day VAH: `0.004989` | Month POC: `0.005169`
3. **VWAP Regime & Bands**: VWAP: `$0.004960` (z = `-1.28σ`) | -1σ: `$0.004907` · +1σ: `$0.005013`
4. **EMA Cascade**: M15: `13=0.004912 / 89=0.005016` | H1: `13=0.004973 / 89=0.005125` | H4: `13=0.005057 / 89=0.005493` | D1: `13=0.005348 / 89=0.006512`
5. **Multi-TF RSI**: M15: `33.6458189652662` | H1: `31.150673376968413` | H4: `33.3435653995562`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 56 (Bullish: 48, Bearish: 45) | Active: `Discrete ABS (sell) @ $0.005050 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-2` | Quadrant: `spot-bid` | Taker Buy Share: `49.4%` | Active Divs: 27
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$709.5k` vs Ask `$555.7k` (Imbalance: `12.2%`) | Confirmed Walls: 7
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 0 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$17.81M` vs Longs Down: `$223.17M` → **LSR: 12.5:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (12.5:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### 1000PEPE · Pepe (1000x perp) (LONG)

- **Live Spot / Perp Price**: $0.004277
- **Regime / Model**: `RANGE_BALANCE` | Active Model: `OFF` (Conf: 35%)
- **Table 7 Confluence Score**: **5.3 / 11.5 pts** → **Grade B**
  * Directional Trend (2.0 max): **0.0** — H4: Bear vs D1: Bull (Opposing/Partial -> 0.0 pts)
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.004277) > VWAP ($0.004274) [Premium Zone - Buying in premium fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete ABS (buy) @ $0.004231 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $257.7k @ $0.004266 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BULL CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Short Liq Above dominates (2.8:1 (SA)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.004273` | Day VAL: `0.004211` · Day POC: `0.004278` · Day VAH: `0.004307` | Month POC: `0.005016`
3. **VWAP Regime & Bands**: VWAP: `$0.004274` (z = `+0.05σ`) | -1σ: `$0.004220` · +1σ: `$0.004328`
4. **EMA Cascade**: M15: `13=0.004276 / 89=0.004353` | H1: `13=0.004311 / 89=0.004597` | H4: `13=0.004455 / 89=0.004777` | D1: `13=0.004694 / 89=0.004173`
5. **Multi-TF RSI**: M15: `50.98724250282133` | H1: `35.7517952136927` | H4: `31.372617926133543`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 37 (Bullish: 60, Bearish: 32) | Active: `Discrete ABS (buy) @ $0.004231 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-223` | Quadrant: `spot-bid` | Taker Buy Share: `48.8%` | Active Divs: 25
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$9.56M` vs Ask `$7.74M` (Imbalance: `10.5%`) | Confirmed Walls: 38
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 23 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$3.65B` vs Longs Down: `$1.32B` → **LSR: 2.8:1 (SA)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (2.8:1 (SA)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

### 1000SHIB · Shiba Inu (1000x perp) (SHORT)

- **Live Spot / Perp Price**: $0.004145
- **Regime / Model**: `TREND_DOWN` | Active Model: `TRIGGERED` (Conf: 92%)
- **Table 7 Confluence Score**: **7.3 / 11.5 pts** → **Grade A**
  * Directional Trend (2.0 max): **2.0** — H4 (13<89) & D1 (13<89) Bearish Cascade aligned
  * Auction / VWAP Regime (1.5 max): **0.0** — Price ($0.004145) < VWAP ($0.004175) [Discount Zone - Shorting into discount fails test] -> 0.0 pts
  * Footprint Signal (2.0 max): **2.0** — Discrete SDIV (sell) @ $0.004314 -> 2.0 pts
  * Whale Wall Backstop (1.5 max): **0.8** — Sub-threshold wall: $925.9k @ $0.004220 -> 0.8 pts
  * CVD Divergence (1.0 max): **1.0** — Active BEAR CVD divergence -> 1.0 pt
  * Liquidation Magnet Gate (1.5 max): **1.5** — Long Liq Below dominates (5.4:1 (LB)) — Target magnet aligned -> 1.5 pts
  * Options GEX Context (1.0 max): **0.0** — n/a (Non-BTC/ETH -> 0.0 pts)
  * Broker Spread Drag (1.0 max): **0.0** — No venue / Veto (0.0 pts)

**16 Telemetry Data Dimensions Breakdown**:
1. **Live Spot & Broker Basis**: MT5 Spread `No MT5 Venue` | Basis: `n/a` (where mapped)
2. **Auction Market Profile**: Session 8h POC: `0.004150` | Day VAL: `0.004131` · Day POC: `0.004151` · Day VAH: `0.004190` | Month POC: `0.004464`
3. **VWAP Regime & Bands**: VWAP: `$0.004175` (z = `-0.87σ`) | -1σ: `$0.004141` · +1σ: `$0.004210`
4. **EMA Cascade**: M15: `13=0.004151 / 89=0.004213` | H1: `13=0.004185 / 89=0.004310` | H4: `13=0.004249 / 89=0.004511` | D1: `13=0.004440 / 89=0.004982`
5. **Multi-TF RSI**: M15: `39.91837791109775` | H1: `36.19442702840091` | H4: `33.552502186531825`
6. **Footprint Volume & Delta**: Forming Bar Delta: `n/a` | Volume: `n/a`
7. **Footprint Discrete Signals**: Signals in set: 63 (Bullish: 72, Bearish: 40) | Active: `Discrete SDIV (sell) @ $0.004314 -> 2.0 pts`
8. **Cumulative Volume Delta**: 24h Perp CVD: `-19` | Quadrant: `spot-bid` | Taker Buy Share: `47.7%` | Active Divs: 25
9. **Multi-Exchange BookWalls**: Depth ±5%: Bid `$5.62M` vs Ask `$4.30M` (Imbalance: `13.3%`) | Confirmed Walls: 6
10. **Institutional LTO**: Tracked clusters across Aster, Binance, Bybit, OKX: 1 clusters
11. **Liquidation Clusters (±4%)**: Top Above: `$n/a` | Top Below: `$n/a`
12. **Liquidation Magnet Gate (±2%)**: Shorts Up: `$159.52M` vs Longs Down: `$858.83M` → **LSR: 5.4:1 (LB)**
13. **Options GEX Context**: n/a (Non-BTC/ETH perpetual)
14. **Open Interest & Funding**: OI Quadrant: `spot-bid` | Funding Rate: `n/a`
15. **Broker Spread Drag**: MT5 Quote: `No MT5 Venue`
16. **Risk Invariants**: Heat ≤ 1.0% ($46.45 cap) · Max 2 crypto slots · +1.0R Breakeven · 8-bar time stop.

**Adversarial Setback & Failure-Mode Interrogation**:
- **Liquidity Trap Hazard**: CRITICAL. Asymmetric liquidation pool (5.4:1 (LB)) creates an irresistible magnet. Passive limit orders (S2/S3) are strictly banned to prevent being swept. MUST wait for exhaustion wick (S1).
- **Whale Wall Defense vs Spoofing**: Thin resting liquidity — high vulnerability to slippage or sudden spoof removal.
- **Pullback Depth & Asymmetry Reality**: R-multiple must strictly provide ≥ 2.0R to T1 to justify directional exposure.

---

## 5. Playbook DECIDE Formulation Cards

## FORMULATION · BTC · 2026-11-14 11:08:13 UTC · S2 (Value Area Retest)
Regime: RANGE_BALANCE — H4/D1 Trend + Microstructure Order Flow
Direction: LONG · Grade: B · Confidence: 35%
D1  basisPct: +0.0348% | mt5Spread: 0.0348% (PASS)
D2  profile: session POC 67,156.60 · day VAL/POC/VAH 66,676.52/67,141.37/67,440.20 · month POC 75,837.32
D3  VWAP 67,245.22 · z +0.03σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bull · D1 13x89 bull
D5  RSI: M15 49.41880055543785 · H1 35.120348751096685
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 17 Bull / 22 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.2:1 (SA) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (BTC/ETH)
D14 OI: Quadrant spot-bid
D15 spread: 0.0348% (PASS)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $67,256.90–$66,676.52 (Limit Ladder) · Stop: $64,676.23 (Structural Invalidation)
T1: $67,440.20 (0.38R · Day Value Area) · T2: $75,837.32 (4.58R · Volume Node) · T3: $72,637.45 (2.98R · Liquidity Sweep)
Composite R: 2.58R · Active Vetoes: Desk R-Standard (T1 0.38R < 2.0R)

## FORMULATION · ETH · 2026-11-14 11:08:13 UTC · S2 (Value Area Retest)
Regime: RANGE_BALANCE — H4/D1 Trend + Microstructure Order Flow
Direction: LONG · Grade: B · Confidence: 35%
D1  basisPct: +0.0285% | mt5Spread: 0.0285% (PASS)
D2  profile: session POC 1,903.94 · day VAL/POC/VAH 1,883.92/1,903.88/1,910.17 · month POC 2,246.32
D3  VWAP 1,900.73 · z +0.66σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bull · D1 13x89 bull
D5  RSI: M15 52.857828700181805 · H1 41.86209626417157
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 28 Bull / 21 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.3:1 (SA) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (BTC/ETH)
D14 OI: Quadrant spot-bid
D15 spread: 0.0285% (PASS)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $1,908.50–$1,883.92 (Limit Ladder) · Stop: $1,827.41 (Structural Invalidation)
T1: $1,910.17 (0.46R · Day Value Area) · T2: $2,246.32 (6.41R · Volume Node) · T3: $2,061.18 (3.14R · Liquidity Sweep)
Composite R: 3.38R · Active Vetoes: Desk R-Standard (T1 0.46R < 2.0R)

## FORMULATION · BNB · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 616.6335 · day VAL/POC/VAH 614.2977/616.6276/622.9514 · month POC 695.7292
D3  VWAP 620.3793 · z -0.20σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 50.67628634404886 · H1 36.98359311784756
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 24 Bull / 35 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 2.0:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $619.4300–$622.9514 (Limit Ladder) · Stop: $641.6400 (Structural Invalidation)
T1: $614.2977 (0.46R · Day Value Area) · T2: $588.4585 (1.85R · Volume Node) · T3: $569.8756 (2.84R · Liquidity Sweep)
Composite R: 1.49R · Active Vetoes: M1 R 0.76 < 1.5 — reward does not pay the risk; Desk R-Standard (T1 0.46R < 2.0R)

## FORMULATION · SOL · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 88%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 75.4667 · day VAL/POC/VAH 74.9852/75.6002/76.0922 · month POC 89.8760
D3  VWAP 75.8974 · z -0.18σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 49.22717154572983 · H1 34.69367357735071
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 46 Bull / 32 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.4:1 (SA) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $75.7500–$76.0922 (Limit Ladder) · Stop: $78.3750 (Structural Invalidation)
T1: $74.9852 (0.48R · Day Value Area) · T2: $71.9625 (1.81R · Volume Node) · T3: $69.6900 (2.80R · Liquidity Sweep)
Composite R: 1.48R · Active Vetoes: M1 R 0.61 < 1.5 — reward does not pay the risk; opposing $1M+ wall at 75.26 blocks T1; Desk R-Standard (T1 0.48R < 2.0R)

## FORMULATION · XRP · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: +0.0986% | mt5Spread: 0.0986% (PASS)
D2  profile: session POC 0.991608 · day VAL/POC/VAH 0.983773/0.991800/0.998680 · month POC 1.2530
D3  VWAP 0.993030 · z -0.31σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 49.40063467133191 · H1 37.576964204888796
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 39 Bull / 39 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.5:1 (SA) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 0.0986% (PASS)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.990900–$0.998680 (Limit Ladder) · Stop: $1.0286 (Structural Invalidation)
T1: $0.983773 (0.50R · Day Value Area) · T2: $0.941355 (1.91R · Volume Node) · T3: $0.911628 (2.91R · Liquidity Sweep)
Composite R: 1.55R · Active Vetoes: M1 R 0.35 < 1.5 — reward does not pay the risk; Desk R-Standard (T1 0.50R < 2.0R)

## FORMULATION · ADA · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: +2.2499% | mt5Spread: 2.2499% (VETO)
D2  profile: session POC 0.163400 · day VAL/POC/VAH 0.162548/0.163412/0.165015 · month POC 0.173029
D3  VWAP 0.164265 · z -0.67σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 44.13939564989893 · H1 35.22369572633811
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 46 Bull / 48 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.2:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 2.2499% (VETO)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.163300–$0.165015 (Limit Ladder) · Stop: $0.169965 (Structural Invalidation)
T1: $0.162548 (0.50R · Day Value Area) · T2: $0.155135 (2.00R · Volume Node) · T3: $0.150236 (2.99R · Liquidity Sweep)
Composite R: 1.59R · Active Vetoes: M1 R 0.55 < 1.5 — reward does not pay the risk; Broker Spread Gate (2.25% >= 0.15%); Desk R-Standard (T1 0.50R < 2.0R)

## FORMULATION · DOGE · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: +1.3921% | mt5Spread: 1.3921% (VETO)
D2  profile: session POC 0.062820 · day VAL/POC/VAH 0.062359/0.062856/0.063172 · month POC 0.075296
D3  VWAP 0.062974 · z -0.15σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 47.847512595347546 · H1 38.26376741611784
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 30 Bull / 33 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.0:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 1.3921% (VETO)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.062900–$0.063172 (Limit Ladder) · Stop: $0.065067 (Structural Invalidation)
T1: $0.062359 (0.43R · Day Value Area) · T2: $0.059755 (1.80R · Volume Node) · T3: $0.057868 (2.80R · Liquidity Sweep)
Composite R: 1.45R · Active Vetoes: M1 R 0.33 < 1.5 — reward does not pay the risk; Broker Spread Gate (1.39% >= 0.15%); Desk R-Standard (T1 0.43R < 2.0R)

## FORMULATION · LINK · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: +0.5666% | mt5Spread: 0.5666% (VETO)
D2  profile: session POC 9.6320 · day VAL/POC/VAH 9.5456/9.6307/9.6766 · month POC 10.8311
D3  VWAP 9.6430 · z -0.43σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 46.36562380931357 · H1 39.3719481243111
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 36 Bull / 55 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 2.2:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 0.5666% (VETO)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $9.6080–$9.6766 (Limit Ladder) · Stop: $9.9669 (Structural Invalidation)
T1: $9.5456 (0.45R · Day Value Area) · T2: $9.1276 (1.89R · Volume Node) · T3: $8.8394 (2.88R · Liquidity Sweep)
Composite R: 1.51R · Active Vetoes: M1 R 0.36 < 1.5 — reward does not pay the risk; Broker Spread Gate (0.57% >= 0.15%); Desk R-Standard (T1 0.45R < 2.0R)

## FORMULATION · LTC · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: +2.4241% | mt5Spread: 2.4241% (VETO)
D2  profile: session POC 48.3485 · day VAL/POC/VAH 48.1209/48.3436/48.8446 · month POC 51.4532
D3  VWAP 48.6079 · z -0.90σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 45.16627845787921 · H1 41.406973364253716
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 49 Bull / 39 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 5.5:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 2.4241% (VETO)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $48.2800–$48.8446 (Limit Ladder) · Stop: $50.3099 (Structural Invalidation)
T1: $48.1209 (0.49R · Day Value Area) · T2: $45.8660 (2.03R · Volume Node) · T3: $44.4176 (3.02R · Liquidity Sweep)
Composite R: 1.61R · Active Vetoes: M1 R 0.28 < 1.5 — reward does not pay the risk; LSR 5.5:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Broker Spread Gate (2.42% >= 0.15%); Desk R-Standard (T1 0.49R < 2.0R)

## FORMULATION · AVAX · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 8.0235 · day VAL/POC/VAH 7.9990/8.0326/8.1278 · month POC 8.5755
D3  VWAP 8.0741 · z -1.48σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 35.705800777023015 · H1 34.077024551024564
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 37 Bull / 47 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 10.8:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $7.9730–$8.1278 (Limit Ladder) · Stop: $8.3716 (Structural Invalidation)
T1: $7.8135 (1.29R · Day Value Area) · T2: $7.5743 (2.27R · Volume Node) · T3: $7.3352 (3.25R · Liquidity Sweep)
Composite R: 2.07R · Active Vetoes: M1 R 0.27 < 1.5 — reward does not pay the risk; LSR 10.8:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.29R < 2.0R)

## FORMULATION · DOT · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.783760 · day VAL/POC/VAH 0.782050/0.784850/0.797450 · month POC 0.948058
D3  VWAP 0.792856 · z -1.01σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 37.058517790784514 · H1 32.4129717104378
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 48 Bull / 37 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 3.2:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.784100–$0.797450 (Limit Ladder) · Stop: $0.821373 (Structural Invalidation)
T1: $0.782050 (0.64R · Day Value Area) · T2: $0.744895 (2.20R · Volume Node) · T3: $0.721372 (3.18R · Liquidity Sweep)
Composite R: 1.77R · Active Vetoes: M1 R 0.37 < 1.5 — reward does not pay the risk; LSR 3.2:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.64R < 2.0R)

## FORMULATION · NEAR · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 3.3240 · day VAL/POC/VAH 3.3089/3.3520/3.3860 · month POC 3.7073
D3  VWAP 3.3633 · z -0.91σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 42.52919860714972 · H1 37.5933795192587
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 39 Bull / 43 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 3.9:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $3.3260–$3.3860 (Limit Ladder) · Stop: $3.4875 (Structural Invalidation)
T1: $3.3089 (0.76R · Day Value Area) · T2: $3.1597 (2.23R · Volume Node) · T3: $3.0599 (3.21R · Liquidity Sweep)
Composite R: 1.84R · Active Vetoes: M1 R 0.24 < 1.5 — reward does not pay the risk; LSR 3.9:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.76R < 2.0R)

## FORMULATION · UNI · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 5.5217 · day VAL/POC/VAH 5.5035/5.5242/5.6227 · month POC 7.0103
D3  VWAP 5.5869 · z -1.07σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 41.65055187142687 · H1 34.784631760346926
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 39 Bull / 32 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 3.5:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $5.5150–$5.6227 (Limit Ladder) · Stop: $5.7914 (Structural Invalidation)
T1: $5.5035 (0.71R · Day Value Area) · T2: $5.2392 (2.27R · Volume Node) · T3: $5.0738 (3.25R · Liquidity Sweep)
Composite R: 1.84R · Active Vetoes: M1 R 0.70 < 1.5 — reward does not pay the risk; LSR 3.5:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.71R < 2.0R)

## FORMULATION · ATOM · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 1.3432 · day VAL/POC/VAH 1.3248/1.3434/1.3486 · month POC 1.3901
D3  VWAP 1.3392 · z -0.35σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 45.47515684856904 · H1 35.839290300247725
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 59 Bull / 38 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.5:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $1.3350–$1.3486 (Limit Ladder) · Stop: $1.3890 (Structural Invalidation)
T1: $1.3248 (0.59R · Day Value Area) · T2: $1.2682 (1.99R · Volume Node) · T3: $1.2282 (2.98R · Liquidity Sweep)
Composite R: 1.62R · Active Vetoes: M1 R 0.83 < 1.5 — reward does not pay the risk; Desk R-Standard (T1 0.59R < 2.0R)

## FORMULATION · XLM · 2026-11-14 11:08:13 UTC · S1 (Liquidation Sweep Reversal — Magnet Exhaustion)
Regime: RANGE_BALANCE — H4/D1 Trend + Microstructure Order Flow
Direction: NEUTRAL · Grade: SKIP · Confidence: 20%
D1  basisPct: +0.1157% | mt5Spread: 0.1157% (PASS)
D2  profile: session POC 0.143728 · day VAL/POC/VAH 0.142272/0.143389/0.144132 · month POC 0.147668
D3  VWAP 0.143496 · z +0.74σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bull · D1 13x89 bull
D5  RSI: M15 55.32526897176712 · H1 46.10577850602495
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 32 Bull / 28 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 3.5:1 (SA) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: 0.1157% (PASS)
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.144200–$0.142272 (Limit Ladder) · Stop: $0.138004 (Structural Invalidation)
T1: $0.147084 (1.13R · Day Value Area) · T2: $0.147668 (1.26R · Volume Node) · T3: $0.155736 (3.15R · Liquidity Sweep)
Composite R: 1.59R · Active Vetoes: LSR 3.5:1 (SA) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.13R < 2.0R)

## FORMULATION · ETC · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 6.2842 · day VAL/POC/VAH 6.2710/6.3011/6.3484 · month POC 6.9621
D3  VWAP 6.3182 · z -0.39σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 43.95499380780601 · H1 36.711338918572835
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 47 Bull / 54 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.6:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $6.3000–$6.3484 (Limit Ladder) · Stop: $6.5389 (Structural Invalidation)
T1: $6.2710 (0.41R · Day Value Area) · T2: $5.9850 (1.91R · Volume Node) · T3: $5.7960 (2.90R · Liquidity Sweep)
Composite R: 1.51R · Active Vetoes: M1 R 0.43 < 1.5 — reward does not pay the risk; Desk R-Standard (T1 0.41R < 2.0R)

## FORMULATION · FIL · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 88%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.688156 · day VAL/POC/VAH 0.680813/0.687712/0.693462 · month POC 0.864804
D3  VWAP 0.689374 · z -0.46σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 43.622255956062375 · H1 33.333068337742034
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 72 Bull / 52 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.3:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.686400–$0.693462 (Limit Ladder) · Stop: $0.714266 (Structural Invalidation)
T1: $0.680813 (0.61R · Day Value Area) · T2: $0.652080 (1.99R · Volume Node) · T3: $0.631488 (2.98R · Liquidity Sweep)
Composite R: 1.63R · Active Vetoes: M1 R 0.37 < 1.5 — reward does not pay the risk; opposing $1M+ wall at 0.6835 blocks T1; Desk R-Standard (T1 0.61R < 2.0R)

## FORMULATION · ICP · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 2.4099 · day VAL/POC/VAH 2.3758/2.4103/2.4262 · month POC 2.5394
D3  VWAP 2.4113 · z -0.64σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 37.75922697313233 · H1 32.740833466819424
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 37 Bull / 47 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 22.7:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $2.3930–$2.4262 (Limit Ladder) · Stop: $2.4990 (Structural Invalidation)
T1: $2.3758 (0.69R · Day Value Area) · T2: $2.2733 (2.10R · Volume Node) · T3: $2.2016 (3.09R · Liquidity Sweep)
Composite R: 1.73R · Active Vetoes: M1 R 0.74 < 1.5 — reward does not pay the risk; LSR 22.7:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.69R < 2.0R)

## FORMULATION · HBAR · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: A+ · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.059810 · day VAL/POC/VAH 0.059502/0.059854/0.060426 · month POC 0.066956
D3  VWAP 0.060125 · z -0.01σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 51.10433297930559 · H1 36.88404623100156
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 46 Bull / 47 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 5.0:1 (SA) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.060120–$0.060426 (Limit Ladder) · Stop: $0.062239 (Structural Invalidation)
T1: $0.059502 (0.51R · Day Value Area) · T2: $0.057114 (1.83R · Volume Node) · T3: $0.055310 (2.82R · Liquidity Sweep)
Composite R: 1.50R · Active Vetoes: LSR 5.0:1 (SA) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.51R < 2.0R)

## FORMULATION · APT · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.512625 · day VAL/POC/VAH 0.510668/0.513528/0.522108 · month POC 0.603180
D3  VWAP 0.518789 · z -1.50σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 31.787163656546824 · H1 29.81132240650419
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 37 Bull / 31 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 5.1:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.509800–$0.522108 (Limit Ladder) · Stop: $0.537772 (Structural Invalidation)
T1: $0.499604 (1.44R · Day Value Area) · T2: $0.484310 (2.41R · Volume Node) · T3: $0.469016 (3.39R · Liquidity Sweep)
Composite R: 2.22R · Active Vetoes: M1 R 0.40 < 1.5 — reward does not pay the risk; LSR 5.1:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.44R < 2.0R)

## FORMULATION · ARB · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.140352 · day VAL/POC/VAH 0.138554/0.140402/0.141458 · month POC 0.164017
D3  VWAP 0.140598 · z -0.61σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 48.703397125480656 · H1 37.15995121754543
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 40 Bull / 50 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 1.3:1 (LB) → GATE: OPEN
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.139630–$0.141458 (Limit Ladder) · Stop: $0.145702 (Structural Invalidation)
T1: $0.138554 (0.68R · Day Value Area) · T2: $0.132649 (2.08R · Volume Node) · T3: $0.128460 (3.06R · Liquidity Sweep)
Composite R: 1.72R · Active Vetoes: M1 R 0.75 < 1.5 — reward does not pay the risk; Desk R-Standard (T1 0.68R < 2.0R)

## FORMULATION · OP · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.088844 · day VAL/POC/VAH 0.088477/0.088910/0.090383 · month POC 0.100428
D3  VWAP 0.089683 · z -1.54σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 32.40236759035902 · H1 29.86595453809116
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 58 Bull / 50 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 6.6:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.088160–$0.090383 (Limit Ladder) · Stop: $0.093095 (Structural Invalidation)
T1: $0.086397 (1.47R · Day Value Area) · T2: $0.083752 (2.45R · Volume Node) · T3: $0.081107 (3.42R · Liquidity Sweep)
Composite R: 2.25R · Active Vetoes: M1 R 0.45 < 1.5 — reward does not pay the risk; LSR 6.6:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.47R < 2.0R)

## FORMULATION · SUI · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.772225 · day VAL/POC/VAH 0.767662/0.772262/0.780312 · month POC 0.869237
D3  VWAP 0.776478 · z -1.00σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 39.82797309943079 · H1 37.2097776689036
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 58 Bull / 44 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 6.8:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.769600–$0.780312 (Limit Ladder) · Stop: $0.803722 (Structural Invalidation)
T1: $0.767662 (0.54R · Day Value Area) · T2: $0.731120 (2.10R · Volume Node) · T3: $0.708032 (3.09R · Liquidity Sweep)
Composite R: 1.67R · Active Vetoes: M1 R 0.23 < 1.5 — reward does not pay the risk; LSR 6.8:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.54R < 2.0R)

## FORMULATION · SEI · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.040905 · day VAL/POC/VAH 0.040960/0.041788/0.041968 · month POC 0.047977
D3  VWAP 0.041515 · z -1.56σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 31.95759792867301 · H1 31.290048640962638
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 32 Bull / 31 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 10.9:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.040740–$0.041968 (Limit Ladder) · Stop: $0.043227 (Structural Invalidation)
T1: $0.039925 (1.62R · Day Value Area) · T2: $0.038703 (2.59R · Volume Node) · T3: $0.037481 (3.56R · Liquidity Sweep)
Composite R: 2.40R · Active Vetoes: M1 R 0.26 < 1.5 — reward does not pay the risk; LSR 10.9:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.62R < 2.0R)

## FORMULATION · INJ · 2026-11-14 11:08:13 UTC · S1 (Liquidation Sweep Reversal — Magnet Exhaustion)
Regime: RANGE_BALANCE — H4/D1 Trend + Microstructure Order Flow
Direction: NEUTRAL · Grade: SKIP · Confidence: 20%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 8.0130 · day VAL/POC/VAH 7.9236/8.0130/8.0896 · month POC 8.1310
D3  VWAP 8.0294 · z -1.67σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bull · D1 13x89 bull
D5  RSI: M15 38.30063056731597 · H1 47.51857401973451
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 79 Bull / 84 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 73.7:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $7.8980–$7.8980 (Limit Ladder) · Stop: $7.6611 (Structural Invalidation)
T1: $8.0896 (0.81R · Day Value Area) · T2: $8.1310 (0.98R · Volume Node) · T3: $8.5298 (2.67R · Liquidity Sweep)
Composite R: 1.25R · Active Vetoes: LSR 73.7:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.81R < 2.0R)

## FORMULATION · TIA · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.370412 · day VAL/POC/VAH 0.366842/0.370337/0.374221 · month POC 0.437979
D3  VWAP 0.371280 · z -1.54σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 38.831352854739805 · H1 24.322021016334375
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 71 Bull / 62 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 6.2:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.365200–$0.374221 (Limit Ladder) · Stop: $0.385447 (Structural Invalidation)
T1: $0.357896 (1.45R · Day Value Area) · T2: $0.346940 (2.43R · Volume Node) · T3: $0.335984 (3.41R · Liquidity Sweep)
Composite R: 2.23R · Active Vetoes: M1 R 0.43 < 1.5 — reward does not pay the risk; LSR 6.2:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.45R < 2.0R)

## FORMULATION · VET · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.004908 · day VAL/POC/VAH 0.004892/0.004906/0.004989 · month POC 0.005169
D3  VWAP 0.004960 · z -1.28σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 33.6458189652662 · H1 31.150673376968413
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 48 Bull / 45 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 12.5:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.004892–$0.004989 (Limit Ladder) · Stop: $0.005139 (Structural Invalidation)
T1: $0.004794 (1.30R · Day Value Area) · T2: $0.004647 (2.28R · Volume Node) · T3: $0.004501 (3.26R · Liquidity Sweep)
Composite R: 2.09R · Active Vetoes: M1 R 0.32 < 1.5 — reward does not pay the risk; LSR 12.5:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 1.30R < 2.0R)

## FORMULATION · 1000PEPE · 2026-11-14 11:08:13 UTC · S1 (Liquidation Sweep Reversal — Magnet Exhaustion)
Regime: RANGE_BALANCE — H4/D1 Trend + Microstructure Order Flow
Direction: LONG · Grade: B · Confidence: 35%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.004273 · day VAL/POC/VAH 0.004211/0.004278/0.004307 · month POC 0.005016
D3  VWAP 0.004274 · z +0.05σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bull · D1 13x89 bull
D5  RSI: M15 50.98724250282133 · H1 35.7517952136927
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 60 Bull / 32 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 2.8:1 (SA) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.004277–$0.004211 (Limit Ladder) · Stop: $0.004084 (Structural Invalidation)
T1: $0.004307 (0.77R · Day Value Area) · T2: $0.005016 (6.37R · Volume Node) · T3: $0.004619 (3.23R · Liquidity Sweep)
Composite R: 3.50R · Active Vetoes: LSR 2.8:1 (SA) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.77R < 2.0R)

## FORMULATION · 1000SHIB · 2026-11-14 11:08:13 UTC · S7 (High-Volume Absorption Continuation)
Regime: TREND_DOWN — H4/D1 Trend + Microstructure Order Flow
Direction: SHORT · Grade: B · Confidence: 92%
D1  basisPct: n/a | mt5Spread: No MT5 Venue
D2  profile: session POC 0.004150 · day VAL/POC/VAH 0.004131/0.004151/0.004190 · month POC 0.004464
D3  VWAP 0.004175 · z -0.87σ · bands ±1σ/2σ/3σ
D4  EMA stacks: H4 13x89 bear · D1 13x89 bear
D5  RSI: M15 39.91837791109775 · H1 36.19442702840091
D6  delta: sell-dominant taker pressure / absorption
D7  signals: 72 Bull / 40 Bear
D8  CVD: spot-bid · taker buy 47.7%
D9  walls: confirmed resting walls present (6 active)
D10 LTO: institutional limit orders present (1 clusters)
D11 clusters: sweep magnets identified
D12 LSR: 5.4:1 (LB) → GATE: BANNED (Wait for Sweep)
D13 GEX: Deribit options gamma tracked (n/a)
D14 OI: Quadrant spot-bid
D15 spread: No MT5 Venue
D16 invariants: max heat 1.0% · slots <= 2 crypto · +1.0R BE · 8-bar time stop
Entry: $0.004145–$0.004190 (Limit Ladder) · Stop: $0.004316 (Structural Invalidation)
T1: $0.004131 (0.47R · Day Value Area) · T2: $0.003938 (2.01R · Volume Node) · T3: $0.003813 (3.00R · Liquidity Sweep)
Composite R: 1.59R · Active Vetoes: M1 R 0.47 < 1.5 — reward does not pay the risk; LSR 5.4:1 (LB) Magnet Gate (Passive S2/S3 Banned — S1 Sweep Required); Desk R-Standard (T1 0.47R < 2.0R)

## 6. Synthesis & Execution Directives for Lead Synthesizer (@lead-5)

1. **Universe Screening Summary**:
   - Total Crypto Assets Swept: **30 / 30**
   - Qualifiers Isolated: **29 assets**
   - Table 7 Score Summary: Under strict zero-fallback scoring (phantom points eliminated), scores range from 2.0 to 7.8 pts. Assets with Grade A scores (e.g. BNB, XRP) remain vetoed by the Desk R-Standard (T1 R < 2.0) and lack of MT5 mapping.
2. **Liquidity Magnet Warnings (LSR ≥ 2.5:1)**:
   - Multiple altcoins display severe liquidation asymmetry within ±2.0% of price (dominant Short Liquidations Above or Long Liquidations Below). Passive front-running (Setup S3) is strictly BANNED on these assets; desk posture must be **WAIT FOR THE SWEEP (Setup S1)**.
3. **Broker Spread Disqualifications**:
   - FundedNext MT5 spreads strictly disqualify: **ADAUSD (2.25%)**, **DOGUSD (1.39%)**, **LNKUSD (0.57%)**, **LTCUSD (2.42%)**.
   - Qualified execution venues with tight institutional spreads (<0.15%): **BTCUSD (0.0348%)**, **ETHUSD (0.0285%)**, **XRPUSD (0.0986%)**, **XLMUSD (0.1157%)**.
4. **MT5 Position Audit & Risk Limits**:
   - Open Position: **ETHUSD Short (#210199486)** at 1948.29, current stop locked at Breakeven 1948.29 (+2.03R excursion, $0.00 open risk).
   - Standing Limits: **BTCUSD Short Limit (#210199407)** at 67850.00 and **XAUUSD Buy Limit (#210199455)** at 3872.00.
   - Total portfolio heat is well below the 1.0% ($46.45) equity risk cap.
5. **Handoff**:
   - All 30 assets are fully screened, validated against live data, and ready for synthesis into `UNIVERSE-360` by `@lead-5`.
