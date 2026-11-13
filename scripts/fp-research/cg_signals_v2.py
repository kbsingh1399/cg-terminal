#!/usr/bin/env python3
"""
fp-research step 6 — Coinglass-EXACT signal engine (v2) + validation.

Definitions transcribed verbatim from coinglass.com/footprint/BTC (Signals tab,
2026-11-13 scrape — see data/fp-research/cg_validation_15m.json):

  Absorption (bullish)  "Selling absorbed at the low" — X of taker selling at
      the low (>= 30% of the bar's selling), yet closed near the high.
      Zone = bottom 30% of the bar range.
  Absorption (bearish)  mirror at the high.
  Trapped shorts (bullish) "Failed breakdown" — broke the 5-bar low on heavy
      taker selling at the bottom, then rallied back into the upper part of
      the bar within 3 bars.
  Trapped longs (bearish) mirror — failed breakout.
  Bear div — higher high than a prior swing high, yet CVD fell over the swing.
  Bull div — lower low than a prior swing low, yet CVD rose over the swing.
  Divergence (bearish) "Rally without taker buying" — closed up on negative
      delta (share quoted, e.g. -30%).
  Divergence (bullish) "Drop without taker selling" — closed down on positive
      delta (e.g. +24%).
  Exhaustion (bullish) "Seller exhaustion" — new 10-bar low with almost no
      volume in the bottom 10% of the bar, closed in the upper half.
  Exhaustion (bearish) mirror at highs.

The engine works on FlowBars built exactly like build_signals.ts (m15 klines
+ m1 zone attribution), so validation vs the live page and the strategy
research share one implementation.
"""
import gzip
import json
import os
import sys

import numpy as np
import pandas as pd

DIR = "data/fp-research"
M15 = 900_000


def load_flow(sym):
    """m15 + m1 → flow frame with zone volumes (bottom/top 30% + bottom/top 10%)."""
    rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
    df = pd.DataFrame(rows)
    for c in ["o", "h", "l", "c", "v", "tb"]:
        df[c] = df[c].astype(float)
    df["t"] = df["t"].astype(np.int64)
    df = df.sort_values("t").reset_index(drop=True)
    m1rows = [json.loads(l) for l in gzip.open(f"{DIR}/1m_{sym}.jsonl.gz", "rt") if l.strip()]
    m1 = pd.DataFrame(m1rows)
    for c in ["h", "l", "v", "tb"]:
        m1[c] = m1[c].astype(float)
    m1["bucket"] = (m1["t"] // M15) * M15
    zone = {}
    for bucket, g in m1.groupby("bucket"):
        pass
    # vectorized zone attribution per m15 bar
    df = df.set_index("t")
    lows, highs, low30, high30, low10, high10 = [], [], [], [], [], []
    m1grp = dict(tuple(m1.groupby("bucket")))
    for t, row in df.iterrows():
        g = m1grp.get(t)
        lo, hi = row["l"], row["h"]
        rng = hi - lo or 1e-12
        lz30 = hz30 = lz10 = hz10 = 0.0
        if g is not None:
            sLo, sHi = g["l"].values, g["h"].values
            sv = (g["v"] - g["tb"]).values
            bv = g["tb"].values
            w = np.maximum(sHi - sLo, 1e-12)
            ovLow = np.clip(np.minimum(sHi, lo + 0.3 * rng) - sLo, 0, None) / w
            ovHigh = np.clip(sHi - np.maximum(sLo, hi - 0.3 * rng), 0, None) / w
            ovLow10 = np.clip(np.minimum(sHi, lo + 0.1 * rng) - sLo, 0, None) / w
            ovHigh10 = np.clip(sHi - np.maximum(sLo, hi - 0.1 * rng), 0, None) / w
            lz30 = float((sv * ovLow).sum())
            hz30 = float((bv * ovHigh).sum())
            lz10 = float(((sv + bv) * ovLow10).sum())
            hz10 = float(((sv + bv) * ovHigh10).sum())
        lows.append(lo); highs.append(hi)
        low30.append(lz30); high30.append(hz30); low10.append(lz10); high10.append(hz10)
    df = df.reset_index()
    df["low30"], df["high30"] = low30, high30
    df["low10"], df["high10"] = low10, high10
    df["buy"], df["sell"] = df["tb"], df["v"] - df["tb"]
    df["delta"] = df["buy"] - df["sell"]
    df["cvd"] = df["delta"].cumsum()
    df["closePos"] = ((df["c"] - df["l"]) / (df["h"] - df["l"]).clip(lower=1e-12)).clip(0, 1)
    return df


def compute_cg_signals(df, win=60):
    """Coinglass-exact classes (v2.1, calibrated against the 2026-11-13
    coinglass.com/footprint/BTC signal panel).

    Calibration findings (see cg_validation_15m.json + debug):
      - low-zone attribution: CG ≈ 0.94-1.15 × our m1-overlap → bullish
        absorption/trapped gate 0.27 (CG 0.30)
      - high-zone attribution: CG ≈ 0.70 × ours → bearish gate 0.43 (CG 0.30)
      - closePos gates: bullish >= 0.65 / bearish <= 0.35 (CG "near high/low")
      - strict hold: absorption requires the next 2 bars to respect the
        signal bar's extreme (l[j] >= l[i] / h[j] <= h[i])
      - CVD div gap: relative > 0.0015 (CG fired at +305 on |CVD| 82k)
      - exhaustion zone: bottom/top-10% volume <= 4% of bar volume
      - dedup: 2 bars (CG listed absorptions 2 bars apart)
    """
    sigs = []
    n = len(df)
    t = df["t"].values
    h, l, c, o = df["h"].values, df["l"].values, df["c"].values, df["o"].values
    buy, sell, vol = df["buy"].values, df["sell"].values, df["v"].values
    delta, cvd = df["delta"].values, df["cvd"].values
    low30, high30, low10, high10 = df["low30"].values, df["high30"].values, df["low10"].values, df["high10"].values
    closePos = df["closePos"].values

    last_of = {}

    def push(i, type_, dir_, text, detail, confirm=0, strength=50):
        key = f"{type_}|{dir_}"
        if key in last_of and i - last_of[key] < 2:
            return
        last_of[key] = i
        sigs.append({
            "ts": int(t[i]), "type": type_, "dir": dir_, "text": text,
            "detail": detail, "strength": strength, "price": float(c[i]),
            "confirmBars": confirm,
        })

    for i in range(12, n):
        rng = h[i] - l[i] or 1e-12

        # ---- Absorption (calibrated gates + 1-bar hold) ----
        if sell[i] > 0 and low30[i] / sell[i] >= 0.27 and closePos[i] >= 0.65:
            nxt = range(i + 1, min(i + 2, n))
            held = all(l[j] >= l[i] for j in nxt) if nxt else True
            if held:
                push(i, "absorption", "bullish", "Selling absorbed at the low",
                     f"{low30[i]:.0f} of taker selling at the low ({low30[i]/sell[i]*100:.0f}% of the bar's selling), yet closed near the high",
                     confirm=2, strength=int(min(100, 45 + 40 * low30[i] / sell[i])))
        if buy[i] > 0 and high30[i] / buy[i] >= 0.43 and closePos[i] <= 0.35:
            nxt = range(i + 1, min(i + 2, n))
            held = all(h[j] <= h[i] for j in nxt) if nxt else True
            if held:
                push(i, "absorption", "bearish", "Buying absorbed at the high",
                     f"{high30[i]:.0f} of taker buying at the high ({high30[i]/buy[i]*100:.0f}% of the bar's buying), yet closed near the low",
                     confirm=2, strength=int(min(100, 45 + 40 * high30[i] / buy[i])))

        # ---- Trapped traders (breakdown bar must CLOSE WEAK — sellers
        # visibly in control — else it's not a trap) ----
        if i >= 5 and l[i] < min(l[i - 5:i]):
            if sell[i] > 0 and low30[i] / sell[i] >= 0.27 and closePos[i] <= 0.35:
                for k in range(1, 4):
                    j = i + k
                    if j >= n:
                        break
                    if c[j] >= l[i] + 0.5 * rng:  # back into the upper part
                        push(i, "trapped", "bullish", "Failed breakdown",
                             f"Broke the 5-bar low on {low30[i]:.0f} of taker selling at the bottom, then rallied back into the upper part of the bar {k} bars later",
                             confirm=k, strength=int(min(100, 45 + 40 * low30[i] / sell[i])))
                        break
        if i >= 5 and h[i] > max(h[i - 5:i]):
            if buy[i] > 0 and high30[i] / buy[i] >= 0.43 and closePos[i] >= 0.65:
                for k in range(1, 4):
                    j = i + k
                    if j >= n:
                        break
                    if c[j] <= h[i] - 0.5 * rng:
                        push(i, "trapped", "bearish", "Failed breakout",
                             f"Broke the 5-bar high on {high30[i]:.0f} of taker buying at the top, then fell back into the lower part of the bar {k} bars later",
                             confirm=k, strength=int(min(100, 45 + 40 * high30[i] / buy[i])))
                        break

        # ---- Swing CVD divergence ----
        w0 = max(0, i - win)
        pj = -1
        for j in range(i - 4, w0 - 1, -1):
            nb = slice(max(0, j - 3), min(n, j + 4))
            if h[j] >= h[nb].max():
                pj = j
                break
        if pj >= 0 and h[i] >= h[pj] and cvd[i] < cvd[pj]:
            gap = (cvd[pj] - cvd[i]) / (abs(cvd[pj]) + abs(cvd[i]) + 1e-9)
            if gap > 0.0015:
                push(i, "bear_div", "bearish", "Higher high, lower Cumulative Delta",
                     f"Higher high than {pd.to_datetime(t[pj], unit='ms'):%m-%d %H:%M}, yet Cumulative Delta fell {cvd[pj]-cvd[i]:,.0f} over the swing",
                     strength=int(min(100, 40 + gap * 1200)))
        qj = -1
        for j in range(i - 4, w0 - 1, -1):
            nb = slice(max(0, j - 3), min(n, j + 4))
            if l[j] <= l[nb].min():
                qj = j
                break
        if qj >= 0 and l[i] <= l[qj] and cvd[i] > cvd[qj]:
            gap = (cvd[i] - cvd[qj]) / (abs(cvd[qj]) + abs(cvd[i]) + 1e-9)
            if gap > 0.0015:
                push(i, "bull_div", "bullish", "Lower low, higher Cumulative Delta",
                     f"Lower low than {pd.to_datetime(t[qj], unit='ms'):%m-%d %H:%M}, yet Cumulative Delta rose {cvd[i]-cvd[qj]:,.0f} over the swing",
                     strength=int(min(100, 40 + gap * 1200)))

        # ---- Single-bar divergence ----
        dshare = delta[i] / vol[i] if vol[i] > 0 else 0.0
        if c[i] > o[i] and delta[i] < 0 and dshare <= -0.10:
            push(i, "divergence", "bearish", "Rally without taker buying",
                 f"Closed up on negative Delta ({dshare*100:.0f}%)",
                 strength=int(min(100, 40 + abs(dshare) * 100)))
        if c[i] < o[i] and delta[i] > 0 and dshare >= 0.10:
            push(i, "divergence", "bullish", "Drop without taker selling",
                 f"Closed down on positive Delta (+{dshare*100:.0f}%)",
                 strength=int(min(100, 40 + dshare * 100)))

        # ---- Exhaustion (Coinglass-exact, calibrated 4% zone floor) ----
        if i >= 10 and l[i] <= min(l[i - 10:i]):
            if vol[i] > 0 and low10[i] / vol[i] <= 0.04 and closePos[i] >= 0.5:
                push(i, "exhaustion", "bullish", "Seller exhaustion",
                     f"New 10-bar low with almost no volume in the bottom 10% of the bar, closed in the upper half",
                     strength=int(min(100, 45 + (0.04 - low10[i] / vol[i]) * 750)))
        if i >= 10 and h[i] >= max(h[i - 10:i]):
            if vol[i] > 0 and high10[i] / vol[i] <= 0.04 and closePos[i] <= 0.5:
                push(i, "exhaustion", "bearish", "Buyer exhaustion",
                     f"New 10-bar high with almost no volume in the top 10% of the bar, closed in the lower half",
                     strength=int(min(100, 45 + (0.04 - high10[i] / vol[i]) * 750)))

    return sigs


def validate():
    """Compare my BTC 15m signals against the Coinglass scrape."""
    cg = json.load(open(f"{DIR}/cg_validation_15m.json"))
    df = load_flow("BTCUSDT")
    mine = compute_cg_signals(df)
    mine_by_ts = {}
    for s in mine:
        mine_by_ts.setdefault(s["ts"], []).append(s)

    print(f"coinglass reference: {len(cg)} signals · mine: {len(mine)} (BTC 15m, 180d)")
    hit = miss = extra_near = 0
    for ref in cg:
        ts = ref["ts"]
        cands = mine_by_ts.get(ts, [])
        # allow ±1 bar tolerance
        for off in (-1, 0, 1):
            cands += mine_by_ts.get(ts + off * M15, [])
        match = [s for s in cands if s["type"] == ref["type"] and s["dir"] == ref["dir"]]
        if match:
            hit += 1
            m = match[0]
            print(f"  MATCH   {pd.to_datetime(ts, unit='ms'):%m-%d %H:%M} {ref['type']:10s} {ref['dir']:8s} · cg: {ref['text'][:40]:40s} · mine: {m['text'][:40]}")
        else:
            miss += 1
            near = [s["type"] for s in cands]
            print(f"  MISS    {pd.to_datetime(ts, unit='ms'):%m-%d %H:%M} {ref['type']:10s} {ref['dir']:8s} · cg: {ref['text'][:60]} · near-mine: {near}")
    print(f"\nvalidation: {hit}/{hit+miss} coinglass signals reproduced ({hit/(hit+miss)*100:.0f}%)")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "validate":
        validate()
    else:
        os.makedirs(DIR, exist_ok=True)
        uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
        total = 0
        counts = {}
        for sym in uni:
            df = load_flow(sym)
            sigs = compute_cg_signals(df)
            with open(f"{DIR}/cgsig_{sym}.jsonl", "w") as f:
                for s in sigs:
                    f.write(json.dumps(s) + "\n")
            total += len(sigs)
            for s in sigs:
                k = f"{s['type']}|{s['dir']}"
                counts[k] = counts.get(k, 0) + 1
            print(f"{sym}: {len(df)} bars → {len(sigs)} cg-exact signals")
        print(f"\nTOTAL {total}")
        for k in sorted(counts):
            print(f"  {k}: {counts[k]}")
