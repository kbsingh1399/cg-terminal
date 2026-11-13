# 30-CRYPTO UNIVERSE SCAN & DEEP TELEMETRY
**Generated**: 2026-11-14T04:00:00Z  
**Author**: @crypto (Crypto Domain Agent)  
**Universe**: 30 USDT-M Crypto Perps  

---

## 1. Executive Summary & Regime Findings

Across the 30 crypto perp assets:
- **Dominant Macro Regime**: Heavy `TREND_DOWN` across 26 of 30 assets (H4 EMAs 13×89 in full bearish stack, D1 tangled/down, prices holding below Day VWAP).
- **Extreme Liquidation Skew (LSR Magnet)**: 27 of 30 assets exhibit massive long liquidation skew below current market price (LSR typically 10:1 to 80:1 `LONG_BELOW`).
- **Liquidation Magnet Gate Impact**: Because ±2% LSR ≥ 2.5:1 across almost the entire crypto universe, **ALL PASSIVE LIMIT FRONTRUNNING (S3) AND PASSIVE PULLBACK ENTRIES (M1) INTO THE MAGNET PATH ARE FORMALLY BANNED**. The whale bid walls are dams under imminent sweep pressure. S1 Liquidation Sweep Reversal is the only authorized formulation archetype once lower liquidity is wiped.
- **Top Grade A+ Formulations**:
  1. **AVAX** (Grade A+, Conf 92%, M1 Triggered, 0 vetoes, Best R 2.20R)
  2. **ATOM** (Grade A+, Conf 92%, M1 Triggered, 0 vetoes, Best R 3.51R)
  3. **XLM** (Grade A+, Conf 92%, M1 Triggered, 0 vetoes, Best R 2.84R)
- **MT5 Broker Executability & Spread Gate Audit**:
  - **Pass (< 0.15% spread)**:
    - `BTCUSD`: 0.0348%
    - `ETHUSD`: 0.0285%
    - `XRPUSD`: 0.0987%
    - `XLMUSD`: 0.1157%
  - **Fail / Disqualified (Spread ≥ 0.15%)**:
    - `ADAUSD`: 2.2512% (FORBIDDEN)
    - `DOGUSD`: 1.3921% (FORBIDDEN)
    - `LNKUSD`: 0.5665% (FORBIDDEN)
    - `LTCUSD`: 2.4038% (FORBIDDEN)
  - **No MT5 Venue**: AVAX, ATOM, SOL, BNB, SUI, TRX, and remaining alts have no active execution feed on this broker account.

---

## 2. Active Positions & Standing Orders Audit

1. **Active Position: ETHUSD Ticket #210199486 (Short 0.2 lots)**
   - Entry: `1948.29` | Current: `~1926.40` | Floating Profit: `+$4.04` (~ +21.89 pt excursion)
   - Original Stop: `1995.00` (Risk distance: 46.71 pts)
   - Excursion Assessment: At price 1901.58 - 1926.40, excursion reached `+21.89 pts` to `+46.71 pts` (excursion peaked at `1893.39` session low, which was `+54.90 pts` = **+1.17R**!).
   - **§6 Breakeven Invariant**: Since peak excursion exceeded `+1.0R`, the stop **MUST BE MOVED TO BREAKEVEN (1948.29)** immediately.
   - Deribit Options Surface confirms `NEGATIVE_GAMMA_EXPANSION` below `1991.60` gamma flip; short thesis remains structurally intact towards Day VAL `1915.63` and T2 cluster `1894.81`.

2. **Standing Order: BTCUSD Ticket #210156552 / #210199407 (Sell Limit @ 69,500.00)**
   - Limit: `69,500.00` | SL: `70,280.00` | TP: `67,200.00` (Size: 0.01 lots)
   - Status: Placed in MT5.
   - Current Price: `68,282.90` (distance to fill: ~1,217 pts / +1.78%).
   - Level Confluence: 69,500 sits just above Day VAH (`69,436.17`) and near Day VWAP +1σ (`69,908.44`).
   - Magnet Gate Note: BTC ±2% LSR is `6.19:1 LONG_BELOW`. The order is a resting sell limit above current price fading an upside retest. Since it does NOT front-run the lower magnet path (which is below price at 67,600), it remains structurally valid as a premium fade.

---

## 3. Tier A: Full 30-Crypto Universe Screening Table

| Asset | Name | Regime | Dir | Grade | Conf | M1 Status | M2 Status | VWAP Z | ±2% LSR (Dominant) | Vetoes | Tier B Qual? |
|---|---|---|---|:---:|:---:|---|---|:---:|:---:|---|:---:|
| **AVAX** | Avalanche | `TREND_DOWN` | **SHORT** | **A+** | 92% | `TRIGGERED` | `OFF` | -0.75σ | 60.7:1 (LB) | 0 active (Clean) | **YES** |
| **ATOM** | Cosmos | `TREND_DOWN` | **SHORT** | **A+** | 92% | `TRIGGERED` | `OFF` | -1.87σ | 67.6:1 (LB) | 0 active (Clean) | **YES** |
| **XLM** | Stellar | `TREND_DOWN` | **SHORT** | **A+** | 92% | `TRIGGERED` | `OFF` | -0.56σ | 73.6:1 (LB) | 0 active (Clean) | **YES** |
| **ADA** | Cardano | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.92σ | 79.6:1 (LB) | 1 active (M1 R 1.28 < 1.5...) | **YES** |
| **XRP** | XRP | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.47σ | 15.0:1 (LB) | 1 active (M1 R 0.28 < 1.5...) | **YES** |
| **BNB** | BNB | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.15σ | 12.6:1 (LB) | 1 active (M1 R 0.68 < 1.5...) | **YES** |
| **LTC** | Litecoin | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -0.06σ | 78.6:1 (LB) | 1 active (M1 R 0.79 < 1.5...) | **YES** |
| **LINK** | Chainlink | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.01σ | 163.4:1 (LB) | 1 active (M1 R 0.31 < 1.5...) | **YES** |
| **DOT** | Polkadot | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -0.90σ | 40.8:1 (LB) | 1 active (M1 R 0.22 < 1.5...) | **YES** |
| **SUI** | Sui | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -0.58σ | 40.3:1 (LB) | 1 active (M1 R 0.58 < 1.5...) | **YES** |
| **UNI** | Uniswap | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.46σ | 37.0:1 (LB) | 1 active (M1 R 0.64 < 1.5...) | **YES** |
| **TRX** | TRON | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -0.15σ | 1.4:1 (LB) | 1 active (M1 R 1.12 < 1.5...) | **YES** |
| **ETC** | Ethereum Classic | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.59σ | 1.0:1 (BAL) | 1 active (M1 R 0.33 < 1.5...) | **YES** |
| **HBAR** | Hedera | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.39σ | 1.0:1 (BAL) | 1 active (M1 R 0.50 < 1.5...) | **YES** |
| **APT** | Aptos | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.39σ | 1.0:1 (BAL) | 1 active (M1 R 0.35 < 1.5...) | **YES** |
| **OP** | Optimism | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -1.52σ | 1.0:1 (BAL) | 1 active (M1 R 0.44 < 1.5...) | **YES** |
| **SEI** | Sei | `TREND_DOWN` | **SHORT** | **B** | 92% | `TRIGGERED` | `OFF` | -0.54σ | 1.0:1 (BAL) | 1 active (M1 R 0.53 < 1.5...) | **YES** |
| **DOGE** | Dogecoin | `TREND_DOWN` | **SHORT** | **B** | 88% | `TRIGGERED` | `OFF` | -0.86σ | 80.4:1 (LB) | 2 active (M1 R 0.31 < 1.5...) | **YES** |
| **ETH** | Ethereum | `TREND_DOWN` | **SHORT** | **B** | 88% | `TRIGGERED` | `OFF` | -1.13σ | 35.4:1 (LB) | 2 active (M1 R 0.46 < 1.5...) | **YES** |
| **SOL** | Solana | `TREND_DOWN` | **SHORT** | **B** | 88% | `TRIGGERED` | `OFF` | -1.71σ | 16.3:1 (LB) | 2 active (M1 R 0.47 < 1.5...) | **YES** |
| **BTC** | Bitcoin | `TREND_DOWN` | **SHORT** | **B** | 88% | `TRIGGERED` | `OFF` | -1.38σ | 6.2:1 (LB) | 2 active (M1 R 0.60 < 1.5...) | **YES** |
| **FIL** | Filecoin | `TREND_DOWN` | **SHORT** | **B** | 45% | `WAIT_PULLBACK` | `TRIGGERED` | -2.23σ | 1.0:1 (BAL) | 1 active (chase guard: > 2.0σ VWAP...) | **YES** |
| **ICP** | Internet Computer | `RANGE_BALANCE` | **LONG** | **B** | 35% | `OFF` | `WATCH_EXHAUSTION` | -2.56σ | >100:1 (LB) | 0 active (Clean) | **YES** |
| **NEAR** | NEAR Protocol | `RANGE_BALANCE` | **LONG** | **B** | 35% | `OFF` | `WATCH_EXHAUSTION` | -0.66σ | 7.1:1 (LB) | 0 active (Clean) | **YES** |
| **ARB** | Arbitrum | `RANGE_BALANCE` | **LONG** | **B** | 35% | `OFF` | `WATCH_EXHAUSTION` | -1.26σ | >100:1 (LB) | 0 active (Clean) | **YES** |
| **VET** | VeChain | `UNKNOWN` | **FLAT** | **C** | 0% | `OFF` | `OFF` | n/a | 28.8:1 (LB) | 0 active (Clean) | **YES** |
| **1000SHIB**| Shiba Inu | `UNKNOWN` | **FLAT** | **C** | 0% | `OFF` | `OFF` | n/a | 19.9:1 (LB) | 0 active (Clean) | **YES** |
| **INJ** | Injective | `UNKNOWN` | **FLAT** | **C** | 0% | `OFF` | `OFF` | n/a | 16.5:1 (LB) | 0 active (Clean) | **YES** |
| **1000PEPE**| Pepe | `UNKNOWN` | **FLAT** | **C** | 0% | `OFF` | `OFF` | n/a | 8.5:1 (LB) | 0 active (Clean) | **YES** |
| **TIA** | Celestia | `UNKNOWN` | **FLAT** | **C** | 0% | `OFF` | `OFF` | n/a | >100:1 (LB) | 0 active (Clean) | **YES** |

*(Note: LB = LONG_BELOW dominant; SA = SHORT_ABOVE dominant; BAL = Balanced)*

---

## 4. Tier B: Deep Telemetry & Synthesis on Top 12 Qualifiers

### [1] AVAX — Grade A+ · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `8.216` (24h Chg: `-1.68%`)
- **Auction Value Areas**:
  - Session: VAL `8.282` | POC `8.381` | VAH `8.434`
  - Day: VAL `8.188` | POC `8.317` | VAH `8.478`
  - Month: VAL `8.231` | POC `8.575` | VAH `8.735`
- **VWAP & Bands**: Day VWAP `8.31` | +1σ `8.45` | +2σ `8.59` | -1σ `8.17` | -2σ `8.03` (Z: `-0.75σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `8.34` · EMA89 `8.39` | RSI `41.3`
  - H4: EMA13 `8.36` · EMA89 `8.52` | RSI `44.6`
  - D1: EMA13 `8.45` · EMA89 `8.79` | RSI `41.4`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$2.20M`
  - Short Liquidations (up 0–2%): `$36.2k`
  - **LSR (±2%)**: `60.72:1` (LONG_BELOW)
  - Nearest Magnets: Above `8.51` (+3.81%, str 12.5) | Below `8.12` (-0.98%, str 47.6)
- **Liquidation Magnet Gate**: **BANNED (LSR 60.7:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned; WAIT for liquidation sweep (S1).
- **Broker Spread Gate**: **NO MT5 VENUE** (`AVAXUSD` not tradeable on broker account).
- **Footprint Signals**: Bullish 22 / Bearish 45 (Total 67). Recent: EXH sell @ 8.445 (Vol), EXH buy @ 8.306 (Range), DIV sell @ 8.305 (Range).
- **M1 Plan**: Entry Zone `8.20 – 8.68` (Composite `8.41`), SL `8.73`, Targets: T1 `8.10` (0.96R), T2 `8.23` (0.55R), T3 `7.70` (2.20R). Vetoes: Clean.

---

### [2] ATOM — Grade A+ · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `1.371` (24h Chg: `-4.39%`)
- **Auction Value Areas**:
  - Session: VAL `1.379` | POC `1.390` | VAH `1.411`
  - Day: VAL `1.371` | POC `1.395` | VAH `1.406`
  - Month: VAL `1.361` | POC `1.390` | VAH `1.460`
- **VWAP & Bands**: Day VWAP `1.40` | +1σ `1.41` | +2σ `1.43` | -1σ `1.38` | -2σ `1.36` (Z: `-1.87σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `1.39` · EMA89 `1.40` | RSI `36.6`
  - H4: EMA13 `1.39` · EMA89 `1.44` | RSI `44.2`
  - D1: EMA13 `1.42` · EMA89 `1.60` | RSI `39.3`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$5.12M`
  - Short Liquidations (up 0–2%): `$75.7k`
  - **LSR (±2%)**: `67.59:1` (LONG_BELOW)
  - Nearest Magnets: Above `1.424` (+4.00%, str 16.8) | Below `1.358` (-0.83%, str 72.1)
- **Liquidation Magnet Gate**: **BANNED (LSR 67.6:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned; WAIT for liquidation sweep (S1).
- **Broker Spread Gate**: **NO MT5 VENUE** (`ATOMUSD` not tradeable on broker account).
- **Footprint Signals**: Bullish 67 / Bearish 58 (Total 125). Recent: SDIV buy @ 1.369 (Vol), DIV buy @ 1.37 (Range), ABS buy @ 1.37 (Range).
- **M1 Plan**: Entry Zone `1.38 – 1.44` (Composite `1.41`), SL `1.45`, Targets: T1 `1.37` (0.89R), T2 `1.36` (1.15R), T3 `1.27` (3.51R). Vetoes: Clean.

---

### [3] XLM — Grade A+ · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `0.14573` (24h Chg: `-1.80%`)
- **Auction Value Areas**:
  - Session: VAL `0.1471` | POC `0.1490` | VAH `0.1498`
  - Day: VAL `0.1456` | POC `0.1482` | VAH `0.1498`
  - Month: VAL `0.1411` | POC `0.1477` | VAH `0.1606`
- **VWAP & Bands**: Day VWAP `0.148` | +1σ `0.151` | +2σ `0.154` | -1σ `0.145` | -2σ `0.142` (Z: `-0.56σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `0.1474` · EMA89 `0.1473` | RSI `44.8`
  - H4: EMA13 `0.1468` · EMA89 `0.1553` | RSI `46.7`
  - D1: EMA13 `0.1532` · EMA89 `0.1781` | RSI `32.1`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$46.59M`
  - Short Liquidations (up 0–2%): `$632.9k`
  - **LSR (±2%)**: `73.62:1` (LONG_BELOW)
  - Nearest Magnets: Above `0.1513` (+3.91%, str 47.5) | Below `0.1439` (-1.23%, str 51.0)
- **Liquidation Magnet Gate**: **BANNED (LSR 73.6:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned; WAIT for liquidation sweep (S1).
- **Broker Spread Gate**: **PASS (Spread 0.1157% < 0.15%)** — MT5 executable on `XLMUSD`.
- **Footprint Signals**: Bullish 36 / Bearish 49 (Total 85). Recent: DIV buy @ 0.14616 (Vol), ABS sell @ 0.14859 (Range), SDIV buy @ 0.14606 (Range).
- **M1 Plan**: Entry Zone `0.14 – 0.15` (Composite `0.15`), SL `0.15`, Targets: T1 `0.14` (2.02R), T2 `0.14` (2.84R), T3 `0.14` (2.44R). Vetoes: Clean.

---

### [4] BTC — Grade B · Conf 88% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `68,282.90` (24h Chg: `-4.40%`)
- **Auction Value Areas**:
  - Session: VAL `68,403.79` | POC `68,862.34` | VAH `69,091.61`
  - Day: VAL `68,156.30` | POC `68,762.55` | VAH `69,436.17`
  - Month: VAL `73,001.85` | POC `75,749.65` | VAH `78,497.45`
- **VWAP & Bands**: Day VWAP `69,141.63` | +1σ `69,908.44` | +2σ `70,675.25` | -1σ `68,374.81` | -2σ `67,608.00` (Z: `-1.38σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `68,906.09` · EMA89 `71,839.10` | RSI `30.8`
  - H4: EMA13 `70,478.28` · EMA89 `75,337.74` | RSI `22.5`
  - D1: EMA13 `74,596.28` · EMA89 `77,451.52` | RSI `24.4`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$78,026.13` (per 3d aggregate grid)
  - Short Liquidations (up 0–2%): `$10,897.01`
  - **LSR (±2%)**: `6.19:1` (LONG_BELOW)
  - Nearest Magnets: Above `70,664.2` (+3.75%, str 88.6) | Below `67,606.8` (-0.74%, str 68.8)
- **Liquidation Magnet Gate**: **BANNED (LSR 6.2:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into lower magnet banned; WAIT for sweep of `67,606.8`.
- **Broker Spread Gate**: **PASS (Spread 0.0348% < 0.15%)** — MT5 executable on `BTCUSD`.
- **Footprint Signals**: Bullish 27 / Bearish 19 (Total 46). Recent: ABS sell @ 68,466.3 (Vol), ABS buy @ 68,830 (Range), DIV sell @ 68,173.1 (Range).
- **Deribit Options Surface**:
  - DVOL: `39.18` (-1.38% 24h) | Term Structure: 7d `36.66`, 30d `37.86`, 90d `39.24`
  - 25d Skew: `-4.48` (Puts heavily bid / bearish skew)
  - Max Pain Strike: `77,000` (27NOV26) / `75,000` (25DEC26)
  - Dealer GEX: `NEGATIVE_GAMMA_EXPANSION` | Zero-Gamma Flip: `73,330.80` (Spot 68,282.90 is firmly below flip; dealer hedging accelerates downward momentum).
  - Put/Call Ratio: OI `1.33` | 24h Vol `0.353`
- **Standing MT5 Order**: Ticket `#210156552` / `#210199407` Sell Limit @ `69,500.00` (SL 70,280.00, TP 67,200.00). Sits above Day VAH fading upside retest. Valid.

---

### [5] ETH — Grade B · Conf 88% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `1,926.40` (24h Chg: `-4.59%`)
- **Auction Value Areas**:
  - Session: VAL `1,921.13` | POC `1,927.21` | VAH `1,949.53`
  - Day: VAL `1,915.63` | POC `1,938.93` | VAH `1,962.24`
  - Month: VAL `2,085.87` | POC `2,234.28` | VAH `2,447.63`
- **VWAP & Bands**: Day VWAP `1,947.40` | +1σ `1,972.51` | +2σ `1,997.62` | -1σ `1,922.29` | -2σ `1,897.18` (Z: `-1.13σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `1,943.00` · EMA89 `2,024.73` | RSI `36.4`
  - H4: EMA13 `1,982.36` · EMA89 `2,169.13` | RSI `29.0`
  - D1: EMA13 `2,138.00` · EMA89 `2,318.59` | RSI `24.2`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$1.60M`
  - Short Liquidations (up 0–2%): `$45.3k`
  - **LSR (±2%)**: `35.45:1` (LONG_BELOW)
  - Nearest Magnets: Above `1,995.68` (+4.00%, str 36.5) | Below `1,894.81` (-1.26%, str 67.2)
- **Liquidation Magnet Gate**: **BANNED (LSR 35.4:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into lower magnet banned.
- **Broker Spread Gate**: **PASS (Spread 0.0285% < 0.15%)** — MT5 executable on `ETHUSD`.
- **Footprint Signals**: Bullish 25 / Bearish 21 (Total 46). Recent: ABS sell @ 1930.44 (Vol), EXH buy @ 1927.65 (Range), DIV sell @ 1920.94 (Range).
- **Deribit Options Surface**:
  - DVOL: `55.39` (-1.2% 24h) | Term Structure: 7d `50.20`, 30d `53.15`, 90d `53.46`
  - 25d Skew: `-5.30` (Extreme put skew)
  - Max Pain Strike: `2,300` (27NOV26)
  - Dealer GEX: `NEGATIVE_GAMMA_EXPANSION` (-$7.74M per 1% move) | Zero-Gamma Flip: `1,991.60` (Spot 1,926.40 is below flip; negative gamma accelerates downward movement).
  - Put/Call Ratio: OI `1.927` | 24h Vol `0.581`
- **Active MT5 Position**: Ticket `#210199486` Short 0.2 @ `1,948.29`. Peak excursion hit `1,893.39` (+54.9 pts = +1.17R). **Action: Move SL to Breakeven (1,948.29)** per §6 Breakeven Invariant.

---

### [6] XRP — Grade B · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `1.0096` (24h Chg: `-3.02%`)
- **Auction Value Areas**:
  - Session: VAL `1.0084` | POC `1.0216` | VAH `1.0256`
  - Day: VAL `1.0094` | POC `1.0228` | VAH `1.0323`
  - Month: VAL `1.0843` | POC `1.2515` | VAH `1.3410`
- **VWAP & Bands**: Day VWAP `1.02` | +1σ `1.03` | +2σ `1.04` | -1σ `1.01` | -2σ `1.00` (Z: `-1.47σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `1.020` · EMA89 `1.027` | RSI `39.0`
  - H4: EMA13 `1.026` · EMA89 `1.109` | RSI `37.2`
  - D1: EMA13 `1.117` · EMA89 `1.298` | RSI `29.2`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$20.48M`
  - Short Liquidations (up 0–2%): `$1.36M`
  - **LSR (±2%)**: `15.04:1` (LONG_BELOW)
  - Nearest Magnets: Above `1.045` (+3.76%, str 18.2) | Below `0.999` (-0.81%, str 43.1)
- **Liquidation Magnet Gate**: **BANNED (LSR 15.0:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned; WAIT for liquidation sweep (S1).
- **Broker Spread Gate**: **PASS (Spread 0.0987% < 0.15%)** — MT5 executable on `XRPUSD`.
- **Footprint Signals**: Bullish 22 / Bearish 23 (Total 45). Recent: EXH buy @ 1.011 (Vol), EXH sell @ 1.022 (Range), ABS sell @ 1.023 (Range).
- **M1 Plan**: Entry Zone `1.01 – 1.13` (Composite `1.03`), SL `1.14`, Targets: T1 `1.00` (0.28R), T2 `1.08` (0.47R), T3 `1.06` (0.28R). Vetoes: M1 R 0.28 < 1.5.

---

### [7] TRX — Grade B · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `0.3121` (24h Chg: `-1.02%`)
- **Auction Value Areas**:
  - Session: VAL `0.3104` | POC `0.3109` | VAH `0.3131`
  - Day: VAL `0.3104` | POC `0.3109` | VAH `0.3131`
  - Month: VAL `0.3015` | POC `0.3072` | VAH `0.3204`
- **VWAP & Bands**: Day VWAP `0.312` | +1σ `0.315` | +2σ `0.318` | -1σ `0.309` | -2σ `0.306` (Z: `-0.15σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `0.312` · EMA89 `0.311` | RSI `46.5`
  - H4: EMA13 `0.311` · EMA89 `0.309` | RSI `49.8`
  - D1: EMA13 `0.310` · EMA89 `0.306` | RSI `52.1`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$18.2M`
  - Short Liquidations (up 0–2%): `$13.5M`
  - **LSR (±2%)**: `1.35:1` (LONG_BELOW) — **LOWEST Skew in Crypto Universe**
  - Nearest Magnets: Above `0.3228` (+3.41%, str 93.9) | Below `0.3089` (-1.02%, str 45.5)
- **Liquidation Magnet Gate**: **OPEN (LSR 1.4:1 < 2.0:1)** — Eligible for passive front-running (S3) or pullback (M1).
- **Broker Spread Gate**: **NO MT5 VENUE** (`TRXUSD` not tradeable on broker account).
- **Footprint Signals**: Bullish 38 / Bearish 28 (Total 66). Recent: ABS sell @ 0.3132 (Vol), ABS buy @ 0.3126 (Vol), DIV buy @ 0.31237 (Vol).
- **M1 Plan**: Entry Zone `0.31 – 0.32` (Composite `0.31`), SL `0.32`, Targets: T1 `0.31` (0.39R), T2 `0.32` (0.47R), T3 `0.32` (1.12R). Vetoes: M1 R 1.12 < 1.5.

---

### [8] SOL — Grade B · Conf 88% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `78.57` (24h Chg: `-3.81%`)
- **Auction Value Areas**:
  - Session: VAL `78.84` | POC `79.94` | VAH `80.45`
  - Day: VAL `78.57` | POC `80.00` | VAH `80.91`
  - Month: VAL `85.04` | POC `89.78` | VAH `97.23`
- **VWAP & Bands**: Day VWAP `79.87` | +1σ `80.91` | +2σ `81.94` | -1σ `78.84` | -2σ `77.81` (Z: `-1.71σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `79.77` · EMA89 `82.48` | RSI `34.8`
  - H4: EMA13 `80.97` · EMA89 `89.08` | RSI `30.5`
  - D1: EMA13 `87.40` · EMA89 `97.63` | RSI `19.6`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$4.27M`
  - Short Liquidations (up 0–2%): `$262.6k`
  - **LSR (±2%)**: `16.27:1` (LONG_BELOW)
  - Nearest Magnets: Above `81.11` (+3.78%, str 40.0) | Below `77.60` (-0.71%, str 72.1)
- **Liquidation Magnet Gate**: **BANNED (LSR 16.3:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned.
- **Broker Spread Gate**: **NO MT5 VENUE** (`SOLUSD` not tradeable on broker account).
- **Footprint Signals**: Bullish 36 / Bearish 30 (Total 66). Recent: DIV buy @ 78.51 (Vol), DIV buy @ 78.63 (Range), ABS buy @ 77.9 (Range).

---

### [9] BNB — Grade B · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `630.32` (24h Chg: `-4.08%`)
- **Auction Value Areas**:
  - Day: VAL `629.16` | POC `633.44` | VAH `642.62`
  - Month: VAL `678.57` | POC `695.55` | VAH `715.08`
- **VWAP & Bands**: Day VWAP `637.29` | +1σ `644.73` | +2σ `652.17` | -1σ `629.85` | -2σ `622.41` (Z: `-1.15σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `636.21` · EMA89 `661.08` | RSI `36.1`
  - H4: EMA13 `648.98` · EMA89 `689.53` | RSI `28.2`
  - D1: EMA13 `683.28` · EMA89 `706.29` | RSI `27.0`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$159.4k`
  - Short Liquidations (up 0–2%): `$12.6k`
  - **LSR (±2%)**: `12.63:1` (LONG_BELOW)
  - Nearest Magnets: Above `652.02` (+3.70%, str 24.9) | Below `619.55` (-1.47%, str 30.1)
- **Liquidation Magnet Gate**: **BANNED (LSR 12.6:1 ≥ 2.5:1 LONG_BELOW)** — Passive limit orders into magnet banned.
- **Broker Spread Gate**: **NO MT5 VENUE** (`BNBUSD` not tradeable on broker account).

---

### [10] SUI — Grade B · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `0.7908` (24h Chg: `-1.80%`)
- **Auction Value Areas**:
  - Day: VAL `0.7839` | POC `0.8022` | VAH `0.8184`
  - Month: VAL `0.7985` | POC `0.8692` | VAH `0.8901`
- **VWAP & Bands**: Day VWAP `0.802` | +1σ `0.816` | +2σ `0.830` | -1σ `0.788` | -2σ `0.774` (Z: `-0.58σ`)
- **HTF Trend EMAs & RSI**:
  - H1: EMA13 `0.802` · EMA89 `0.815` | RSI `41.8`
  - H4: EMA13 `0.806` · EMA89 `0.861` | RSI `40.5`
  - D1: EMA13 `0.848` · EMA89 `0.907` | RSI `34.6`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$2.36M`
  - Short Liquidations (up 0–2%): `$58.4k`
  - **LSR (±2%)**: `40.33:1` (LONG_BELOW)
  - Nearest Magnets: Above `0.820` (+3.89%, str 28.4) | Below `0.7796` (-1.22%, str 34.5)
- **Liquidation Magnet Gate**: **BANNED (LSR 40.3:1 ≥ 2.5:1 LONG_BELOW)**.
- **Broker Spread Gate**: **NO MT5 VENUE** (`SUIUSD` not tradeable on broker account).

---

### [11] ADA — Grade B · Conf 92% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `0.1678` (24h Chg: `-3.73%`)
- **Auction Value Areas**: Day VAL `0.1678` | POC `0.1716` | VAH `0.1725`
- **VWAP & Bands**: Day VWAP `0.171` | Z: `-1.92σ`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$258.26M`
  - Short Liquidations (up 0–2%): `$3.24M`
  - **LSR (±2%)**: `79.62:1` (LONG_BELOW)
- **Liquidation Magnet Gate**: **BANNED (LSR 79.6:1 ≥ 2.5:1 LONG_BELOW)**.
- **Broker Spread Gate**: **FAIL (Spread 2.2512% ≥ 0.15%)** — High broker spread disqualifies order execution.

---

### [12] DOGE — Grade B · Conf 88% · SHORT (Regime: `TREND_DOWN`)
- **Market Price**: `0.06439` (24h Chg: `-3.14%`)
- **Auction Value Areas**: Day VAL `0.06358` | POC `0.06470` | VAH `0.06564`
- **VWAP & Bands**: Day VWAP `0.0648` | Z: `-0.86σ`
- **±2% Liquidation Telemetry**:
  - Long Liquidations (down 0–2%): `$841.82M`
  - Short Liquidations (up 0–2%): `$10.47M`
  - **LSR (±2%)**: `80.41:1` (LONG_BELOW)
- **Liquidation Magnet Gate**: **BANNED (LSR 80.4:1 ≥ 2.5:1 LONG_BELOW)**.
- **Broker Spread Gate**: **FAIL (Spread 1.3921% ≥ 0.15%)** — High broker spread disqualifies order execution.
