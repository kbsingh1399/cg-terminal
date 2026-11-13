# CANONICAL TRADE FORMULATION MANUAL (SOP)

**CG Order-Flow Terminal & Trade Desk Protocol**
*Document Version: 1.1.0 — Merged Canonical (2026-11-13)*
*Reference Source: `C:\Users\SIGMA\Downloads\Trade-Formulation-Playbook (1).pdf` (10 Nov 2026 canonical specification)*
*Operating Roles: atg-exec (Local Execution & Risk Gate) · zai-desk (Remote Analysis Brain) · Human (Capital & Config Authority)*
*Provenance: v1.0.0 (atg-exec, PDF-faithful specification) merged with the zai-desk terminal-parity draft (implementation grounding, wake & cadence protocol). Where the two drafts differed, the PDF-faithful numbers win; terminal enforcement thresholds are documented alongside.*

**Status: BINDING.** Both agents must follow this manual for every round and every trade formulation. Conflicts between older documents (AGENTS.md, desk/PROTOCOL.md) and this manual resolve in favor of THIS manual. `desk/state.json` `config` thresholds remain human-owned.

---

## 0. Purpose & Core Philosophy: Critical Realism

In financial markets—and perpetual futures in particular—prices are not moved by subjective chart patterns or isolated indicators. Prices are driven by **generative microstructure mechanisms**:

1. **Liquidity is Fuel**: The market's primary directive is to seek liquidity pools where large orders can fill. Dense clusters of stop-losses and liquidations act as magnets.
2. **Order Flow Reality**: Passive limit orders (book walls) absorb flow; aggressive market orders (taker volume) drive price through depth.
3. **Multi-Scenario Discipline**: Every trade must consider both the absorption case and the liquidity sweep case. Never commit dogmatically to a single narrative.

**Prime directive: NO TRADE without a completed DECIDE pass, a Table 7 score ≥ 5.0, and zero active hard vetoes.** A missed data feed is scored 0 and disclosed as `n/a` — never guessed.

---

## 1. The 6-Step DECIDE Framework

Every trade proposed by `zai-desk` or executed by `atg-exec` must strictly follow the **DECIDE** framework:

1. **D — Direction (Bias)**: Establish macro and intraday bias via the 2-of-3 confluence rule:
   - Signal direction (Footprint absorption/divergence — D7/D8)
   - Trend alignment (H4/D1 EMA 13 × 89 trend — D4)
   - Auction regime (Price position relative to Day VWAP — D3)
2. **E — Entry Zone**:
   - Passive limit orders at structural anchors: Day VWAP ±1σ, Day/Session POC, or post-sweep exhaustion wicks.
   - Front-running confirmed whale walls by 0.05%–0.1% **only if** the Liquidation Magnet Gate passes (§3).
3. **C — Confluence Scoring**: score the setup against Table 7 (§5, 11.5 points max). Minimum score of **5.0 points** required to trade.
4. **I — Invalidation (Stop Loss)**: data-driven structural invalidation only — beyond the sweep wick, beyond Day VWAP ±2σ/±3σ, or behind an uncompromised whale wall + 0.5 ATR buffer. Never arbitrary pips.
5. **D — Drive (Targets & Scale-Out)**:
   - **40% @ T1**: Nearest Value Area edge (Day VAH for longs, Day VAL for shorts).
   - **40% @ T2**: High-volume node (Month POC / Session POC).
   - **20% Runner @ T3**: Major liquidation pool or opposite whale barrier.
   - Desk R-standard (human mandate, binding): **≥ 2.0R to T1** on continuation setups; the PDF's 1.5R floor applies to the 40/40/20 composite. Pure reversion (S5) may use 1.2R to T1 when the 0σ VWAP target pays ≥ 1.5R.
6. **E — Execution & Risk Management**: exact lot size from structural stop distance — 0.5% risk (Grade B) or 1.0% risk (Grade A). Enforce the broker spread gate and portfolio heat limits (§6, §7).

The output of DECIDE is a **Formulation Card** (§9.2) with every field populated from a live tool/API response in that session.

---

## 2. The 16 Telemetry Data Dimensions — the Data Contract

Every trade audit must explicitly examine and log all 16 dimensions from the terminal. Each dimension lists the PDF rule (canonical) plus the terminal source for verification. A feed that is down contributes 0 points, its card row reads `n/a`, and confidence caps apply.

### Dimension 1: Live Spot & Broker Basis Offset (`basisPct`)
* **Endpoint**: `/api/cg/market` & `desk/mt5.json` → `spreads.<SYMBOL>.basisPct`
* **Metric**: percentage difference between the MT5 Cash CFD quote and the terminal USDT-M perp quote:
  `basisPct = (Price_MT5 − Price_Perp) / Price_Perp × 100`
* **Rule**: always calibrate perp levels by `basisPct` before sending MT5 orders: `mt5Level = perpLevel × (1 + basisPct/100)`. Ensure limit sell orders are placed strictly ABOVE the live MT5 ask. `|basisPct| > 0.5%` → flag in `log.md`, widen the stop or skip. Basis changes prices, never direction or scoring.

### Dimension 2: Auction Market Profile (VAL, POC, VAH)
* **Endpoint**: `/api/cg/narrative` → `market.auction.{session,day,month}` (session = rolling 8h, day = UTC 00:00 anchor, month = UTC)
* **Rule**: POC represents high-volume acceptance. Fade Value Area extremes back to POC (Setup S2); target VAL/VAH on trend continuations. Mid-value entries score 0 in Table 7.

### Dimension 3: Day-Anchored VWAP & Standard Deviation Bands
* **Endpoint**: `/api/cg/narrative` → `market.vwap.{vwap, bands.sd1..sd3}`; z = (price − VWAP)/sd1
* **Regime**: Above VWAP = Premium (bullish bias); Below VWAP = Discount (bearish bias).
* **Rule**: mean-reversion fades trigger at ±2σ and ±3σ extremes (Setup S5). Trend continuation pullbacks enter at VWAP or ±1σ. Chase guard: |z| ≥ 2.0 bans continuation entries (work a limit at the band instead).

### Dimension 4: Trend Momentum Alignment (Fib-Prime EMAs)
* **Endpoint**: `/api/cg/narrative` → `market.ema.{m15,h1,h4,d1}.{e13,e89,e233}`
* **Rule**: H4 EMA13 > EMA89 = bullish trend; EMA13 < EMA89 = bearish trend. Full H4+D1 stack alignment (13>89>233 both) awards maximum confluence points (Table 7 row 1).
* **3-TF alignment standard (terminal)**: H4 13×89 in direction (mandatory) + H1 structure aligned + M15 bar holding the EMA89 side. A/A+ on S7 requires 3-TF alignment.

### Dimension 5: Multi-Timeframe RSI(14) Divergence
* **Endpoint**: `/api/cg/narrative` → `market.rsi.{m15,h1,h4}`
* **Rule**: H1/H4 RSI > 70 or < 30 warns of exhaustion. Regular divergence between price swing and RSI swing on two or more timeframes confirms reversal setups (S1/S5/S6 prerequisite evidence).

### Dimension 6: Footprint Delta & Volume Clusters
* **Endpoint**: `/api/cg/fp` (per-bar taker buy/sell USD, bar delta %, bar POC)
* **Rule**: high volume with small price progress indicates absorption. Delta surges at highs/lows indicate aggressive market participation. Dead-volume zones (10-bar volume extreme) at extremes are exhaustion preconditions (S1).

### Dimension 7: Footprint Discrete Signal Patterns
* **Endpoint**: `/api/cg/signals` (Coinglass-aggregated parity set) + `/api/cg/narrative` checklist
* **Signals**: **Absorption** (`abs`), **Divergence** (`div`), **Strong Divergence** (`sdiv`), **Trap** (`trap`), **Exhaustion** (`exh`).
* **Rule**: footprint signals must confirm the entry zone (signal printed at/inside the zone, ≤ 8h recency). A Strong Divergence or Absorption at the entry zone awards 2.0 confluence points. Signals elsewhere are context, not triggers.

### Dimension 8: Cumulative Volume Delta (CVD)
* **Endpoint**: `/api/cg/cvd` (Perp CVD, Spot CVD, taker buy share %, active divergences) + `/api/cg/quant` (Coinbase premium bps)
* **Rule**: price making higher highs while Perp CVD makes lower highs indicates aggressive absorption (exhaustion). Confirm spot and perp alignment. Accelerating trend + CVD with trend + Coinbase premium with trend + zero exhaustion = hard veto on all fades (S1/S2/S5/S6).

### Dimension 9: Multi-Exchange BookWalls
* **Endpoint**: `/api/cg/bookwalls` (aggregate depth ±5%, imbalance now vs 5m ago, confirmed resting wall list with USD value, age in hours, touched status, add/fill/pull events — exact Coinglass wall-scanner port)
* **Rule**: walls ≥ $10M resting > 2 hours act as strong barriers (S3 anchor). Touched walls that hold confirm defense; pulled walls warn of breakouts (S4 trigger). An opposing wall ≥ $5M within 1.5R into the profit path = hard veto. Walls are estimates — label them in `rationale`.

### Dimension 10: LTO Large Resting Orders
* **Endpoint**: `/api/cg/lto` (individual institutional limit orders ≥ $100k across Aster, Binance, Bybit, OKX, Hyperliquid; futures + spot)
* **Rule**: identify institutional resting clusters to position limit orders 0.05% in front for queue priority. LTOs corroborate the wall thesis (D9) — wall or LTO satisfies Table 7 row 4; both = stronger rationale, no double-counting.

### Dimension 11: Liquidation Heatmap Clusters
* **Endpoint**: `/api/cg/liqlevels` (multi-venue estimated pools, 3d/7d/30d rolling windows ±4%, strength 0–100, USD size, venue count) + `/api/cg/stopmap` (24h rolling heatmap)
* **Rule**: liquidation clusters are sweep magnets. Take profit INTO liquidation clusters; never hold through them. Major cluster = strength ≥ 50 or ≥ $5M. Clusters are Coinglass estimates — always disclosed.

### Dimension 12: THE LIQUIDATION MAGNET GATE (LSR) — Mandatory Veto
* **Metric**: Liquidation Skew Ratio within **±2.0% of price**:
  `LSR = Short Liquidations Above / Long Liquidations Below` (always expressed dominant-side-first)
* **The VETO rule**:
  * **If LSR ≥ 2.5:1** (short liquidations heavily dominate above): **BAN ALL PASSIVE ENTRIES INTO THE MAGNET PATH** — Setup S3 front-runs and S2 fades at the facing Value Area edge. The whale wall is a dam about to burst.
  * **Action**: switch strictly to **Setup S1 (Liquidation Sweep Reversal)**. Wait for the sweep to clear the stops, wait for taker CVD delta to flip, and enter on the 15m exhaustion close.
  * Symmetric when long liquidations dominate below.
* **The Gate outranks every other confluence.** A 9-point setup of a banned archetype is still NO TRADE. Full operating procedure in §3.

### Dimension 13: Options Open Interest & Gamma Exposure (GEX)
* **Endpoint**: `/api/cg/options` (BTC/ETH only — Deribit DVOL, term structure, 25Δ RR, max pain, top OI walls, GEX regime, **Gamma Flip level**)
* **Regimes**:
  * **Positive Gamma**: market makers sell rallies and buy dips (volatility dampening / mean reversion) — favors S2/S5.
  * **Negative Gamma**: market makers sell dips and buy rallies (volatility expansion / trend acceleration) — favors S1/S8.
  * **Gamma Flip point**: the structural boundary between regimes; price crossing it is a structural event. No entry within 0.5 ATR of the flip; fades on the far side are one-grade downgraded.
* Non-BTC/ETH: row scores 0 in Table 7 (honest n/a).

### Dimension 14: Open Interest (OI) Dynamics
* **Endpoint**: `/api/cg/oi` + `/api/cg/quant` (OI×price quadrant 1h/4h, OI Δ% 1h/4h/24h) + `desk/positioning.json`
* **Rule**:
  * Rising Price + Rising OI = true institutional accumulation (bullish) — confirms S7/S8 continuation.
  * Rising Price + Falling OI = short liquidation squeeze / short covering (bearish exhaustion once fuel runs out) — favors S1.
  * Falling Price + Falling OI = long liquidation cascade.
  * Entering LONG on a LONG_LIQUIDATION quadrant (or SHORT on SHORT_COVERING) = distribution trap flag, one-grade haircut.

### Dimension 15: Broker Spread & Liquidity Drag Gate
* **Source**: `desk/mt5.json` → `spreads.<SYMBOL>.spreadPct` (live verified; snapshot stale > 20 min = gate honest-off, n/a)
* **The hard VETO**:
  1. Broker Spread Pct must be **< 0.15%**.
  2. Broker spread must consume **< 20% of planned stop-loss distance**: `Spread / StopDistance < 0.20`.
* Terminal enforcement parity: drag ratio > 0.12 → Grade C (SPREAD_DRAG_EXCESSIVE — reduced size), > 0.25 → SKIP. The 20% line sits inside the C band: 12–20% = pass with haircut confidence.
* **Disqualified assets on FundedNext** (measured 2026-11-12): ADA (2.2%), DOGE (1.38%), LTC (2.31%), LINK (0.55%). **Qualified**: BTC, ETH, XAU, XLM, XRP, USO, XAG. Re-measure after any broker change — this list is a fact, not a law.
* Side padding: SHORT fills at bid, SL triggers on ask — pad tight levels by the spread.

### Dimension 16: Risk & Execution Invariants
* **Max Portfolio Heat**: ≤ 1.0% total equity risk across all open trades ($46.30 on $4,630 equity — recompute from live equity every sizing).
* **Per-trade heat**: Grade A → 1.0%; Grade B → 0.5%.
* **Correlation limit**: max 2 concurrent crypto positions in the same direction. Slot 3 is reserved exclusively for non-crypto macro commodities (XAU, XAG, USO).
* **The +1.0R Breakeven Invariant**: move SL to entry immediately upon reaching ≥ +1.0R excursion. Tail risk must be eliminated to 0.00%. Non-discretionary.
* **8-Bar (2-hour) Time Stop**: if price fails to reach +0.5R within 8 15-minute bars, close or tighten the stop.
* **40/40/20 Liquidity Scale-Out**: 40% @ T1 (Day VAH/VAL), 40% @ T2 (Month/Session POC), 20% Runner @ T3 (liquidation sweep). Never hold the runner through an unswept magnet.

---

## 3. The Liquidation Magnet Gate — Operating Procedure

1. **Every formulation round, compute the LSR** for the target symbol from D11 totals within ±2% of live price: `LSR = max(shortsAbove, longsBelow) / min(shortsAbove, longsBelow)`, dominant side recorded.
2. Record it on the Formulation Card (`liqSkewRatio`, dominant side).
3. **LSR ≥ 2.5:1**:
   - All passive entries into the magnet path are **banned** (S3 front-runs; S2 fades at the facing VA edge) until LSR decays below 2.5 or the magnet is swept.
   - Desk posture becomes **WAIT FOR THE SWEEP**: arm S1 (sweep → exhaustion close → delta flip) or plan S7/S8 continuation after clearance.
4. **LSR 2.0–2.5**: S3 permitted at Grade B max (half size), untouched aging wall + in-zone absorption required.
5. **LSR < 2.0**: S3 fully eligible (its "Best Regime" per the PDF).
6. Opposite-side magnet (str ≥ 50) within 1.2R of entry = NO TRADE (hazard veto, logged).
7. Stops push beyond any magnet inside the risk zone with total geometry ≤ 1.6× base structural risk; if the widened stop breaks that bound, move the entry or skip.

---

## 4. The 8 Standardized Playbook Setups (S1 to S8)

These are the ONLY permitted trade archetypes. The table is the canonical PDF classification; each card adds mandatory conditions, grade caps, and terminal mapping. An opportunity that fits no card is NO TRADE.

| Code | Setup Name | Best Regime | Entry Trigger | Stop Invalidation | Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S1** | **Liquidation Sweep Reversal** | Over-extended / high LSR | 15m close back inside value after upper/lower stops wiped + delta flip | Beyond the sweep wick high/low | Opposite Day VAL/VAH & POC |
| **S2** | **Value Area Edge Fade** | Range Balance / High Gamma | Touch of Day VAH (short) or Day VAL (long) with footprint divergence | Beyond Day VWAP ±2σ band | Day POC (mean reversion) |
| **S3** | **Whale Wall Defense / Front-Run** | Trend Pullback (LSR < 2.0) | 0.05%–0.1% in front of confirmed resting wall ≥ $10M (age > 2h) | Behind the whale wall + 0.5 ATR buffer | Next major opposing wall / POC |
| **S4** | **Wall-Pull Breakout** | Momentum Expansion | Breakout candle through previously pulled wall with rising OI | Retest of broken level | +2σ or +3σ VWAP band |
| **S5** | **VWAP Band Mean Reversion** | Extreme Extension | Touch of Day VWAP ±3σ band with RSI divergence | 0.5 ATR beyond ±3σ band | Day VWAP mean |
| **S6** | **Trapped Traders Fade** | False Breakout | High volume cluster at extreme with failed price progress | Beyond trapped volume candle wick | POC / Value Area midline |
| **S7** | **High-Volume Absorption Continuation** | Strong Trend (M1) | Retest of absorbed high-volume node in trend direction | Other side of absorption bar | Same-direction liquidation pool |
| **S8** | **Liquidation Breakout Continuation** | Negative Gamma Expansion | Clean 15m close beyond major liquidation shelf with rising volume | Inside edge of the broken shelf | Next liquidity pocket |

### S1 — Liquidation Sweep Reversal *(the sweep trade; the Magnet Gate's chosen setup)*
- **Thesis**: a dominant liquidation magnet (D12) gets run; trapped positions are force-closed; the move exhausts and snaps back. We trade the completed sweep, never the approach.
- **Mandatory conditions**: major cluster swept (str ≥ 50 or ≥ $5M, within ~8 bars) · exhaustion signature at the extreme (D7 `exh`: 10-bar volume extreme + close in opposite half) · delta flip (D8 CVD divergence or D7 `div`/`sdiv`) · stretch context (|z| ≥ 2σ or outside month VA).
- **Entry**: the 15m close back inside value (confirmation bar), or limit at 50% retrace of the sweep wick.
- **Stop**: beyond the sweep wick high/low (+ 0.3–0.5 ATR noise buffer).
- **Targets**: opposite Day VAL/VAH & POC (40/40/20 applies).
- **Grade cap**: A+ eligible — highest-quality archetype when LSR skew is extreme.
- **Hard veto**: accelerating trend + CVD with trend + Coinbase premium with trend + zero exhaustion = never fade.

### S2 — Value Area Edge Fade
- **Thesis**: aggressive flow is absorbed at a Value Area edge (D2) by passive size; the auction rejects the level and rotates back into value.
- **Mandatory conditions**: `abs` signal or footprint divergence (D7) AT the Day VAH (short) / VAL (long), within 8 bars · bar delta (D6) strongly against price direction at the level · close back inside value (rejection) · balance regime or positive gamma (D13) — in a strong trend this inverts into S7.
- **Entry**: the rejection bar close, or limit back at the absorption level's near edge.
- **Stop**: beyond the Day VWAP ±2σ band.
- **Targets**: Day POC (mean reversion); T2 session POC.
- **Grade cap**: B unless the absorption cluster is ≥ $5M (then A eligible). Banned at the facing edge when LSR ≥ 2.5:1 (§3).

### S3 — Whale Wall Defense / Front-Run *(GATED — §3)*
- **Thesis**: a large confirmed resting wall (D9) / institutional LTO (D10) defends a level before price arrives; we join the passive side with a limit.
- **Mandatory conditions**: **Magnet Gate pass (LSR < 2.0 preferred; 2.0–2.5 = Grade B max; ≥ 2.5 BANNED)** · confirmed resting wall ≥ $10M, age > 2h, untouched · absorption evidence at/near the wall (D7) or CVD divergence (D8) · LTO corroboration (D10) strengthens but never replaces the wall.
- **Entry**: limit 0.05%–0.1% in front of the wall price (basis-translated, D1) for queue priority.
- **Stop**: behind the whale wall + 0.5 ATR buffer (if the wall fails, the thesis is dead instantly).
- **Targets**: next major opposing wall / POC. Conservative archetype — no runner requirement.
- **Grade cap**: B (0.5% risk) always — the wall-pull fat left tail forbids full size.

### S4 — Wall-Pull Breakout
- **Thesis**: a previously confirmed wall is PULLED (D9 fill/pull event) — the barrier disappears and price expands through the vacuum.
- **Mandatory conditions**: wall-pull event on a previously confirmed wall · breakout candle closes beyond the level with rising OI (D14) · footprint delta surge with the break (D6/D8). Positive GEX caps at B (dampening fights expansion).
- **Entry**: retest of the broken level (limit at the level).
- **Stop**: retest failure — back beyond the broken level (inside the old wall zone).
- **Targets**: +2σ / +3σ VWAP band (D3), then nearest magnet (D11).
- **Grade cap**: B on the first break; A on retest-with-absorption.

### S5 — VWAP Band Mean Reversion
- **Thesis**: price is statistically stretched from the day's fair value with crowding exhausted; it mean-reverts to the VWAP magnet.
- **Mandatory conditions (anti-knife-catch — ALL)**: touch of Day VWAP ±3σ band (D3; ±2σ with peak conviction z ≥ 2.2 acceptable when stacked with crowding) · **crowding** — H1/H4 RSI > 70 / < 30 (D5), funding APR > +25% / < −25%, top-trader L/S > 2.2 / < 0.55 (D14), or cluster already swept within 0.5% · **reversal proof** — footprint `exh`/`trap`/`abs`/`div`/`sdiv` in the fade direction, or a defending wall within 0.75% + CVD divergence. Stretch + crowding WITHOUT proof = WATCH, not a trade.
- **Entry**: confirmation bar close in the fade direction (or ±0.15 ATR zone around price).
- **Stop**: 0.5 ATR beyond the ±3σ band.
- **Targets**: Day VWAP mean (T2, must pay ≥ 1.5R); T1 session/Day POC (≥ 1.2R).
- **Grade cap**: A only with peak conviction (|z| ≥ 2.2) or swept-cluster stack.

### S6 — Trapped Traders Fade
- **Thesis**: a breakout through an obvious level traps late aggressive entrants and immediately reverses — the `trap` signature.
- **Mandatory conditions**: high-volume cluster at the extreme with failed price progress (D6) — volume on the break ABOVE average (real participation, not a drift-over) · `trap` signal (D7) or failed-break close back inside within 2 bars · trapped side identifiable — delta one-sided into the break (D6), CVD extreme (D8), or L/S crowd leaning the broken way (D14) · room to rotate ≥ 2R to the opposite magnet (D11/D2).
- **Entry**: the close of the failure bar (close back inside the level).
- **Stop**: beyond the trapped volume candle wick (+ 0.25 ATR).
- **Targets**: POC / Value Area midline; T2 opposite side of the prior range.
- **Grade cap**: B; A only when a swept cluster coincides — in which case book it as S1.

### S7 — High-Volume Absorption Continuation *(terminal M1 trend-pullback)*
- **Thesis**: established trend (H4+D1 stack) pauses into an absorbed high-volume node; the retest holds; continuation resumes.
- **Mandatory conditions**: H4 13×89 trend + D1 non-opposing (D4) · 2-of-3 bias gate (stack / VWAP side / 24h CVD sign) · not stretched (|z| < 2.0) · absorption or strong divergence at the retest node (D7) — **A/A+ requires 3-TF alignment AND in-zone absorption/CVD-divergence**.
- **Entry**: retest of the absorbed node — 3-tier limit ladder 40% at POC · 40% at trend-side ±1σ · 20% at the absorption low/high; risk from the composite fill.
- **Stop**: other side of the absorption bar (geometry guard: zone edge + 0.25 ATR).
- **Targets**: T1 Day VAH/VAL → T2 same-direction liquidation pool (D11) → T3 opposing wall / PWH-PWL.
- **Grade cap**: A/A+ with 3-TF + in-zone absorption; otherwise B.

### S8 — Liquidation Breakout Continuation
- **Thesis**: price breaks cleanly beyond a major liquidation shelf — the trapped side's stops become fuel; negative gamma (D13) amplifies the expansion.
- **Mandatory conditions**: clean 15m close beyond a major liquidation shelf (D11, str ≥ 50 / ≥ $5M) with rising volume · rising OI on the break (D14) · negative GEX regime supports (BTC/ETH); positive GEX caps at B.
- **Entry**: break-close, or the retest of the shelf's inside edge.
- **Stop**: inside edge of the broken shelf.
- **Targets**: next liquidity pocket (D11) — never hold THROUGH the next unswept magnet; scale 40/40/20 into it.
- **Grade cap**: B on the first close beyond; A on the retest with rising OI + negative gamma.

---

## 5. Table 7: The 11.5-Point Confluence Scoring Table

Score every candidate independently; partial points only where the row defines tiers. Maximum = **11.5**.

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
* **Grade A (≥ 7.0 points)**: Full Unit Risk (**1.0% equity risk**). Premium setup.
* **Grade B (5.0 – 6.5 points)**: Half Unit Risk (**0.5% equity risk**). Standard setup.
* **< 5.0 points**: **HARD VETO (NO TRADE)**. Tape is noisy; preserve capital.

### Hard vetoes (override ANY score):
1. LSR ≥ 2.5:1 → all passive entries into the magnet path banned (§3).
2. Opposite magnet str ≥ 50 within 1.2R of entry.
3. No structural target ≥ 2.0R to T1 (continuation) / no ≥ 1.2R T1 + ≥ 1.5R T2 (reversion).
4. Opposing whale wall ≥ $5M within 1.5R into the profit path; any ≥ $1M wall blocking T1.
5. Spread > 0.15% or spread/stop-distance > 20% (D15).
6. Required feeds stale/cold (market, footprint on trigger-dependent setups).
7. Risk invariants would be breached (D16: heat, slots, portfolio cap).
8. Setup fits no card S1–S8.
9. Accelerating trend + CVD with trend + Coinbase premium with trend + zero exhaustion (fade veto).

---

## 6. Execution Lifecycle & Invariant Rules

1. **Never trade market orders**: all entries are passive limit orders at structural levels.
2. **Never move stops further away**: stops are fixed at placement and may only be tightened or trailed.
3. **Breakeven invariant**: when price reaches +1.0R, immediately move SL to breakeven (0.00% risk).
4. **Time stop**: if after 8 bars (2 hours) price has not achieved +0.5R, close or tighten the stop.
5. **Scale-out discipline**: 40% @ T1 (Day VAH/VAL) · 40% @ T2 (Month/Session POC) · 20% runner @ T3 (liquidation sweep). After T1, stop to breakeven on the remainder.
6. **Git auditability**: every placement, fill, stop adjustment, and closed trade must be written to `desk/state.json`, logged in `desk/log.md`, and committed to `origin/main`.

Per-fill sizing procedure (atg-exec, recomputed live, never trusted from the card):
```
risk_usd   = equity_live × risk_pct(grade)          # A 1.0% · B 0.5%
stop_dist  = |entry_composite − stop|               # price units, basis-translated
lots       = risk_usd / (stop_dist × value_per_lot)
```

---

## 7. Execution Protocol (atg-exec)

1. **Re-derive, never trust** (reasoning mandate): re-pull `desk/mt5.json`, recompute the basis translation, lot size from live equity, spread/side.
2. **Translate every level**: `mt5Level = perpLevel × (1 + basisPct/100)`; `|basisPct| > 0.5%` → flag + widen/skip.
3. **Pad the side**: SHORT fills at bid / SL triggers on ask (+ spread); TP on bid (− spread).
4. **Spread gate** (D15) applied to the TRANSLATED geometry before placement.
5. **Ladder placement** (S7): three limits 40/40/20; composite entry = weighted mean; risk from composite.
6. **Order lifecycle & expiry** per `desk/PROTOCOL.md`; every suggested order re-debated each round with fresh data; a lost debate withdraws.
7. **Rationale citing**: every level names its source dimension (e.g., "T2 71,240 = 7d liq cluster str 62, ~$89M est (D11, Coinglass estimate)").
8. **Honesty rule**: estimates are labeled estimates; missing feeds are n/a; two sources disagree → newer `updatedAt` wins and the conflict is disclosed.

---

## 8. Wake & Cadence Protocol — waking Antigravity locally for analysis

### 8.1 Cadence architecture (current)

- **zai-desk (sandbox)**: 3 scheduled wakes/day + a round on every user message — deep interpretation, formulation cards, order suggestions.
- **atg-exec daemon (`scripts/desk_daemon.mjs`)**: continuous 45 s loop; 15-min deterministic rounds; MT5 refresh; inbox processing; appends to `desk/inbox/WAKE.md`; desktop notification via `notify_cmd`.
- **The missing link**: `desk/daemon.json` → `"wake_cmd": ""` is EMPTY. Filling it turns the beacon into a hard wake for the local Antigravity agent.

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
- Local webhook: `curl http://127.0.0.1:8787/wake -d \"{msg}\"`
- Script wrapper (recommended if the CLI needs env setup): `python C:\\Users\\SIGMA\\cg-terminal\\scripts\\wake_antigravity.py \"{msg}\"`

### 8.3 Scheduled analysis wake (the cron job)

Beyond event-driven wakes, schedule a **periodic analysis wake** so Antigravity runs a formulation round even without a HIGH-severity event. The repo ships `scripts/wake_analysis.mjs` for this: it drops a standard ANALYSIS ROUND agent-task into `desk/inbox/` (the daemon's fixed instruction vocabulary), then runs one daemon cycle — the task lands in `WAKE.md`, fires `wake_cmd`, sends the desktop notification, and gets committed + pushed. No daemon modification needed.

Windows (Task Scheduler, from an admin prompt):

```powershell
# every 30 minutes, 24/7
schtasks /Create /TN "Antigravity Desk Analysis Wake" /SC MINUTE /MO 30 ^
  /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\wake_analysis.mjs"

# on-logon autostart of the always-on daemon (recommended baseline — the
# daemon already self-schedules 15-min rounds; the wake task is the
# analysis-round layer on top)
schtasks /Create /TN "Antigravity Desk Daemon" /SC ONLOGON ^
  /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\desk_daemon.mjs"
```

Linux/macOS equivalent:

```bash
crontab -e
0,30 * * * * cd /home/sigma/cg-terminal && node scripts/wake_analysis.mjs >> desk/rounds.local.log 2>&1
@reboot cd /home/sigma/cg-terminal && nohup node scripts/desk_daemon.mjs >> desk/rounds.local.log 2>&1
```

Prerequisite: `wake_cmd` must be configured (§8.2) — otherwise the task still lands in `WAKE.md` and fires the desktop notification, and the next manual Antigravity activation handles it.

### 8.4 The standard wake prompt (what Antigravity does when woken)

Every woken analysis run MUST follow this checklist — the binding contract between the beacon and the agent:

```
WAKE (analysis round):
1. git pull --rebase origin main
2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (this document is the SOP)
3. Pull live telemetry for the target symbols: /api/cg/screener, /api/cg/narrative,
   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,
   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json
4. Run the 6-step DECIDE (§1) per symbol across ALL 16 dimensions (§2)
5. Compute the LSR and apply the Liquidation Magnet Gate (§3): LSR >= 2.5:1
   bans passive entries into the magnet path (S3/S2) — wait for the S1 sweep
6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %
7. For every Grade >= B candidate: write a Formulation Card (§9.2) into
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
SETUPS: S1 sweep-reversal · S2 VA-edge-fade · S3 wall-front-run(GATED) ·
        S4 wall-pull-breakout · S5 vwap-reversion · S6 trap-fade ·
        S7 absorption-continuation · S8 liq-breakout
GATE:   LSR ≥ 2.5:1 (±2%) → passive entries into the magnet path BANNED —
        wait for the S1 sweep (exhaustion close + delta flip)
SCORE:  ≥7.0 = A (1.0%) · 5.0–6.5 = B (0.5%) · <5.0 = NO TRADE · max 11.5
RISK:   ≤2 crypto slots + 1 macro (XAU/XAG/USO) · heat ≤1.0% · +1.0R → BE
        8 bars no +0.5R → out · scale 40/40/20 into VA edge / POC / liq sweep
EXEC:   passive limits only · mt5Level = perpLevel × (1 + basisPct/100) ·
        spread < 0.15% & < 20% of stop · pad the side · re-derive every number
```

### 9.2 Formulation Card template

```markdown
## FORMULATION · <SYMBOL> · <ts UTC> · <S#> <name>
Regime: <TREND_UP|TREND_DOWN|RANGE|COMPRESSION> — <one-line evidence>
Direction: LONG|SHORT · Grade: A|B (score X.X/11.5) · Risk: 1.0%|0.5% = $<amt>
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
D12 LSR <v>:1 (<side> dominant, ±2% window) → GATE: <open|BANNED — wait for sweep>
D13 GEX: <POSITIVE|NEGATIVE> · γ-flip <v> · max pain <v> (BTC/ETH)
D14 OI: Δ1h <v>% · Δ4h <v>% · quadrant <v> · funding APR <v>% · L/S <v>
D15 spread <v>% · stop dist <v>% · drag <v>% → <PASS|C|SKIP>
D16 invariants: heat <v>% · slots <n>/3 · BE armed <ts?> · bars since fill <n>
Entry: <ladder/zone, translated> · Stop: <v> (<rationale>) ·
T1 <v> (<x.x>R · Day VAH/VAL) · T2 <v> (<x.x>R · Month/Session POC) · T3 <v> (<x.x>R · liq sweep)
Table 7: [trend <v> · regime <v> · signal <v> · wall <v> · cvd <v> · gate <v> · gex <v> · spread <v>] = <X.X> · vetoes: <none|list>
```

### 9.3 Change control

This manual changes only by: (a) user directive, or (b) a logged `DIALOG` between both agents proposing an amendment that the user approves. Every change bumps the version header and appends a line to `desk/log.md`.

---

*End of manual. Trade well, score honestly, respect the gate.*
