// Main report generator — content sections 1-8.
const L = require("./report_lib.js");
const {
  Document, Packer, Paragraph, TextRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, LevelFormat, TableOfContents, P, coverP, buildCoverR1,
  h1, h2, body, r, bullet, caption, chart, tbl, tableTitle, OUT, fs,
} = L;

// ================= SECTION 1 — EXECUTIVE SUMMARY =================
const s1 = [
  h1("1. Executive Summary"),
  body([r("This report answers three questions: " ), r("how do institutional trading firms and quantitative funds actually make money", { bold: true }), r("; what exactly is your favorite Hyperdash wallet (Selini Capital #3) doing; and how can you reverse-engineer any wallet's trading algorithm from public data. The analysis is built on a complete extraction of " ), r("15,277 trade fills", { bold: true }), r(", 410 live resting orders, funding records and account history pulled from Hyperliquid's public API and the Hyperdash platform on November 13, 2026.")]),
  body([r("The headline finding: Selini Capital #3 is a " ), r("laddered market-making algorithm", { bold: true }), r(" quoting two-sided price ladders on Hyperdash's 24/7 stock and commodity CFD markets (the xyz: markets on Hyperliquid). It posts 3 to 6 limit orders per side per market, spaced roughly 29 basis points apart, with each rung sized near $100,000 notional. It earns the bid-ask spread passively (maker fills produced +$118,644 of realized PnL in 10.6 days) and deliberately loses a small amount on aggressive taker fills (-$7,323) to unload inventory it does not want. The account compounded from $0 to $2.4 million in twelve months with a Sharpe ratio of 3.12 and a maximum drawdown under 10%.")]),
  body([r("Three findings matter most for a strategy designer. First, " ), r("the profit engine is frequency times a tiny edge", { bold: true }), r(": roughly 1,444 fills per day at an average capture of a few dollars per fill, not big directional bets — account leverage is just 0.23x. Second, " ), r("inventory control is the algorithm's core intelligence", { bold: true }), r(": after any position builds up, 97% of subsequent passive fills are on the side that reduces it, and inventory mean-reverts with a half-life of 2 to 7 hours on single stocks. Third, " ), r("the machine is session-aware", { bold: true }), r(": activity concentrates in US equity market hours and stops almost completely on weekends.")]),
  body([r("The report also benchmarks nine other institutional wallets (Auros, Jump, Cumberland, Flow Traders, Manifold, Wintermute and Selini siblings) and closes with a reusable five-test methodology for fingerprinting any wallet's strategy from public fills — plus an honest assessment of which parts of the institutional playbook a smaller trader can and cannot copy.")]),
];

// ================= SECTION 2 — HOW INSTITUTIONS MAKE MONEY =================
const s2 = [
  h1("2. How Institutional Firms and Quants Actually Make Money"),
  body("Retail trading narratives center on prediction: buy low, sell high, be right. Institutional desks mostly do something else entirely. They sell liquidity, arbitrage price differences, and harvest structural premia — businesses with repeatable, quantifiable edges rather than opinions about direction. The Hyperdash data makes this visible in a way few retail traders ever see, because on-chain perps accounts publish every fill to a public API."),

  h2("2.1 The five profit engines"),
  tableTitle("Table 1  The five institutional profit engines, with on-chain evidence"),
  L.tbl(
    ["Engine", "How it earns", "Wallet evidence (Hyperdash)", "Edge per trade"],
    [
      ["Market making", "Post simultaneous bids and offers; earn the spread plus maker rebates; manage inventory risk", "Selini #2/#3 (62-100% maker), Cumberland #1 (90% maker)", "~1-3 bps of notional, thousands of times per day"],
      ["Cross-venue arbitrage", "Buy on one venue, sell the same asset on another when prices diverge; speed is the moat", "Jump: 1.04 million lifetime fills, only 22% maker — constantly crossing spreads to capture dislocations", "A few bps, capital recycled in seconds"],
      ["Basis / funding harvesting", "Hold delta-neutral long-spot / short-perp positions and collect funding payments", "Cumberland, Wintermute wallets with very few trades but large notional", "Funding rate (often 5-20% annualized) with near-zero price risk"],
      ["Statistical arbitrage", "Trade correlated baskets (index vs components, pairs) when spreads deviate from historical relationships", "Selini #3's long XYZ100/SP500 index exposure against single-stock shorts; SOXL vs semis", "Mean-reversion capture, hedged market exposure"],
      ["Directional / swing", "Take outright positions on a thesis — the retail-style game played with size", "MachiBigBrother: -$35.8M, 10% win rate, fully liquidated 'Rekt' cohort", "High variance; the only engine where institutions routinely blow up"],
    ],
    [14, 30, 32, 24]
  ),
  caption("Percentages from 2-day fill samples pulled November 13, 2026."),

  h2("2.2 The law of edge, frequency and size"),
  body([r("Expected profit decomposes as " ), r("edge x frequency x size", { bold: true }), r(". A market maker earning 2 basis points per round trip sounds trivial — 2 bps on a $50,000 clip is $10. But at 1,400 fills per day it is roughly $7,000-14,000 per day of gross capture before costs, on an account that risks almost no net direction. Selini #3's realized numbers land exactly in this range: $111,321 of net realized PnL plus funding over 10.6 days on $72.4 million of volume.")]),
  body("The same multiplication explains why institutions obsess over infrastructure. A 50-millisecond advantage in reacting to a price move converts directly into captured spread; a 10% better fill rate on quotes compounds daily. This is why firms like Jump can run a wallet with over one million fills — each individual trade is nearly meaningless, but the aggregate is a machine for converting speed and order-book presence into money."),
  body([r("Equally important is what is " ), r("absent", { bold: true, italics: true }), r(": leverage and prediction. Selini #3 runs 0.23x net account leverage with margin usage below 1%, and its longest win streak (5 days) is a byproduct of steady harvesting, not conviction trading. When the same platform's most famous whale, MachiBigBrother, played the directional game with size, the result was a -$35.8M account wipeout at a 10% win rate. The contrast between these two accounts, sitting in the same leaderboard, is the single cleanest lesson in this entire dataset.")]),
  chart("comparison.png"),
  caption("Figure 1  All-time PnL across Hyperdash-tagged wallets. Market makers (Auros, Cumberland) top the list; the directional whale sits at the bottom."),
];

// ================= SECTION 3 — HYPERDASH AS A RESEARCH INSTRUMENT =================
const s3 = [
  h1("3. The Hyperdash Platform as a Research Instrument"),
  body("Hyperdash is both a trading terminal and a analytics layer on top of Hyperliquid. For research purposes, four features matter. First, the Tagged directory: 190 wallets labeled with known trader and fund identities — Selini Capital, Auros, Jump, Cumberland, Flow Traders, Wintermute, Manifold Trading, QCP — each tagged by style (algo, scalp, swing, position, intraday). Second, per-wallet analytics: realized/unrealized PnL, win-rate windows, Sharpe, Sortino, drawdown, trade counts, long/short split, position notional and copytrade scores. Third, live position and order tables for any wallet — including the resting order book, which is the algorithm's actual quote sheet. Fourth, cohort rankings that bucket every wallet by profitability and size."),
  body([r("The platform's own markets matter too. Hyperdash deploys the " ), r("xyz: markets", { bold: true }), r(" — 144 perpetual contracts on US stocks (NVDA, AAPL, AMD), indices (XYZ100, SP500), ETFs (SOXL, SMH) and commodities (gold, silver, crude, Brent) — as a Hyperliquid HIP-3 builder. These markets run $5.9 billion of daily volume (NVDA alone does $1.9B/day) and trade 24/5, including US after-hours. Because professional firms quote these books, the fills of those firms are fully public, which is what makes this case study possible.")]),
  tableTitle("Table 2  Key facts about the analyzed environment"),
  L.tbl(
    ["Item", "Value (Nov 13, 2026)"],
    [
      ["Hyperdash tagged wallets", "190 (12 algo, 10 position, 8 scalp, 32 intraday, 64 swing, 64 untagged)"],
      ["xyz: CFD markets on Hyperliquid", "144 markets, $5.87B 24h volume, deployed via HIP-3"],
      ["Largest xyz markets", "NVDA $1.90B/day, XYZ100 $503M/day, SP500 $407M/day"],
      ["Selini Capital wallets", "#2, #3, #4, #5 — four algo books, one firm"],
      ["Public data depth (userFillsByTime API)", "Approximately the most recent 10 days"],
      ["Data pulled for this report", "15,277 fills, 410 live orders, funding, portfolio history, 10 wallet profiles"],
    ],
    [40, 60]
  ),
  caption("Sources: Hyperliquid public info API and Hyperdash GraphQL API, extracted November 13, 2026."),
];

// ================= SECTION 4 — SELINI CASE STUDY =================
const s4 = [
  h1("4. Case Study: Selini Capital #3 — Anatomy of an Algorithmic Market Maker"),
  body("The wallet 0x76987ceada087975a0cedef7753f25bf86234480 is verified on Hyperdash as Selini Capital #3, one of four algo books run by Selini Capital (a crypto market-making and proprietary trading firm). Everything below is reconstructed from its public fills and live orders, then cross-validated against Hyperdash's own analytics."),

  h2("4.1 Account profile"),
  tableTitle("Table 3  Selini Capital #3 — key account metrics"),
  L.tbl(
    ["Metric", "Value", "Metric", "Value"],
    [
      ["All-time PnL", "+$2.40M", "Account equity", "$2.66M"],
      ["Total volume", "$5.58B", "Total trades (Hyperdash)", "37,710"],
      ["Win rate (lifetime / 30d)", "52.9% / 55.0%", "Sharpe (30d / 90d)", "3.12 / 2.87"],
      ["Sortino (30d)", "6.30", "Max drawdown (180d)", "9.5%"],
      ["Account leverage", "0.23x", "Margin usage", "0.82%"],
      ["Open positions", "38 across 64 markets", "Open resting orders", "410"],
      ["Median trade duration", "31 min", "Average trade duration", "6h 53m"],
      ["PnL cohort", "Extremely Profitable", "Size cohort", "Whale"],
    ],
    [26, 24, 26, 24]
  ),
  caption("Account metrics from Hyperdash analytics, November 13, 2026."),
  chart("equity_curve.png"),
  caption("Figure 2  Twelve-month account value: from $0 to $2.4M with visibly controlled drawdowns — the signature of a harvesting strategy, not a betting strategy."),

  h2("4.2 The evidence base: 15,277 fills"),
  body("Hyperliquid's public API exposes every fill for any wallet (the userFillsByTime endpoint, paginated in time windows). After repairing same-millisecond ordering using each fill's startPosition field, the dataset covers November 2-13, 2026 completely: 15,277 fills across 64 xyz: markets, $72.4M of volume, every fee and every realized-PnL entry. The statistics that follow are computed from this raw tape, not from Hyperdash's aggregates."),
  tableTitle("Table 4  The fill tape at a glance (Nov 2-13, 2026)"),
  L.tbl(
    ["Statistic", "Value", "Interpretation"],
    [
      ["Fills per day", "1,444 average", "Continuous presence, not discretionary trading"],
      ["Maker / taker split", "62.5% / 37.5%", "Passive-first, aggressive for inventory control"],
      ["Median fill size", "$663 (p90: $10,485)", "Absorbs retail-sized flow"],
      ["Median inter-fill gap", "1 second", "Fully automated, always quoting"],
      ["Peak hours", "14:00-16:00 UTC", "US equity regular session open"],
      ["Weekend activity", "165 fills Sat, 2 Sun", "Machine idles when markets close"],
      ["Net fees paid", "$1,607 on $72.4M (0.22 bps)", "Maker rebates offset most taker fees"],
      ["Realized PnL (maker)", "+$118,644", "The spread-harvesting engine"],
      ["Realized PnL (taker)", "-$7,323", "The cost of inventory management"],
    ],
    [28, 30, 42]
  ),

  h2("4.3 The reconstructed algorithm specification"),
  body("Reading the live order book together with the fill tape reveals the machine's structure with unusual clarity. At any moment it maintains 410 resting limit orders across 64 markets. Per market it posts two ladders:"),
  bullet([r("3 to 6 buy levels below mid and 3 to 6 sell levels above mid", { bold: true }), r(" — e.g. crude oil (xyz:CL) showed 5 bids from $86.28 to $87.05 and 5 asks from $87.38 to $88.08.")]),
  bullet([r("Rungs spaced ~29 bps apart", { bold: true }), r(" (median across all markets; p10-p90 range 17-38 bps), producing a roughly 30-40 bps centered quote spread at the top of book.")]),
  bullet([r("Equal notional per rung", { bold: true }), r(" — about $100K on major commodities and indices, $40-60K on single stocks. Total quoted depth is ~$1M per side on the four biggest markets.")]),
  body("Order management is programmatic: every fill carries a client order ID (15,244 of 15,277 fills), 28% of orders fill more than once (partial fills sweeping a ladder rung), and quote refreshes follow taker fills within a median of 9 seconds. The largest single fills are almost exactly one rung ($100,956 on XYZ100) — someone swept a whole level."),
  chart("ladder.png"),
  caption("Figure 3  The live quote ladder on xyz:CL, scraped from the wallet's 410 resting orders. Both sides are always quoted; inventory decides which side is deeper."),

  h2("4.4 Inventory dynamics — the core intelligence"),
  body([r("The single most diagnostic statistic in the dataset: after the wallet is holding a net long position, " ), r("97% of its next passive fills are sells", { bold: true }), r("; after it is net short, 97% of next passive fills are buys (n = 4,451 maker transitions with a 5-second buffer). The ladder is not static — it skews toward whatever side reduces inventory. This is textbook inventory-based quote skewing, and it is the difference between a market maker and a gambler who uses limit orders.")]),
  body("Inventory mean-reverts with measurable half-lives: 2-8 hours on volatile single stocks and leveraged ETFs (KORU 4.3h, SOXL 4.8h, GOLD 4.9h, AMD 6.4h, NVDA 7.7h), but 20-59 hours on index and macro books (SP500 20h, CBRS 23h, SILVER 32h, AAPL 32.5h, XYZ100 59h). The interpretation: single-stock flow is hedged or faded quickly, while index exposure is allowed to accumulate as a structural book. Peak inventory stays between 0.3x and 2x daily volume per market — the machine knows its own capacity."),
  chart("halflife.png"),
  caption("Figure 4  Inventory half-life by market. Fast reversion on single names; slow, deliberate accumulation on index/macro books."),
  body("Completed position cycles (flat to flat) number 551 in the window: median duration 96 minutes, mean 10.7 hours, 41% under one hour, 88% under one day. This matches Hyperdash's independent 'median trade duration 31 minutes' metric and confirms the two-speed structure: fast market-making cycles plus slower index position holds."),
  chart("durations.png"),
  caption("Figure 5  Round-trip duration distribution (log scale). The mass under one hour is the market-making layer; the long tail out to multiple days is the index/macro book."),

  h2("4.5 Where the money comes from — PnL attribution"),
  body("Over the 10.6-day window the wallet realized +$111,321 net: +$118,644 from maker fills, -$7,323 from taker fills, -$1,607 net fees (maker rebates offset taker fees), plus small positive funding (+$313 in the 2-day funding sample). The taker losses are not a defect — they are the price of refusing unwanted inventory. Averaged out, the machine captures roughly 1.5-2 bps per round trip on its own volume."),
  chart("attribution.png"),
  caption("Figure 6  Net realized PnL attribution over the 10.6-day sample. Maker spread capture is the engine; taker fills are a deliberate, budgeted cost."),
  body("Market-level attribution shows the benefits and limits of diversification. The best books: MRVL +$23.5K, SOXL +$20.5K, AMD +$22.8K (maker and taker both positive on AMD), XYZ100 +$17.4K, MU +$13.0K, KORU +$9.5K. The worst: BRENTOIL -$21.2K and SHAZ -$10.3K, negative on both maker and taker legs — volatile, gapping markets where passive quoting gets run over. Sixty-four parallel books turn idiosyncratic losses into a smooth equity curve."),
  chart("pnl_by_market.png"),
  caption("Figure 7  Realized PnL by market, maker vs taker. Green bars (maker) dominate; red (taker) is usually a small controlled cost — except in BRENTOIL and SHAZ where both legs lost."),

  h2("4.6 Risk management under stress"),
  bullet([r("The BRENTOIL event (Nov 9): ", { bold: true }), r("a -$21,898 single-day loss concentrated in 48 taker fills, including a burst of 52 fills in one second on CBRS — the machine aggressively dumped risk into a gap. It kept quoting the market afterward at reduced size.")]),
  bullet([r("Session gating: ", { bold: true }), r("fills stop almost completely on weekends (165 Sat, 2 Sun) — the algo stands down when the underlying US markets are closed and pricing risk rises.")]),
  bullet([r("Isolated margin per position", { bold: true }), r(" (9x leverage caps, 0.82% account margin usage) so a single-book blowup cannot propagate; 4 tiny isolated-long liquidations occurred with negligible account impact.")]),
  bullet([r("Position sizing discipline: ", { bold: true }), r("rung notional is fixed (~$100K) regardless of conviction; total account leverage 0.23x; 99.86% distance from liquidation.")]),
  body("The activity clock also shows pre-market quoting from 13:00 UTC (8:00 ET) and after-hours activity through 01:00 UTC — the machine covers the full 24/5 xyz session but concentrates depth in the liquid US regular hours."),
  chart("hourly_fills.png"),
  caption("Figure 8  Fill counts by hour of day (UTC). The peak spans the US regular session (13:30-20:00 UTC); activity collapses on weekends."),

  h2("4.7 Why copy-trading this wallet fails"),
  body("Hyperdash itself scores Selini #3 at 0/100 for copytrading and flags it as an 'algorithmic trader — copytrading results may vary due to execution speed differences.' The fill tape explains why. The edge is ~2 bps per clip; a copier's latency and slippage exceed the edge by construction. Worse, the machine's taker bursts (52 fills per second) and constant quote-refresh churn would route a copier straight into adverse selection — you would systematically inherit the fills that were inventory-dumping, not the ones capturing spread. Market-making edges are non-copyable by design; they must be built, not mirrored."),
];

module.exports = { s1, s2, s3, s4 };
