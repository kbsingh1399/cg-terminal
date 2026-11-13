// E2E Backtest Report — sections 5-8 and final assembly.
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, TableOfContents, PageBreak,
  P, coverP, buildCoverR1, h1, h2, body, r, bullet, caption, chart, tbl, tableTitle, fs,
} = require("./report_lib.js");
const { s1, s2, s3, s4 } = require("./report_e2e_a.js");

// ================= SECTION 5 — WHY THE EDGE IS NOT THERE =================
const s5 = [
  h1("Why the Edge Is Not There"),
  body("The failure has a precise anatomy, and it is worth stating precisely because it defines what any fix would have to overcome. Raw footprint events on a knowable universe carry a small informational drift — the event study measured +5 to +30bp drift-adjusted at 30-minute to 24-hour horizons — but the drift is unstable in sign across regimes and smaller than the 15bp round-trip cost plus the adverse excursion the position must survive. The median of all 1,728 configurations loses 7.6% out-of-sample; that is the honest center of gravity of this signal family."),
  body("The exit design cannot rescue a sub-cost drift. Stops at 3 or 6 ATR convert the 2.1-2.7% median 24-hour adverse excursion into small, frequent losses (83 of 104 honest-run trades exited at the disaster stop), while the rare favorable tail must not merely win but win by 3-5x the average loss to break even. On the survivorship-biased universe the tail cooperated (JCT +277%, ARIA +155%, HYPE +41% over 14-day holds) and the book printed a 6.68x payoff. On the knowable universe the same entries found no such tails, and the payoff ratio collapsed to 0.86x. Nothing about the entry logic changed — only the membership of the asset list."),
  body("The walk-forward optimizer, for its part, behaved exactly as selection theory predicts. With 1,728 configurations and only 25-40 training trades per fold, the best training configurations are systematically the luckiest ones: training expectancies of +370 to +549bp decayed to negative in all four folds out-of-sample. The optimizer is not broken; the search space simply contains no configuration whose true edge exceeds zero after costs on this universe. When that is the case, more optimization only manufactures more convincing ways to lose."),
];

// ================= SECTION 6 — WHAT ACTUALLY PAYS =================
const s6 = [
  h1("What Actually Pays: Lessons for a $5,000 Account"),
  body("The companion trader study verified six structural edges on Hyperliquid. This backtest prices their accessibility from a $5,000 retail account, and the result is a sober, useful map."),
  tableTitle("Table 7 — The six verified edges and their availability at $5,000"),
  tbl(
    ["Edge (who has it)", "How it pays", "At $5,000?"],
    [
      ["Spread and rebate capture (Wintermute, Auros, Cumberland)", "1.7-5.9bp per dollar traded, 60-90% maker share, cross-venue hedging", "No — VIP/maker rebate tiers and infrastructure are out of reach"],
      ["Inventory hedging (market makers)", "Structurally net-short the flow they absorb; rebalance continuously", "No — requires two-sided flow"],
      ["Stale-quote arbitrage on TradFi perps (HFT bots)", "Quote lag on Hyperliquid XAU/XAG/stock perps versus primary markets", "No — a latency game won or lost in microseconds"],
      ["Exhaustion shorting of over-hyped assets (Fasanara, SilkBtc)", "68.6-229bp per dollar on campaign shorts after parabolic runs", "Partially — but this backtest shows the signal timing is not enough standalone"],
      ["Asymmetric loss control (all profitable accounts)", "20-35% win rates with 3-5x payoffs; losses cut at 1R", "Yes — a discipline, not a fee tier; adopt the geometry, not the signal"],
      ["Funding capture (Fasanara, John Wick)", "Collect 8h funding on the crowded side; +4.7% annualized on notional in-sample here", "Yes — sizeable at 2-3x gross, but it is a carry overlay, not a directional signal"],
    ],
    [30, 40, 30]
  ),
  body("The honest residue for a small account is therefore two overlays, not a standalone signal. First, funding capture: in this 180-day sample the universe's mean funding was +0.43bp per 8-hour settlement (84% of settlements positive), roughly 4.7% annualized on notional — a short-tilted or neutral book that collects it while staying delta-hedged converts a structural flow into income, exactly as the Fasanara playbook does at scale. Second, asymmetric loss control: the exit geometry this backtest implemented (wide disaster stops, 0.5-1% risk fractions, patience) is the one component that behaved identically on both universes and matches every profitable account profiled; it is how you survive being wrong, not how you get rich. The footprint signals themselves earn their keep only as confirmation gates — the M1/M2 absorption-gate design in the terminal's execution stack — where their +5 to +30bp informational drift improves entry quality without carrying the entire cost burden."),
];

// ================= SECTION 7 — CONCLUSIONS =================
const s7 = [
  h1("Conclusions and Recommended Next Steps"),
  body([r("Verdict. ", { bold: true }), r("At $5,000 initial equity, the footprint-signal strategy family — exhaustion and absorption confluence, funding-aware carry, and their mirrors, optimized end-to-end by walk-forward selection over 1,728 configurations — does not produce a profitable standalone system on a point-in-time top-20 crypto perp universe. The honest out-of-sample result is $3,197 from $5,000 (-36.1%) over 121 days, with a 100% Monte-Carlo probability of loss. The +32.4% result on the original universe is survivorship bias, demonstrated and quantified at 68.4 percentage points.")]),
  body([r("What was learned. ", { bold: true }), r("The signal engine, the data pipeline, the point-in-time universe constructor and the event-accurate simulator now exist as validated, reusable infrastructure. The bias audit itself — confluence lookahead, universe survivorship — is a template every future backtest in this project must pass through. And the two accessible edges for a small account (funding carry as an overlay, asymmetric loss control as discipline) are now quantified on 180 days of real settlement data.")]),
  body([r("Next steps, in order of expected value. ", { bold: true }), r("(1) Do not trade the standalone signal book; retire it as a candidate. (2) Paper-trade the funding-carry overlay in the Virtual-Book: short or neutral exposure on the top-20 at 1-2x gross, collecting the 4.7% annualized in-sample carry with delta discipline — small, but structural and testable live. (3) Route the footprint signals into the M1/M2 confirmation gates of the execution stack, where the cost burden is shared with the primary signal rather than carried alone. (4) Extend the archive: 180 days is one regime; the funding-carry thesis in particular deserves a multi-year sample before capital is committed. (5) Any future strategy proposal must clear the same bar this one was held to — point-in-time universe, leak-free features, walk-forward selection, out-of-sample only — before it earns a live slot.")]),
];

// ================= SECTION 8 — APPENDIX =================
const s8 = [
  h1("Appendix"),
  h2("A.1 Reproduction"),
  body("Pipeline: scripts/fp-research/pit_universe.py (point-in-time universe) -> fetch_history.py 180 180 (resumable data) -> pit_new_signals.py + cg_signals_v2.py (calibrated signals) -> event_study.py (event table) -> e2e_backtest.py (walk-forward, env E2E_OUT/E2E_EVENTS) -> e2e_final_analysis.py (metrics, Monte-Carlo, charts). The honest run lives in download/fp-research/e2e_pit; the biased comparison in download/fp-research/e2e_olduni. Every figure in this report regenerates from those two directories."),
  h2("A.2 Deliverable manifest"),
  bullet("This report (docx + pdf) — methodology, results, bias audit, recommendations."),
  bullet("e2e_trades_OOS.csv — all 104 out-of-sample trades with entry/exit, side, rule, notional, funding, costs, PnL and running equity."),
  bullet("e2e_equity_OOS.csv — event-timestamped equity curve; e2e_fold_choices.json — per-fold selections and stress variants; e2e_final_metrics.json — computed metrics and Monte-Carlo output."),
  bullet("Charts (PNG): equity and drawdown, fold PnL, trade anatomy, Monte-Carlo and stress."),
  bullet("Excel workbook: fold summary, full trade log, metrics and universe comparison for filtering and audit."),
  h2("A.3 Caveats"),
  body("One hundred four out-of-sample trades over 121 days is a small sample in one regime with generally positive funding and mixed trend; the negative conclusion is robust to cost stress and carry removal, but a longer archive could still reveal regimes where the family works. Bar-level backtests cannot model queue position, partial fills or liquidation cascades; costs are flat 15bp rather than depth-dependent. The walk-forward searched 1,728 configurations on 25-40 trade training windows — small-sample selection risk is inherent to the method and is precisely why the no-skill median is reported alongside the selected path. Nothing in this document is investment advice; it is an audit of a specific strategy family on specific data."),
];

// ================= ASSEMBLY =================
const header = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: 1, size: 2, color: "C9D4DE" } },
    children: [new TextRun({ text: "Footprint Signal Strategies — End-to-End Backtest at $5,000", size: 16, color: "8A97A5", font: { ascii: "Times New Roman" } })],
  })],
});
const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8A97A5", font: { ascii: "Times New Roman" } })],
  })],
});

const OUTFILE = "/home/z/my-project/download/Footprint_Strategy_E2E_Backtest_Report.docx";

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
    {
      properties: { page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Footprint Signal Strategies — End-to-End Backtest at $5,000",
        subtitle: "Walk-forward optimization of exhaustion, absorption and funding-carry strategies on the top-20 crypto perpetuals — with a full bias audit",
        englishLabel: "QUANTITATIVE RESEARCH",
        metaLines: [
          "Engine: event-accurate portfolio simulator — $5,000 initial, compounding, funding PnL, 15bp costs",
          "Optimization: 1,728 configurations, 60d/30d walk-forward folds, out-of-sample scoring only",
          "Bias audit: confluence lookahead eliminated; universe rebuilt point-in-time (May 2026)",
          "Verdict: no standalone edge survives — final equity $3,197 (-36.1%) vs +32.4% before the fix",
          "Date: November 13, 2026",
        ],
        footerLeft: "fp-research / cg-terminal",
        footerRight: "November 2026",
        palette: coverP,
      }),
    },
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
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: header },
      footers: { default: footer },
      children: [...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTFILE, buf);
  console.log("WROTE", OUTFILE, buf.length, "bytes");
});
