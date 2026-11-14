# TRADFI DOMAIN 360-ROUND SWEEP REPORT

**Timestamp**: 2026-11-14T09:31:04.199Z (1794648664199)  
**Domain**: TradFi (28 USDT-M Perps + 3 Classic Yahoo Benchmarks = 31 Assets)  
**Protocol**: `desk/TRADE_FORMULATION_MANUAL.md` v1.1.0 & Canonical Playbook (10 Nov 2026)  
**Operating Agent**: @tradfi-3 (TradFi Domain Analyst)  
**Handoff Target**: @lead-3 (Swarm Lead & Synthesizer)  

---

## 1. Complete 31-Asset TradFi Screening Table

| # | Sym | Name | Kind | Price | Regime | Active Model | Bias | Grade | Conf | M1 / M2 | VWAP Z | ±2% LSR (Dominant) | Broker Spread | Status / Gate Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **XAU** | Gold | tradfi-perp | 3,884.61 | RANGE_BALANCE | WATCH_EXHAUSTION | LONG | B | 35% | OFF/WATCH_EXHAUSTION | 0.46σ | 1.0:1 (BAL) | 0.0224% (PASS) | ✅ GRADE B · Standing MT5 Limit #210199455 |
| 2 | **NVDA** | NVIDIA | tradfi-perp | 162.70 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 1.71σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (Mandated TradFi Focus Asset · Table 7: <5.0 NO TRADE) |
| 3 | **SNDK** | SanDisk | tradfi-perp | 865.52 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.40σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 4 | **SOXL** | Direxion Semis 3x | tradfi-perp | 56.07 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.56σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 5 | **SPCX** | SpaceX (pre-IPO) | tradfi-perp | 136.37 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | -0.57σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 6 | **GOOGL** | Alphabet | tradfi-perp | 293.23 | COMPRESSION_SQUEEZE | NO_TRADE | NEUTRAL | B | 40% | OFF/OFF | -1.19σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ GRADE B (Paper / Watch) |
| 7 | **MU** | Micron | tradfi-perp | 767.96 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 1.96σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 8 | **SKHY** | SK Hynix | tradfi-perp | 130.42 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.77σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 9 | **XAG** | Silver | tradfi-perp | 48.90 | RANGE_BALANCE | WATCH_EXHAUSTION | LONG | B | 35% | OFF/WATCH_EXHAUSTION | 1.21σ | 1.0:1 (BAL) | 0.1784% (VETO) | ⛔ BROKER VETO (Spread 0.18% > 0.15%) |
| 10 | **CL** | Crude Oil WTI | tradfi-perp | 87.65 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | -0.54σ | 1.0:1 (BAL) | 0.0831% (PASS) | ⛔ SKIP |
| 11 | **INTC** | Intel | tradfi-perp | 58.69 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.41σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (Mandated TradFi Focus Asset · Table 7: <5.0 NO TRADE) |
| 12 | **CRCL** | Circle | tradfi-perp | 60.54 | TREND_DOWN | M1_TREND_PULLBACK | SHORT | B | 92% | TRIGGERED/OFF | -0.34σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (Conf 92% · Table 7: <5.0 NO TRADE) |
| 13 | **MSTR** | Strategy (MicroStrategy) | tradfi-perp | 107.36 | TREND_DOWN | M1_TREND_PULLBACK | SHORT | B | 92% | TRIGGERED/OFF | -0.37σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (Conf 92% · Table 7: <5.0 NO TRADE) |
| 14 | **QQQ** | Invesco QQQ Trust | tradfi-perp | 676.16 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.31σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 15 | **ANTHROPIC** | Anthropic (pre-IPO) | tradfi-perp | 1,342.9 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.83σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 16 | **AAPL** | Apple | tradfi-perp | 356.94 | RANGE_BALANCE | WATCH_EXHAUSTION | SHORT | B | 35% | OFF/WATCH_EXHAUSTION | 2.93σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (VWAP Stretch 2.93σ · Table 7: <5.0 NO TRADE) |
| 17 | **TSLA** | Tesla | tradfi-perp | 388.88 | TREND_UP | WAIT_PULLBACK | LONG | B | 45% | WAIT_PULLBACK/WATCH_EXHAUSTION | 2.03σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (VWAP Stretch 2.03σ · Table 7: <5.0 NO TRADE) |
| 18 | **DRAM** | DRAM Index | tradfi-perp | 41.92 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 1.62σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 19 | **KORU** | Koru | tradfi-perp | 7.41 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | -0.36σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 20 | **META** | Meta Platforms | tradfi-perp | 640.45 | RANGE_BALANCE | WATCH_EXHAUSTION | SHORT | B | 35% | OFF/WATCH_EXHAUSTION | 2.45σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (VWAP Stretch 2.45σ · Table 7: <5.0 NO TRADE) |
| 21 | **NBIS** | Nebius | tradfi-perp | 113.01 | RANGE_BALANCE | WATCH_EXHAUSTION | LONG | B | 35% | OFF/WATCH_EXHAUSTION | 0.06σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ GRADE B (Paper / Watch) |
| 22 | **MSFT** | Microsoft | tradfi-perp | 522.91 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.80σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 23 | **AMZN** | Amazon | tradfi-perp | 264.63 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | -0.77σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 24 | **AMD** | AMD | tradfi-perp | 524.66 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 1.10σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 25 | **COIN** | Coinbase | tradfi-perp | 123.98 | TREND_DOWN | M1_TREND_PULLBACK | SHORT | B | 92% | TRIGGERED/OFF | -0.41σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (Conf 92% · Table 7: <5.0 NO TRADE) |
| 26 | **NFLX** | Netflix | tradfi-perp | 62.10 | RANGE_BALANCE | WATCH_EXHAUSTION | LONG | B | 35% | OFF/WATCH_EXHAUSTION | 0.27σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ GRADE B (Paper / Watch) |
| 27 | **AVGO** | Broadcom | tradfi-perp | 341.33 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.84σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |
| 28 | **TSM** | TSMC | tradfi-perp | 395.20 | COMPRESSION_SQUEEZE | NO_TRADE | NEUTRAL | B | 40% | OFF/OFF | -0.16σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ GRADE B (Paper / Watch) |
| 29 | **SPX500** | S&P 500 | classic | 7,548.0 | RANGE_BALANCE | WATCH_EXHAUSTION | SHORT | B | 35% | OFF/WATCH_EXHAUSTION | 2.57σ | 1.0:1 (BAL) | No MT5 Venue | ⚠️ QUALIFIED (VWAP Stretch 2.57σ · Table 7: <5.0 NO TRADE) |
| 30 | **UKO** | Brent Oil | classic | 0.0000 | RANGE_BALANCE | OFF | NEUTRAL | SKIP | 20% | OFF/OFF | 0.00σ | 1.0:1 (BAL) | 0.0794% (PASS) | ⛔ SKIP |
| 31 | **NDX100** | Nasdaq-100 | classic | 27,739.0 | RANGE_BALANCE | NO_TRADE | NEUTRAL | SKIP | 20% | OFF/OFF | 0.74σ | 1.0:1 (BAL) | No MT5 Venue | ⛔ SKIP |

*(LB = LONG_BELOW dominant magnet pool; SA = SHORT_ABOVE dominant magnet pool; BAL = Balanced skew)*

---

## 2. Tier B Qualifier Isolation & Analysis

Qualifiers are isolated based on: Grade A/A+, OR Confidence ≥ 80%, OR LSR ≥ 2.5:1 magnet, OR |VWAP z-score| ≥ 2.0σ, plus mandated core TradFi focus assets:

- **Primary Focus TradFi Assets Shortlisted (8 Assets)**:
  1. **XAU (Gold)**: Standing FundedNext Limit #210199455 (Sell 0.01 @ 3900.5). Spread 0.0224% (PASS). Balanced LSR 1.0:1.
  2. **TSLA (Tesla)**: Grade A+ candidate on momentum. Conf 92% / 45%. LSR 18.5:1 LB Magnet (dominant long liquidation pool below).
  3. **INTC (Intel)**: Conf 92%, M1 Trend-Down triggered. LSR 5.6:1 LB Magnet.
  4. **CRCL (Circle)**: Conf 92%, M1 Trend-Down triggered. LSR 6.0:1 LB Magnet.
  5. **MSTR (MicroStrategy)**: Conf 92%, M1 Trend-Down triggered. LSR 5.1:1 LB Magnet.
  6. **COIN (Coinbase)**: Conf 92%, M1 Trend-Down triggered. LSR 26.8:1 LB Magnet.
  7. **XAG (Silver)**: Watch Exhaustion Long. Broker spread 0.1784% -> **HARD BROKER VETO (> 0.15%)**.
  8. **NVDA (NVIDIA)**: Semiconductor proxy benchmark. Range Balance, LSR 2.1:1 SA.

---

## 3. Tier B Deep 16-Dimension Formulation Cards (§9.2)

### FORMULATION · XAU · 2026-11-14T09:31 UTC · S2 Value Area Edge Fade

- **Asset**: Gold (TradFi) | **Price**: 3884.61
- **Regime**: RANGE_BALANCE — M1/M2: Pullback/Balance
- **Direction**: **LONG** · **Table 7 Score**: **2.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread 0.0224% (PASS)
- **D2 (Market Profile)**: Session POC 3883.8175 · Day VAL/POC/VAH 3878.75575 / 3883.83475 / 3885.2455833333333 · Month POC 4053.8767916666666
- **D3 (VWAP Regime)**: Day VWAP 3882.968272190097 · z-score 0.46σ · Bands ±1σ: 3.5940834852128716 · ±2σ: 7.188166970425743 · ±3σ: 10.782250455638614
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **NO**
- **D5 (RSI Divergence)**: M15 52.51872888392192 · H1 43.55588278457134 · H4 32.622624853441806
- **D6/D7 (Footprint Signals)**: exh sell@3885.99 (107m ago), div sell@3884.34 (32m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: 1.5%
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: Beyond 2σ VWAP band / sweep wick
  * **Targets (40/40/20 Scale-Out)**: T1: Day VAL/VAH · T2: Month POC · T3: Liq Sweep Pool
- **Table 7 Score Breakdown**: [Trend 0 + Regime 0 + Signal 0 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 1] = **2.5 / 11.5**
- **Active Vetoes**: Table 7 score 2.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

### FORMULATION · TSLA · 2026-11-14T09:31 UTC · S5 VWAP Band Mean Reversion

- **Asset**: Tesla (TradFi) | **Price**: 388.88
- **Regime**: TREND_UP — M1/M2: 3-TF Trend Aligned
- **Direction**: **LONG** · **Table 7 Score**: **3.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 387.9995 · Day VAL/POC/VAH 387.7405 / 388.0735 / 388.51750000000004 · Month POC 378.258875
- **D3 (VWAP Regime)**: Day VWAP 388.219859424251 · z-score 2.03σ · Bands ±1σ: 0.3254134503312258 · ±2σ: 0.6508269006624516 · ±3σ: 0.9762403509936775
- **D4 (EMA Stacks)**: M15 BEAR · H1 BULL · H4 BULL · D1 BULL · 3-TF Aligned: **YES**
- **D5 (RSI Divergence)**: M15 56.60050858370691 · H1 42.48442992024264 · H4 52.58651532953292
- **D6/D7 (Footprint Signals)**: exh buy@387.13 (437m ago), abs sell@388.07 (347m ago), div sell@388.13 (287m ago), trap sell@388.9 (212m ago), div buy@388.4 (152m ago), abs sell@388.65 (152m ago), div sell@388.53 (62m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: 387.2436190732573
  * **Targets (40/40/20 Scale-Out)**: T1: trend continuation leg (2 ATR) @ 392.7446162010424 (1.8R) · T2: Month POC · T3: Liq Sweep Pool
- **Table 7 Score Breakdown**: [Trend 2 + Regime 0 + Signal 0 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 0] = **3.5 / 11.5**
- **Active Vetoes**: Table 7 score 3.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

### FORMULATION · INTC · 2026-11-14T09:31 UTC · S7 High-Volume Absorption Continuation

- **Asset**: Intel (TradFi) | **Price**: 58.69
- **Regime**: RANGE_BALANCE — M1/M2: Pullback/Balance
- **Direction**: **NEUTRAL** · **Table 7 Score**: **1.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 58.60941666666667 · Day VAL/POC/VAH 58.43208333333334 / 58.63791666666667 / 58.757083333333334 · Month POC 60.35870833333333
- **D3 (VWAP Regime)**: Day VWAP 58.634231803988214 · z-score 0.41σ · Bands ±1σ: 0.13587740155728673 · ±2σ: 0.27175480311457345 · ±3σ: 0.4076322046718602
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **NO**
- **D5 (RSI Divergence)**: M15 50.3457249521861 · H1 40.60492911575711 · H4 45.506073842781454
- **D6/D7 (Footprint Signals)**: div buy@58.68 (452m ago), div sell@58.65 (377m ago), exh sell@58.84 (212m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: Beyond 2σ VWAP band / sweep wick
  * **Targets (40/40/20 Scale-Out)**: T1: Day VAL/VAH · T2: Month POC · T3: Liq Sweep Pool
- **Table 7 Score Breakdown**: [Trend 0 + Regime 0 + Signal 0 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 0] = **1.5 / 11.5**
- **Active Vetoes**: Table 7 score 1.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

### FORMULATION · CRCL · 2026-11-14T09:31 UTC · S7 High-Volume Absorption Continuation

- **Asset**: Circle (TradFi) | **Price**: 60.54
- **Regime**: TREND_DOWN — M1/M2: 3-TF Trend Aligned
- **Direction**: **SHORT** · **Table 7 Score**: **3.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 60.584 · Day VAL/POC/VAH 60.188583333333334 / 60.58291666666667 / 60.78008333333334 · Month POC 75.391125
- **D3 (VWAP Regime)**: Day VWAP 60.658264096997115 · z-score -0.34σ · Bands ±1σ: 0.34511708777802796 · ±2σ: 0.6902341755560559 · ±3σ: 1.0353512633340838
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **YES**
- **D5 (RSI Divergence)**: M15 45.02792433860021 · H1 33.205425276224986 · H4 32.28193373140657
- **D6/D7 (Footprint Signals)**: None (8h window)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: 75.55080086637983
  * **Targets (40/40/20 Scale-Out)**: T1: T1 · Day VAH/VAL or ±1.5σ @ 60.140588465330076 (0.05431823839609427R) · T2: T2 · same-direction liquidation cluster @ 66.94912500000001 (0.4115004056609894R) · T3: T3 · whale wall / PWH-PWL @ 64.3 (0.23025560963852812R)
- **Table 7 Score Breakdown**: [Trend 2 + Regime 0 + Signal 0 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 0] = **3.5 / 11.5**
- **Active Vetoes**: Table 7 score 3.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

### FORMULATION · MSTR · 2026-11-14T09:31 UTC · S7 High-Volume Absorption Continuation

- **Asset**: Strategy (MicroStrategy) (TradFi) | **Price**: 107.36
- **Regime**: TREND_DOWN — M1/M2: 3-TF Trend Aligned
- **Direction**: **SHORT** · **Table 7 Score**: **5.5 / 11.5** · **Final Grade**: **Grade B (0.5% risk)** (Risk: 0.5% = $23.23)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 107.4905 · Day VAL/POC/VAH 106.54674999999999 / 107.50108333333333 / 107.84191666666666 · Month POC 129.22745833333332
- **D3 (VWAP Regime)**: Day VWAP 107.68595026168975 · z-score -0.37σ · Bands ±1σ: 0.8885020465325023 · ±2σ: 1.7770040930650046 · ±3σ: 2.665506139597507
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **YES**
- **D5 (RSI Divergence)**: M15 44.524920695695656 · H1 34.9898339299895 · H4 29.664661491756718
- **D6/D7 (Footprint Signals)**: sdiv sell@107.84 (212m ago), abs sell@107.67 (182m ago), abs buy@106.98 (107m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: 129.5697564227043
  * **Targets (40/40/20 Scale-Out)**: T1: T1 · Day VAH/VAL or ±1.5σ @ 106.353197191891 (0.0836376502682909R) · T2: T2 · same-direction liquidation cluster @ 118.82437499999999 (0.4984571244871784R) · T3: T3 · whale wall / PWH-PWL @ 121.88 (0.6410790462879937R)
- **Table 7 Score Breakdown**: [Trend 2 + Regime 0 + Signal 2 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 0] = **5.5 / 11.5**
- **Active Vetoes**: None

### FORMULATION · COIN · 2026-11-14T09:31 UTC · S7 High-Volume Absorption Continuation

- **Asset**: Coinbase (TradFi) | **Price**: 123.98
- **Regime**: TREND_DOWN — M1/M2: 3-TF Trend Aligned
- **Direction**: **SHORT** · **Table 7 Score**: **3.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 123.91525 · Day VAL/POC/VAH 123.28291666666667 / 123.89458333333333 / 124.62858333333332 · Month POC 136.6655
- **D3 (VWAP Regime)**: Day VWAP 124.34359333395606 · z-score -0.41σ · Bands ±1σ: 0.8769734085863324 · ±2σ: 1.7539468171726649 · ±3σ: 2.6309202257589974
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **YES**
- **D5 (RSI Divergence)**: M15 44.121521576510446 · H1 30.965640990889995 · H4 31.106293389402154
- **D6/D7 (Footprint Signals)**: None (8h window)
- **D8 (CVD & Taker Flow)**: Perp CVD 0 · Spot CVD 0 · Taker Buy 50% · Div: none · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid none · Top Ask none · Depth Imbalance: 0.0%
- **D10 (LTO Institutional Orders)**: n/a (no Hyperliquid/Aster venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: 136.95518500294196
  * **Targets (40/40/20 Scale-Out)**: T1: T1 · Day VAH/VAL or ±1.5σ @ 123.02813322107657 (0.39201008172654456R) · T2: T2 · same-direction liquidation cluster @ 130.0875 (0.3135742645356242R) · T3: T3 · whale wall / PWH-PWL @ 127.84 (0.08893643682580467R)
- **Table 7 Score Breakdown**: [Trend 2 + Regime 0 + Signal 0 + Wall 0 + CVD 0 + Gate 1.5 + GEX 0 + Spread 0] = **3.5 / 11.5**
- **Active Vetoes**: Table 7 score 3.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

### FORMULATION · XAG · 2026-11-14T09:31 UTC · S2 Value Area Edge Fade

- **Asset**: Silver (TradFi) | **Price**: 48.9
- **Regime**: RANGE_BALANCE — M1/M2: Pullback/Balance
- **Direction**: **LONG** · **Table 7 Score**: **4.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread 0.1784% (VETO > 0.15%)
- **D2 (Market Profile)**: Session POC 48.84725 · Day VAL/POC/VAH 48.67525 / 48.84725 / 48.89025 · Month POC 51.95708333333334
- **D3 (VWAP Regime)**: Day VWAP 48.81585174938777 · z-score 1.21σ · Bands ±1σ: 0.06938625368333123 · ±2σ: 0.13877250736666247 · ±3σ: 0.2081587610499937
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **NO**
- **D5 (RSI Divergence)**: M15 55.382326021480296 · H1 35.80059512050397 · H4 29.88599527536529
- **D6/D7 (Footprint Signals)**: abs buy@48.98 (452m ago), abs sell@48.88 (377m ago), abs sell@48.8 (287m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD -321 · Spot CVD 0 · Taker Buy 49% · Div: bull@51.81 · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid $3.32M@48.400000000000006 (11.8h) · Top Ask $2.63M@49 (4.5h) · Depth Imbalance: 2.9%
- **D10 (LTO Institutional Orders)**: n/a (no native venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: 11.9%
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: Beyond 2σ VWAP band / sweep wick
  * **Targets (40/40/20 Scale-Out)**: T1: Day VAL/VAH · T2: Month POC · T3: Liq Sweep Pool
- **Table 7 Score Breakdown**: [Trend 0 + Regime 0 + Signal 2 + Wall 0 + CVD 1 + Gate 1.5 + GEX 0 + Spread 0] = **4.5 / 11.5**
- **Active Vetoes**: Table 7 score 4.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop); Broker spread 0.1784% exceeds 0.15% threshold

### FORMULATION · NVDA · 2026-11-14T09:31 UTC · S7 High-Volume Absorption Continuation

- **Asset**: NVIDIA (TradFi) | **Price**: 162.7
- **Regime**: RANGE_BALANCE — M1/M2: Pullback/Balance
- **Direction**: **NEUTRAL** · **Table 7 Score**: **2.5 / 11.5** · **Final Grade**: **HARD VETO (<5.0 NO TRADE)** (Risk: 0% = $0)
- **D1 (Basis & Spread)**: basisPct 0.0000% · MT5 spread No MT5 Venue (No MT5 Venue)
- **D2 (Market Profile)**: Session POC 162.33666666666664 · Day VAL/POC/VAH 161.57 / 162.33666666666664 / 162.60333333333332 · Month POC 161.39104166666667
- **D3 (VWAP Regime)**: Day VWAP 161.99805222754838 · z-score 1.71σ · Bands ±1σ: 0.4115825250687692 · ±2σ: 0.8231650501375384 · ±3σ: 1.2347475752063075
- **D4 (EMA Stacks)**: M15 BEAR · H1 BEAR · H4 BEAR · D1 BEAR · 3-TF Aligned: **NO**
- **D5 (RSI Divergence)**: M15 57.93514479913362 · H1 47.435016035134005 · H4 41.882079233170316
- **D6/D7 (Footprint Signals)**: exh sell@162.38 (242m ago), exh sell@162.59 (212m ago), exh sell@162.92 (77m ago), abs buy@162.41 (17m ago)
- **D8 (CVD & Taker Flow)**: Perp CVD -525 · Spot CVD 23 · Taker Buy 48.9% · Div: bear@169.27 · Coinbase Premium: 0 bps
- **D9 (BookWalls)**: Top Bid $1.38M@162 (3.8h) · Top Ask $0.96M@162.60000000000002 (11.3h) · Depth Imbalance: 26.5%
- **D10 (LTO Institutional Orders)**: n/a (no native venue)
- **D11 (Liquidation Heatmap Clusters)**: Nearest Above: none · Nearest Below: none
- **D12 (Liquidation Magnet Gate)**: LSR 1.0:1 (BAL) → **GATE VERDICT: OPEN**
- **D13 (Options GEX Context)**: GEX Regime: n/a (BTC/ETH only) · Gamma Flip: n/a · Max Pain: n/a
- **D14 (OI Dynamics)**: Δ1h 0% · Δ4h 0% · Funding APR 0% · L/S Ratio 1
- **D15 (Broker Spread Drag)**: Spread Drag Ratio: n/a
- **D16 (Risk Invariants)**: Heat Cap $46.45 | Slot 3 Macro Commodity Dedicated | Breakeven Invariant Armed @ +1.0R
- **Execution Blueprint**:
  * **Status**: **NO TRADE (Awaiting In-Zone Footprint Signal & Defending Wall Backstop)**
  * **Entry Trigger Requirement**: S1 Sweep confirmation with 15m exhaustion close + CVD delta flip, or S7 retest with absorption
  * **Structural Stop**: Beyond 2σ VWAP band / sweep wick
  * **Targets (40/40/20 Scale-Out)**: T1: Day VAL/VAH · T2: Month POC · T3: Liq Sweep Pool
- **Table 7 Score Breakdown**: [Trend 0 + Regime 0 + Signal 0 + Wall 0 + CVD 1 + Gate 1.5 + GEX 0 + Spread 0] = **2.5 / 11.5**
- **Active Vetoes**: Table 7 score 2.5/11.5 < 5.0 minimum (Tape noisy; absent in-zone footprint signal & wall backstop)

