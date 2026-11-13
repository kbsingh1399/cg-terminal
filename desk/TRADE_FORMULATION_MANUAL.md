<<<<<<< HEAD
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
=======
# TRADE FORMULATION MANUAL — Canonical Standard Operating Procedure

**Version 1.0 · 2026-11-13 · zai-desk**
**Grounded strictly in `Trade-Formulation-Playbook (1).pdf` (10 Nov 2026 canonical specification).**
**Status: BINDING. Both zai-desk (analysis brain) and atg-exec (execution brain) must follow this manual for every round and every trade formulation. Conflicts between older documents (AGENTS.md, desk/PROTOCOL.md) and this manual resolve in favor of THIS manual.**

---

## 0. Purpose and Authority

This document is the permanent, canonical SOP for formulating, scoring, sizing, executing, and managing trades on this desk. It formalizes:

- the **6-step DECIDE framework** (the formulation sequence),
- all **16 telemetry dimensions** available in the terminal (the data contract),
- the **8 standardized playbook setups S1–S8** (the only permitted trade archetypes),
- the **11.5-point Confluence Scoring Table (Table 7)** (the grade + risk gate),
- the **Liquidation Magnet Gate (LSR)** (the structural veto),
- the **risk & position-management invariants** (non-negotiable),
- the **execution protocol** (basis translation, spread gate, ladders),
- the **wake & cadence protocol** (how Antigravity is woken locally to run analysis).

**Prime directive: NO TRADE without a completed DECIDE pass, a Table 7 score ≥ 5.0, and zero active hard vetoes.** A missed data feed is scored 0 and disclosed — never guessed.

---

## 1. The 6-Step DECIDE Framework

Every formulation — whether it ends in an order or in NO-TRADE — walks these six steps in order. No skipping, no reordering.

| Step | Question | Resolved by |
|---|---|---|
| **D — Direction** | Long, short, or stand aside? Which regime are we in? | §D3 VWAP regime, §D4 EMA stack, §D12 LSR, §D13 GEX, §D14 OI |
| **E — Entry zone** | Where exactly does the market pay us to take risk? | §D2 Market Profile, §D3 VWAP bands, §D9/D10 walls & LTOs, EMA pocket |
| **C — Confluence score** | How many independent dimensions agree? | **Table 7 (§5)** — 11.5-point scoring |
| **I — Invalidation** | Where is the thesis structurally dead? | Beyond ±2σ/±3σ band, sweep wick, absorption zone edge, magnet cluster |
| **D — Drive / Target** | What magnet is price being pulled toward? | §D11 liquidation clusters, Day VAH/VAL, Month POC, walls |
| **E — Execution** | How do we place it without giving the edge away? | §7 Execution protocol (basis, spread gate, ladder, sizing) |

The output of DECIDE is a **Formulation Card** (see §9.2) with every field populated from a live tool/API response in that session.

---

## 2. The 16 Telemetry Dimensions — the Data Contract

Each dimension below is mandatory reading before any formulation. "Source" is the terminal endpoint. "n/a" handling: a dimension whose feed is down contributes **0 points** in Table 7, its checklist row reads `n/a`, and confidence caps apply — the desk never invents a value.

---

### D1 — Live Spot & MT5 Broker Basis (`basisPct`)

- **Source:** `desk/mt5.json` → `spreads.<SYMBOL>.basisPct` (daemon-computed: MT5 mid vs terminal USDT-M perp mid), `spreadPct`.
- **Definition:** The percentage offset between the MT5 Cash CFD price and the perp price the terminal's levels are built on.
- **Thresholds:** `|basisPct| ≤ 0.5%` = normal, translate levels. `|basisPct| > 0.5%` = flag in `log.md`, widen stop or skip.
- **Role:** Execution translation ONLY — every terminal level must be converted before MT5 placement: `mt5Level = perpLevel × (1 + basisPct/100)`. Basis NEVER changes direction or scoring; it changes prices.

### D2 — Auction Market Profile (VAL / POC / VAH)

- **Source:** `/api/cg/narrative` → `market.auction.{session,day,month}` → `{poc, vah, val}`.
- **Definition:** Volume-profile value areas and point-of-control at three horizons: rolling 8h session, UTC day, UTC month.
- **Usage rules:**
  - **Entries** are earned at value edges and POCs — mid-value entries score 0 in Table 7 row 2.
  - **T1** = Day VAH (long) / Day VAL (short) — the first liquidity take.
  - **T2** = Month POC — the fair-value magnet.
  - Outside month VA in a balance regime = mean-reversion candidate (S4/S6).

### D3 — Day-Anchored VWAP Regime & Bands (±1σ / ±2σ / ±3σ)

- **Source:** `/api/cg/narrative` → `market.vwap.{vwap, bands.sd1..sd3}`, z = `(price − VWAP)/sd1`.
- **Regime read:** price above/below 0σ defines intraday control; z is the stretch meter.
- **Thresholds:**
  - `|z| ≤ 0.5` — balanced; pullback entries preferred (S2, S6).
  - `|z| ≥ 2.0` — stretched; chase BANNED for continuation, fade setup eligible (S1, S4).
  - `|z| ≥ 2.2` — peak conviction band for reversion.
  - `|z| ≥ 3.0` or beyond ±3σ — flush zone; only S1 after a confirmed sweep.
- **Entry/stop anchors:** pullback entry at trend-side −1σ (long) / +1σ (short); structural stop beyond ±2σ; reversion stop beyond ±3σ.

### D4 — Trend Momentum Alignment (Fib-prime EMA 13/89/233, M15–D1)

- **Source:** `/api/cg/narrative` → `market.ema.{m15,h1,h4,d1}.{e13,e89,e233}`.
- **Stack states:** `up` (13>89>233), `down` (13<89<233), `tangled`.
- **Alignment standard (3-TF):** H4 13×89 in trade direction (mandatory) + H1 structure aligned + M15 bar holding the EMA89 side. 2-of-3 with H4 non-false = aligned; anything less caps the grade at B (§5).
- **Regime:** H4+D1 stacked same direction + EMA13−89 spread > 0.5 ATR + price on correct VWAP side = TREND. Both stacks tangled + ATR percentile < 20 = COMPRESSION (S5 watch). 

### D5 — Multi-Timeframe RSI(14) Divergence

- **Source:** `/api/cg/narrative` → `market.rsi.{m15,h1,h4}` + price pivots.
- **Usage:**
  - Divergence (price higher-high / RSI lower-high, or inverse) across **two or more** timeframes = Table 7 row 11 (+0.5) and is a prerequisite evidence type for S1/S4/S8 reversals.
  - Single-TF divergence = context only, 0 points.
  - Extremes: H1 RSI > 72 / < 28 count as crowding evidence for S4.

### D6 — Footprint Delta & Volume Clusters

- **Source:** `/api/cg/fp` (footprint bars) → per-bar taker buy USD / taker sell USD, delta %, bar POC.
- **Usage:**
  - **Bar delta %** at the entry zone: strongly negative delta at a low that price refuses to break = absorption evidence (feeds D7).
  - **Bar POC** migration: POC migrating toward the day's edge = conviction; POC pinned mid = balance.
  - Dead-volume zone (10-bar volume extreme low) at an extreme = exhaustion precondition (S1).

### D7 — Footprint Discrete Signals (Absorption / Divergence / Strong Divergence / Trap / Exhaustion)

- **Source:** `/api/cg/signals` + `/api/cg/narrative` checklist (parity-preserving Coinglass-aggregated set).
- **Definitions (terminal-canonical):**
  - **Absorption (`abs`)** — aggressive flow into a level absorbed by passive resting orders; reversal/continuation defense evidence.
  - **Divergence (`div`)** — delta divergence between venues or vs price at one bar scale.
  - **Strong Divergence (`sdiv`)** — multi-bar delta/price divergence.
  - **Trap (`trap`)** — a breakout that immediately reverses; stop-hunt signature (S8 core).
  - **Exhaustion (`exh`)** — 10-bar volume extreme (dead zone) + close in opposite half at an extreme.
- **Rule:** the trigger signal must print **at or inside the entry zone** (8h recency window). Signals elsewhere are context, not triggers. A/A+ grades for S2 require `abs` in-zone or a live CVD divergence (D8).

### D8 — Cumulative Volume Delta (CVD)

- **Source:** `/api/cg/cvd` → perp CVD, spot CVD, taker buy share, active divergences; `/api/cg/quant` → Coinbase premium (bps).
- **Usage:**
  - Trend trades (S2): 24h CVD sign must agree with direction (bias gate vote).
  - Reversals (S1/S4): active CVD divergence in the fade direction is reversal proof; perp-vs-spot CVD split (spot leading perp) is the strongest form.
  - Taker buy share ≥ 55% (long) / ≤ 45% (short) at the zone = confirmation (+Table 7 row 4).
  - Accelerating trend + CVD with trend + Coinbase premium with trend + zero exhaustion = S4 hard veto (never fade that).

### D9 — Multi-Exchange BookWalls

- **Source:** `/api/cg/bookwalls` — depth ±5%, bid/ask imbalance (now + 5m delta), confirmed resting walls (USD value, age, touched state), add/fill/pull events. Exact Coinglass LiquidityHeatmap wall-scanner port (±3% scan, confirm on consecutive scans, fill vs pull classification).
- **Usage:**
  - **Defending wall** (≥ $1M on the entry side within 1% of the zone, untouched, aging) = liquidity defense (+Table 7 row 6; S3 anchor; tightens stops).
  - **Blocking wall** (≥ $1M opposing, sitting in the profit path before T1) = hard veto.
  - Opposing whale wall ≥ $5M within 1.5R into the profit path = hard veto.
  - Walls are **estimates** — any level anchored to a wall must say so in `rationale`.

### D10 — LTO Large Resting Orders (institutional, ≥ $100k)

- **Source:** `/api/cg/lto` — individual large taker/limit orders ≥ $100k (default `minVolUsd=100000`), futures + spot, per-exchange.
- **Usage:** an institutional limit resting at/near the entry zone corroborates the wall thesis (D9) and scores with it in Table 7 row 6 (wall **or** LTO satisfies the row; both = stronger rationale, still 1.0 point — no double counting). LTOs appearing on the OPPOSITE side of a planned S3 front-run = downgrade one grade.

### D11 — Liquidation Heatmap Clusters (the magnets)

- **Source:** `/api/cg/liqlevels?range=3d|7d|30d` — multi-venue estimated liquidation clusters ±4% (`lvR` default 4), strength 0–100, USD size, venue count; `/api/cg/stopmap` — 24h rolling heatmap (BTC direct; other perps via the rolling multi-venue model).
- **Usage:**
  - **Targets:** T1/T2/T3 take profit INTO clusters (strength ≥ 40 or ≥ $5M preferred); never hold through a magnet.
  - **Sweep detection (S1 trigger):** price trades through a major cluster (str ≥ 50 or ≥ $5M) within 0.5%.
  - **Hazard veto:** opposite-side magnet (str ≥ 50) within 1.2R of entry = NO TRADE, wait for the sweep.
  - Clusters are Coinglass **estimates** — always disclosed in `rationale`.

### D12 — THE LIQUIDATION MAGNET GATE (LSR) — structural veto

- **Source:** liquidation cluster USD totals above vs below live price (D11: `totals.shorts` above / `totals.longs` below; stopmap bands).
- **Rule:** compute the **Liquidation Skew Ratio**: `LSR = USD of short-liq stops above price ÷ USD of long-liq stops below price` (invert if < 1; always express as the dominant side).
- **The Gate:**
  - **LSR ≥ 2.5:1** (e.g., short stops heavily dominate above) → the magnet will likely be RUN. **BAN passive wall front-running (S3) entirely** — a resting bid under a 2.5:1 magnet is fuel, not support. **WAIT for the sweep and take S1** at exhaustion, or S2 continuation after the sweep clears.
  - **LSR < 2.5:1** → S3 permitted at reduced size (max Grade B risk 0.5%) and only with an untouched aging wall (D9) + absorption in-zone (D7).
- **The Gate outranks every other confluence.** A 9-point setup of the banned archetype is still NO TRADE.

### D13 — Options Open Interest & Gamma Exposure (GEX) — BTC/ETH

- **Source:** `/api/cg/options?sym=BTC|ETH` — Deribit DVOL, term structure, 25Δ risk reversal, max pain, top OI walls, dealer net gamma (GEX) regime, **Gamma Flip level**.
- **Regime read:**
  - **Positive GEX (pin/dampening):** dealer hedging suppresses range → favors reversion setups (S4/S6), fade extremes toward VWAP/max-pain; breakouts lose conviction (S5 downgraded).
  - **Negative GEX (expansion):** dealer hedging amplifies moves → favors momentum/continuation (S2 through levels), reversion setups downgraded; expect magnet runs (feeds D12).
  - **Gamma Flip level:** price crossing it flips the regime — treat as a structural event line; entries within 0.5 ATR of the flip get one-grade haircut.
- **n/a for non-BTC/ETH** (row 8 scores 0, no penalty beyond the points).

### D14 — Open Interest (OI) Dynamics

- **Source:** `/api/cg/quant` → OI×price quadrant (1h/4h), OI Δ% (1h/4h/24h); `desk/positioning.json`.
- **Quadrant read:**
  - **Rising OI + trend move** = new positions funding the trend — continuation healthy (S2, S5 breakout confirmation).
  - **Falling OI at range extreme** = liquidation covering / short-covering spike — fuel exhausted, reversion candidate (S1, S4).
  - **Rising OI + flat price** = loading coil (S5 precondition).
  - Entering LONG on a LONG_LIQUIDATION quadrant (or SHORT on SHORT_COVERING) = distribution trap flag, one-grade haircut.

### D15 — Broker Spread & Liquidity Drag Gate

- **Source:** `desk/mt5.json` → `spreads.<SYMBOL>.spreadPct` (live, verified; stale > 20 min = gate off, honest n/a).
- **Canonical rule (the mandate):**
  - **PASS:** `spreadPct < 0.15%` **AND** `spreadPct < 20% of stop distance` (`stopDistPct = |entry − stop|/entry`).
  - **20–25% drag or 0.15–0.25% spread:** Grade C — trade only at reduced conviction/size (half the graded risk).
  - **> 25% drag or > 0.25% spread:** **SKIP** — the edge pays the spread, not you.
  - **Terminal enforcement parity:** `spreadDragVerdict()` fires C at ratio > 0.12 and SKIP at > 0.25; the manual's 20% line sits inside the C band — treat 12–20% as "pass with hair-cut confidence."
- **Side padding:** SHORT fills at bid, SL triggers on ask — pad every tight level by the spread before placement.

### D16 — Risk & Position Management Invariants (non-negotiable)

These are HARD rules — no score, no debate, no override by either agent (config changes are human-only via `desk/state.json` → `CONFIG?` log entry):

1. **Equity heat per trade:** Grade A/A+ → **1.0%** of account equity; Grade B → **0.5%**. (On the current ~$4.6K account: $23–$46 risk per trade. Recompute from live equity every sizing.)
2. **Total portfolio heat ≤ 1.0%** across all open positions at any time.
3. **Max 2 concurrent crypto positions** (BTC/ETH/SOL/alt perps — they correlate). **Slot 3 is reserved for macro diversification** (XAU/XAG/USO/indices) and may only be used when crypto slots are not additive to the same directional risk.
4. **The +1.0R Breakeven Invariant:** the moment a position's open excursion reaches **≥ +1.0R**, move SL to entry (breakeven) — immediately, not on the next round. Non-discretionary. (Terminal verdict `MOVE_STOP_TO_BREAKEVEN`.)
5. **The 8-Bar Time Stop (2 hours on M15):** if price has NOT reached **+0.5R** within 8 bars of fill, tighten the stop to structure or close. Time is risk.
6. **40/40/20 Liquidity Scale-Out:** 40% at **T1 = Day VAH/VAL** · 40% at **T2 = Month POC** · 20% **Runner to T3 = liquidation sweep magnet**. Never hold the runner through an unswept magnet.
7. **Minimum R:** no formulation below **2.0R to T1** (user mandate: minimum 1:2, prefer more). M2-class reversion setups may use 1.2R to T1 only when the 0σ VWAP target pays ≥ 1.5R.
8. **Order lifecycle:** suggested → placed → filled → closed, with expiry and re-debate every round per `desk/PROTOCOL.md`.

---

## 3. The 8 Standardized Playbook Setups (S1–S8)

These are the ONLY permitted trade archetypes. Each card lists: thesis, mandatory conditions (ALL required unless marked "any-of"), entry, stop, targets, grade caps, and vetoes. Any valid opportunity that does not fit a card is NO TRADE.

---

### S1 — Liquidity Sweep → Exhaustion Reversal *(the sweep trade; D12's chosen setup)*

- **Thesis:** a dominant liquidation magnet (D12) gets run; trapped positions are force-closed; the move exhausts and snaps back. We buy/sell the completed sweep, never the approach.
- **Mandatory conditions:**
  1. Major magnet swept: price traded through a cluster str ≥ 50 or ≥ $5M (D11), within the last ~8 bars.
  2. **Exhaustion pinbar** printed at the sweep extreme (D7 `exh`: 10-bar volume extreme + close in opposite half).
  3. **Delta flip:** live CVD divergence in the fade direction (D8) or `div`/`sdiv` signal (D7).
  4. Stretch context: |z| ≥ 2σ from Day VWAP (D3) or outside month VA (D2).
- **Entry:** confirmation bar close (the bar after the pinbar), or limit at 50% retrace of the sweep wick.
- **Stop:** 0.3–0.5 ATR beyond the sweep wick extreme, or beyond ±3σ — whichever is tighter but outside noise.
- **Targets (40/40/20):** T1 Day POC / session POC → T2 0σ VWAP → T3 opposite-side value edge or opposing cluster.
- **Grade cap:** A+ available (this is the highest-quality archetype when D12 skew is extreme). 
- **Vetoes:** accelerating trend + CVD with trend + Coinbase premium with trend + zero exhaustion = never fade (hard veto).

### S2 — Trend Pullback Continuation *(terminal M1)*

- **Thesis:** established trend (H4+D1 stack, D4) pauses into a confluence magnet; order flow confirms the trend side; continuation resumes.
- **Mandatory conditions:**
  1. Regime TREND_UP/TREND_DOWN: H4 stack in direction, EMA13−89 spread > 0.5 ATR, price on the correct VWAP side (D3/D4).
  2. Bias gate 2-of-3: H4/D1 stack ✓, VWAP side ✓, 24h CVD sign ✓ (D8).
  3. **Not stretched:** |z| < 2.0 (chase guard). If stretched → downgrade to WAIT_PULLBACK with a working limit at the trend-side band.
  4. Trigger at the zone: footprint proof (D7 abs/trap/sdiv) OR wall+CVD+non-distribution quadrant confluence.
- **Entry zone:** confluence of Day VWAP 0σ/+1σ (trend side), Day POC, EMA13/89 pocket (H1), PDH/PDL flip. **3-tier limit ladder:** 40% at POC · 40% at trend-side −1σ · 20% at the absorption low/high. Risk measured from the composite fill.
- **Stop:** beyond the signal zone / ±2σ / zone edge + 0.25 ATR geometry guard.
- **Targets:** T1 Day VAH/VAL or ±1.5σ → T2 same-direction liq cluster / month VA edge → T3 whale wall or PWH/PWL.
- **Grade cap:** A/A+ requires **3-TF alignment (D4) AND absorption/CVD-div at the zone** — otherwise capped at B regardless of score.

### S3 — Passive Wall Front-Run *(BANNED under the Magnet Gate)*

- **Thesis:** a large resting wall (D9) / institutional LTO (D10) defends a level before price arrives; we join the passive side with a limit and get filled as aggressive flow hits the wall.
- **Mandatory conditions:**
  1. **LSR < 2.5:1 (D12) — else BANNED.**
  2. Confirmed resting wall ≥ $1M (untouched, aging, consecutive-scan confirmed) or LTO ≥ $100k on the entry side, within 1% of the zone.
  3. Absorption evidence at/near the wall (`abs` signal, D7) or CVD divergence (D8).
  4. Entry on the wall's defended side only; stop tight behind the wall.
- **Entry:** limit at/just in front of the wall price (basis-translated, D1).
- **Stop:** 0.3 ATR beyond the wall (if the wall fails, the thesis is dead instantly).
- **Targets:** conservative — T1 session POC, T2 Day POC. No runner requirement (this is a low-R, high-hit-rate archetype; often Grade B sizing).
- **Grade cap: B (0.5% risk max) always.** The archetype's fat left tail (wall pull) forbids full size.

### S4 — VWAP ±2σ/±3σ Mean Reversion *(terminal M2)*

- **Thesis:** price is statistically stretched from the day's fair value with crowding exhausted; it mean-reverts to the VWAP magnet.
- **Mandatory conditions (anti-knife-catching — ALL required):**
  1. Stretch: z ≥ +2.0 (SHORT) / ≤ −2.0 (LONG); peak conviction at |z| ≥ 2.2.
  2. **Crowding:** one of — H1 RSI > 72 / < 28 (D5), funding APR > +25% / < −25% against, top-trader L/S > 2.2 / < 0.55 (D14 quant), or cluster already swept within 0.5%.
  3. **Reversal proof:** footprint `exh`/`trap`/`abs`/`div`/`sdiv` in the fade direction, OR a defending wall within 0.75% + CVD divergence. Stretch + crowding WITHOUT proof = WATCH, not a trade.
- **Entry:** confirmation bar close in fade direction (or ±0.15 ATR zone around price).
- **Stop:** beyond ±3σ or 0.4 ATR past the sweep wick / defending wall.
- **Targets:** T1 session/Day POC → T2 0σ VWAP (must pay ≥ 1.5R) → T3 opposite day VAL/VAH or opposing cluster.
- **Vetoes:** R to T1 < 1.2 or R to T2 < 1.5; the accelerating-trend quad-veto (see S1).

### S5 — Compression Squeeze Break

- **Thesis:** ATR percentile < 20 with flat EMAs (D4 spread < 0.8 ATR) is a coil; resolution is explosive. Rising OI during compression (D14) confirms fuel loading.
- **Mandatory conditions:**
  1. Compression regime confirmed (ATR pct < 20, flat EMA13−89).
  2. **Wait for the break — never pre-position inside the coil.** Entry on the M15/H1 close outside the compression range (VWAP ±1σ or PDH/PDL frame), with a footprint `trap` on the opposite side (failed break) OR delta surge with the break (D6/D8).
  3. OI rising on the break (D14) = confirmation; OI falling = suspect breakout, half conviction.
  4. GEX negative (D13, BTC/ETH) supports expansion; positive GEX caps at B.
- **Entry:** break-close retest of the range edge (limit at the broken level).
- **Stop:** back inside the coil by 0.5 ATR (beyond the midpoint if tight).
- **Targets:** measured: T1 1× range height projected; T2 nearest magnet (D11) if ≥ 2R; T3 runner per 40/40/20.
- **Grade cap:** B on the first break of a coil; A only on retest-with-absorption.

### S6 — Absorption at Auction Structure

- **Thesis:** aggressive flow is absorbed at a value-area edge (D2) or POC by passive size; the auction rejects the level and rotates back into value.
- **Mandatory conditions:**
  1. `abs` signal (D7) printed AT Day/Month VAL·VAH·POC (or session POC), within the last 8 bars.
  2. Bar delta (D6) strongly against price direction at the level (sellers absorbed at a low that won't break, or inverse).
  3. Price closed back inside value (rejection), not closing outside.
  4. Balance regime (RANGE_BALANCE) — in a strong trend this setup is inverted into S2.
- **Entry:** the close of the rejection bar, or limit back at the absorption level's near edge.
- **Stop:** beyond the absorption bar's extreme wick.
- **Targets:** T1 opposite value edge (Day VAL→VAH), T2 month POC, T3 0σ VWAP.
- **Grade cap:** B unless the absorption cluster is ≥ $5M (then A eligible).

### S7 — Gamma Regime Trade (BTC/ETH only)

- **Thesis:** dealer gamma positioning (D13) creates predictable behavior: positive gamma pins the range; negative gamma amplifies momentum.
- **Two sub-modes:**
  - **S7-PIN (positive GEX):** fade extremes toward max pain / VWAP when price is at range edge + z ≥ 1.5 + no negative-GEX flip risk (price not within 0.5 ATR of the Gamma Flip level). Stop beyond the range edge + 0.5 ATR. Targets: VWAP, max pain. Grade cap B.
  - **S7-EXPANSION (negative GEX):** trade WITH momentum through prior structure (S2 conditions on a break, or magnet run per D12) with OI rising (D14). The Gamma Flip level is the line in the sand: once crossed, S4/S6 fades on that side are one-grade downgraded.
- **Mandatory:** options feed live (else n/a, no trade); no entry within 0.5 ATR of the Gamma Flip in either sub-mode.

### S8 — Trap / Failed Breakout Fade

- **Thesis:** a breakout through an obvious level (PDH/PDL, session high/low, range edge) traps late aggressive entrants and immediately reverses — the `trap` signature (D7).
- **Mandatory conditions:**
  1. `trap` signal at the broken level (D7), or S5's failed-break signature (break + close back inside within 2 bars).
  2. Volume on the break ABOVE average (real participation, not a drift-over) — otherwise it's not a trap, it's balance.
  3. Trapped side identifiable: delta one-sided into the break (D6), CVD extreme (D8), or L/S crowd leaning the broken way (D14).
  4. Room to rotate: distance to the opposite magnet ≥ 2R (D11/D2).
- **Entry:** the close of the failure bar (close back inside the level).
- **Stop:** beyond the trap extreme by 0.25 ATR.
- **Targets:** T1 session POC, T2 opposite side of the prior range, T3 opposite magnet.
- **Grade cap:** B; A only when a swept cluster (S1 stack) coincides — in which case book it as S1.

---

## 4. The Liquidation Magnet Gate — Operating Procedure

1. **Every formulation round, compute the LSR** for the target symbol from D11 totals (above/below USD within ±4%): `LSR = max(shorts_above, longs_below) / min(shorts_above, longs_below)`.
2. Record it on the Formulation Card (`liqSkewRatio`, dominant side).
3. If **LSR ≥ 2.5:1**:
   - S3 is **banned** for that symbol until LSR decays below 2.5 or the magnet is swept.
   - Formulations of the front-running type (limits into the dominant side's path) are rejected at the gate regardless of Table 7 score.
   - The desk's posture becomes: **WAIT FOR THE SWEEP** — arm S1 (sweep → exhaustion → delta flip) or plan S2 continuation after clearance.
4. If the dominant magnet sits within 1.2R **opposite** the planned entry → NO TRADE (hazard veto, logged).
5. Stop placement: stops are pushed beyond any magnet inside the risk zone, with total geometry ≤ 1.6× the base structural risk — if the magnet-widened stop breaks that bound, the entry is too close to the magnet; move the entry or skip.

---

## 5. Table 7 — The 11.5-Point Confluence Scoring

Score every candidate independently; partial points are NOT awarded. Maximum = **11.5**.

| # | Confluence factor | Pts | Pass measurement (exact values on the card) |
|---|---|---|---|
| 1 | **HTF trend alignment** — H4 AND D1 EMA 13/89/233 stacked in direction (2.0); one stack + other non-opposing (1.0); tangled/opposing (0) | 2.0 | D4 stack states |
| 2 | **Auction location edge** — entry at Day/Month VAL·VAH·POC or VWAP ±1σ band (1.0); mid-value / chase location (0) | 1.0 | D2/D3 |
| 3 | **Footprint discrete signal at the zone** — abs / exh / trap / sdiv in direction, in-zone, ≤ 8h (1.5); signal elsewhere (0) | 1.5 | D7 |
| 4 | **Delta & CVD confirmation** — 24h CVD sign + taker share ≥ 55%/≤ 45% at zone, or active spot-perp divergence (1.0) | 1.0 | D8/D6 |
| 5 | **Structural magnet drive** — T1 pays ≥ 2.0R into Day VAH/VAL or a cluster str ≥ 40 (1.0) | 1.0 | D11/D2 + geometry |
| 6 | **Liquidity defense at the zone** — untouched wall ≥ $1M or LTO ≥ $100k on entry side within 1% (1.0) | 1.0 | D9/D10 |
| 7 | **Liquidation Magnet Gate state** — LSR < 2.5:1 (or, for reversals, dominant magnet already swept) (1.0); banned/unswept magnet in path (0) | 1.0 | D12 |
| 8 | **GEX regime alignment** — BTC/ETH: positive GEX + reversion setup, or negative GEX + momentum setup (0.5); misaligned or n/a (0) | 0.5 | D13 |
| 9 | **OI dynamics confirmation** — rising OI on trend/break entries; falling OI at covering extremes for reversals (0.5) | 0.5 | D14 |
| 10 | **Funding / L-S edge** — |APR| ≤ 25% AND top L/S not ≥ 2.2 against the trade; or funding explicitly paying the trade (0.5) | 0.5 | D14 quant |
| 11 | **Multi-TF RSI divergence** — RSI(14) divergence on ≥ 2 timeframes in the trade direction (0.5) | 0.5 | D5 |
| 12 | **Execution quality** — basis ≤ 0.5%, spread < 0.15%, drag < 20% of stop (0.5) | 0.5 | D1/D15 |
| 13 | **Session timing** — active session window, no red-news within 30 min, feeds fresh (0.5) | 0.5 | freshness tracker |
| | **TOTAL** | **11.5** | |

### Grades and risk (the gate)

| Grade | Score | Risk per trade | Meaning |
|---|---|---|---|
| **A+** | ≥ 9.0 AND setup star-conditions (S1: exhaustion+delta-flip confirmed · S2: 3-TF + in-zone absorption) | 1.0% | Full size, ladder, runner |
| **A** | ≥ 7.0 | 1.0% | Standard size |
| **B** | 5.0 – 6.5 | 0.5% | Half size |
| **< 5.0** | — | — | **NO TRADE (veto)** |

### Hard vetoes (override ANY score)

1. LSR ≥ 2.5:1 → S3 archetype banned (§4).
2. Opposite magnet str ≥ 50 within 1.2R of entry.
3. No structural target ≥ 2.0R to T1 (1.2R T1 + ≥ 1.5R T2 for pure reversion).
4. Opposing whale wall ≥ $5M within 1.5R into the profit path; any ≥ $1M wall blocking T1.
5. Spread > 0.25% or drag > 25% of stop distance (D15 SKIP band).
6. Required feeds stale/cold (market, footprint on trigger-dependent setups).
7. Risk invariants would be breached (D16: heat, slots, portfolio cap).
8. Setup does not fit any card S1–S8.

---

## 6. Risk & Position Management — Invariant Checklist (D16 expanded)

Per-fill sizing procedure (atg-exec, recomputed live, never trusted from the card):

```
risk_usd   = equity_live × risk_pct(grade)          # A/A+ 1.0% · B 0.5%
stop_dist  = |entry_composite − stop|               # in price units, basis-translated
lots       = risk_usd / (stop_dist × value_per_lot) # MT5 lot value per symbol
```

- **Breakeven invariant:** at ≥ +1.0R open excursion → SL to entry, immediately (atg applies on the daemon cycle or user acts on the alert; zai verdict `MOVE_STOP_TO_BREAKEVEN` every round).
- **Time stop:** bar 8 (2h) without +0.5R → tighten to structure or close. Log either way.
- **Scale-out:** 40% T1 (Day VAH/VAL) · 40% T2 (Month POC) · 20% runner T3 (magnet sweep). After T1, stop to breakeven on the remainder (stacks with the invariant).
- **Slots:** ≤ 2 crypto positions; slot 3 = macro/metals only, and only if it does not stack the same macro-directional risk.
- **Portfolio heat ≤ 1.0%** total — a new Grade A formulation is capped to the heat left in the budget.
- **Tighten ladder:** ≥ +1.5R → `TIGHTEN_STOP`; within 0.3× stop-distance of T1 → `TAKE_PARTIAL`.

---

## 7. Execution Protocol (atg-exec)

1. **Re-derive, never trust** (reasoning mandate, `desk/PROTOCOL.md`): re-pull `desk/mt5.json`, recompute basis translation, lot size from live equity, spread/side.
2. **Translate every level:** `mt5Level = perpLevel × (1 + basisPct/100)`; `|basisPct| > 0.5%` → flag + widen/skip.
3. **Pad the side:** SHORT fills at bid / SL on ask (+ spread); TP on bid (− spread).
4. **Spread gate** (D15) applied to the TRANSLATED geometry before placement.
5. **Ladder placement** (S2): three limits 40/40/20 at POC / −1σ / absorption rung; composite entry = weighted mean; risk from composite.
6. **Order lifecycle & expiry** per `desk/PROTOCOL.md`; every suggested order re-debated each round with fresh data; a lost debate withdraws.
7. **Rationale citing:** every level on the card names its source dimension (e.g., "T2 71,240 = 7d liq cluster str 62, ~$89M est (D11, Coinglass estimate)").
8. **Honesty rule:** estimates are labeled estimates; missing feeds are n/a; two sources disagree → newer `updatedAt` wins and the conflict is disclosed.

---

## 8. Wake & Cadence Protocol — waking Antigravity locally for analysis

### 8.1 Cadence architecture (current)

- **zai-desk (sandbox):** 3 scheduled wakes/day + a round on every user message — deep interpretation, formulation cards, order suggestions.
- **atg-exec daemon (`scripts/desk_daemon.mjs`):** continuous 45 s loop; 15-min deterministic rounds; MT5 refresh; inbox processing; appends to `desk/inbox/WAKE.md`; desktop notification via `notify_cmd`.
- **The missing link:** `desk/daemon.json` → `"wake_cmd": ""` is EMPTY. Filling it turns the beacon into a hard wake for the local Antigravity agent.

### 8.2 Configure the hard wake (daemon.json)

Edit `desk/daemon.json` on the local machine, set `wake_cmd` to whatever interface the Antigravity install exposes (argv-tokenized, shell-free — see `desk/PROTOCOL.md` §notify_cmd for the safety model; `{msg}` is replaced with the task text as one argv element):

```jsonc
{
  "poll_secs": 45,
  "round_every_min": 15,
  "terminal_boot_cmd": "npm start",
  "mt5": { "enabled": true, "python_cmd": "python", "interval_secs": 45, "max_consecutive_errors": 10 },
  "wake_cmd": "<ANTIGRAVITY_CLI> --run \"<agent-name>\" \"{msg}\"",
  "notify_cmd": "python scripts/bell_alert.py"
}
```

Patterns that work with the tokenizer (pick ONE, matching the install):
- CLI: `antigravity agent run desk-agent "{msg}"`
- Local webhook: `curl http://127.0.0.1:8787/wake -d \"{msg}\"` (curl receives it as one argv token — no shell metacharacters survive)
- Script wrapper (recommended if the CLI needs env setup): `python C:\\Users\\SIGMA\\cg-terminal\\scripts\\wake_antigravity.py \"{msg}\"`

### 8.3 Scheduled analysis wake (the cron job)

Beyond event-driven wakes, schedule a **periodic analysis wake** so Antigravity runs a formulation round even without a HIGH-severity event. The repo ships `scripts/wake_analysis.mjs` for this: it drops a standard ANALYSIS ROUND agent-task into `desk/inbox/` (the daemon's fixed instruction vocabulary), then runs one daemon cycle — the task lands in `WAKE.md`, fires `wake_cmd`, sends the desktop notification, and gets committed + pushed. No daemon modification needed.

On Windows (Task Scheduler, from an admin prompt):

```powershell
# every 30 minutes, 24/7
schtasks /Create /TN "Antigravity Desk Analysis Wake" /SC MINUTE /MO 30 ^
  /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\wake_analysis.mjs"

# on-logon autostart of the always-on daemon (recommended baseline — the
# daemon already self-schedules 15-min rounds; the wake task above is the
# analysis-round layer on top)
schtasks /Create /TN "Antigravity Desk Daemon" /SC ONLOGON ^
  /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\desk_daemon.mjs"
```

Linux/macOS equivalent (if the repo lives on a Linux box instead):

```bash
crontab -e
*/30 * * * * cd /home/sigma/cg-terminal && node scripts/wake_analysis.mjs >> desk/rounds.local.log 2>&1
@reboot cd /home/sigma/cg-terminal && nohup node scripts/desk_daemon.mjs >> desk/rounds.local.log 2>&1
```

Prerequisite: `wake_cmd` must be configured (§8.2) — otherwise the task still lands in `WAKE.md` and fires the desktop notification, and the next manual Antigravity activation handles it.

### 8.4 The standard wake prompt (what Antigravity does when woken)

Every woken analysis run MUST follow this checklist — this is the binding contract between the beacon and the agent:

```
WAKE (analysis round):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (this document is the SOP)
3. Pull live telemetry for the target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (§1) per symbol with ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§4)
6. Score Table 7 (§5); apply hard vetoes; assign grade + risk %
7. For every Grade ≥ B candidate: write a Formulation Card (§9.2) into
   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md and (if order-worthy) a
   suggested order into desk/state.json per desk/PROTOCOL.md
8. Review open positions vs §6 invariants (BE rule, time stop, scale-outs)
9. Commit + push; append the round entry to desk/log.md
```

### 8.5 Which events force a wake (daemon side)

The daemon appends to `WAKE.md` and fires `wake_cmd` on: any `[HIGH]` severity event (Absorption, Trap, Strong Divergence at a zone), any new `suggested` order, any zai inbox `AGENT_TASK`, a position crossing +1.0R (breakeven invariant), a position within 0.3× stop-distance of T1 (scale-out), and the scheduled analysis cadence (§8.3).

---

## 9. Reference

### 9.1 The one-page card (memorize)

```
DECIDE: Direction → Entry zone → Confluence → Invalidation → Drive → Execution
16 DIMS: basis · profile · VWAP · EMA · RSI · delta · signals · CVD · walls ·
        LTO · liq clusters · LSR GATE · GEX · OI · spread · risk invariants
SETUPS: S1 sweep-reversal · S2 trend-pullback · S3 wall-front-run(GATED) ·
        S4 vwap-reversion · S5 squeeze-break · S6 absorption · S7 gamma · S8 trap-fade
GATE:   LSR ≥ 2.5:1 → S3 BANNED, wait for S1
SCORE:  ≥7.0 = A (1.0%) · 5.0–6.5 = B (0.5%) · <5.0 = NO TRADE · max 11.5
RISK:   ≤2 crypto slots + 1 macro · heat ≤1.0% · +1.0R → BE · 8 bars no +0.5R → out
        scale 40/40/20 into Day VA edge / Month POC / liq sweep
EXEC:   mt5Level = perpLevel × (1 + basisPct/100) · spread < 0.15% & < 20% of stop
        · pad the side · re-derive every number
```

### 9.2 Formulation Card template

```markdown
## FORMULATION · <SYMBOL> · <ts UTC> · <S#> <name>
Regime: <TREND_UP|TREND_DOWN|RANGE|COMPRESSION> — <one-line evidence>
Direction: LONG|SHORT · Grade: A+|A|B (score X.X/11.5) · Risk: 1.0%|0.5% = $<amt>
D1  basisPct <v>% (translate: mt5Level = perpLevel × <factor>)
D2  profile: session POC <v> · day VAL/POC/VAH <v>/<v>/<v> · month VAL/POC/VAH <v>/<v>/<v>
D3  VWAP <v> · z <v>σ · bands ±1σ/2σ/3σ <v>
D4  EMA stacks: M15 <v> · H1 <v> · H4 <v> · D1 <v> · 3-TF aligned: yes/no
D5  RSI: M15 <v> · H1 <v> · H4 <v> · divergence: <none|bull|bear ×TF>
D6  delta at zone: buy $<v> / sell $<v> · bar POC <v>
D7  signals in zone: <abs/exh/trap/sdiv/div @ price, ts>
D8  CVD: perp <v> · spot <v> · taker buy <v>% · divergence <v> · Coinbase <v>bps
D9  walls: bid <$v>@<p> (age <v>, touched <v>) · ask <$v>@<p> · imbalance <v>
D10 LTO: <$v> @ <p> <side> <venue>
D11 clusters: above <p> str<v> $<v>est · below <p> str<v> $<v>est (3d/7d/30d)
D12 LSR <v>:1 (<side> dominant) → GATE: <open|S3-BANNED — wait for sweep>
D13 GEX: <POSITIVE_PIN|NEGATIVE_EXPANSION> · γ-flip <v> · max pain <v> (BTC/ETH)
D14 OI: Δ1h <v>% · Δ4h <v>% · quadrant <v> · funding APR <v>% · L/S <v>
D15 spread <v>% · stop dist <v>% · drag <v>% → <PASS|C|SKIP>
D16 invariants: heat <v>% of <v> slots · BE armed <ts?> · bars since fill <n>
Entry: <ladder/zone, translated> · Stop: <v> (<rationale>) ·
T1 <v> (<x.x>R · Day VAH/VAL) · T2 <v> (<x.x>R · Month POC) · T3 <v> (<x.x>R · liq sweep)
Table 7: [1:<v> 2:<v> 3:<v> ... 13:<v>] = <X.X> · vetoes: <none|list>
```

### 9.3 Change control

This manual changes only by: (a) user directive, or (b) a logged `DIALOG` between both agents proposing an amendment that the user approves. Every change bumps the version header and appends a line to `desk/log.md`. Thresholds in `desk/state.json` `config` remain human-owned; this manual references them, it does not override them.

---

*End of manual. Trade well, score honestly, respect the gate.*
>>>>>>> f65f897 (desk(daemon): auto-commit (pre-sync))
