#!/usr/bin/env python3
"""E2E backtest trade-log workbook (English, professional palette).
Sheets: Summary | Trades_OOS | Folds | Universe_PIT | Stress_MC."""
import json
import sys
import os

import pandas as pd

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)
from base import (  # noqa: E402
    use_palette_explicit, setup_sheet, style_header_row, style_data_row,
    style_total_row, font_title, font_body, font_caption, font_kpi, font_kpi_label,
    fill_data_row, align_number, align_text, FONT_NAME,
)
from openpyxl import Workbook  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402

use_palette_explicit("professional")

PIT = "download/fp-research/e2e_pit"
OLD = "download/fp-research/e2e_olduni"
OUT = "download/Footprint_E2E_Backtest_Trades_and_Metrics.xlsx"

tr = pd.read_csv(f"{PIT}/e2e_trades_OOS.csv").sort_values("ts").reset_index(drop=True)
metrics = json.load(open(f"{PIT}/e2e_final_metrics.json"))
folds = json.load(open(f"{PIT}/e2e_fold_choices.json"))
uni_pit = json.load(open("data/fp-research/universe_pit.json"))
uni_old = json.load(open("data/fp-research/universe_old.json"))

wb = Workbook()
wb.properties.creator = "Z.ai"

NUM2 = "#,##0.00"
NUM4 = "0.0000"
PCT2 = "0.00%"
USD = "$#,##0.00"


def put_row(ws, row, values, start_col=2, fmts=None):
    for j, v in enumerate(values):
        c = ws.cell(row=row, column=start_col + j, value=v)
        if fmts and fmts[j]:
            c.number_format = fmts[j]
    return row + 1


def header_block(ws, row, headers, start_col=2):
    for j, h in enumerate(headers):
        ws.cell(row=row, column=start_col + j, value=h)
    style_header_row(ws, row, start_col, start_col + len(headers) - 1)
    return row + 1


# ---------------- Sheet 1: Summary ----------------
ws = wb.active
ws.title = "Summary"
setup_sheet(ws, title="Footprint Strategy E2E Backtest — $5,000 Start", last_col=6)
r = 4
ws.cell(row=r, column=2, value="Headline (out-of-sample 2026-07-16 to 2026-11-13, point-in-time universe)").font = font_title()
r += 2
r = header_block(ws, r, ["Metric", "Honest run (PIT)", "Biased run (Nov-ranked)", "Benchmark / reference"])
pit, old = metrics["pit"], metrics["old_universe"]
rows = [
    ("Final equity (USD)", pit["final"], old["final"], None),
    ("Total return", pit["total_ret"], old["total_ret"], 0.10),
    ("Annualized return", pit["annualized"], old["annualized"], None),
    ("Maximum drawdown", pit["max_dd"], old["max_dd"], None),
    ("Sharpe (daily)", pit["sharpe"], old["sharpe"], None),
    ("Sortino (daily)", pit["sortino"], old["sortino"], None),
    ("Trades (OOS)", pit["trades"]["n"], old["trades"]["n"], None),
    ("Win rate", pit["trades"]["win_rate"], old["trades"]["win_rate"], None),
    ("Profit factor", pit["trades"]["pf"], old["trades"]["pf"], None),
    ("Avg win / avg loss (USD)", f"{pit['trades']['avg_win']:.2f} / {pit['trades']['avg_loss']:.2f}", f"{old['trades']['avg_win']:.2f} / {old['trades']['avg_loss']:.2f}", None),
    ("Expectancy per trade (USD)", pit["trades"]["expectancy"], old["trades"]["expectancy"], None),
    ("Funding received (USD)", pit["trades"]["funding_pnl"], old["trades"]["funding_pnl"], None),
    ("Costs paid (USD)", pit["trades"]["cost_pnl"], old["trades"]["cost_pnl"], None),
    ("All-config median final (no-skill)", 4619.31, 4210, None),
]
fmt_map = {
    "Final equity (USD)": USD, "Total return": PCT2, "Annualized return": PCT2,
    "Maximum drawdown": PCT2, "Sharpe (daily)": "0.00", "Sortino (daily)": "0.00",
    "Trades (OOS)": "0", "Win rate": PCT2, "Profit factor": "0.00",
    "Expectancy per trade (USD)": USD, "Funding received (USD)": USD, "Costs paid (USD)": USD,
    "All-config median final (no-skill)": USD,
}
start = r
for i, (name, v1, v2, v3) in enumerate(rows):
    fmt = fmt_map.get(name)
    ws.cell(row=r, column=2, value=name)
    c1 = ws.cell(row=r, column=3, value=v1)
    c2 = ws.cell(row=r, column=4, value=v2)
    if fmt:
        c1.number_format = fmt
        c2.number_format = fmt
    if v3 is not None:
        c3 = ws.cell(row=r, column=5, value=v3)
        if fmt:
            c3.number_format = fmt
    style_data_row(ws, r, 2, 6, i)
    r += 1
ws.cell(row=start + 13, column=5, value="BTC buy & hold +10.00% (row: Total return)").font = font_caption()
r += 1
ws.cell(row=r, column=2, value="Verdict: no standalone edge survives the bias audit. The +32.4% on the Nov-ranked universe is survivorship bias (68.4pp).").font = font_caption()

# ---------------- Sheet 2: Trades_OOS ----------------
ws = wb.create_sheet("Trades_OOS")
setup_sheet(ws, title="Out-of-Sample Trade Log — Honest Run (104 trades)", last_col=14)
r = 4
cols = ["#", "Entry (UTC)", "Exit (UTC)", "Symbol", "Side", "Rule", "Entry px", "Exit px",
        "Stop %", "Notional $", "Funding $", "Cost $", "PnL $", "Equity after $"]
r = header_block(ws, r, cols)
fmts = [None, None, None, None, None, None, NUM4, NUM4, PCT2, USD, USD, USD, USD, USD]
for i, t in tr.iterrows():
    vals = [
        i + 1,
        pd.to_datetime(t.ts, unit="ms").strftime("%Y-%m-%d %H:%M"),
        pd.to_datetime(t.exit_ts, unit="ms").strftime("%Y-%m-%d %H:%M"),
        t.sym, t.side, t.rule, t.entry, t.exit, t.stop_pct, t.notional,
        round(t.fund_pct * t.notional, 2), round(t.cost_pct * t.notional, 2),
        round(t.pnl, 2), round(t.equity_after, 2),
    ]
    r = put_row(ws, r, vals, fmts=fmts)
    style_data_row(ws, r - 1, 2, 15, i)
    for col, fmt in enumerate(fmts, 2):
        if fmt:
            ws.cell(row=r - 1, column=col).number_format = fmt
# totals row
ws.cell(row=r, column=2, value="TOTAL")
tot = ws.cell(row=r, column=14, value=round(tr.pnl.sum(), 2))
tot.number_format = USD
style_total_row(ws, r, 2, 15)
r += 2
ws.cell(row=r, column=2, value="Side: short = bearish signal sold; long = bullish signal bought. Funding is credited at 8h settlements (shorts receive positive funding). Costs are 15bp round trip on notional.").font = font_caption()
ws.freeze_panes = "C5"

# ---------------- Sheet 3: Folds ----------------
ws = wb.create_sheet("Folds")
setup_sheet(ws, title="Walk-Forward Fold Selections", last_col=8)
r = 4
r = header_block(ws, r, ["Fold", "Test window", "Rule set", "Gate", "Stop k", "Trail", "Hold", "Conc", "Risk", "Train n", "Train bp", "Train PF", "OOS n", "OOS PnL $"])
for i, f in enumerate(folds["folds"]):
    if f["config"] == "NO-TRADE":
        r = put_row(ws, r, [f["fold"], "cash — no qualifying config"] + [""] * 12)
        style_data_row(ws, r - 1, 2, 15, i)
        continue
    p = dict(x.split("=", 1) for x in f["config"].split("|")[1:])
    vals = [f["fold"],
            f"{pd.to_datetime(f['test'][0], unit='ms'):%Y-%m-%d} to {pd.to_datetime(f['test'][1], unit='ms'):%Y-%m-%d}",
            f["config"].split("|")[0], p["gate"], float(p["k"]), float(p["trail"]),
            p["hold"], int(p["conc"]), float(p["risk"].rstrip("%")) / 100,
            f["train_n"], f["train_bp"], None, f["test_n"], f["test_pnl"]]
    r = put_row(ws, r, vals)
    style_data_row(ws, r - 1, 2, 15, i)
    ws.cell(row=r - 1, column=10).number_format = PCT2
    ws.cell(row=r - 1, column=15).number_format = USD
r += 1
ws.cell(row=r, column=2, value="Selection rule: best net expectancy bp/trade on the trailing 60d, n >= 25, positive; tie-break profit factor. Every fold lost money OOS.").font = font_caption()

# ---------------- Sheet 4: Universe_PIT ----------------
ws = wb.create_sheet("Universe_PIT")
setup_sheet(ws, title="Point-in-Time Universe (knowable on 2026-05-17)", last_col=6)
r = 4
r = header_block(ws, r, ["Rank", "Symbol", "Week-1 quote volume ($M)", "Age at 2026-05-17 (days)", "In old (Nov-ranked) universe?"])
old_syms = {x["symbol"] for x in uni_old}
for i, u in enumerate(uni_pit):
    r = put_row(ws, r, [i + 1, u["symbol"], round(u["qv_week1"] / 1e6, 1), u["age_at_may17"],
                        "yes" if u["symbol"] in old_syms else "NO — new"])
    style_data_row(ws, r - 1, 2, 6, i)
    ws.cell(row=r - 1, column=4).number_format = "#,##0.0"
r += 1
removed = sorted(old_syms - {u["symbol"] for u in uni_pit})
ws.cell(row=r, column=2, value=f"Removed vs Nov-ranked universe (survivorship beneficiaries): {', '.join(removed)}").font = font_caption()
r += 1
ws.cell(row=r, column=2, value="Method: all 459 USDT perps with >= 150d history at 2026-05-17, TradFi/stable/index excluded, ranked by quote volume 2026-05-17 to 05-24.").font = font_caption()

# ---------------- Sheet 5: Stress_MC ----------------
ws = wb.create_sheet("Stress_MC")
setup_sheet(ws, title="Stress Variants and Monte Carlo (honest run)", last_col=5)
r = 4
ws.cell(row=r, column=2, value="Stress variants (final equity from $5,000)").font = font_title()
r += 2
r = header_block(ws, r, ["Variant", "Final equity $", "Return", "Trades"])
for i, (k, v) in enumerate(folds["stress"].items()):
    r = put_row(ws, r, [k, v["final"], v["ret"], v["n"]], fmts=[None, USD, PCT2, "0"])
    style_data_row(ws, r - 1, 2, 5, i)
r += 2
ws.cell(row=r, column=2, value="Monte-Carlo bootstrap of the OOS trade sequence (4,000 paths)").font = font_title()
r += 2
r = header_block(ws, r, ["Run", "P(loss)", "5th pct $", "Median $", "95th pct $", "P(DD > 20%)"])
for i, (label, mc) in enumerate([("PIT (honest)", metrics["pit"]["mc"]), ("Biased universe", metrics["old_universe"]["mc"])]):
    r = put_row(ws, r, [label, mc["p_loss"], mc["final_p5"], mc["final_p50"], mc["final_p95"], mc["p_dd_gt20"]],
                fmts=[None, PCT2, USD, USD, USD, PCT2])
    style_data_row(ws, r - 1, 2, 7, i)
r += 2
ws.cell(row=r, column=2, value="Monte Carlo resamples the realized OOS trade PnL sequence with replacement; equity paths approximate compounding at fixed initial equity.").font = font_caption()

# column widths
for sheet, widths in {
    "Summary": [34, 20, 20, 26, 10],
    "Trades_OOS": [5, 17, 17, 13, 8, 13, 11, 11, 9, 11, 10, 9, 10, 13],
    "Folds": [6, 24, 12, 10, 8, 7, 7, 6, 7, 8, 9, 9, 7, 11],
    "Universe_PIT": [6, 14, 24, 22, 24],
    "Stress_MC": [22, 15, 12, 13, 12, 12],
}.items():
    s = wb[sheet]
    for j, w in enumerate(widths, 2):
        s.column_dimensions[get_column_letter(j)].width = w

wb.save(OUT)
print("WROTE", OUT)
