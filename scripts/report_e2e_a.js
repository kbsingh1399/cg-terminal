// E2E Backtest Report — sections 1-4 (exec summary, method, journey, results)
const {
  Paragraph, TextRun, PageBreak, AlignmentType,
  P, coverP, buildCoverR1, h1, h2, body, r, bullet, caption, chart, tbl, tableTitle,
} = require("./report_lib.js");

// ---------- Section 1 — Executive Summary ----------
const s1 = [
  h1("Executive Summary"),
  body([r("This report closes the loop on the original mandate: design a scalable, verifiably profitable strategy from the footprint order-flow signals (exhaustion, divergence, absorption) on the top-20 crypto perpetuals. The reverse-engineering of Hyperliquid's most profitable accounts (companion report) produced five strategy blueprints; the two that are testable on our 180-day bar-level dataset — the exhaustion/absorption confluence short (Blueprint 1) and the funding-aware carry short (Blueprint 3), both wrapped in the asymmetric loss-control discipline every profitable account showed (Edge 5) — were implemented in an event-accurate portfolio simulator and optimized end-to-end with a strict walk-forward protocol, starting from "), r("$5,000", { bold: true }), r(" of initial equity.")]),
  body([r("The headline result is a negative, and it is the most valuable output of the study. After a full bias audit — eliminating a confluence-filter lookahead and rebuilding the asset universe point-in-time as it was knowable at the sample start — the optimized walk-forward portfolio loses ", ), r("36.1% of equity", { bold: true, color: "B0413E" }), r(": $5,000 becomes $3,197 over the 120-day out-of-sample window, with a maximum drawdown of 36.6% and a Monte-Carlo probability of loss of 100%. The same engine, same signals and same discipline run on the original (survivorship-biased) universe had produced +32.4% — a 68-percentage-point swing caused entirely by how the top-20 list was constructed. The apparent edge was long exposure to tokens that entered the top-20 because they pumped during the backtest window.")]),
  body([r("Three findings survive the audit and matter for any future attempt. First, the signal family carries real but ", ), r("sub-cost information", { bold: true }), r(": the median of all 1,728 tested configurations loses 7.6%, and the best honest configuration still cannot clear 15bp round-trip costs. Second, the walk-forward optimizer reliably finds lottery-shaped configurations in training data (win rates below 20%, payoff ratios above 6x) whose training edges of +300 to +3,800bp per trade decay to negative out-of-sample — a textbook overfitting signature, not a tradable edge. Third, the structural edges documented in the companion trader report (spread/rebate capture, inventory hedging, stale-quote arbitrage, funding capture) are unavailable at $5,000 retail scale, which is precisely why the replicable residue of this research is confirmation-layer value, not standalone alpha.")]),
  tableTitle("Table 1 — Headline results at $5,000 initial equity (out-of-sample only)"),
  tbl(
    ["Metric", "Honest run (PIT universe)", "Biased run (Nov-ranked universe)"],
    [
      ["Final equity", "$3,197.15", "$6,618.67"],
      ["Total return (121 days)", "-36.06%", "+32.37%"],
      ["Maximum drawdown", "-36.6%", "-7.6%"],
      ["Sharpe / Sortino (daily)", "-10.91 / -12.25", "+1.57 / +7.06"],
      ["Trades (OOS)", "104", "101"],
      ["Win rate / payoff ratio", "9.6% / 0.86x", "19.8% / 6.68x"],
      ["Profit factor", "0.09", "1.65"],
      ["Monte-Carlo P(loss)", "100%", "10.9%"],
      ["BTC buy & hold (same window)", "+10.0%", "+10.0%"],
      ["No-skill reference (config median)", "$4,619 (-7.6%)", "$4,210 (-15.8%)"],
    ],
    [34, 33, 33],
    { align: ["left", "center", "center"] }
  ),
  caption("The honest run is the deliverable. The biased run is retained deliberately: quantifying the survivorship bias is itself a result."),
  body([r("Recommendation, stated plainly: do not deploy these signals standalone at $5,000. Use them as confirmation gates inside a broader execution stack — the role the prior 180-day signal study assigned them (M1/M2 confluence) and the role this backtest confirms. Section 6 translates the six verified institutional edges into what is and is not reachable from a $5,000 account, and Section 7 lists the concrete next steps that follow from the evidence.", )]),
];

// ---------- Section 2 — Mandate, Data and Methodology ----------
const s2 = [
  h1("Mandate, Data and Methodology"),
  h2("2.1 Mandate and scope"),
  body("The end-to-end job was specified as: take the strategy candidates derived from the profitable-trader reverse engineering, backtest them end-to-end from $5,000 of initial equity, optimize them honestly, and report the final results. Scope decisions: the backtest runs on Binance USDT-M perpetual data (the only source with 180 days of bar-level taker-split volume, validated earlier as 74-75% congruent with aggregated five-venue footprints); the strategy family is the short-side exhaustion/absorption confluence book, the funding-aware bear-divergence carry book, and their long-side mirrors; and the optimization must never see the future — neither in signal construction, nor in universe membership, nor in parameter selection."),
  h2("2.2 Data"),
  body("All inputs are reproducible artifacts of the fp-research pipeline. The universe is the point-in-time top-20 (Section 3.3). Per symbol: 180 days of 1-minute bars (about 259,000 per symbol, 5.19 million in total) for price-zone attribution, 15-minute bars (about 17,280 per symbol) as the signal timeframe, 4-hour bars for regime classification, and the complete 8-hour funding settlement history (540 settlements for BTC; every symbol covered). The calibrated Coinglass-exact signal engine (validated 9/9 against the live Coinglass BTC panel, including the trapped-traders class) generates 119,808 raw signals across the 20 symbols; 5,514 events pass the eligibility filters of at least one strategy rule (2,968 long-side, 2,546 short-side)."),
  h2("2.3 Strategy family (from the trader report)"),
  body("Blueprint 1 (SilkBtc / NAKED SHORTS ONLY / Fasanara archetype) shorts bearish exhaustion and absorption events that carry multi-class confluence, gated by a confirmed 4-hour downtrend. Blueprint 3 (Fasanara / John Wick archetype) shorts bearish divergences only when the 3-day funding z-score exceeds +1 — crowded longs paying to stay long. Edge 5 (present in every consistently profitable account) is enforced through the exit design: wide ATR disaster stops rather than tight risk stops, time exits or open-ended patience, and small fixed-fractional risk per trade. A long-side mirror (bullish exhaustion confluence, bull-divergence carry at funding z below -1) is included as a falsification probe, because the raw event table shows bull_div carrying the strongest unconditional 24-hour drift (+55.8bp)."),
  h2("2.4 Portfolio simulator"),
  body("The engine is event-accurate rather than bar-approximate. Positions settle at the entry timestamp of the next trade; sizing compounds on settled equity; each position risks a fixed fraction of equity (0.5% or 1.0%) across the distance to its disaster stop, capped at 2x equity per position; portfolio gross notional is capped at 3x equity (the realized maximum was 0.77x, so the cap never bound); one position per symbol; at most 4-6 concurrent positions. Costs are 15bp round trip (Binance USDT-M VIP0 taker fees plus slippage), with a 25bp stress variant. Funding is credited and debited at every 8-hour settlement the position spans — shorts receive positive funding, longs pay it. Stops are ATR(20) multiples (3x or 6x) beyond the signal bar extreme; an optional ratcheting chandelier trail (3x or 6x ATR) tightens behind favorable moves using only closed-bar information; exit horizons are 12h, 24h, 48h or a 14-day patience cap; the final bar of the archive force-closes any open trade."),
  h2("2.5 Walk-forward protocol and grid"),
  body("The 180-day archive is rolled into four folds: each fold trains on the trailing 60 days and tests on the next 30 days, covering 2026-07-16 through 2026-11-13 out-of-sample (121 days). On each training window every configuration is ranked by net expectancy in basis points per trade (after costs and funding), requiring at least 25 trades and a positive mean, with profit factor as the tie-break; if nothing qualifies, the portfolio sits in cash for that fold. The selected configuration is then applied once to the unseen 30 days and the equity carries over. The grid spans 9 rule sets x 2 regime gates x 2 stop multiples x 3 trail variants x 4 exit horizons x 2 concurrency caps x 2 risk fractions — 1,728 configurations in total. Alongside the walk-forward path, the full out-of-sample distribution of all 1,728 configurations is computed as a no-skill reference, plus a BTC buy-and-hold benchmark, four stress variants, and a 4,000-path Monte-Carlo bootstrap of the out-of-sample trade sequence."),
  tableTitle("Table 2 — Engine specification"),
  tbl(
    ["Parameter", "Value"],
    [
      ["Initial equity", "$5,000 (compounding, event-accurate settlement)"],
      ["Risk per trade", "0.5% or 1.0% of equity across the stop distance"],
      ["Position / portfolio caps", "2x equity per position; 3x gross; realized peak 0.77x"],
      ["Concurrency", "1 per symbol; 4 or 6 concurrent"],
      ["Costs", "15bp round trip (25bp stress)"],
      ["Funding", "8h settlements, sign-correct per side"],
      ["Stops / trails", "ATR(20) x {3, 6} disaster; chandelier trail x {0, 3, 6}"],
      ["Exit horizons", "12h / 24h / 48h / 14d cap"],
      ["Folds", "60d train -> 30d test, rolling x4 (121 OOS days)"],
      ["Configurations", "1,728 (864 precomputed schedules)"],
    ],
    [34, 66]
  ),
  caption("Every number in the results section derives from this specification; the run is reproducible from scripts/fp-research/e2e_backtest.py."),
];

// ---------- Section 3 — The optimization journey and the two bias traps ----------
const s3 = [
  h1("The Optimization Journey and the Two Bias Traps"),
  h2("3.1 Four runs, two corrections"),
  body("The end-to-end job was executed as a sequence of four runs. Each run's only changes were correctness fixes or grid extensions — never a re-tune after seeing out-of-sample results. The progression isolates exactly where the apparent profitability came from, which is the core finding of this report."),
  tableTitle("Table 3 — Run progression (all at $5,000 initial equity)"),
  tbl(
    ["Run", "Change", "OOS result", "No-skill median"],
    [
      ["v1", "Baseline: short-only grid, +/-6-bar confluence window, Nov-13 volume-ranked universe", "-8.0% ($4,600)", "$3,636 (-27%)"],
      ["v2", "Grid extended: chandelier trails, long-side mirrors, 14-day patience exits", "+23.1% ($6,153)", "$4,400 (-12%)"],
      ["v3", "Confluence lookahead eliminated (signals counted only once confirmed by entry time)", "+32.4% ($6,619)", "$4,210 (-16%)"],
      ["v4 FINAL", "Universe rebuilt point-in-time as knowable on 2026-05-17", "-36.1% ($3,197)", "$4,619 (-7.6%)"],
    ],
    [10, 44, 23, 23],
    { align: ["center", "left", "center", "center"] }
  ),
  caption("The confluence fix (v2 to v3) made the biased run stronger — the leak was not the source of profit. The universe fix (v3 to v4) removed 68.4 percentage points of return."),
  h2("3.2 Bias trap 1 — confluence lookahead"),
  body("The confluence filter counted confirming signal classes within +/-6 bars (90 minutes) of the trigger event. But a trade enters one to three bars after its trigger, and a confirming signal arriving after the entry decision is unknowable at entry. The fix counts a confirming signal only once its own confirmation bars have closed — at or before the moment our entry order is placed. Tightening the filter to genuinely knowable information raised the biased-universe result (fewer, cleaner entries), which is why the lookahead was not the profit source. The lesson stands: a leak-free filter is a precondition for trusting anything downstream."),
  h2("3.3 Bias trap 2 — universe survivorship (the decisive one)"),
  body("The original top-20 was ranked by 24-hour quote volume on 2026-11-13 — the day the research began, which is also the last day of the backtest window. Eight of twenty members (AGT, AKE, ARIA, BARD, ENA, INIT, JCT, UNI) earned their seats through volume that accrued during the window, much of it on the way up. A long-biased strategy on that list rides the winners of a competition whose outcome is already embedded in the membership. The point-in-time rebuild ranks all 459 eligible USDT perps by their quote volume in the first week of the sample (2026-05-17 to 05-24), applying the same age (150+ days) and product exclusions as the original selection. Eight names drop out; BCH, BEAT, EDEN, FIDA, LAB, ONDO, TAO and WLD enter. The full histories for the new members were fetched from Binance, signals regenerated with the same calibrated engine, and the event table rebuilt (119,808 signals). On this knowable universe the identical walk-forward loses 36.1%."),
  tableTitle("Table 4 — Universe membership: knowable at sample start vs ranked at sample end"),
  tbl(
    ["Point-in-time top-20 (May 2026 week-1 volume)", "Removed (Nov-ranked only)"],
    [
      ["BTC, ETH, HYPE, SOL, ZEC, XRP, NEAR, DOGE, EDEN, SUI, FIDA, BNB, BEAT, ONDO, 1000PEPE, LAB, BCH, ADA, WLD, TAO", "AGT, AKE, ARIA, BARD, ENA, INIT, JCT, UNI"],
    ],
    [62, 38]
  ),
  caption("HYPE was already the #3 perp by volume in the first week of the sample — its membership is legitimate in both lists. The removed names are exactly where the biased run's largest winners lived (JCT +277% and ARIA +155% over 14-day holds)."),
  body("The mechanism deserves emphasis because it is the most common way retail backtests lie. The biased run was not a fluke of noise: it had a 19.8% win rate, a 6.68x payoff ratio, a 1.65 profit factor and only a 7.6% maximum drawdown — it looked like the asymmetric-loss-control profile of the professional short sellers we reverse engineered. Every one of those statistics was real, computed on real prices with real costs. What was fake was the sample: a long book on tokens selected by their subsequent pumps. Survivorship bias does not produce fragile-looking results; it produces beautiful ones."),
];

// ---------- Section 4 — Final results, honest run ----------
const s4 = [
  h1("Final Results — the Honest Run at $5,000"),
  h2("4.1 Equity path and risk metrics"),
  body("Figure 1 shows the out-of-sample equity path of the honest (point-in-time universe) run against the biased run and BTC buy-and-hold over the identical window. The honest path declines in every fold: -$735 (Jul 16 - Aug 15), -$260 (Aug 15 - Sep 14), -$125 (Sep 14 - Oct 14) and -$683 (Oct 14 - Nov 13). The walk-forward selector did its job — it avoided the worst configurations, beating the all-configuration median ($4,619) by $1,422 — but avoiding the worst is not the same as finding the good, and no fold produced a positive month."),
  chart("chart1_equity.png", 560),
  caption("Figure 1: Out-of-sample equity from $5,000. Red: honest point-in-time universe. Blue: the identical engine on the survivorship-biased universe. Grey dashed: BTC buy-and-hold."),
  tableTitle("Table 5 — Honest run, full risk profile (OOS window 2026-07-16 to 2026-11-13)"),
  tbl(
    ["Metric", "Value", "Metric", "Value"],
    [
      ["Final equity", "$3,197.15", "Win rate", "9.6%"],
      ["Total return", "-36.06%", "Payoff ratio (avg win / avg loss)", "0.86x ($18.05 / $21.10)"],
      ["Annualized", "-74.0%", "Profit factor", "0.09"],
      ["Maximum drawdown", "-36.6%", "Expectancy per trade", "-$17.34"],
      ["Sharpe (daily, annualized)", "-10.91", "Average / max notional", "$635 / $1,959"],
      ["Sortino (daily, annualized)", "-12.25", "Average holding time", "68.5 hours"],
      ["Peak gross leverage", "0.77x", "Funding received / costs paid", "-$7.28 / $99.00"],
      ["Trades (OOS)", "104", "Exit mix (stop / trail / time)", "83 / 11 / 10"],
    ],
    [26, 24, 28, 22],
    { align: ["left", "center", "left", "center"] }
  ),
  h2("4.2 What the optimizer chose, fold by fold"),
  body("Figure 2 and Table 6 show the configuration selected on each trailing 60-day window and its out-of-sample outcome. The selector rotated across the long-side exhaustion book (folds 1 and 4), the short-side exhaustion book (fold 2) and the funding-carry short (fold 3) — chasing whatever had worked in the previous two months. Training expectancies ranged from +370 to +549bp per trade with profit factors of 2.0 to 4.4; every fold then lost money out-of-sample. Fold 4 is the cleanest illustration: the long-side exhaustion book with a 6-ATR disaster stop and 14-day patience had trained at +384bp with PF 2.15, then delivered 40 trades at a 9.6% win rate for -$683."),
  chart("chart2_folds.png", 560),
  caption("Figure 2: Out-of-sample PnL per fold with the selected rule set and its training-window statistics."),
  tableTitle("Table 6 — Walk-forward selections (honest run)"),
  tbl(
    ["Fold (test window)", "Selected configuration", "Train (n / bp / PF)", "OOS (n / PnL)"],
    [
      ["1 (Jul 16 - Aug 15)", "L1_exh1 long, no gate, k=6, no trail, 14d hold, conc 4, 0.5% risk", "43 / +433 / 2.04", "33 / -$735"],
      ["2 (Aug 15 - Sep 14)", "A_exh1 short, trend-aligned, k=6, no trail, 14d hold, conc 4, 0.5%", "36 / +549 / 2.95", "18 / -$260"],
      ["3 (Sep 14 - Oct 14)", "F_bdz1 carry short, aligned, k=3, trail 6, 24h hold, conc 4, 0.5%", "27 / +370 / 4.42", "13 / -$125"],
      ["4 (Oct 14 - Nov 13)", "L1_exh1 long, aligned, k=6, no trail, 14d hold, conc 4, 0.5%", "35 / +384 / 3.70", "40 / -$683"],
    ],
    [20, 42, 19, 19],
    { align: ["left", "left", "center", "center"] }
  ),
  h2("4.3 Trade anatomy"),
  body("Figure 3 decomposes the 104 out-of-sample trades. The PnL histogram shows the intended asymmetric-loss-control shape — many small losses, few large wins — but the asymmetry is not strong enough: the average win of $18.05 fails to cover the average loss of $21.10 at a 9.6% win rate, so the payoff ratio lands at 0.86x where the professional accounts profiled in the companion report operate at 3-5x. The holding-time panel shows winners needing multi-day runs to pay for the book, and the per-symbol panel shows the damage concentrated in the mid-cap entrants of the point-in-time universe."),
  chart("chart3_anatomy.png", 580),
  caption("Figure 3: PnL per trade, PnL versus holding time, and per-symbol attribution (honest run)."),
  h2("4.4 Robustness: stress and Monte Carlo"),
  body("Figure 4 quantifies the downside. The 4,000-path bootstrap of the realized trade sequence puts the 5th-percentile outcome at $2,997, the median at $3,196 and the 95th at $3,422 — the probability of finishing below the starting $5,000 is 100%, and every path breaches a 20% drawdown. Cost stress (25bp round trip) deepens the loss only marginally to $3,145 because the failure is directional, not cost-marginal: removing the funding credit entirely costs just $6 (the strategy was net long and paid funding), confirming that carry was never the engine of either run."),
  chart("chart4_mc_stress.png", 560),
  caption("Figure 4: Monte-Carlo bootstrap of the OOS trade sequence (left) and final equity under stress variants (right)."),
];

module.exports = { s1, s2, s3, s4 };
