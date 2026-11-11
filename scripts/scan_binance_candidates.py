#!/usr/bin/env python3
"""Scan the Binance top-200 liquidity universe for trade candidates.

Data (all through the terminal's own live routes — no stale caches):
  /api/binance/universe  — top-200 by rolling 24h quote volume (+rank, decimals)
  /api/binance/quotes    — all-universe bookTicker mids (5s TTL)
  /api/binance/klines    — 1h x 168 bars per symbol (trend/RSI/ATR/structure)
  /api/binance/market    — funding + OI for the shortlist (venue context)

Template (mirrors the desk engine v3.2 trend-pullback school):
  LONG : bull EMA stack, price > EMA50, RSI 45-68 (room, not overbought),
         pullback within ~1.2 ATR of EMA20 or 24h VWAP, volume confirmation.
  SHORT: bear stack, price < EMA50, RSI 32-55, rally into EMA20, volume.
  Funding overlay: crowded-side funding (> +0.08%/8h against longs, < -0.08%
  against shorts) down-scores — squeeze fuel.

Output: ranked candidate list with entry (live mid), structural SL
(swing + 1.2*ATR), TP at >= 2.2R, risk-sized qty (0.5% of the demo wallet,
notional capped) — written to desk/deepscan/BIN-SCAN-<ts>.json + .md.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import math
import re
import time
import urllib.request
from datetime import datetime, timezone

BASE = "http://127.0.0.1:3000"
OUT_JSON = "/home/z/my-project/desk/deepscan/BIN-SCAN-latest.json"
OUT_MD = "/home/z/my-project/desk/deepscan/BIN-SCAN-latest.md"

WALLET = 4095.52          # testnet USDT (account snapshot 2026-11-11)
RISK_PCT = 0.5            # desk mandate: risk per trade
MAX_NOTIONAL = 600.0      # ~15% of the demo wallet per position
MIN_NOTIONAL = 21.0       # exchange min is 20
MIN_R = 2.2               # desk mandate: R >= 2.0 (build in a buffer)
MAX_POSITIONS = 4         # desk mandate: max concurrent positions
SCAN_TOP_FOR_PUNCH = 100  # only punch within the most liquid half
KLINE_BARS = 99           # weight-1 per call (limit<100) — the host IP is
                          # ban-prone; 200 symbols must stay under weight budget
FUNDER_SHORTLIST = 14     # fetch funding/OI for the top |score| few


def get(path: str, timeout: int = 15, ban_retries: int = 4):
    """GET with awareness of the recurring fapi IP ban. The route error carries
    the REAL ban end (fapi.ts now parses Binance's own 'auto-banned until'
    timestamp) — sleep past it silently, because every request during a ban
    EXTENDS it. No fapi traffic during the window at all."""
    for attempt in range(ban_retries):
        with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
            j = json.loads(r.read().decode())
        err = str(j.get("error", "")) if isinstance(j, dict) else ""
        if "IP ban" not in err:
            return j
        until = 0.0
        m = re.search(r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)", err)
        if m:
            until = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")).timestamp() + 2
        wait = max(0, until - time.time()) if until else 30 * (attempt + 1)
        if attempt == ban_retries - 1:
            break
        print(f"  [ban] {err} — sleeping {wait:.0f}s (attempt {attempt + 1}/{ban_retries})")
        if wait > 0:
            time.sleep(min(wait, 900))
    return j


# ---------------------------------------------------------------- indicators
def ema(vals: list[float], n: int) -> list[float]:
    if not vals:
        return []
    k = 2 / (n + 1)
    out = [vals[0]]
    for v in vals[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def rsi(closes: list[float], n: int = 14) -> float:
    if len(closes) < n + 1:
        return 50.0
    gains = losses = 0.0
    for i in range(1, n + 1):
        d = closes[-i] - closes[-i - 1]
        if d >= 0:
            gains += d
        else:
            losses -= d
    if gains + losses == 0:
        return 50.0
    rs = (gains / n) / ((losses / n) or 1e-12)
    return 100 - 100 / (1 + rs)


def atr(bars: list[list[float]], n: int = 14) -> float:
    if len(bars) < n + 1:
        n = max(2, len(bars) - 1)
    trs = []
    for i in range(len(bars) - n, len(bars)):
        h, l, pc = bars[i][2], bars[i][3], bars[i - 1][4]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    return sum(trs) / len(trs) if trs else 0.0


def vwap(bars: list[list[float]]) -> float:
    # typical-price VWAP over the window (1h bars, quote volume weighted)
    num = den = 0.0
    for b in bars:
        tp = (b[1] + b[2] + b[3] + b[4]) / 4
        num += tp * b[5]
        den += b[5]
    return num / den if den > 0 else bars[-1][4]


# ---------------------------------------------------------------- scan core
def scan() -> list[dict]:
    uni = get("/api/binance/universe")
    if not uni.get("ok"):
        raise SystemExit(f"universe not ok: {uni}")
    assets = uni["assets"]
    print(f"universe: {len(assets)} assets (state {uni['state']}, scanned {uni.get('scannedPairs')})")

    quotes = get("/api/binance/quotes").get("quotes", {})
    print(f"quotes: {len(quotes)} mids")

    def klines(a: dict) -> dict | None:
        try:
            j = get(f"/api/binance/klines?sym={a['sym']}&interval=1h&limit={KLINE_BARS}", 20, ban_retries=2)
            if not j.get("ok"):
                return None
            return {"a": a, "rows": j["rows"]}
        except Exception:
            return None

    results: list[dict] = []
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(klines, assets):
            if r:
                results.append(r)
            time.sleep(0.02)  # gentle — keep the shared weight budget calm
    print(f"klines: {len(results)} symbols fetched ({len(assets) - len(results)} failed)")

    cands: list[dict] = []
    for r in results:
        a, rows = r["a"], r["rows"]
        if len(rows) < 60:
            continue
        closes = [b[4] for b in rows]
        vols = [b[5] for b in rows]
        px = closes[-1]
        if px <= 0:
            continue
        e20, e50 = ema(closes, 20)[-1], ema(closes, 50)[-1]
        e200 = ema(closes, 200)[-1] if len(closes) >= 200 else None
        r14 = rsi(closes)
        a14 = atr(rows)
        day_bars = rows[-24:]
        d_hi = max(b[2] for b in day_bars)
        d_lo = min(b[3] for b in day_bars)
        chg24 = (px - day_bars[0][1]) / day_bars[0][1] * 100 if day_bars[0][1] else 0
        rng_pos = (px - d_lo) / (d_hi - d_lo) if d_hi > d_lo else 0.5
        vw = vwap(rows[-24:])
        surge = (sum(vols[-6:]) / 6) / (sum(vols[-30:]) / 30) if sum(vols[-30:]) > 0 else 1.0
        swing_lo = min(b[3] for b in rows[-24:])
        swing_hi = max(b[2] for b in rows[-24:])
        mid = quotes.get(a["sym"], {}).get("last", px)

        # --- LONG template score
        ls = 0.0
        if e20 > e50:
            ls += 2
        if px > e50:
            ls += 1.5
        if e200 and e50 > e200:
            ls += 0.5
        if 45 <= r14 <= 68:
            ls += 1.5
        elif r14 > 72:
            ls -= 1.5
        if 0 <= (mid - e20) / (a14 or 1e-9) <= 1.2:
            ls += 1.5  # pulled back to the mean — trend-pullback pocket
        if mid > vw:
            ls += 0.5
        ls += max(-1.5, min(1.5, chg24 / 5))
        if surge > 1.3:
            ls += 1.0

        # --- SHORT template score
        ss = 0.0
        if e20 < e50:
            ss += 2
        if px < e50:
            ss += 1.5
        if e200 and e50 < e200:
            ss += 0.5
        if 32 <= r14 <= 55:
            ss += 1.5
        elif r14 < 28:
            ss -= 1.5
        if -1.2 <= (mid - e20) / (a14 or 1e-9) <= 0:
            ss += 1.5  # rallied into the mean
        if mid < vw:
            ss += 0.5
        ss += max(-1.5, min(1.5, -chg24 / 5))
        if surge > 1.3:
            ss += 1.0

        direction, score = ("LONG", ls) if ls >= ss else ("SHORT", ss)
        if score <= 0:
            continue

        # structural levels
        if direction == "LONG":
            sl = min(swing_lo - 0.2 * a14, mid - 1.2 * a14)
        else:
            sl = max(swing_hi + 0.2 * a14, mid + 1.2 * a14)
        dist = abs(mid - sl)
        if dist <= 0 or dist / mid > 0.12:  # SL sane: >0 and <12% away
            continue
        tp = mid + (MIN_R * dist if direction == "LONG" else -MIN_R * dist)

        risk_usd = WALLET * RISK_PCT / 100
        qty = risk_usd / dist
        notional = qty * mid
        if notional > MAX_NOTIONAL:
            qty = MAX_NOTIONAL / mid
            notional = MAX_NOTIONAL
        if notional < MIN_NOTIONAL:
            continue  # cannot even meet min notional at this risk — skip
        qty = math.floor(qty * 10 ** a["qtyDecs"]) / 10 ** a["qtyDecs"]
        if qty <= 0:
            continue
        real_risk = qty * dist

        cands.append({
            "sym": a["sym"], "pair": a["pair"], "rank": a["rank"],
            "vol24": a["quoteVol24h"], "priceDecs": a["priceDecs"], "qtyDecs": a["qtyDecs"],
            "mid": mid, "direction": direction, "score": round(score, 2),
            "rsi": round(r14, 1), "atr": round(a14, 8), "chg24": round(chg24, 2),
            "rngPos": round(rng_pos, 2), "vwap": round(vw, 8), "surge": round(surge, 2),
            "ema20": round(e20, 8), "ema50": round(e50, 8),
            "entry": round(mid, a["priceDecs"]), "sl": round(sl, a["priceDecs"]),
            "tp": round(tp, a["priceDecs"]), "qty": qty, "notional": round(notional, 2),
            "riskUsd": round(real_risk, 2), "rMultiple": round(abs(tp - mid) / dist, 2),
            "fundingPct": None, "oiUsd": None,
        })

    cands.sort(key=lambda c: -c["score"])
    return cands


def add_funding(cands: list[dict]) -> None:
    # funding overlay for the strongest signals (squeeze-fuel penalty)
    def fetch(c: dict):
        try:
            j = get(f"/api/binance/market?sym={c['sym']}", 15)
            if j.get("ok"):
                c["fundingPct"] = j.get("mark", {}).get("fundingRatePct")
                c["oiUsd"] = j.get("oi", {}).get("usd")
        except Exception:
            pass

    with cf.ThreadPoolExecutor(max_workers=7) as ex:
        list(ex.map(fetch, cands[:FUNDER_SHORTLIST]))

    for c in cands[:FUNDER_SHORTLIST]:
        f = c.get("fundingPct")
        if f is None:
            continue
        if c["direction"] == "LONG" and f > 0.08:
            c["score"] -= 1.5  # crowded longs pay funding — squeeze fuel below
            c["notes"] = c.get("notes", []) + [f"funding +{f:.4f}%/8h crowded-long penalty"]
        if c["direction"] == "SHORT" and f < -0.08:
            c["score"] -= 1.5
            c["notes"] = c.get("notes", []) + [f"funding {f:.4f}%/8h crowded-short penalty"]
    cands.sort(key=lambda c: -c["score"])


def main() -> None:
    t0 = time.time()
    cands = scan()
    add_funding(cands)
    dt = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    punchable = [c for c in cands if c["rank"] <= SCAN_TOP_FOR_PUNCH][:MAX_POSITIONS]
    payload = {"generatedAt": dt, "wallet": WALLET, "riskPct": RISK_PCT,
               "scanned": 200, "candidates": cands[:40], "punchList": punchable}
    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=1)

    lines = [
        f"# Binance top-200 scan — {dt}",
        f"wallet ${WALLET} · risk {RISK_PCT}%/trade · min R {MIN_R} · max {MAX_POSITIONS} positions · runtime {time.time()-t0:.0f}s",
        "",
        "## Punch list (top candidates, risk-sized)",
        "| # | sym | dir | score | entry | SL | TP | R | qty | notional | risk$ | funding%/8h | OI | notes |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for i, c in enumerate(punchable, 1):
        oi = "–" if c["oiUsd"] is None else f"${c['oiUsd'] / 1e9:.2f}B"
        fnd = "–" if c["fundingPct"] is None else round(c["fundingPct"], 4)
        lines.append(
            f"| {i} | {c['sym']} (#{c['rank']}) | {c['direction']} | {c['score']} | {c['entry']} | {c['sl']} | "
            f"{c['tp']} | {c['rMultiple']} | {c['qty']} | ${c['notional']} | ${c['riskUsd']} | "
            f"{fnd} | {oi} | {'; '.join(c.get('notes', []))} |"
        )
    lines += ["", "## Watchlist (next 12 by score)", "| sym | dir | score | entry | rsi | chg24 | funding%/8h |", "|---|---|---|---|---|---|---|"]
    for c in cands[MAX_POSITIONS:MAX_POSITIONS + 12]:
        lines.append(f"| {c['sym']} (#{c['rank']}) | {c['direction']} | {c['score']} | {c['entry']} | {c['rsi']} | {c['chg24']}% | {c['fundingPct'] if c['fundingPct'] is None else round(c['fundingPct'], 4)} |")
    with open(OUT_MD, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"\n=== PUNCH LIST ({len(punchable)}) ===")
    for i, c in enumerate(punchable, 1):
        print(f"{i}. {c['sym']:>10} {c['direction']:>5} score {c['score']:>5} | entry {c['entry']} SL {c['sl']} TP {c['tp']} (R {c['rMultiple']}) | qty {c['qty']} notional ${c['notional']} risk ${c['riskUsd']} | funding {c['fundingPct']} OI {c['oiUsd']}")
    print(f"\nwatchlist: {[c['sym'] + ':' + c['direction'] for c in cands[MAX_POSITIONS:MAX_POSITIONS+12]]}")
    print(f"\nwrote {OUT_JSON} and {OUT_MD} ({time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()
