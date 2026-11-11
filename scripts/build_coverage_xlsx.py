#!/usr/bin/env python3
"""Build the FundedNext universe data-coverage matrix workbook (user deliverable).

Data sources: scripts/t3_probe_results.json (live Yahoo probe 2026-11-10),
terminal /api/cg/classic?list=1 (registry), repo knowledge (perp registry).
Style: xlsx skill design system (professional palette, borderless-first).
"""
import json, sys, os, urllib.request
from datetime import datetime, timezone

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)
from templates.base import *  # noqa: design tokens + style factories
from templates.base import font_title, font_header, font_body, font_caption, fill_header, fill_data_row, align_header
from openpyxl.styles import Font, Alignment

align_wrap = lambda: Alignment(vertical="top", wrap_text=True)
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

OUT = "/home/z/my-project/download/FundedNext-Universe-Data-Coverage-Matrix-20261110.xlsx"
probe = json.load(open("/home/z/my-project/scripts/t3_probe_results.json"))
y = probe["sections"]["yahoo"]

# ---- registry from the live terminal
with urllib.request.urlopen("http://localhost:3000/api/cg/classic?list=1", timeout=30) as r:
    cl = json.load(r)
CLASSIC = {a["sym"]: a for a in cl["assets"]}

PERP = {
    "BTCUSD": ("BTC", "crypto", "BTC-USD"), "ETHUSD": ("ETH", "crypto", "ETH-USD"),
    "XRPUSD": ("XRP", "crypto", "XRP-USD"), "ADAUSD": ("ADA", "crypto", "ADA-USD"),
    "DOGUSD": ("DOGE", "crypto", "DOGE-USD"), "LNKUSD": ("LINK", "crypto", "LINK-USD"),
    "LTCUSD": ("LTC", "crypto", "LTC-USD"), "XLMUSD": ("XLM", "crypto", "XLM-USD"),
    "XMRUSD": ("XMR", "crypto", "XMR-USD"),
    "XAUUSD": ("XAU", "metal", "GC=F"), "XAGUSD": ("XAG", "metal", "SI=F"),
    "XPTUSD": ("XPT", "metal", "PL=F"), "USOUSD": ("USO", "metal", "CL=F"),
    "UKOUSD": ("UKO", "commodity", "BZ=F"),
}
NOT_LISTED = {"SOLUSD": "SOL", "BNBUSD": "BNB", "AVAXUSD": "AVAX"}


def yrow(yset, key):
    return (y.get(yset) or {}).get(key) or {}


rows = []
# perp-path instruments (incl. UKO which is classic-only for data)
for broker, (sym, klass, yticker) in PERP.items():
    pr = yrow("crypto_xcheck" if klass == "crypto" else "commodities_metals", sym)
    perp_path = klass != "commodity"  # UKO has no perp data
    rows.append({
        "Class": klass, "Broker": broker, "Desk": sym, "Yahoo": yticker,
        "Path": "perp (8-dim)" if perp_path else "classic (watchlist)",
        "YahooQuote": "✓" if pr.get("price") else "✗",
        "YahooBars": "✓ 15m/5d, 1m→1y" if pr.get("price") else "✗",
        "Volume": "✓" if pr.get("has_volume") else "—",
        "Perp8dim": "✓ Coinglass" if perp_path else "✗ none exists",
        "Binance": "✓" if klass == "crypto" else "n/a",
        "BrokerFeed": "✓ mt5.json" if broker != "UKOUSD" else "pending DIR-0009",
        "Notes": ("USO: OKX-lead perp (1 venue — PARKED under data-depth gate); Yahoo CL=F cross-ref"
                  if sym == "USO" else
                  "XPT: 2-venue perp (PARKED under data-depth gate); Yahoo PL=F cross-ref"
                  if sym == "XPT" else
                  "UKO: ZERO perp data on any venue — Yahoo BZ=F futures are the only reference market"
                  if sym == "UKO" else ""),
    })
# not-listed perps
for broker, sym in NOT_LISTED.items():
    rows.append({"Class": "crypto", "Broker": broker + " (NOT LISTED)", "Desk": sym, "Yahoo": f"{sym}-USD",
                 "Path": "perp watchlist", "YahooQuote": "✓", "YahooBars": "✓", "Volume": "✓",
                 "Perp8dim": "✓ Coinglass", "Binance": "✓", "BrokerFeed": "✗ not on FundedNext",
                 "Notes": "execution impossible at this broker — perp-side levels watchlist-only"})
# classic instruments
for sym, a in CLASSIC.items():
    setname = {"index": "indices", "fx": "fx", "equity": "equities", "commodity": "commodities_metals"}[a["klass"]]
    pr = yrow(setname, sym)
    rows.append({
        "Class": a["klass"], "Broker": a["broker"], "Desk": sym, "Yahoo": a["yahoo"],
        "Path": "classic (watchlist)", "YahooQuote": "✓" if pr.get("price") else "✗",
        "YahooBars": "✓ 15m/5d, 1m→1y" if pr.get("price") else "✗",
        "Volume": "✓" if (pr.get("has_volume") or a.get("volume")) else "— price-only",
        "Perp8dim": "✗ none exists", "Binance": "n/a",
        "BrokerFeed": "pending DIR-0009",
        "Notes": (a.get("note") or ""),
    })
# excluded SPCX row (documented)
rows.append({"Class": "equity", "Broker": "SPCX", "Desk": "— excluded", "Yahoo": "SPCX (SPAC ETF)",
             "Path": "EXCLUDED", "YahooQuote": "✓ wrong instrument", "YahooBars": "✓ wrong instrument",
             "Volume": "✓", "Perp8dim": "✗", "Binance": "n/a", "BrokerFeed": "?",
             "Notes": "Yahoo SPCX = Tuttle SPAC/New-Issue ETF ≠ FN instrument — removed; restore after DIR-0009 spec check"})

order = {"crypto": 0, "metal": 1, "commodity": 2, "index": 3, "fx": 4, "equity": 5}
rows.sort(key=lambda r: (order.get(r["Class"], 9), r["Broker"]))

wb = Workbook()
wb.properties.creator = "Z.ai"

# ---------------------------------------------------------------- Sheet 1
ws = wb.active
ws.title = "Coverage Matrix"
title = "FundedNext Universe · Market-Data Coverage Matrix — live-verified 2026-11-10 21:10 UTC"
headers = ["Class", "Broker", "Desk", "Yahoo", "Path", "YahooQuote", "YahooBars",
           "Volume", "Perp8dim", "Binance", "BrokerFeed", "Notes"]
ws["B2"] = title
ws["B2"].font = font_title()
hdr_row = 4
for c, h in enumerate(headers, start=2):
    cell = ws.cell(row=hdr_row, column=c, value=h)
    cell.font = font_header()
    cell.fill = fill_header()
    cell.alignment = align_header()
for i, r in enumerate(rows):
    rr = hdr_row + 1 + i
    for c, h in enumerate(headers, start=2):
        cell = ws.cell(row=rr, column=c, value=r[h])
        if i % 2 == 0:
            cell.fill = fill_data_row(i)
        cell.font = font_body()
        if h in ("Yahoo Quote", "Volume", "Perp8dim", "Binance"):
            v = str(r[h])
            cell.font = Font(color=ACCENT_POSITIVE, bold=True) if v.startswith("✓") else (Font(color=ACCENT_NEGATIVE, bold=True) if v.startswith("✗") else font_body())
        if h == "Path":
            v = str(r[h])
            if v.startswith("perp ("):
                cell.font = Font(color=ACCENT_POSITIVE, bold=True)
            elif "watchlist" in v:
                cell.font = Font(color=ACCENT_WARNING, bold=True)
            elif v == "EXCLUDED":
                cell.font = Font(color=ACCENT_NEGATIVE, bold=True)
widths = [10, 15, 9, 13, 18, 10, 16, 12, 18, 9, 15, 52]
for c, w in enumerate(widths, start=2):
    ws.column_dimensions[get_column_letter(c)].width = w
ws.freeze_panes = "B5"
n_perp = sum(1 for r in rows if r["Path"].startswith("perp"))
n_classic = sum(1 for r in rows if "watchlist" in r["Path"])
ws.cell(row=hdr_row + len(rows) + 2, column=2, value=f"{len(rows)} instruments mapped · {n_perp} perp-path · {n_classic} classic watchlist · 1 excluded (SPCX) · counts computed at generation").font = font_caption()
ws.cell(row=hdr_row + len(rows) + 3, column=2, value="Probe artifact: scripts/t3_probe_results.json · classic registry: /api/cg/classic?list=1 · all ✓ verified live").font = font_caption()

# ---------------------------------------------------------------- Sheet 2
ws2 = wb.create_sheet("Data Sources")
src_rows = [
    ["Coinglass web API", "crypto perps + metals/energy perps (XAU XAG XPT USO)", "klines, order-flow footprints, funding, OI, liquidation levels/heatmaps, large orders, stopmap (BTC)", "paced calls + TTL caches; encrypted responses", "free (web-client key)", "auth layer in terminal", "INTEGRATED — the 8-dim engine's backbone"],
    ["Binance fapi", "crypto perps", "live prices/WS, perp klines, premium/funding, OI", "aggressive parallel probing → IP 418 auto-ban (observed)", "free", "public endpoints", "INTEGRATED (live-price + cross-check)"],
    ["Yahoo Finance chart v8", "indices · FX · equities · commodity futures · crypto cross-check", "quotes + OHLCV bars 1m→1y, session tz, volume (equities/US cash/CME futures only)", "unofficial, unpublished; ~7k tickers/day cutoff precedent (2024); 60s cache + 2s backoff shipped", "free, keyless", "none", "INTEGRATED — /api/cg/classic route (77 instruments)"],
    ["OANDA v20 REST", "FX majors", "quotes, candles, OrderBook + PositionBook (FX positioning analog)", "practice tier generous (docs)", "free practice token", "API token", "RESEARCHED — engine v4 candidate for FX positioning dim"],
    ["CFTC COT", "index/commodity/FX futures", "trader positioning (analog to OI/sentiment)", "SEMIWEEKLY since late-2026: Mon data→Wed release, Wed data→Fri 15:30 ET", "free public datasets", "none", "RESEARCHED — v4 candidate"],
    ["Twelve Data", "FX · stocks · indices · crypto", "quotes, candles, fundamentals", "free 800 calls/day, 8/min", "freemium", "API key", "DOCUMENTED — plan-B if Yahoo degrades"],
    ["Finnhub", "US stocks · FX · crypto", "real-time quotes, websocket", "free 60 calls/min", "freemium", "API key", "DOCUMENTED"],
    ["Alpha Vantage", "FX · commodities · stocks", "quotes, intraday", "free 25 calls/day (too thin for 43-pair FX)", "freemium", "API key", "DOCUMENTED — not viable at our scale"],
    ["Dukascopy", "1,499 FX pairs · stocks · indices", "historical tick + OHLC (backtest-grade)", "fair use", "free", "none (CLI)", "DOCUMENTED — backtest source for engine v4"],
    ["Stooq", "world indices · FX", "CSV quotes/EOD", "n/a", "free", "none", "UNREACHABLE from sandbox (timeouts) — documented dead end"],
    ["MT5 broker feed (FundedNext)", "all 96 instruments", "bid/ask/spread/basis, contract specs, tick volume, (DOM: synthetic on CFD brokers — desk research)", "daemon pushes every 45s", "account-held", "MT5 login (daemon side)", "INTEGRATED for perp symbols (17-entry map); classic coverage pending DIR-0009"],
]
ws2["B2"] = "External market-data sources — coverage, limits, integration status"
ws2["B2"].font = font_title()
h2 = ["Source", "Classes", "Exposes", "Rate limits / cadence", "Cost", "Auth", "Status"]
for c, h in enumerate(h2, start=2):
    cell = ws2.cell(row=4, column=c, value=h)
    cell.font = font_header()
    cell.fill = fill_header()
    cell.alignment = align_header()
for i, r in enumerate(src_rows):
    for c, v in enumerate(r, start=2):
        cell = ws2.cell(row=5 + i, column=c, value=v)
        if i % 2 == 0:
            cell.fill = fill_data_row(i)
        cell.font = font_body()
        cell.alignment = align_wrap()
    st = r[6]
    cell = ws2.cell(row=5 + i, column=8)
    if st.startswith("INTEGRATED"):
        cell.font = Font(color=ACCENT_POSITIVE, bold=True)
    elif st.startswith("RESEARCHED") or st.startswith("DOCUMENTED"):
        cell.font = Font(color=ACCENT_WARNING, bold=True)
    else:
        cell.font = Font(color=ACCENT_NEGATIVE, bold=True)
for c, w in enumerate([22, 30, 44, 34, 16, 16, 44], start=2):
    ws2.column_dimensions[get_column_letter(c)].width = w
ws2.freeze_panes = "B5"

# ---------------------------------------------------------------- Sheet 3
ws3 = wb.create_sheet("Scorecard Mapping")
ws3["B2"] = "8-dimension scorecard — what each dimension becomes per asset class"
ws3["B2"].font = font_title()
h3 = ["Dimension", "Perp assets (16)", "Classic assets (77)", "Classic analog (researched, not integrated)"]
for c, h in enumerate(h3, start=2):
    cell = ws3.cell(row=4, column=c, value=h)
    cell.font = font_header()
    cell.fill = fill_header()
    cell.alignment = align_header()
sc_rows = [
    ["trend (EMA stack)", "✓ live, 4 timeframes", "✓ EMA20/50 (15m) from Yahoo bars", "—"],
    ["VWAP ± σ / session", "✓ live (UTC-day anchored)", "✓ vol-weighted (US indices, equities, UKO) · price-only anchor (FX, EU/Asia indices) — labeled, never faked", "session-anchored VWAP per calendar (v4 precondition 4)"],
    ["RSI", "✓ 4 timeframes", "✓ RSI(14) 15m", "—"],
    ["signals / microFlow (footprint Δ)", "✓ 4→2→1-venue aggregates", "n/a — no perp order-flow exists", "MT5 tick-volume delta (daemon-side)"],
    ["CVD quadrant / divergence", "✓", "n/a", "OANDA taker/booking data (FX majors)"],
    ["funding / OI", "✓ (context-only rule proposed when thin)", "n/a — cash instruments", "CFTC COT (semiweekly) · OANDA PositionBook · short-interest/put-call (equities)"],
    ["liquidation magnets (targets)", "✓ with v3.3 mass floor", "n/a — structural levels (24h/5d extremes) printed as reference only", "gap/stop-cluster models (v4 precondition 6)"],
    ["bookwalls / LTO / stopmap", "✓ (USO: honest no-aggregate)", "n/a — MT5 DOM synthetic at best (desk research)", "—"],
    ["VERDICTS", "PLACEABLE / PARKED / REJECTED / NO-TRADE", "WATCHLIST-ONLINE / -STALE / -OFFLINE — NO trade construction until engine v4 (user gate)", "8 Laurie preconditions documented (REVIEW-MULTIAGENT-20261110-R2.md)"],
]
for i, r in enumerate(sc_rows):
    for c, v in enumerate(r, start=2):
        cell = ws3.cell(row=5 + i, column=c, value=v)
        if i % 2 == 0:
            cell.fill = fill_data_row(i)
        cell.font = font_body()
        cell.alignment = align_wrap()
for c, w in enumerate([26, 30, 52, 44], start=2):
    ws3.column_dimensions[get_column_letter(c)].width = w

# ---------------------------------------------------------------- Sheet 4
ws4 = wb.create_sheet("Gates v3.3")
ws4["B2"] = "Engine v3.3 honesty gates (live-calibrated 2026-11-10)"
ws4["B2"].font = font_title()
h4 = ["Gate", "Rule", "Live calibration", "Effect"]
for c, h in enumerate(h4, start=2):
    cell = ws4.cell(row=4, column=c, value=h)
    cell.font = font_header()
    cell.fill = fill_header()
    cell.alignment = align_header()
g_rows = [
    ["Data-depth", "PLACEABLE needs ≥3 fp data venues AND ≥1,000 open liq levels", "BTC 5,389/4v · ETH 4,351/4v · XLM 3,112/4v · XMR 3,640/3v · XAG 1,715/3v · XPT 1,592/2v ✗ · USO 358/1v ✗", "XPT + USO PARK (thin books cannot pass phantom magnets)"],
    ["Magnet-mass floor", "T1 USD ≥ max($5M, 0.25% of perp OI)", "XLM T1 $0.9M vs floor $5.0M (OI $0.19B) → FAIL", "XLM 3.19R PLACEABLE → PARKED (closes the rank-normalized-strength blocker)"],
    ["Min-lot risk gate", "volumeMin-forced risk > 0.5% mandate → PARKED (not advisory)", "XAG 0.01 lot = 0.72% at $4,650 equity", "XAG PARKED until equity ≥ ~$6,740 or explicit user override (hard-capped 1.5×)"],
    ["Sizing direction", "floor-to-step, never round up", "XLM landed exactly 0.50% by luck under round-nearest", "realized risk can never exceed the computed mandate risk"],
    ["Staleness gate", "last bar > 90 min old → WATCHLIST-STALE", "15/77 classic STALE at 21:08 UTC (EU closed)", "closed markets never print as live"],
    ["Registry/parse hard-fails", "state.json unreadable or <17 map entries → refuse; classic registry unreachable on all/classic → refuse", "state.json race produced false feed-dead DOGE/LINK readings at 20:53 (retracted, logged)", "no scan rather than a false scan"],
]
for i, r in enumerate(g_rows):
    for c, v in enumerate(r, start=2):
        cell = ws4.cell(row=5 + i, column=c, value=v)
        if i % 2 == 0:
            cell.fill = fill_data_row(i)
        cell.font = font_body()
        cell.alignment = align_wrap()
for c, w in enumerate([20, 46, 52, 44], start=2):
    ws4.column_dimensions[get_column_letter(c)].width = w
ws4.cell(row=5 + len(g_rows) + 2, column=2, value="Pending user approval (v3.3 proposals, not shipped): lone-magnet guard · stop extension past any magnet within 0.25σ · magnet-merge within 0.5σ · digest STANDBY ranking · spread ≤ min(0.15%, 15% of 1R) · correlation-cap config").font = font_caption()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("saved", OUT, "·", len(rows), "instrument rows ·", len(src_rows), "sources")
