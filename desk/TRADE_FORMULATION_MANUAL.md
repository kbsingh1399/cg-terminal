# CANONICAL TRADE FORMULATION MANUAL (SOP)
**CG Order-Flow Terminal & Trade Desk Protocol**  
*Document Version: 1.0.0 — Canonical Specification*  
*Reference Source: `C:\Users\SIGMA\Downloads\Trade-Formulation-Playbook (1).pdf` (10 Nov 2026)*  
*Operating Roles: atg-exec (Local Execution & Risk Gate) · zai-desk (Remote Analysis Brain) · Human (Capital & Config Authority)*

---

## 1. The Core Philosophy: Critical Realism
In financial markets—and perpetual futures in particular—prices are not moved by subjective chart patterns or isolated indicators. Prices are driven by **generative microstructure mechanisms**:
1. **Liquidity is Fuel**: The market's primary directive is to seek liquidity pools where large orders can fill. Dense clusters of stop-losses and liquidations act as magnets.
2. **Order Flow Reality**: Passive limit orders (book walls) absorb flow; aggressive market orders (taker volume) drive price through depth.
3. **Multi-Scenario Discipline**: Every trade must consider both the absorption case and the liquidity sweep case. Never commit dogmatically to a single narrative.

---

## 2. The 6-Step DECIDE Framework
Every trade proposed by `zai-desk` or executed by `atg-exec` must strictly follow the **DECIDE** framework:

1. **D — Direction (Bias)**: Establish macro and intraday bias via the 2-of-3 confluence rule:
   * Signal direction (Footprint absorption/divergence)
   * Trend alignment (H4/D1 EMA 13 × 89 trend)
   * Auction regime (Price position relative to Day VWAP)
2. **E — Entry Zone**:
   * Passive limit orders at structural anchors: Day VWAP ±1σ, Day/Session POC, or post-sweep exhaustion wicks.
   * Front-running confirmed whale walls by 0.05%–0.1% **only if** the Liquidation Magnet Gate passes.
3. **C — Confluence Scoring**:
   * Score the setup against Table 7 (11.5 points max). Minimum score of **5.0 points** required to trade.
4. **I — Invalidation (Stop Loss)**:
   * Data-driven structural invalidation only: beyond the sweep wick, beyond Day VWAP ±2σ/±3σ, or behind an uncompromised whale wall + 0.5 ATR buffer. Never arbitrary pips.
5. **D — Drive (Targets & Scale-Out)**:
   * **40% @ T1**: Nearest Value Area edge (Day VAH for longs, Day VAL for shorts).
   * **40% @ T2**: High-volume node (Month POC / Session POC).
   * **20% Runner @ T3**: Major liquidation pool or opposite whale barrier. Minimum expected R:R ≥ 1.5R.
6. **E — Execution & Risk Management**:
   * Calculate exact lot size based on structural stop distance: 0.5% risk (Grade B) or 1.0% risk (Grade A).
   * Enforce broker spread gate and portfolio heat limits.

---

## 3. The 16 Telemetry Data Dimensions

Every trade audit must explicitly examine and log all 16 dimensions from the terminal:

### Dimension 1: Live Spot & Broker Basis Offset (`basisPct`)
* **Endpoint**: `/api/cg/market` & `desk/mt5.json`
* **Metric**: Percentage difference between MT5 Cash CFD quote and terminal USDT-M perp quote:
  $$\text{basisPct} = \frac{\text{Price}_{\text{MT5}} - \text{Price}_{\text{Perp}}}{\text{Price}_{\text{Perp}}} \times 100$$
* **Rule**: Always calibrate perp levels by `basisPct` before sending MT5 orders. Ensure limit sell orders are placed strictly ABOVE live MT5 ask price.

### Dimension 2: Auction Market Profile (VAL, POC, VAH)
* **Endpoint**: `/api/cg/market`
* **Levels**: Session (8h), Day (UTC 00:00 anchor), and Month Value Area Low (VAL), Point of Control (POC), and Value Area High (VAH).
* **Rule**: POC represents high-volume acceptance. Fade Value Area extremes back to POC (Setup S2); target VAL/VAH on trend continuations.

### Dimension 3: Day-Anchored VWAP & Standard Deviation Bands
* **Endpoint**: `/api/cg/market` (Bands: ±1σ, ±2σ, ±3σ)
* **Regime**: Above VWAP = Premium (bullish bias); Below VWAP = Discount (bearish bias).
* **Rule**: Mean-reversion fades trigger at ±2σ and ±3σ extremes (Setup S5). Trend continuation pullbacks enter at VWAP or ±1σ.

### Dimension 4: Trend Momentum Alignment (Fib-Prime EMAs)
* **Endpoint**: `/api/cg/market` (EMA 13 / 89 / 233 across M15, H1, H4, D1)
* **Rule**: H4 EMA13 > EMA89 = Bullish trend; EMA13 < EMA89 = Bearish trend. Full trend alignment awards maximum confluence points.

### Dimension 5: Multi-Timeframe RSI(14) Divergence
* **Endpoint**: `/api/cg/market`
* **Rule**: H1/H4 RSI > 70 or < 30 warns of exhaustion. Regular divergence between price swing and RSI swing confirms reversal setups.

### Dimension 6: Footprint Delta & Volume Clusters
* **Endpoint**: `/api/cg/fp`
* **Metrics**: Per-bar taker buy volume vs taker sell volume, bar delta, bar POC.
* **Rule**: High volume with small price progress indicates absorption. Delta surges at highs/lows indicate aggressive market participation.

### Dimension 7: Footprint Discrete Signal Patterns
* **Endpoint**: `/api/cg/signals`
* **Signals**: Absorption, Divergence, Strong Divergence, Trap, Exhaustion.
* **Rule**: Footprint signals must confirm the entry zone. A Sell Divergence inside an ask resistance zone awards 2.0 confluence points.

### Dimension 8: Cumulative Volume Delta (CVD)
* **Endpoint**: `/api/cg/cvd`
* **Metrics**: Perp CVD vs Spot CVD, taker buy share (%), active CVD divergences.
* **Rule**: Price making higher highs while Perp CVD makes lower highs indicates aggressive absorption (exhaustion). Confirm spot and perp alignment.

### Dimension 9: Multi-Exchange BookWalls
* **Endpoint**: `/api/cg/bookwalls`
* **Metrics**: Aggregate bid/ask depth within ±5%, depth imbalance (now vs 5m ago), confirmed resting wall list (USD value, age in hours, touched status).
* **Rule**: Walls ≥ $10M resting for > 2 hours act as strong barriers. Touched walls that hold confirm defense; pulled walls warn of breakouts.

### Dimension 10: LTO Large Resting Orders
* **Endpoint**: `/api/cg/lto`
* **Metrics**: Individual institutional limit orders ≥ $100k across Aster, Binance, Bybit, OKX, and Hyperliquid.
* **Rule**: Identify institutional resting clusters to position limit orders 0.05% in front for queue priority.

### Dimension 11: Liquidation Heatmap Clusters
* **Endpoint**: `/api/cg/liqlevels`
* **Metrics**: Multi-venue estimated liquidation pools (3d, 7d, 30d rolling windows ±4%).
* **Rule**: Liquidation clusters are sweep magnets. Take profit INTO liquidation clusters; never hold through them.

### Dimension 12: THE LIQUIDATION MAGNET GATE (LSR) — Mandatory Veto
* **Metric**: Liquidation Skew Ratio within ±2.0% of price:
  $$\text{LSR} = \frac{\text{Short Liquidations Above}}{\text{Long Liquidations Below}}$$
* **The VETO Rule**:
  * **If LSR ≥ 2.5:1** (short liquidations heavily dominate above): **BAN ALL PASSIVE SHORT ENTRIES (Setup S3 / S2)** inside or in front of the cluster. The whale wall is a dam about to burst.
  * **Action**: Switch strictly to **Setup S1 (Liquidation Sweep Reversal)**. Wait for the sweep to clear the stops, wait for taker CVD delta to flip negative, and enter on the 15m exhaustion close.

### Dimension 13: Options Open Interest & Gamma Exposure (GEX)
* **Endpoint**: `/api/cg/options`
* **Regimes**:
  * Positive Gamma: Market makers sell rallies and buy dips (volatility dampening / mean reversion).
  * Negative Gamma: Market makers sell dips and buy rallies (volatility expansion / trend acceleration).
* **Level**: Gamma Flip point marks the structural boundary between regimes.

### Dimension 14: Open Interest (OI) Dynamics
* **Endpoint**: `/api/cg/oi`
* **Rule**:
  * Rising Price + Rising OI = True institutional accumulation (Bullish).
  * Rising Price + Falling OI = Short liquidation squeeze / short covering (Bearish exhaustion once fuel runs out).
  * Falling Price + Falling OI = Long liquidation cascade.

### Dimension 15: Broker Spread & Liquidity Drag Gate
* **Source**: `desk/mt5.json`
* **The Hard VETO**:
  1. Broker Spread Pct must be **< 0.15%**.
  2. Broker spread must consume **< 20% of planned stop-loss distance**:
     $$\frac{\text{Spread}}{\text{Stop Distance}} < 0.20$$
  * *Disqualified Assets on FundedNext*: ADA (2.2%), DOGE (1.38%), LTC (2.31%), LINK (0.55%).
  * *Qualified Assets*: BTC, ETH, XAU, XLM, XRP, USO, XAG.

### Dimension 16: Risk & Execution Invariants
* **Max Portfolio Heat**: ≤ 1.0% total equity risk across all open trades ($46.30 on $4,630 equity).
* **Correlation Limit**: Max 2 concurrent crypto positions in the same direction. Slot 3 is reserved exclusively for non-crypto macro commodities (XAU, XAG, USO).
* **The +1.0R Breakeven Invariant**: Move Stop Loss to Entry immediately upon reaching ≥ +1.0R excursion. Tail risk must be eliminated to 0.00%.
* **8-Bar (2-Hour) Time Stop**: If price fails to reach +0.5R within 8 15-minute bars, close or tighten stop to breakeven.
* **40/40/20 Liquidity Scale-Out**: 40% @ T1 (VAH/VAL), 40% @ T2 (POC), 20% Runner @ T3 (Liquidation sweep).

---

## 4. The 8 Standardized Playbook Setups (S1 to S8)

| Code | Setup Name | Best Regime | Entry Trigger | Stop Invalidation | Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S1** | **Liquidation Sweep Reversal** | Over-extended / high LSR | 15m close back inside value after upper/lower stops wiped + delta flip | Beyond the sweep wick high/low | Opposite Day VAL/VAH & POC |
| **S2** | **Value Area Edge Fade** | Range Balance / High Gamma | Touch of Day VAH (short) or Day VAL (long) with footprint divergence | Beyond Day VWAP ±2σ band | Day POC (mean reversion) |
| **S3** | **Whale Wall Defense / Front-Run** | Trend Pullback (LSR < 2.0) | 0.05%–0.1% in front of confirmed resting wall ≥ $10M (age > 2h) | Behind the whale wall + 0.5 ATR buffer | Next major opposing wall / POC |
| **S4** | **Wall-Pull Breakout** | Momentum Expansion | Breakout candle through previously pulled wall with rising OI | Retest of broken level | +2σ or +3σ VWAP band |
| **S5** | **VWAP Band Mean Reversion** | Extreme Extension | Touch of Day VWAP ±3σ band with RSI divergence | 0.5 ATR beyond ±3σ band | Day VWAP mean |
| **S6** | **Trapped Traders Fade** | False Breakout | High volume cluster at extreme with failed price progress | Beyond trapped volume candle wick | POC / Value Area midline |
| **S7** | **High-Volume Absorption Continuation**| Strong Trend (M1) | Retest of absorbed high-volume node in trend direction | Other side of absorption bar | Same-direction liquidation pool |
| **S8** | **Liquidation Breakout Continuation** | Negative Gamma Expansion | Clean 15m close beyond major liquidation shelf with rising volume | Inside edge of the broken shelf | Next liquidity pocket |

---

## 5. Table 7: The 11.5-Point Confluence Scoring Table

| Telemetry Element | Scoring Condition | Max Points |
| :--- | :--- | :--- |
| **Directional Trend** | H4 & D1 EMA 13 × 89 alignment in trade direction | **2.0** |
| **Auction / VWAP Regime** | Long in Discount (below VWAP) / Short in Premium (above VWAP) | **1.5** |
| **Footprint Signal** | Strong Divergence or Absorption signal at the entry zone | **2.0** |
| **Whale Wall Backstop** | Entry protected by confirmed resting wall ≥ $5M (age > 1h) | **1.5** |
| **CVD Divergence** | Cumulative Volume Delta diverging from price swing | **1.0** |
| **Liquidation Magnet Gate** | Liquidation skew favors trade direction (LSR aligned) | **1.5** |
| **Options GEX Context** | Gamma regime confirms setup type (Positive for S2/S5; Negative for S1/S8) | **1.0** |
| **Broker Spread Drag** | Spread < 0.05% (1.0 pt) / Spread 0.05%–0.10% (0.5 pts) | **1.0** |
| **TOTAL MAXIMUM SCORE** | — | **11.5** |

### Confluence Decision Gates:
* **Grade A ($\ge 7.0$ points)**: Full Unit Risk (**1.0% equity risk**). Premium setup.
* **Grade B ($5.0 - 6.5$ points)**: Half Unit Risk (**0.5% equity risk**). Standard setup.
* **$< 5.0$ points**: **HARD VETO (NO TRADE)**. Tape is noisy; preserve capital.

---

## 6. Execution Lifecycle & Invariant Rules
1. **Never Trade Market Orders**: All entries are passive limit orders at structural levels.
2. **Never Move Stops Further Away**: Stops are fixed at placement and may only be tightened or trailed.
3. **Breakeven Invariant**: When price reaches +1.0R, immediately move SL to Breakeven (0.00% risk).
4. **Time Stop**: If after 8 bars (2 hours) price has not achieved +0.5R, evaluate closing or tightening stop.
5. **Git Auditability**: Every placement, fill, stop adjustment, and closed trade must be written to `desk/state.json`, logged in `desk/log.md`, and committed to `origin/main`.
