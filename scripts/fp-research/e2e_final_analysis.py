#!/usr/bin/env python3
"""
fp-research step 20 — FINAL ANALYSIS of the E2E walk-forward backtest.

Consumes the two run directories:
  download/fp-research/e2e_pit    — the HONEST run (point-in-time universe,
                                   leak-free confluence)
  download/fp-research/e2e_olduni — the survivorship-biased run (Nov-13
                                   volume-ranked universe), kept to quantify
                                   the bias itself.

Produces: daily equity curves, risk metrics, Monte-Carlo bootstrap,
attribution tables, and 4 report charts under download/fp-research/e2e_pit/.
"""
import json
import os
from collections import defaultdict

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE = "download/fp-research"
PIT = f"{BASE}/e2e_pit"
OLD = f"{BASE}/e2e_olduni"
INITIAL = 5_000.0
DAY = 86_400_000


def daily_equity(curve_csv):
    df = pd.read_csv(curve_csv)
    df["dt"] = pd.to_datetime(df.ts, unit="ms")
    df = df.drop_duplicates(subset="dt", keep="last")
    s = df.set_index("dt")["equity"].sort_index()
    # mark each calendar day with the LAST equity print within that day
    daily = s.resample("1D").last().ffill()
    return daily


def risk_metrics(daily, initial=INITIAL):
    ret = daily.pct_change().dropna()
    total = daily.iloc[-1] / initial - 1
    days = max((daily.index[-1] - daily.index[0]).days, 1)
    ann = (1 + total) ** (365 / days) - 1 if total > -1 else -1.0
    dd = (daily / daily.cummax() - 1)
    sharpe = ret.mean() / ret.std() * np.sqrt(365) if ret.std() > 0 else 0.0
    downside = ret[ret < 0]
    sortino = ret.mean() / downside.std() * np.sqrt(365) if len(downside) > 1 and downside.std() > 0 else 0.0
    return {
        "final": round(float(daily.iloc[-1]), 2),
        "total_ret": round(float(total), 4),
        "annualized": round(float(ann), 4),
        "max_dd": round(float(dd.min()), 4),
        "sharpe": round(float(sharpe), 2),
        "sortino": round(float(sortino), 2),
        "days": int(days),
    }


def trade_stats(csv):
    tr = pd.read_csv(csv)
    pnl = tr.pnl.values
    wins, losses = pnl[pnl > 0], pnl[pnl <= 0]
    out = {
        "n": len(tr), "win_rate": round(float((pnl > 0).mean()), 4),
        "pf": round(float(wins.sum() / max(1e-9, -losses.sum())), 3),
        "avg_win": round(float(wins.mean()) if len(wins) else 0.0, 2),
        "avg_loss": round(float(losses.mean()) if len(losses) else 0.0, 2),
        "payoff": round(float(wins.mean() / abs(losses.mean())) if len(wins) and len(losses) and losses.mean() != 0 else 0, 2),
        "expectancy": round(float(pnl.mean()), 2),
        "avg_notional": round(float(tr.notional.mean()), 0),
        "max_notional": round(float(tr.notional.max()), 0),
        "avg_hold_h": round(float(tr.exit_ts.sub(tr.ts).mean() / 3_600_000), 1),
        "funding_pnl": round(float((tr.fund_pct * tr.notional).sum()), 2),
        "cost_pnl": round(float((tr.cost_pct * tr.notional).sum()), 2),
    }
    return out, tr


def monte_carlo(tr, label, n_paths=4000, seed=20261113):
    pnl = tr.pnl.values / INITIAL          # fraction of initial equity
    # risk-fraction re-normalization: pnl already realized on compounding equity;
    # bootstrap as fraction-of-initial approximation for path dispersion
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(pnl), size=(n_paths, len(pnl)))
    paths = np.cumsum(pnl[idx], axis=1)
    finals = 1 + paths[:, -1]
    maxdd = (np.maximum.accumulate(paths, axis=1) - paths).max(axis=1) / (1 + np.maximum.accumulate(paths, axis=1).max(axis=1))
    return {
        "label": label,
        "p_loss": round(float((finals < 1).mean()), 4),
        "final_p5": round(float(np.percentile(finals, 5) * INITIAL), 2),
        "final_p50": round(float(np.percentile(finals, 50) * INITIAL), 2),
        "final_p95": round(float(np.percentile(finals, 95) * INITIAL), 2),
        "p_dd_gt20": round(float((maxdd > 0.20).mean()), 4),
    }


def main():
    # ---- load runs
    pit_daily = daily_equity(f"{PIT}/e2e_equity_OOS.csv")
    old_daily = daily_equity(f"{OLD}/e2e_equity_OOS.csv")
    pit_m = risk_metrics(pit_daily)
    old_m = risk_metrics(old_daily)
    pit_ts, pit_tr = trade_stats(f"{PIT}/e2e_trades_OOS.csv")
    old_ts, old_tr = trade_stats(f"{OLD}/e2e_trades_OOS.csv")
    folds = json.load(open(f"{PIT}/e2e_fold_choices.json"))
    folds_old = json.load(open(f"{OLD}/e2e_fold_choices.json"))

    # BTC benchmark daily over the same OOS window
    import gzip
    rows = [json.loads(l) for l in gzip.open("data/fp-research/15m_BTCUSDT.jsonl.gz", "rt") if l.strip()]
    btc = pd.DataFrame(rows)
    btc["t"] = btc["t"].astype(np.int64)
    btc["c"] = btc["c"].astype(float)
    btc["dt"] = pd.to_datetime(btc.t, unit="ms")
    oos0, oos1 = pit_daily.index[0], pit_daily.index[-1]
    btc_d = btc.set_index("dt")["c"].resample("1D").ffill()
    btc_d = btc_d[(btc_d.index >= oos0) & (btc_d.index <= oos1)]
    btc_norm = btc_d / btc_d.iloc[0] * INITIAL

    mc_pit = monte_carlo(pit_tr, "PIT (honest)")
    mc_old = monte_carlo(old_tr, "old universe (biased)")

    # attribution on PIT run
    by_sym = pit_tr.groupby("sym").pnl.agg(["sum", "count"]).sort_values("sum")
    by_rule = pit_tr.groupby("rule").pnl.agg(["sum", "count"])
    by_fold = pit_tr.groupby(pit_tr.ts // (30 * DAY)).pnl.sum()

    metrics = {
        "pit": {**pit_m, "trades": pit_ts, "folds": folds["folds"],
                "stress": folds["stress"], "mc": mc_pit,
                "btc_buyhold": folds["btc_buyhold_ret"],
                "allconfig_median": folds["allconfig_median_final"]},
        "old_universe": {**old_m, "trades": old_ts, "mc": mc_old,
                         "btc_buyhold": folds_old["btc_buyhold_ret"]},
    }
    with open(f"{PIT}/e2e_final_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2, default=str)

    print(json.dumps(metrics["pit"], indent=2, default=str)[:2200])

    # ---------------- charts ----------------
    plt.rcParams.update({"figure.facecolor": "white", "axes.grid": True,
                         "grid.alpha": 0.3, "font.size": 10})

    # chart 1: equity curves
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9.5, 6.4), sharex=True,
                                   height_ratios=[2.4, 1], constrained_layout=True)
    ax1.plot(pit_daily.index, pit_daily.values, lw=1.8, color="#b3122d",
             label=f"PIT universe (honest): ${pit_m['final']:,.0f} ({pit_m['total_ret']*100:+.1f}%)")
    ax1.plot(old_daily.index, old_daily.values, lw=1.4, color="#1f6feb", alpha=0.85,
             label=f"Nov-ranked universe (survivorship-biased): ${old_m['final']:,.0f} ({old_m['total_ret']*100:+.1f}%)")
    ax1.plot(btc_norm.index, btc_norm.values, lw=1.2, color="#8b8fa3", ls="--",
             label=f"BTC buy & hold: {folds['btc_buyhold_ret']*100:+.1f}%")
    ax1.axhline(INITIAL, color="#444", lw=0.8, ls=":")
    ax1.set_title("E2E walk-forward portfolio, $5,000 initial equity (out-of-sample folds only)", fontsize=11, weight="bold")
    ax1.set_ylabel("Equity (USD)")
    ax1.legend(loc="upper left", fontsize=8.5)
    dd_pit = (pit_daily / pit_daily.cummax() - 1) * 100
    dd_old = (old_daily / old_daily.cummax() - 1) * 100
    ax2.fill_between(dd_pit.index, dd_pit.values, 0, color="#b3122d", alpha=0.55, label="PIT drawdown")
    ax2.fill_between(dd_old.index, dd_old.values, 0, color="#1f6feb", alpha=0.35, label="biased-universe drawdown")
    ax2.set_ylabel("Drawdown (%)")
    ax2.legend(loc="lower left", fontsize=8.5)
    fig.savefig(f"{PIT}/chart1_equity.png", dpi=150)

    # chart 2: fold-by-fold
    fig, ax = plt.subplots(figsize=(9.5, 4.6), constrained_layout=True)
    fl = folds["folds"]
    names = [f"fold {f['fold']}\n{str(f['config']).split('|')[0]}" for f in fl]
    pnls = [f["test_pnl"] for f in fl]
    colors = ["#1a9c5b" if p > 0 else "#b3122d" for p in pnls]
    ax.bar(range(len(fl)), pnls, color=colors, width=0.62)
    ax.set_xticks(range(len(fl)))
    ax.set_xticklabels(names, fontsize=8.5)
    ax.axhline(0, color="#444", lw=0.8)
    ax.set_title("Out-of-sample PnL per 30-day fold (PIT universe) — configs chosen on trailing 60d only", fontsize=10.5, weight="bold")
    ax.set_ylabel("PnL (USD)")
    for i, f in enumerate(fl):
        ax.text(i, pnls[i] + (14 if pnls[i] > 0 else -34),
                f"n={f['test_n']}\ntrain {f['train_bp']:+.0f}bp", ha="center", fontsize=7.5)
    fig.savefig(f"{PIT}/chart2_folds.png", dpi=150)

    # chart 3: trade anatomy
    fig, axes = plt.subplots(1, 3, figsize=(11.5, 3.9), constrained_layout=True)
    r_mult = pit_tr.pnl.values / (pit_tr.stop_pct * pit_tr.notional / pit_tr.notional)  # pnl per trade in $
    ax = axes[0]
    ax.hist(pit_tr.pnl[pit_tr.pnl <= 0], bins=28, color="#b3122d", alpha=0.75, label="losses")
    ax.hist(pit_tr.pnl[pit_tr.pnl > 0], bins=20, color="#1a9c5b", alpha=0.85, label="wins")
    ax.axvline(0, color="#444", lw=0.8)
    ax.set_title(f"PnL per trade (n={pit_ts['n']}, win {pit_ts['win_rate']*100:.0f}%, payoff {pit_ts['payoff']}x)", fontsize=9.5)
    ax.set_xlabel("USD"); ax.set_ylabel("trades"); ax.legend(fontsize=8)
    ax = axes[1]
    hold_h = (pit_tr.exit_ts - pit_tr.ts) / 3_600_000
    ax.scatter(hold_h, pit_tr.pnl, s=14, c=np.where(pit_tr.pnl > 0, "#1a9c5b", "#b3122d"), alpha=0.7)
    ax.axhline(0, color="#444", lw=0.8)
    ax.set_title("PnL vs holding time", fontsize=9.5)
    ax.set_xlabel("hours held"); ax.set_ylabel("USD")
    ax = axes[2]
    bs = by_sym.tail(10)["sum"]
    ax.barh([s.replace("USDT", "") for s in bs.index], bs.values,
            color=["#b3122d" if v < 0 else "#1a9c5b" for v in bs.values])
    ax.set_title("PnL by symbol (worst 10 shown, PIT run)", fontsize=9.5)
    ax.set_xlabel("USD")
    fig.savefig(f"{PIT}/chart3_anatomy.png", dpi=150)

    # chart 4: monte carlo + stress
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.5, 4.1), constrained_layout=True)
    rng = np.random.default_rng(20261113)
    pnl = pit_tr.pnl.values
    paths = np.cumsum(rng.choice(pnl, (1200, len(pnl)), replace=True) + INITIAL, axis=1)
    ax1.plot(paths.T, color="#b3122d", alpha=0.05, lw=0.7)
    ax1.plot(np.arange(len(pnl)), INITIAL + np.cumsum(pnl), color="#111", lw=2.2, label="realized OOS path")
    ax1.axhline(INITIAL, color="#444", lw=0.8, ls=":")
    ax1.set_title("Monte-Carlo bootstrap of OOS trades (1200 paths)", fontsize=9.5)
    ax1.set_xlabel("trade #"); ax1.set_ylabel("equity (USD)"); ax1.legend(fontsize=8)
    st = folds["stress"]
    labels = ["base\n15bp+funding", "stress\n25bp", "no funding\n15bp", "25bp+\nno funding"]
    vals = [st["base_15bp_funding"]["final"], st["stress_25bp"]["final"],
            st["nofunding_15bp"]["final"], st["stress_25bp_nofunding"]["final"]]
    ax2.bar(labels, vals, color=["#b3122d", "#d4606f", "#c93b50", "#e08a97"], width=0.6)
    ax2.axhline(INITIAL, color="#444", lw=0.9, ls=":")
    ax2.set_title("Stress variants — final equity (PIT run)", fontsize=9.5)
    ax2.set_ylabel("USD")
    for i, v in enumerate(vals):
        ax2.text(i, v - 120, f"${v:,.0f}", ha="center", fontsize=8)
    fig.savefig(f"{PIT}/chart4_mc_stress.png", dpi=150)

    print("\ncharts written to", PIT)


if __name__ == "__main__":
    main()
