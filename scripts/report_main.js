// Sections 5-8 and final assembly.
const L = require("./report_lib.js");
const {
  Document, Packer, Paragraph, TextRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, TableOfContents, P, coverP, buildCoverR1,
  h1, h2, body, r, bullet, caption, chart, tbl, tableTitle, OUT, fs,
} = L;
const { s1, s2, s3, s4 } = require("./report_sections_a.js");

// ================= SECTION 5 — COMPARISON =================
const s5 = [
  h1("5. Comparison: Six Institutional Wallets, Six Different Machines"),
  body("Pulling recent fill tapes for the other tagged firms shows how differently the same infrastructure gets used. Each profile below comes from a two-day fill sample plus Hyperdash lifetime analytics."),
  tableTitle("Table 5  Institutional wallet comparison (fill samples pulled Nov 11-13, 2026)"),
  L.tbl(
    ["Wallet (tag)", "Lifetime PnL", "Trades", "2-day fills", "Maker %", "Median clip", "Markets", "Machine"],
    [
      ["Auros (algo)", "+$58.9M", "28,284", "14,832", "68%", "$593", "BTC, ETH, XMR, SOL, ZEC (+spot)", "Crypto spot+perp market maker; 100% maker on BTC; Sharpe 9.1, 68% win rate"],
      ["Cumberland #1 (algo)", "+$40.3M", "8,699", "14,999", "90%", "$586", "xyz:NVDA, XYZ100, BTC, SILVER", "Two-sided CFD quoting, 92-100% maker; -$186K xyz:NVDA realized in 2 days implies hedging elsewhere (off-chain venues)"],
      ["Jump (algo)", "+$352K", "1,041,978", "6,000", "22%", "$187", "HYPE, ZEC, BTC, ETH", "Latency/arbitrage profile: 78% taker, tiny clips, 1M+ lifetime fills — pays spread to capture dislocations"],
      ["Flow Traders #1 (position)", "-$599K", "1,163", "low", "n/a", "n/a", "xyz: markets", "Small CFD book, 17% win rate — even pros lose when a MM book is run positionally"],
      ["Manifold Trading (scalp)", "+$6.18M", "7,402", "0", "n/a", "n/a", "crypto perps", "Profits withdrawn (equity $0); currently inactive — classic scalp book lifecycle"],
      ["Selini #2 (algo)", "+$306K", "11,708", "2,619", "100%", "$2,163", "xyz:NVDA, CL, TSLA", "Pure passive ladder, no taker leg at all; carries almost no inventory"],
      ["MachiBigBrother (swing)", "-$35.8M", "472", "low", "n/a", "n/a", "crypto perps", "Whale directional bets; 10% win rate, 'Rekt' cohort — the anti-example"],
    ],
    [16, 11, 10, 10, 8, 10, 15, 20],
    { align: [null, "right", "right", "right", "right", "right", null, null] }
  ),
  caption("Maker %, clip sizes and market lists from 2-day public fill samples; lifetime figures from Hyperdash."),
  body([r("The instructive contrasts: " ), r("Auros", { bold: true }), r(" and " ), r("Cumberland", { bold: true }), r(" are the same species as Selini (passive quoting, Sharpe 5-9) but at 20x scale and with cross-venue hedging that on-chain data cannot see — Cumberland's simultaneous -$186K on xyz:NVDA and +$92K on BTC in the same 48 hours is almost certainly one hedged book across venues. " ), r("Jump", { bold: true }), r(" inverts the model (78% taker): it pays the spread to win races, viable only with real latency advantage. " ), r("Flow Traders #1", { bold: true }), r(" shows that even a legendary market-making firm loses when a book is run positionally on someone else's turf. And the Selini fleet itself — #2 +$306K, #3 +$2.4M, #4 -$132K, #5 -$80K — reveals that firms A/B test multiple books and kill the losers; a live 'institutional' wallet is not automatically a profitable one.")]),
];

// ================= SECTION 6 — METHODOLOGY =================
const s6 = [
  h1("6. The Methodology: How to Reverse-Engineer Any Wallet's Algorithm"),
  body("Everything in this report was derived from public endpoints, without any privileged access. The workflow below is reusable for any Hyperliquid or Hyperdash wallet."),

  h2("6.1 Data sources"),
  bullet([r("Hyperliquid public info API (api.hyperliquid.xyz/info, POST): ", { bold: true }), r("userFillsByTime (paginated fills — approximately 10 days of depth), userFunding, portfolio, clearinghouseState, perpDexs and metaAndAssetCtxs (per-market volume/OI, use dex: 'xyz' for CFDs). No authentication required.")]),
  bullet([r("Hyperdash GraphQL API (api.hyperdash.com/graphql): ", { bold: true }), r("getTrader (full profile metrics), pnlCalendar, tagged trader directory. Runs in your browser session when logged in.")]),
  bullet([r("The wallet page UI: ", { bold: true }), r("positions, open orders (the live quote sheet), fills and transfers tabs — scrapeable via headless browser for the resting order ladders.")]),

  h2("6.2 The five-test diagnostic battery"),
  tableTitle("Table 6  Five tests that fingerprint a strategy from raw fills"),
  L.tbl(
    ["Test", "Computation", "What it proves"],
    [
      ["1. Maker/taker ratio", "Share of fills with crossed=false", "Passive quoter (60-100%) vs aggressive racer (under 40%) vs discretionary (mixed, clustered)"],
      ["2. PnL attribution split", "Sum closedPnl by maker vs taker fills", "MM earns on maker, loses on taker (Selini: +$119K/-$7K). Arbitrageurs earn on taker. Directional traders show block PnL either side"],
      ["3. Inventory skew", "P(next fill reduces inventory | inventory != 0)", "97% = inventory-aware quoting. ~50% = naive ladders. Skew toward increasing = momentum trader"],
      ["4. Inventory half-life", "Lag-1 autocorrelation of signed position per market", "Minutes-hours = market making; days = position/PA book; weeks = basis harvesting"],
      ["5. Clock & calendar", "Fills by hour-of-day and weekday", "US-session gating, weekend pauses, 24/7 crypto coverage — separates equity-CFD bots from crypto-native ones"],
    ],
    [16, 32, 52]
  ),
  body("Two validation tricks make the reconstruction trustworthy. First, chain fills via the startPosition field (position before each fill) — it self-validates ordering and catches API pagination gaps; final computed positions should match the wallet page's position table exactly (they did here, to the share). Second, remember Hyperliquid's side codes are B (buy/bid) and A (ask/sell), not B/S — the single most common parsing mistake."),

  h2("6.3 Limitations and traps"),
  bullet("API depth: userFillsByTime serves roughly the last 10 days for heavy wallets; older history must come from Hyperdash aggregates."),
  bullet("HIP-3 markets (the xyz: CFDs) clear separately — clearinghouseState returns empty; reconstruct positions from fills."),
  bullet("On-chain PnL may be one leg of a cross-venue book (Cumberland's NVDA pattern); you see the franchise, not the hedge."),
  bullet("Survivorship and relabeling: wallets get recycled; validate labels against on-chain behavior, not just the platform tag."),
  bullet("Wash-like churn: xyz markets show extreme volume/OI ratios (NVDA $1.9B volume vs $2.2M OI) — volume alone proves nothing; fills must be attributed."),
];

// ================= SECTION 7 — IMPLICATIONS =================
const s7 = [
  h1("7. Implications for Your Own Strategy Design"),
  body("You cannot out-run Selini at its own game — the edge is speed, rebates and 24/5 staffing. But the market-maker's playbook contains principles that translate directly to a signal-driven strategy on the top-20 crypto assets:"),
  bullet([r("Think in inventory, not trades. ", { bold: true }), r("Every position you hold is inventory with a half-life. Define, before entry, the maximum inventory per market and the clock at which you must decay it — the single biggest difference between Selini's 9.5% max drawdown and Machi's -100%.")]),
  bullet([r("Skew, don't stop. ", { bold: true }), r("When your footprint signals (exhaustion, divergence, absorption) argue for a side, increase that side's size and frequency rather than flipping outright — mirroring how the ladder deepens the mean-reverting side.")]),
  bullet([r("Budget your taker costs explicitly. ", { bold: true }), r("Selini accepts -$7.3K of taker losses as a cost of doing business and still nets +$111K. Your stops and re-entries are the same line item: measure them per market and kill markets where the cost exceeds the harvest (their BRENTOIL problem).")]),
  bullet([r("Diversify books, cap each one. ", { bold: true }), r("64 parallel markets with fixed per-rung notional is why one bad oil day cost less than 1% of equity. A 20-asset portfolio with per-asset risk caps is the retail-scale version of the same idea.")]),
  bullet([r("Your footprint edge is orthogonal to theirs. ", { bold: true }), r("Market makers harvest flow; they do not predict. Exhaustion/divergence/absorption signals are predictive information about future flow direction — the thing MM inventory models actually fear. A slower strategy that trades a few times per day and only takes liquidity when footprint signals fire is not competing with Selini; it is picking when to be the counterparty retail flow needs.")]),
  body("Finally, calibrate expectations with the multiplication: edge x frequency x size. Selini's per-trade edge is ~2 bps. A footprint strategy that trades 5 times/day needs a ~40 bps expected edge per trade to match the same daily expectancy on the same capital — achievable only with genuine signal quality and disciplined costs, which is exactly why signal validation (your historical aggregated footprint data) is the right foundation to build on."),
];

// ================= SECTION 8 — CONCLUSIONS + APPENDIX =================
const s8 = [
  h1("8. Conclusions"),
  body([r("Institutional money in these markets is made by " ), r("selling liquidity and harvesting structural premia at industrial frequency", { bold: true }), r(", not by predicting price. Selini Capital #3 is a clean specimen: a 64-market, two-sided, inventory-skewed ladder quoter on Hyperdash's CFD books that turned $0 into $2.4M in twelve months at Sharpe 3.1 while never using more than 0.23x leverage. Its full specification — rung sizing, spacing, skew behavior, half-lives, session gating, loss events — is recoverable from public data with nothing more than the Hyperliquid info API, a headless browser, and the five-test battery documented in Section 6.")]),
  body("The same lens, applied to ten wallets, separates the machines cleanly: passive harvesters (Auros, Cumberland, Selini #2/#3), liquidity racers (Jump), hedged cross-venue books (Cumberland again), scalpers that cycle (Manifold), failing positional experiments (Flow Traders #1, Selini #4/#5) and the whale anti-example (MachiBigBrother). For your own design work, the actionable inheritance is inventory discipline, skew-based sizing, explicit cost budgeting, and per-market risk caps — while your footprint signals supply the one ingredient market makers do not have: direction."),

  h1("Appendix A. Data Inventory and Reproducibility"),
  tableTitle("Table 7  Artifacts produced by this analysis"),
  L.tbl(
    ["Artifact", "Contents"],
    [
      ["fills_all.json / fills_ordered.json", "15,277 fills, Nov 2-13, 2026, with same-ms ordering repaired via startPosition"],
      ["orders_live.json", "410 live resting orders scraped from the Hyperdash orders tab"],
      ["fav_trader.json / apollo_cache.json", "Selini #3 profile, equity curve, tagged trader directory (190 wallets)"],
      ["compare_traders.json + fills_*.json", "10 wallet profiles + 2-day fill samples for Auros, Jump, Cumberland #1, Selini #2"],
      ["xyz_market_stats.json", "All 144 xyz markets: 24h volume, OI, funding"],
      ["Scripts (scripts/ directory)", "pull_hl_data, pull_fills_paged, repair_fills, analyze_fills 1-5, pull_compare, make_charts"],
    ],
    [34, 66]
  ),
  tableTitle("Table 8  Key wallet addresses"),
  L.tbl(
    ["Wallet", "Address"],
    [
      ["Selini Capital #3 (case study)", "0x76987ceada087975a0cedef7753f25bf86234480"],
      ["Selini Capital #2", "0x7ab80d2c05e5ed068454f4a7553047c8d0ff8136"],
      ["Auros", "0x023a3d058020fb76cca98f01b3c48c8938a22355"],
      ["Jump", "0xf5d81a135f756ca16544e53c20fc20643ec3ad53"],
      ["Cumberland #1", "0xfc667adba8d4837586078f4fdcdc29804337ca06"],
      ["Flow Traders #1", "0x0c4926daf1250b8da7b9fc339f304d923b94d346"],
      ["Manifold Trading", "0x091144e651b334341eabdbbbfed644ad0100023e"],
      ["MachiBigBrother", "0x020ca66c30bec2c4fe3861a94e4db4a498a35872"],
    ],
    [34, 66]
  ),
  body([r("Data caveats: fill-level analysis covers the public API's ~10-day window (Nov 2-13, 2026); Hyperdash lifetime aggregates extend it. All third-party metrics are as reported by the platform on the extraction date. Nothing in this report is investment advice; it is a forensic description of publicly observable trading activity.", { italics: true })]),
];

// ================= ASSEMBLY =================
const header = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: 1, size: 2, color: "C9D4DE" } },
    children: [new TextRun({ text: "Institutional Trading Playbook — Selini Capital #3 Reverse Engineering", size: 16, color: "8A97A5", font: { ascii: "Times New Roman" } })],
  })],
});
const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8A97A5", font: { ascii: "Times New Roman" } })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "1C2A3D" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: "16324F" },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: "16324F" },
        paragraph: { spacing: { before: 260, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    // ---- cover ----
    {
      properties: { page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "The Institutional Trading Playbook",
        subtitle: "How quant firms actually make money — and a full reverse-engineering of Selini Capital #3 from 15,277 public trade fills",
        englishLabel: "MICROSTRUCTURE RESEARCH",
        metaLines: [
          "Case study: Selini Capital #3 (Hyperliquid / Hyperdash xyz markets)",
          "Evidence: 15,277 fills - 410 live orders - 64 markets - 10 wallets benchmarked",
          "Method: five-test strategy fingerprinting from public APIs",
          "Date: November 13, 2026",
        ],
        footerLeft: "Hyperdash / Hyperliquid public-data research",
        footerRight: "November 2026",
        palette: coverP,
      }),
    },
    // ---- TOC ----
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } } },
      children: [
        new Paragraph({ spacing: { before: 200, after: 240 },
          children: [new TextRun({ text: "Contents", bold: true, size: 32, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] }),
        new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ spacing: { before: 200 },
          children: [new TextRun({ text: "Right-click the table of contents and choose Update Field to refresh page numbers.", italics: true, size: 18, color: "8A97A5", font: { ascii: "Times New Roman" } })] }),
        new Paragraph({ children: [new TextRun({ text: "", size: 2 }), new PageBreak()] }),
      ],
    },
    // ---- body ----
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: header },
      footers: { default: footer },
      children: [...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE", OUT, buf.length, "bytes");
});
