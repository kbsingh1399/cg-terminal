// Trade Formulation Playbook — content part A (sections 1-4)
// Pure data module consumed by build-playbook.js

module.exports = [
  // ============================ 1. EXECUTIVE SUMMARY ============================
  { t: "h1", text: "1. Executive Summary" },
  { t: "p", text: "This playbook is the trading methodology for the CG Order-Flow Terminal: a complete, code-grounded procedure for converting the terminal's twelve data surfaces into position decisions. It answers the three questions posed for this engagement. First, do we have confirmed access to every data point at every dimension - asset, timeframe, venue, distribution layer and liquidation level - through the Antigravity MCP layer? Yes: this session upgraded the MCP server from 9 to 14 tools, exposed the full parameter space of every route, fixed a field-reference bug that silently zeroed the book-imbalance readout, and verified the entire surface with an 18-of-18 live end-to-end test (Section 2). Second, how do we formulate a trade from these data points? Section 4 defines the six-step DECIDE pipeline - regime, liquidity map, trigger, confluence score, execution, risk - with every threshold quoted from the terminal's own Coinglass-exact engines. Third, what are the concrete setups? Section 5 specifies eight fully rule-based setups with entry, stop, target and invalidation definitions." },
  { t: "p", text: "Everything in this document is derived from the shipped code, not from generic trading literature. The footprint signal engine is the line-by-line port of Coinglass's client algorithm (src/lib/cg/cg-signals.ts); the wall scanner replicates their Liquidity Heatmap page engine (book-walls.ts); the liquidation-levels model replicates their page model (liq-model.ts); CVD divergences replicate their cvd page engine (cvd.ts). Where the playbook cites a threshold - the 15 percent delta requirement for a divergence, the 30 percent zone share for absorption, the wall-confirmation scan count - it is the exact constant the production engine uses. Live figures quoted as evidence (BTC book depth of 1.42 billion USD bid against 1.08 billion USD ask, 83.79 billion USD of estimated long liquidations below price, 1,288 resting whale orders across 14 exchanges) are the values returned by the access test run on 10 November 2026." },
  { t: "p", text: "The intended operating model is the Antigravity wake-up loop already documented in AGENTS.md: the agent polls the notification feed, triages HIGH-severity events, calls analyze_setup for the affected asset, and formulates the trade with the bias, entry, stop and target rules in Section 4.5. A human trader can execute the identical procedure manually in the terminal UI. This document formalizes that loop into a scoring system with explicit risk gates, so that the difference between an A-grade and a B-grade setup is a number, not a feeling." },
  { t: "note", text: "Scope note. This is a methodology document for operating a private analytics terminal. Liquidation and whale figures are Coinglass model estimates, not exchange facts. Perpetual-futures trading involves substantial risk of loss; nothing here is investment advice, and every rule should be validated in paper mode before capital is committed." },

  // ============================ 2. DATA SURFACE AUDIT ============================
  { t: "h1", text: "2. Data Surface Audit - Confirmed Access at Every Dimension" },
  { t: "p", text: "Before any trade formulation, the access question had to be settled: can the agent reach each and every data point, at each and every time, distribution layer, asset level and liquidation level? The audit below is the definitive answer, read directly from the shipped routes and re-verified live. The terminal exposes 16 data routes plus an SSE stream; the MCP layer now mirrors all of them with their full dimension sets." },

  { t: "h2", text: "2.1 The access matrix" },
  { t: "p", text: "Table 1 maps every data point to its HTTP route, its MCP tool, and the dimensions under operator control. Anything not parameterized in a tool is fixed by design (for example the signal engine always runs all three bar types). Historical reach is uniform where upstream permits: book walls and the stopmap accept an endTime parameter paging back up to 30 days; klines and order flow are bounded only by the 1,000-row request cap; the notification feed is cursor-based with JSONL persistence." },
  { t: "table", title: "Table 1 - Data point access matrix (route, MCP tool, controllable dimensions)",
    headers: ["Data point", "Route", "MCP tool", "Dimensions under control"],
    widths: [22, 20, 17, 41],
    rows: [
      ["Candles (OHLCV)", "/api/cg/kline", "kline_series", "Instrument key (any venue), type kline, interval m1-d1, up to 1,000 rows"],
      ["Open interest", "/api/cg/kline?type=oi", "kline_series", "Same instrument and interval space as candles"],
      ["Aggregated footprint bars", "/api/cg/orderflow-agg", "footprint", "Asset, interval 1m-1h, up to 500 bars; per-bar buy/sell USD, delta, POC"],
      ["Per-venue footprint", "/api/cg/orderflow", "-", "Instrument, interval, limit (UI and scanner use)"],
      ["Footprint signals", "/api/cg/signals", "signals", "Asset, bar type (time / vol / range)"],
      ["Market structure", "/api/cg/market", "market_snapshot", "Asset; returns EMA 13/89/233 + RSI on m15/h1/h4/d1, VWAP +/-1-3 sigma, session/day/month VAL-POC-VAH"],
      ["Book walls + depth", "/api/cg/bookwalls", "book_walls", "Asset, market futures/spot, interval 1m-1d, 10-500 snapshot frames, band 0.5-20 percent, endTime (30-day history)"],
      ["Liquidation heatmap", "/api/cg/stopmap", "stopmap", "BTC only (upstream limit); 24h window; endTime history"],
      ["Liquidation levels", "/api/cg/liqlevels", "liquidation_levels", "Asset, range 3d/7d/30d, lvR percent radius; 4-venue aggregate"],
      ["Whale resting orders", "/api/cg/lto", "whale_orders", "Asset, minimum USD; every supported exchange"],
      ["Large orders + trades", "/api/cg/largeorder", "large_orders", "Instrument key, lookback 1-720 hours, interval"],
      ["CVD state", "/api/cg/cvd", "cvd_state", "Asset, mode perp/spot/total, interval 1m-1d, 50-1,500 bars, KPI anchor all/day/week"],
      ["Notification feed", "/api/cg/notifications", "notifications", "Cursor (since), asset filter, source filter, limit up to 200"],
      ["Live price", "/api/cg/ticker", "live_price", "Asset; 1-second-grade forming m1 close"],
      ["Asset registry + health", "/api/cg/assets", "list_assets", "All 12 assets with engine and scanner status"],
      ["Engine status / backfill", "/api/cg/engine/*", "-", "Continuity state; backfill trigger (same-origin only)"],
    ] },

  { t: "h2", text: "2.2 Venue routing per asset" },
  { t: "p", text: "Aggregation depth differs by asset because the upstream aggregate streams only exist for the majors. This is routing, not data loss: each asset is aggregated over every venue that actually carries it. The footprint engine adds a fourth venue (Hyperliquid) wherever the asset is listed there; metals are not listed on Hyperliquid, so they aggregate over three venues." },
  { t: "table", title: "Table 2 - Venue aggregation by asset group",
    headers: ["Asset group", "Walls / heatmap agg.", "Footprint agg.", "Liq levels", "CVD whitelist"],
    widths: [18, 26, 20, 16, 20],
    rows: [
      ["BTC, ETH", "Binance, OKX, Gate, Bitget, Hyperliquid (futures); 7 venues spot", "Binance, OKX, Bybit, Hyperliquid", "4 venues", "13 perp + 9 spot venues"],
      ["Alts (SOL to LTC)", "Binance + Hyperliquid", "Binance, OKX, Bybit, Hyperliquid", "4 venues", "13 perp + 9 spot venues"],
      ["XAU, XAG", "Binance only (no spot books)", "Binance, OKX, Bybit", "3 venues", "13 perp + 9 spot venues"],
    ] },

  { t: "h2", text: "2.3 Scanner cadence and the event feed" },
  { t: "p", text: "The server-side scanner turns every surface into events on two independent lanes: a fast lane for BTC, ETH and SOL refreshing each asset approximately every 3.0 minutes, and a slow lane for the remaining nine assets at approximately 13.5 minutes each, for a constant total rate of 1.67 scans per minute - the same upstream load as the legacy schedule, but with the majors now covered six times more often. Events deduplicate over a 30-minute window keyed by asset, source, kind, bar timestamp, bar type and price, so a repeated condition at a different price still fires. The feed rings the last 2,000 events in memory, persists to JSONL, streams over SSE, and serves the MCP cursor used by Antigravity. At the time of the access test the feed was producing 159 events per 24 hours." },
  { t: "table", title: "Table 3 - HIGH-severity event taxonomy (immediate-analysis triggers)",
    headers: ["Source", "HIGH events", "Info events (context only)"],
    widths: [20, 44, 36],
    rows: [
      ["footprint", "Absorption, Trap, Strong Divergence", "single-bar Divergence, Exhaustion"],
      ["indicators", "Day-VWAP +/-3 sigma band cross", "RSI OB/OS, POC/VAH/VAL crosses, EMA13x89 crosses, day high/low breakouts"],
      ["whale-orders", "New resting wall at or above 10M USD", "aggregate bid/ask imbalance flips"],
      ["liqlevels", "Price entering a strong liquidation cluster (sweep setup)", "-"],
      ["cvd", "Price/CVD pivot divergence (confirmed, no repaint)", "-"],
    ] },

  { t: "h2", text: "2.4 History and archives" },
  { t: "p", text: "Continuity is guaranteed by the engine, which archives six series families to the local JSONL store: per-asset m15 candles, per-venue taker flows, stopmap windows (rows keyed by bar timestamp and price so overlapping windows deduplicate), book-wall strip cells, point-in-time whale open orders, and 3d liquidation-level snapshots. On boot the engine pages upstream history with endTime pagination back to the last stored timestamp (default reach 3 days on a fresh store), so the archive is gap-free across restarts. Poll intervals are 60 seconds for candles and whale orders, 120 seconds for book walls and liquidation levels, and 300 seconds for the stopmap. The one honest exception is the whale open-order series: it has no upstream history, so gaps during downtime are unavoidable and marked." },

  { t: "h2", text: "2.5 Known limitations (and what they mean for trading)" },
  { t: "p", text: "A formulation is only as good as its honesty about what it cannot see. The table below lists every material limitation found in the audit, with the design consequence in this playbook." },
  { t: "table", title: "Table 4 - Limitations and their design consequences",
    headers: ["Limitation", "Reason", "Consequence in this playbook"],
    widths: [30, 30, 40],
    rows: [
      ["Stopmap is BTC-only", "Anonymous upstream API serves the heatmap for BTC only; other symbols return code 40000", "Sweep setups use the stopmap for BTC and the 4-venue liquidation-levels model for all other assets"],
      ["No funding-rate route", "Not implemented in the terminal", "Crowd positioning is read from OI plus taker-buy-share extremes instead; Setup S8 is built on this substitute"],
      ["No long/short account ratio, no options data", "Not implemented in the terminal", "Retail-positioning and volatility-surface confluences are out of scope"],
      ["Metals have one book-venue and no spot books", "Upstream listing reality", "Wall evidence for XAU/XAG requires stricter confirmation (Section 5, S3)"],
      ["Whale open orders are point-in-time", "No upstream history for the lto series", "Wall-age analysis relies on the book-walls scanner, which does keep first-seen timestamps"],
      ["Liquidation and whale sizes are estimates", "Coinglass leverage/OI model", "All magnet sizes are treated as relative strengths, never as literal fills"],
      ["CVD aggregates taker flow per bar", "Upstream provides per-bar buy/sell USD, not a full trade tape", "Footprint imbalances are used for precision inside a bar, CVD for direction across bars"],
    ] },

  { t: "h2", text: "2.6 The MCP access upgrade shipped in this session" },
  { t: "p", text: "The audit found the MCP layer healthy but incomplete: five surfaces had no tool, two tools hardcoded parameters, and the book_walls tool read two fields that do not exist in the route response (a dead m.kpis reference and an imbalance lookup on the wrong object, which made the imbalance line always print 0.0 percent). All of this is fixed. The server now exposes 14 tools: the nine existing ones plus stopmap, footprint, large_orders and kline_series; book_walls accepts market, interval, limit, band and endTime; cvd_state accepts itv, limit and anchor; analyze_setup now bundles six context sections including order-book walls and CVD state. The complete surface was then verified live: all 18 checks passed, including parameterized dimension sweeps (ETH walls at 1h snapshots with a 3 percent band; CVD anchored to the day at 1h), historical paging, the graceful BTC-only error path for the stopmap, and the corrected imbalance readout (13.3 percent now against 13.2 percent five minutes earlier, on a 1.42B USD bid versus 1.08B USD ask book). The upgrade is delivered as download/mcp-access-upgrade.patch, verified to apply cleanly to the d288c44 baseline and reproduce the source of truth byte for byte." },

  // ============================ 3. MICROSTRUCTURE LOGIC ============================
  { t: "h1", text: "3. Microstructure Logic - What Each Data Point Means" },
  { t: "p", text: "Every data point in the terminal describes one of three flow types. Passive flow is resting limit orders: the walls, the depth ladder, the POC. It represents intent without urgency - liquidity that is willing to wait. Aggressive flow is market orders: the taker buys and sells that make up CVD and the footprint. It represents urgency - traders paying the spread to be in the position now. Forced flow is liquidations: positions closed by the exchange at whatever price the book offers, with no intent at all. Price moves when aggressive flow consumes passive liquidity; it accelerates when forced flow piles in; and it reverses when forced flow exhausts itself against patient passive flow. Every setup in Section 5 is a specific arrangement of these three." },

  { t: "h2", text: "3.1 Walls: intent, confirmation, fill versus pull" },
  { t: "p", text: "A wall is a price bucket whose resting notional passes the scanner threshold: at least the per-asset floor (1.5M USD for BTC, 800K for ETH, 1M for XAU, 300K for the other alts and XAG) and at least the adaptive level max(6x median of nearby walls, 1.5x median, fourth-largest wall). A wall is only confirmed after it survives 3 consecutive live scans (2 in historical replay), which filters flicker. Two fields then carry the trading meaning. Age (first-seen to now) separates resting intent from transient quoting: a wall that has held for 30 minutes or more is a decision. The event feed separates real from fake: when a confirmed wall disappears after price touched its level, that is a fill - real liquidity that was consumed; when it disappears as price approaches without ever being touched, that is a pull - the classic spoof, and the level is weaker than it looked. The whale-order surface (lto) shows the same ecology per venue with remaining-versus-filled USD, which is how a wall is observed being eaten in real time." },

  { t: "h2", text: "3.2 Liquidation clusters: magnets and cascade termination" },
  { t: "p", text: "The liquidation surfaces estimate where leveraged positions would be force-closed. The liquidation-levels model aggregates unhit levels from up to four venues onto a 520-row price grid spanning 0.88 to 1.12 of the recent range, ranks the strongest rows within a configurable radius (default 4 percent) with strength normalized to 100, and tags each row with its dominant leverage tier - High around 100x, Mid around 50x, Low around 25x. The stopmap (BTC) provides the 24-hour heatmap cross-section instead. Trading meaning is asymmetric by regime. In a trend, clusters are magnets: they are pockets of forced-flow fuel, and price tends to travel toward the densest one because running it produces the liquidity that trend followers and market makers need. At the cluster itself, the game flips: once the cascade fires and the forced flow is spent, the same level that attracted price becomes the exhaustion point - this is the anatomy of the liquidation wick, and it is why Section 5 takes profit into clusters but fades them only after deceleration evidence." },

  { t: "h2", text: "3.3 CVD and the footprint: who is winning, and where" },
  { t: "p", text: "Cumulative Volume Delta is the running sum of taker buys minus taker sells across the aggregated venues, separable into perp and spot components with a taker-buy share per bar. Direction of CVD says who is aggressing; the quadrant classification (both-buying, both-selling, spot-bid, perp-driven) says which population. The footprint decomposes each bar onto a price grid, which is where aggression is located precisely: the signal engine fires five event types with exact thresholds. Absorption: at least 30 percent of the bar's selling concentrated in the bottom 20 percent of the bar's range, at least 1.2x the buying there, yet the close lands in the top 40 percent of the bar - sellers hit a wall of passive bids. Divergence: the bar closes up on a delta of at least negative 15 percent of volume (or the mirror) - aggression that failed to move price. Trap: a 5-bar extreme broken on at least 30 percent concentrated flow, then reversed back within 3 bars - the breakout crowd is caught. Exhaustion: a new 10-bar extreme with at most 2 percent of volume in the extreme 10 percent of the range - nobody home at the new price. Strong divergence: consecutive swing pivots within 40 bars where price makes the new extreme but cumulative delta does not follow by more than a quarter of median volume. Diagonal imbalances (a price row versus its opposing neighbor) locate the exact levels where one side dominates." },

  { t: "h2", text: "3.4 Context levels: fair value and regime" },
  { t: "p", text: "Three families of derived levels frame every decision. The day VWAP with 1-3 sigma bands is the statistical fair value of the current UTC day; plus or minus 2-3 sigma marks where the day's flow is extended, and the scanner treats a 3-sigma touch as a HIGH event. The auction profiles - session (trailing 8 hours), UTC day and UTC month - locate VAL, POC and VAH: the prices where real business actually transacted, which behave like memory in revisits. The EMA set 13/89/233 on m15 through d1 defines trend regime; the scanner watches the 13x89 cross specifically. These levels do not trigger trades; they grade them - a setup aligned with the monthly POC and the h4 trend is an A candidate, the same footprint event into a 3-sigma extension against trend is a fade candidate at best." },

  // ============================ 4. THE FRAMEWORK ============================
  { t: "h1", text: "4. The Trade Formulation Framework (DECIDE)" },
  { t: "p", text: "The framework is a fixed six-step pipeline. Every trade - manual or agent-formulated - passes through the same gates in the same order: Direction (regime), Exposure map (liquidity), Candidate (trigger event), Inspection (confluence score), Decision (entry, stop, targets), and Execution discipline (risk). The steps are cheap: with the MCP tools, steps 1-2 are three tool calls and step 3 is usually already delivered by the notification feed." },

  { t: "h2", text: "4.1 Step 1 - Regime" },
  { t: "p", text: "Call market_snapshot for the asset and classify into one of four regimes using three readings: the h4 EMA13 versus EMA89 relationship and price position relative to both; price versus the day VWAP; and the session-anchored CVD slope with the OI behavior from kline_series type=oi. Two of three agreeing defines the regime; a 2-2 split means range." },
  { t: "table", title: "Table 5 - Regime classification and permitted setups",
    headers: ["Regime", "Signature", "Permitted setups"],
    widths: [16, 50, 34],
    rows: [
      ["Trend up", "h4 EMA13 above EMA89; price above day VWAP; session CVD rising; OI rising with price (new longs) or flat", "S7 long pullbacks, S4 breakouts long, S5 fades of downside sweeps"],
      ["Trend down", "h4 EMA13 below EMA89; price below day VWAP; session CVD falling; OI rising with falls (new shorts)", "S7 short pullbacks, S4 breakouts short, S5 fades of upside sweeps"],
      ["Range", "EMA13 and EMA89 entangled or flat; price oscillating across VWAP; CVD flat", "S1, S2, S3, S6, S8 in either direction at range edges"],
      ["Violent", "Day range beyond 3 sigma; cascading liquidation events; CVD vertical", "Only S5 after deceleration evidence; otherwise stand aside"],
    ] },

  { t: "h2", text: "4.2 Step 2 - The liquidity map" },
  { t: "p", text: "Build the level ladder before any trigger arrives: book_walls for confirmed walls within 3 percent with their ages and add/fill/pull history; liquidation_levels (3d, and 7d for context) for the strongest clusters above and below with strength and leverage tier; market_snapshot for VWAP bands, session/day/month POC, VAH, VAL and the day high/low. For BTC, add stopmap for the 24-hour exposure cross-section. The output is a ranked price ladder: each level labeled as support-type (bid wall, long-liq cluster below, VAL, minus-sigma band) or resistance-type (ask wall, short-liq cluster above, VAH, plus-sigma band). This ladder is where entries are placed and targets are chosen; a trade without a ladder position is not taken." },

  { t: "h2", text: "4.3 Step 3 - Trigger events" },
  { t: "p", text: "Trades are event-initiated, never chart-initiated. The HIGH taxonomy of Table 3 defines the triggers; the mapping from trigger to candidate setup is fixed:" },
  { t: "table", title: "Table 6 - Trigger-to-setup mapping",
    headers: ["Trigger event", "Primary setup", "Secondary"],
    widths: [40, 30, 30],
    rows: [
      ["Absorption at a ladder level", "S1 Absorption Reversal", "S7 if aligned with trend"],
      ["Trap (failed breakdown / breakout)", "S2 Trap Reclaim", "S5 if a cluster was swept"],
      ["Strong divergence on swings", "S6 CVD Swing Divergence", "S8 if at sigma extension"],
      ["Whale wall at or above 10M USD added on the ladder", "S3 Wall Fade (fade into it)", "S4 if it later pulls"],
      ["Price entering strong liquidation cluster", "S5 Liquidation Sweep Fade", "-"],
      ["VWAP 3-sigma band cross", "S8 Crowd Exhaustion Fade", "S6 with divergence"],
    ] },

  { t: "h2", text: "4.4 Step 4 - The confluence score" },
  { t: "p", text: "Score the candidate once, at formulation time, using only data present in the tool responses. The long-side checklist follows; the short side mirrors every line. The maximum is 11.5 points. Thresholds: at least 7.0 is an A setup (full unit of risk), 5.0 to 6.5 is a B setup (half risk), below 5.0 is no trade. The score is recorded in the journal with the trade - it becomes the independent variable for weekly review." },
  { t: "table", title: "Table 7 - Confluence checklist (long side; short side mirrors)",
    headers: ["Factor", "Condition (long)", "Pts", "Read from"],
    widths: [24, 46, 8, 22],
    rows: [
      ["Regime alignment", "Trend up, or range with price at lower edge", "2.0", "market_snapshot"],
      ["Trigger strength", "HIGH event within the last 30 minutes in the trade direction", "2.0", "notifications"],
      ["Wall support", "Confirmed bid wall within 0.5 percent below entry, age at least 30 minutes, not yet touched", "1.5", "book_walls"],
      ["Magnet room", "Nearest same-direction cluster at least 1 ATR-equivalent away (target space)", "1.0", "liquidation_levels"],
      ["Protective backstop", "Dense opposing cluster or wall just beyond the stop level", "0.5", "book_walls / liqlevels"],
      ["CVD confirmation", "Session CVD rising, or fresh confirmed divergence in favor", "1.5", "cvd_state"],
      ["Footprint precision", "Diagonal buy imbalance at the entry zone, or bar POC at/below entry", "1.0", "footprint / signals"],
      ["Whale flow", "Resting book bid-heavy by more than 10 percent, or recent executed buy dominance", "1.0", "whale_orders / large_orders"],
      ["OI behavior", "OI falling into the entry low (weak hands exiting) or rising on the reversal bar", "0.5", "kline_series type=oi"],
      ["Fair value", "Entry at or below day POC, or at minus 1 sigma or lower", "0.5", "market_snapshot"],
    ] },

  { t: "h2", text: "4.5 Step 5 - Execution rules" },
  { t: "p", text: "Entry types. Type A (limit at level): place at the absorption zone mid, the wall price, or the POC retest - only when the trigger has already fired and the score is known. Type B (confirmation close): enter on the first 15m close back inside the range after a trap or sweep - this is the no-repaint entry the CVD engine itself uses (its confirm bar is the swing bar plus five). Type C (breakout-retest): after a level breaks on CVD surge, enter on the retest of the broken level. Stops are always structural, never a fixed percentage: beyond the far edge of the absorption zone, beyond the sweep wick that consumed the cluster, or beyond the 3-sigma band, plus a noise buffer of 0.05 to 0.15 percent. If the structural stop is mechanically too far (more than 0.8 percent from entry on BTC, 1.2 percent on alts, 0.5 percent on metals), the position is sized down or the setup is skipped - the stop is never tightened to fit a risk number. Targets are always INTO liquidity: T1 the nearest same-direction magnet (cluster edge, opposing wall, VAH/VAL) but only if it covers at least 1R; T2 the day or month POC; T3 the extended magnet beyond. Standard scale-out is 40 percent at T1, 40 at T2, 20 runner. Minimum plan: skip any setup whose blended target is under 1.5R unless the confluence score is at least 9. Time stop: if price has not confirmed the thesis within 8 bars (2 hours on 15m), exit at market - the edge decays." },

  { t: "h2", text: "4.6 Step 6 - Risk and portfolio gates" },
  { t: "p", text: "Position size is risk-first: size equals the risk budget divided by the entry-to-stop distance, so that every A setup risks exactly one unit (0.5 to 1.0 percent of equity) and every B setup half a unit. Daily stop: minus 2R or minus 2 percent of equity, whichever comes first - then the terminal closes for the day. Weekly stop: minus 4R. Correlation gate: the ten crypto assets are one correlated block in stress - at most two same-direction crypto positions open, and net directional exposure capped at plus or minus 2R; XAU and XAG are the legitimate diversifiers and may hold the third slot. Session rules: no new entries in the final 2 hours of the UTC day while the VWAP anchor rolls; weekend liquidity halves all risk; metals setups are preferred inside the London-New York overlap. These gates are not advisory - they are the difference between a methodology and a mood." },
];
