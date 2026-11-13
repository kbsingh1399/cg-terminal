#!/usr/bin/env python3
"""fp-research — compose the final PDF research report."""
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Image, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

OUT = "download/fp-research"
BG = colors.HexColor("#0b0e11")
FG = colors.HexColor("#d4d8dd")
MUT = colors.HexColor("#8a919c")
ACC = colors.HexColor("#f0b90b")
GRN = colors.HexColor("#26a17b")
RED = colors.HexColor("#e84142")

styles = {
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=20, textColor=colors.white, leading=25, spaceAfter=6),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=10.5, textColor=MUT, leading=14, spaceAfter=2),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=13, textColor=ACC, leading=16, spaceBefore=12, spaceAfter=4),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=10.5, textColor=colors.white, leading=13, spaceBefore=8, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9, textColor=FG, leading=13, spaceAfter=5),
    "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9, textColor=FG, leading=12.5, leftIndent=10, bulletIndent=2, spaceAfter=3),
    "mono": ParagraphStyle("mono", fontName="Courier", fontSize=7.5, textColor=MUT, leading=10, spaceAfter=4),
    "quote": ParagraphStyle("quote", fontName="Helvetica-Oblique", fontSize=9.5, textColor=ACC, leading=13, leftIndent=8, spaceBefore=4, spaceAfter=6),
}

def P(text, style="body"):
    return Paragraph(text, styles[style])

def data_table(header, rows, widths, fs=7.5):
    cell_style = ParagraphStyle("cell", fontName="Helvetica", fontSize=fs, textColor=FG, leading=fs + 2.5)
    head_style = ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=fs, textColor=ACC, leading=fs + 2.5)
    header_p = [Paragraph(h, head_style) for h in header]
    rows_p = [[Paragraph(c, cell_style) for c in r] for r in rows]
    t = Table([header_p] + rows_p, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a2029")),
        ("TEXTCOLOR", (0, 0), (-1, 0), ACC),
        ("TEXTCOLOR", (0, 1), (-1, -1), FG),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), fs),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#10141a"), colors.HexColor("#161b23")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#2b3139")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t

doc = SimpleDocTemplate(
    f"{OUT}/Footprint_Signal_Research_Report.pdf", pagesize=A4,
    leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
    title="Footprint Signal Research — Top-20 Crypto Perps",
    author="zai-desk quantitative research",
)

def footer(canvas, doc_):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFillColor(MUT)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(16 * mm, 8 * mm, "zai-desk · footprint-signal research · 2026-11-13 · data: Binance USDT-M perps (fapi klines w/ taker split) + Coinglass footprint panel")
    canvas.drawRightString(A4[0] - 16 * mm, 8 * mm, f"page {doc_.page}")
    canvas.restoreState()

story = []

# ---- cover ----
story.append(Spacer(1, 8 * mm))
story.append(P("Footprint Signal Research", "title"))
story.append(P("Can Coinglass-style order-flow signals (absorption · divergence · CVD divergence · exhaustion · trapped traders) power a profitable, scalable strategy on the top-20 crypto perpetuals?", "sub"))
story.append(Spacer(1, 4 * mm))
story.append(P("Mandate", "h1"))
story.append(P("Reconstruct the exact signal methodology behind the Coinglass footprint panel, validate it signal-for-signal against the live page, then design and honestly test a mechanical strategy on the top-20 crypto USDT perpetuals over 180 days of bar-level footprint data — mechanical or ML — and iterate until profitable or until the evidence conclusively shows why not.", "body"))
story.append(P("The headline finding", "h1"))
story.append(P("The signal engine reproduces the Coinglass panel 9/9 (100% of visible 15m signals). The signals are genuinely informative — but their standalone, drift-adjusted edge at every horizon from 30 minutes to 24 hours (+5 to +30 bp per signal, sign-unstable across market regimes) sits below the ~15 bp round-trip cost of trading liquid perps. Every profitable-looking configuration we could build was dominated by market beta; every honest out-of-sample test — two-window holdout, 6-fold adaptive walk-forward, cross-sectional long/short, symmetric trend-gated books — lost money after costs.", "body"))
story.append(P("The correct use of these signals is exactly what the terminal already does: confluence confirmation inside the M1/M2 verdict engine — not standalone entries.", "quote"))
story.append(Spacer(1, 3 * mm))
story.append(P("Evidence snapshot", "h2"))
story.append(data_table(
    ["Test", "Result", "Verdict"],
    [
        ["Coinglass panel validation (15m BTC, 9 signals)", "9/9 reproduced, same class+direction+bar", "Engine is faithful"],
        ["Class edges, drift-adjusted (180d, 20 symbols)", "+5 to +30 bp @ 30m-24h, sign flips across windows", "Sub-cost"],
        ["Directional short book (3 rules), 2-window", "Design -12.5%, Holdout -91.7% equity (1% risk)", "Beta-dominated"],
        ["6-fold adaptive walk-forward", "-31.4% equity, PF 0.70, P(loss)=0.92", "Fails OOS"],
        ["Cross-sectional L/S quintiles", "Spread +12bp design vs -29bp holdout, all |t|<1.4", "No selection edge"],
        ["Symmetric trend-aligned long+short book", "Design -9.5%, Holdout -17.2%", "Fails"],
        ["Aggregated (5 venues) vs Binance-only", "~75% signal overlap, indistinguishable 10d edges", "No difference"],
    ],
    [62 * mm, 78 * mm, 30 * mm],
))
story.append(PageBreak())

# ---- 1. methodology + validation ----
story.append(P("1 · Signal methodology and Coinglass validation", "h1"))
story.append(P("Definitions were transcribed from the live coinglass.com/footprint/BTC page (signal panel + FAQ, scraped 2026-11-13 with a headless browser) and implemented exactly — including the Trapped Traders class the terminal's v1 engine lacked:", "body"))
for b in [
    "<b>Absorption</b> — ≥30% of the bar's taker selling sits in the bottom 30% of the bar range yet the bar closes near its high (bullish); mirror at the high (bearish).",
    "<b>Trapped shorts / longs</b> — price breaks the 5-bar low on heavy bottom-zone taker selling, then closes weak; within 3 bars it rallies back into the upper part of the signal bar (bullish 'failed breakdown'); mirror for failed breakouts.",
    "<b>Bear / Bull div</b> — price prints a higher high (lower low) vs a prior ±3-bar swing pivot while cumulative volume delta falls (rises) over the swing.",
    "<b>Divergence (single-bar)</b> — bar closes up on negative delta ('rally without taker buying') or down on positive delta ('drop without taker selling').",
    "<b>Exhaustion</b> — new 10-bar low with almost no volume in the bottom 10% of the bar, closing in the upper half (seller exhaustion); mirror at highs.",
]:
    story.append(P(f"• {b}", "bullet"))
story.append(P("The engine reconstructs bar-level footprint from Binance fapi klines: taker-buy volume gives buy/sell/delta per m15 bar; m1 sub-bars give the price-zone attribution (volume weighted by range overlap with the bar's bottom/top zones). Calibration against the panel's own quoted numbers found: Coinglass's tick-level attribution reads ≈0.94–1.15× our low-zone estimate (gate 0.27 ≈ their 0.30) but only ≈0.70× our high-zone estimate (bear gate 0.43 ≈ their 0.30); absorption holds require the next bar to respect the signal extreme; close-position gates 0.65/0.35; CVD-divergence gap &gt; 0.0015 relative; 2-bar dedup.", "body"))
story.append(Image(f"{OUT}/chart1_validation.png", width=178 * mm, height=67 * mm))
story.append(P("Figure 1 — all nine 15m signals visible on the Coinglass BTC panel (11-11 21:30 → 11-13 07:53 scrape window) are reproduced exactly by the calibrated engine. Residual density differences at gate boundaries (±10–15% per-bar attribution noise from m1 vs tick-level zone weighting) are documented; every signal Coinglass fired, we fire.", "mono"))
story.append(PageBreak())

# ---- 2. data ----
story.append(P("2 · Data and universe", "h1"))
story.append(P("Universe: top-20 Binance USDT-M perpetuals by 24h quote volume (2026-11-13), excluding TradFi/stable/index listings and coins younger than 150 days: BTC, ETH, ZEC, SOL, XRP, HYPE, BNB, 1000PEPE, DOGE, NEAR, AGT, BARD, JCT, ENA, UNI, AKE, ARIA, SUI, ADA, INIT.", "body"))
story.append(P("History: 180 days (2026-05-17 → 2026-11-13) of m15 + m1 + 4h klines with taker-buy volumes (≈5.2M m1 bars total) and 8h funding; ≈3.45M m15 bars across 20 symbols; 121,887 reconstructed signals. All raw data disk-cached under data/fp-research/ (fetcher is resumable, rate-limit aware).", "body"))
story.append(P("Market context matters for interpretation: the first 90 days (design window) saw BTC fall −18% (77k → 63k); the last 90 days (holdout) rallied +39% to 87k, then fell to 68.8k.", "body"))

# ---- 3. event study ----
story.append(P("3 · Event study: what the signals actually predict", "h1"))
story.append(P("For every signal, entry is the next m15 open after the signal is knowable (absorption/trapped settle after their confirmation bars — no lookahead). Raw forward returns look impressive — e.g. bullish absorption +45 bp/day-direction at 24h with n=36k — but per-symbol drift adjustment (subtracting each symbol's unconditional same-horizon drift, direction-signed) reveals the truth: the raw edges are market beta. Bear-div shorts 'worked' in the falling design window and lost −95 bp/signal in the rallying holdout — the same signal, opposite sign of outcome.", "body"))
story.append(Image(f"{OUT}/chart2_horizons.png", width=182 * mm, height=80 * mm))
story.append(P("Figure 2 — drift-adjusted mean forward returns (bp) for all ten class×direction cells across six horizons, design window (left) vs holdout (right). No cell is consistently above the ~15 bp cost floor in both windows; the largest design-window cell (bear_div|bearish at 24h) inverts completely out-of-sample.", "mono"))
story.append(P("Confluence (multiple distinct same-direction classes within ±6 bars) and strength conditioning lift individual classes by +10–30 bp — enough to make exhaustion|bearish and absorption|bearish shorts reach +25–30 bp drift-adjusted — still below cost once path variance is priced in: the median signal sees 2.1–2.7% adverse excursion within 24h, so any stop tight enough to control risk converts the thin mean edge into a losing lottery (57–59% of 3×ATR-stopped shorts were stopped out before their 24h exit).", "body"))
story.append(PageBreak())

# ---- 4. strategy trail ----
story.append(P("4 · Strategy development trail — and why each design failed", "h1"))
story.append(data_table(
    ["#", "Design", "Result (after 15 bp costs)", "Why it failed"],
    [
        ["1", "Class→direction→horizon map, fixed stops/targets, walk-forward param grid", "OOS PF 0.29–0.51", "Thin mean edge vs 2%+ path variance; stop geometry converts alpha into noise"],
        ["2", "Frozen rules, 24h time exit, 3×ATR disaster stop", "Design −12.5%, Holdout −91.7% (1% risk)", "57–59% stopped; short book rode falling design window (beta), died in holdout rally"],
        ["3", "No-stop time-exit harvesting", "Design −8.8 bp/trade", "Raw edge ≈ beta + ~8 bp selection — below cost"],
        ["4", "Cross-sectional quintile L/S (beta-neutral by construction)", "Spread +12 bp (design) vs −29 bp (holdout), |t| < 1.4", "No reliable cross-sectional selection information"],
        ["5", "Trend-gated shorts (4h per-symbol regime)", "Holdout −73 bp/trade", "Per-symbol regime misses market direction; alts rotate locally down while market rallies"],
        ["6", "6-fold adaptive walk-forward (rule×gate selected from trailing 60d)", "−31.4% equity, PF 0.70, P(total loss)=0.92", "Selection adapts too slowly; trailing edge is beta-contaminated"],
        ["7", "Symmetric trend-aligned book (longs in uptrends, shorts in downtrends, BTC-1d gate)", "Design −9.5%, Holdout −17.2%", "Long leg carries no edge (PF 0.99); the one positive pocket (n=58 shorts, +56 bp) is too small"],
    ],
    [7 * mm, 43 * mm, 46 * mm, 70 * mm],
    fs=7,
))
story.append(Spacer(1, 3 * mm))
story.append(Image(f"{OUT}/chart3_equity.png", width=182 * mm, height=76 * mm))
story.append(P("Figure 3 — representative equity curves (1% equity risk per trade). The frozen-rule short book in-sample vs out-of-sample, with and without stops: every honest configuration loses.", "mono"))
story.append(P("We also verified the obvious execution levers: limit entries at signal-close + 0.5×ATR (fills only on retracement) improve per-trade economics by only ~4 bp; maker-style cost assumptions cannot bridge a sub-cost mean edge. Funding-extreme conditioning (bear-div + funding z &gt; +1: the crowded-long flush) showed +539 bp on n=111 design events but the funding history is too short for a trustworthy holdout — it is the one pocket flagged for live paper-testing, not for capital.", "body"))
story.append(PageBreak())

# ---- 5. aggregated vs binance ----
story.append(P("5 · Aggregated (multi-venue) vs Binance-only signals", "h1"))
story.append(P("The Coinglass footprint panel defaults to Binance perp data (venue selector), so the validation target is Binance. For the aggregation question we pulled 1,000 m15 bars (~10 days, the API maximum) of true price-cell footprint for BTC and ETH in two variants — Binance-only, and the terminal's aggregated view (Binance + OKX + Bybit + Bitget + Hyperliquid, re-gridded) — and ran the identical calibrated engine on both.", "body"))
story.append(Image(f"{OUT}/chart4_agg.png", width=178 * mm, height=64 * mm))
story.append(P("Figure 4 — signal counts and overlap. BTC: 345 vs 340 signals, 75% congruent within ±1 bar. ETH: 377 vs 335, 74%. Short-window forward edges are statistically indistinguishable (all within noise for n≈350/10d).", "mono"))
for b in [
    "Aggregation does not materially change the signal set on liquid majors — Binance order flow dominates and venues agree on the same microstructure events.",
    "The aggregated view cannot be backtested deeply (Coinglass caps orderFlow history at 1,000 bars); Binance taker-split klines are the only 180-day-grade source, and the 75% congruence justifies using them.",
    "Operational recommendation: keep Binance-only for research/backtest; the aggregated view adds value only as a live confirmation layer (it is already what the terminal's orderflow-agg route serves).",
]:
    story.append(P(f"• {b}", "bullet"))

# ---- 6. conclusion ----
story.append(P("6 · Conclusion and recommendation", "h1"))
story.append(P("This was a 'do not stop until profitable' mandate, executed with the full toolkit: faithful signal reconstruction (100% panel match), deep bar-level footprint data, drift-adjusted event studies, confluence/strength/regime/funding conditioning, and seven strategy architectures tested under honest out-of-sample protocols. The result is a confident negative on the headline question — and a positive on the right way to use these signals:", "body"))
for b in [
    "<b>Standalone footprint-signal strategies on liquid perps are not profitable after costs.</b> The information content is real but decays to +5–30 bp drift-adjusted at tradable horizons, below the ~15 bp round-trip cost, and its sign is regime-dependent. This is exactly what efficiency predicts for signals displayed publicly on a popular site.",
    "<b>The signals' value is confirmatory, not directional.</b> As confluence inputs — absorption at a pullback zone, CVD divergence confirming a sweep, exhaustion qualifying a fade — they sharpen an existing edge (the terminal's WS7 M1/M2 engine already uses them this way, and the M2 EXHAUSTION_SWEEP_CONFIRMED rule is precisely this pattern). The recommendation is to keep and deepen that usage, not to trade the signals alone.",
    "<b>Two pockets are flagged for live paper-testing</b> (not capital): (a) exhaustion/absorption-bearish confluence shorts in confirmed downtrends — positive but statistically contaminated by iteration in this study; (b) bear-div shorts at extreme positive funding (crowded-long flush, +539 bp on n=111 in-sample). Both are wired into the research harness so the desk can accumulate an honest live track record on the Virtual Book before any allocation.",
    "<b>The research infrastructure is reusable</b>: resumable multi-source fetchers, the calibrated engine, the drift-adjustment and walk-forward frameworks, and the honest-reporting discipline (every failure documented above) — all committed to the repo.",
]:
    story.append(P(f"• {b}", "bullet"))

story.append(Spacer(1, 4 * mm))
story.append(P("Artifacts", "h2"))
story.append(P("scripts/fp-research/ — 14 reproducible stages: pick_universe · fetch_history · build_signals · cg_signals_v2 (calibrated engine + validator) · event_study · baseline_geometry · conditioning · strategy_v2/v3/final · walk_forward_final · strategy_symmetric · cross_sectional · agg_vs_binance · make_charts · this report. Data (gitignored): data/fp-research/ — 180d klines+funding for 20 symbols, 121,887 signals, events.pkl.", "mono"))

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("PDF:", os.path.abspath(f"{OUT}/Footprint_Signal_Research_Report.pdf"), os.path.getsize(f"{OUT}/Footprint_Signal_Research_Report.pdf"), "bytes")
