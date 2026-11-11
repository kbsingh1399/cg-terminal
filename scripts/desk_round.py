#!/usr/bin/env python3
"""Trade-desk round — the 15-minute analysis brain (zai-desk). v3

Full-parameter trade formulation WITH A DEBATE. Every order carries a
`debate` list citing every terminal data source — overview, footprint
signals, large orders (whale walls), liquidation clusters, stops heatmap
(BTC only), book walls, CVD, notifications — each with FOR/AGAINST/NEUTRAL
+ evidence. Orders are only emitted when the debate is won:
FOR >= 3 AND FOR > AGAINST (on top of the numeric gates).

Numeric gates (unchanged from v2, all must pass):
  |confluence| >= 3.0 · >=2/3 alignment · R to T1 >= config.min_r_multiple
  (2.0, user mandate) · no opposite liq magnet within 1.2R (str>=50) ·
  no opposing whale wall >= $5M within 1.5R into the path · stop beyond
  any liq magnet inside the risk zone (<= 1.6x base risk geometry).

Every order is stamped with `perpRefPrice` (the perp price the levels were
built from) — the local side translates to broker prices via the live
basis (desk/mt5.json `spreads.*.basisPct`) before placing in MT5.

Existing suggested orders are re-debated every round with fresh data;
a lost debate withdraws them.

Usage: python3 scripts/desk_round.py [--dry-run]
"""
import json, sys, time, urllib.request, urllib.error, re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
DESK = ROOT / "desk"
STATE_FILE = DESK / "state.json"
LOG_FILE = DESK / "log.md"
BASE = "http://localhost:3000/api/cg"
SYMS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XAU", "XAG"]
DECS = {"BTC": 1, "ETH": 2, "SOL": 2, "BNB": 2, "XRP": 4, "ADA": 4, "AVAX": 3,
        "DOGE": 5, "LINK": 3, "LTC": 2, "XAU": 2, "XAG": 3}

WALL_MIN_USD = 5_000_000
CLUSTER_MIN_STRENGTH = 40.0
CLUSTER_HAZARD_STRENGTH = 50.0
MAX_TARGET_R = 6.0
MIN_CONF = 3.0
CVD_TOP_N = 6
DEBATE_MIN_FOR = 3          # debate gate: FOR >= 3
IMB_FOR, IMB_AGAINST = 0.55, 0.45   # book-wall imbalance thresholds

DRY = "--dry-run" in sys.argv
now_ms = int(time.time() * 1000)
now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def get(path, timeout=60):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.loads(r.read())


def fmt(sym, x):
    if x is None:
        return "?"
    return f"{x:,.{DECS.get(sym, 2)}f}"


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def cluster_usd(lv):
    """usd field is in base-coin units — honest $ approximation."""
    try:
        return lv.get("usd", 0) * lv["price"] / 1e6
    except Exception:
        return 0.0


# ---------------------------------------------------------------- load state
state = json.loads(STATE_FILE.read_text())
cfg = state["config"]

log_txt = LOG_FILE.read_text()
round_no = len(re.findall(r"^## R(\d+)", log_txt, re.M)) + 1
rid = f"R{round_no}"

# ---------------------------------------------------------------- 1. gather
notes_items = []
try:
    notes = get("/notifications?limit=200")
    notes_items = notes.get("items", [])
except Exception as e:
    print(f"[warn] notifications failed: {e}", file=sys.stderr)

fresh = [n for n in notes_items if now_ms - n.get("ts", 0) < 6 * 3600_000]
seen, uniq = set(), []
for n in sorted(fresh, key=lambda x: -x.get("ts", 0)):
    k = (n.get("asset"), n.get("title"))
    if k not in seen:
        seen.add(k)
        uniq.append(n)

assets = {}
for sym in SYMS:
    rec = {"sym": sym, "error": None}
    try:
        m = get(f"/market?sym={sym}")
        rec["price"] = m.get("price", {}).get("last")
        rec["chgDayPct"] = m.get("price", {}).get("chgDayPct")
        rec["vwap"] = m.get("vwap", {})
        rec["rsi"] = m.get("rsi", {})
        rec["ema"] = m.get("ema", {})
        rec["auction"] = m.get("auction", {})
        rec["updatedAt"] = m.get("updatedAt", 0)
    except Exception as e:
        rec["error"] = f"market: {e}"
    try:
        s = get(f"/signals?sym={sym}", timeout=90)
        rec["signals"] = s.get("counts", {})
        rec["sigSets"] = [
            {"bt": st.get("bt"), "label": st.get("label"),
             "latest": max(st.get("sigs", []), key=lambda x: x.get("barTs", 0))
             if st.get("sigs") else None}
            for st in s.get("sets", [])
        ]
        # v3.1: keep recent micro-events (<6h) by type/side — abs/trap/exh/div were discarded before
        ev = {"buy": 0, "sell": 0, "types": {}}
        now_s = now_ms / 1000
        for st in s.get("sets", []):
            for sig in st.get("sigs", []):
                ts = sig.get("ts", 0)
                ts = ts / 1000 if ts > 1e12 else ts
                if now_s - ts < 6 * 3600:
                    side = sig.get("side")
                    if side in ("buy", "sell"):
                        ev[side] += 1
                        tk = f"{sig.get('t', '?')}:{side}"
                        ev["types"][tk] = ev["types"].get(tk, 0) + 1
        rec["microEvents"] = ev
    except Exception as e:
        rec["error"] = (rec["error"] + "; " if rec["error"] else "") + f"signals: {e}"
    assets[sym] = rec

# ---------------------------------------------------------------- 2. score
def score_asset(sym, rec, cvd=None):
    parts = {}
    nb = 0.0
    for n in fresh:
        if n.get("asset") != sym:
            continue
        d = 1 if n.get("dir") == "bullish" else -1
        w = 2 if n.get("severity") == "high" else 1
        age_h = (now_ms - n.get("ts", 0)) / 3600_000
        nb += d * w * (1 - 0.5 * clamp(age_h / 6, 0, 1))
    parts["notif"] = clamp(nb / 3, -2, 2)
    c = rec.get("signals") or {}
    parts["signals"] = clamp((c.get("bullish", 0) - c.get("bearish", 0)) * 0.33, -1, 1)
    tr = 0.0
    for tf in ("h4", "d1"):
        e = (rec.get("ema") or {}).get(tf) or {}
        if e.get("e13") and e.get("e89"):
            tr += 1 if e["e13"] > e["e89"] else -1
    parts["trend"] = tr
    vw = rec.get("vwap") or {}
    parts["vwap"] = (1 if rec.get("price") and rec["price"] > (vw.get("vwap") or 0) else -1) if rec.get("price") else 0
    rsi = (rec.get("rsi") or {}).get("h4")
    parts["rsi"] = -0.5 if (rsi or 50) > 70 else (0.5 if (rsi or 50) < 30 else 0)
    if cvd:
        k = cvd.get("kpis", {})
        comp = 0.0
        br = k.get("buyRatio")
        if br is not None:
            comp += clamp((br - 50) / 4, -0.5, 0.5)
        ld = k.get("latestDiv") or {}
        if ld.get("type") and now_ms - ld.get("ts", 0) < 24 * 3600_000:
            comp += 1 if ld["type"] == "bull" else -1
        parts["cvd"] = clamp(comp, -1.5, 1.5)
    s = sum(parts.values())
    return s, parts


scored = {}
for sym, rec in assets.items():
    if rec.get("price") is None:
        scored[sym] = {"score": None, "parts": {}, "error": rec.get("error")}
        continue
    s, parts = score_asset(sym, rec)
    scored[sym] = {"score": round(s, 2), "parts": {k: round(v, 2) for k, v in parts.items()},
                   "error": rec.get("error")}

pre_rank = sorted([s for s in SYMS if scored.get(s, {}).get("score") is not None],
                  key=lambda s: -abs(scored[s]["score"]))
for sym in pre_rank[:CVD_TOP_N]:
    if abs(scored[sym]["score"]) < 2.0:
        break
    try:
        cvd = get(f"/cvd?sym={sym}&itv=15m&limit=200", timeout=90)
        s, parts = score_asset(sym, assets[sym], cvd)
        scored[sym] = {"score": round(s, 2), "parts": {k: round(v, 2) for k, v in parts.items()},
                       "error": assets[sym].get("error")}
        assets[sym]["cvd"] = cvd
    except Exception as e:
        print(f"[warn] cvd {sym} failed: {e}", file=sys.stderr)

# ------------------------------------------------- 3. order lifecycle
lifecycle_events = []
orders = state.get("orders", [])
live_positions = state.get("positions", [])
n_open_positions = len(live_positions)
for o in orders:
    if o.get("status") not in ("suggested", "placed"):
        continue
    if o.get("expiresTs") and now_ms > o["expiresTs"] and o.get("status") == "suggested":
        o["status"] = "expired"
        o["statusTs"] = now_ms
        lifecycle_events.append(f"{o['id']} EXPIRED (unfilled past expiry)")
        continue
    if o.get("status") == "suggested" and o.get("riskR") is not None and o["riskR"] < cfg["min_r_multiple"]:
        o["status"] = "withdrawn"
        o["statusTs"] = now_ms
        o["withdrawReason"] = f"riskR {o['riskR']} below mandated minimum {cfg['min_r_multiple']}"
        lifecycle_events.append(f"{o['id']} WITHDRAWN (R {o['riskR']} < min {cfg['min_r_multiple']} — user mandate 1:2)")
        continue
    sc = (scored.get(o["sym"]) or {}).get("score")
    flipped = o.get("side") == "long" and (sc is not None and sc < 0) or \
              o.get("side") == "short" and (sc is not None and sc > 0)
    if flipped and o.get("status") == "suggested":
        o["status"] = "withdrawn"
        o["statusTs"] = now_ms
        o["withdrawReason"] = f"confluence flipped ({sc:+.1f})"
        lifecycle_events.append(f"{o['id']} WITHDRAWN (confluence flipped to {sc:+.1f})")

state["closed"] = state.get("closed", []) + [o for o in orders if o.get("status") in ("expired", "withdrawn")]
state["orders"] = [o for o in orders if o.get("status") not in ("expired", "withdrawn")]

# ------------------------------------------------- 4. deep data
def fetch_deep(sym):
    deep = {"liq": None, "walls": None, "bw": None, "sm": None, "errors": []}
    try:
        d = get(f"/liqlevels?sym={sym}&range=3d&lvR=4", timeout=90)
        deep["liq"] = d.get("stats", {})
    except Exception as e:
        deep["errors"].append(f"liq: {e}")
    try:
        d = get(f"/lto?symbol={sym}&minVolUsd=5000000", timeout=60)
        walls = []
        for g in d.get("groups", []):
            for o in g.get("list", []):
                if o.get("currentUsd", 0) >= WALL_MIN_USD:
                    walls.append({"price": o["price"], "usd": o["currentUsd"],
                                  "side": "ask" if o.get("side") == 1 else "bid"})
        deep["walls"] = sorted(walls, key=lambda w: -w["usd"])[:12]
    except Exception as e:
        deep["errors"].append(f"lto: {e}")
    try:
        d = get(f"/bookwalls?sym={sym}&market=futures&interval=15m&limit=30", timeout=60)
        m = d.get("model", {})
        deep["bw"] = {"imbalance": m.get("imbalance"), "imbalance5mAgo": m.get("imbalance5mAgo"),
                      "bidUsd": (m.get("depth") or {}).get("bidUsd"),
                      "askUsd": (m.get("depth") or {}).get("askUsd"),
                      "last": m.get("last", {})}
    except Exception as e:
        deep["errors"].append(f"bookwalls: {e}")
    if sym == "BTC":
        try:
            d = get(f"/stopmap?sym={sym}", timeout=60)
            m = d.get("model", {})
            y = m.get("y") or []
            grid = m.get("grid") or []
            lp = m.get("lastPrice") or 0
            if y and grid and lp:
                cells = (grid[-1].get("cells") or [])
                above = sum(c[1] for c in cells if 0 <= c[0] < len(y) and y[c[0]] > lp)
                below = sum(c[1] for c in cells if 0 <= c[0] < len(y) and y[c[0]] <= lp)
                deep["sm"] = {"aboveUsd": above, "belowUsd": below, "lastPrice": lp}
        except Exception as e:
            deep["errors"].append(f"stopmap: {e}")
    return deep


# ------------------------------------------------- 5. THE DEBATE
def build_debate(sym, side, rec, deep, regime=None):
    """One FOR/AGAINST/NEUTRAL verdict per terminal data source."""
    long = side == "long"
    sgn = 1 if long else -1
    d = []
    price, vw = rec.get("price"), rec.get("vwap") or {}
    # 1. overview — trend + vwap + rsi + day change
    ema = rec.get("ema") or {}
    h4_up = ((ema.get("h4") or {}).get("e13") or 0) > ((ema.get("h4") or {}).get("e89") or 1)
    d1_up = ((ema.get("d1") or {}).get("e13") or 0) > ((ema.get("d1") or {}).get("e89") or 1)
    above_v = bool(price and (vw.get("vwap") or 0) and price > vw["vwap"])
    align = (h4_up == long) + (d1_up == long) + (above_v == long)
    rsi = (rec.get("rsi") or {}).get("h4")
    ev = (f"h4 {'↑' if h4_up else '↓'}/d1 {'↑' if d1_up else '↓'} EMA, price {'above' if above_v else 'below'} day VWAP "
          f"({fmt(sym, price)} vs {fmt(sym, vw.get('vwap'))}), h4 RSI {rsi and round(rsi, 1)}, day {(rec.get('chgDayPct') or 0):+.1f}%")
    d.append({"source": "overview", "verdict": "FOR" if align >= 2 else ("AGAINST" if align <= 1 and (1 - align) >= 2 else "NEUTRAL"), "evidence": ev})
    # 2. footprint signals
    c = rec.get("signals") or {}
    sig_sign = (c.get("bullish", 0) - c.get("bearish", 0)) * sgn
    names = []
    for st in (rec.get("sigSets") or []):
        lv = st.get("latest")
        if lv and now_ms - lv.get("barTs", 0) < 6 * 3600_000:
            names.append(f"{lv.get('name')}/{lv.get('side')}[{st['bt']}]")
    ev = f"bull {c.get('bullish', 0)} / bear {c.get('bearish', 0)}; recent: {', '.join(names[:3]) or 'none <6h'}"
    d.append({"source": "footprint", "verdict": "FOR" if sig_sign > 0 else ("AGAINST" if sig_sign < 0 else "NEUTRAL"), "evidence": ev})
    # 2b. micro-flow events (v3.1): absorption / exhaustion / traps / divergences, last 6h
    me = rec.get("microEvents") or {}
    me_net = (me.get("buy", 0) - me.get("sell", 0)) * sgn
    types_s = ", ".join(f"{k}×{v}" for k, v in sorted((me.get("types") or {}).items())) or "none"
    d.append({"source": "microFlow(abs/trap/exh)", "verdict": "FOR" if me_net > 0 else ("AGAINST" if me_net < 0 else "NEUTRAL"),
              "evidence": f"6h micro-events: {types_s} — net {me.get('buy', 0)} buy-side vs {me.get('sell', 0)} sell-side"})
    # 3. large orders (whale walls)
    walls = deep.get("walls") or []
    near = [w for w in walls if abs(w["price"] - (price or 0)) / (price or 1) <= 0.02]
    opp_near = [w for w in near if (w["side"] == "ask") != long]
    sup_near = [w for w in near if (w["side"] == "bid") == long]
    if opp_near:
        w = opp_near[0]
        d.append({"source": "largeOrders", "verdict": "AGAINST",
                  "evidence": f"{w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} within 2% — opposing resting size" if False else
                  f"{w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} within 2% opposes"})
    elif sup_near:
        w = sup_near[0]
        d.append({"source": "largeOrders", "verdict": "FOR",
                  "evidence": f"{w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} within 2% supports"})
    else:
        d.append({"source": "largeOrders", "verdict": "NEUTRAL",
                  "evidence": f"{len(walls)} walls ≥$5M, none within 2% of price"})
    # 4. liquidation clusters
    liq = deep.get("liq") or {}
    kl = liq.get("keyLevels", {})
    tg = (kl.get("above") if long else kl.get("below")) or []
    hz = (kl.get("below") if long else kl.get("above")) or []
    good = [lv for lv in tg if lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH]
    bad = [lv for lv in hz if lv.get("strength", 0) >= CLUSTER_HAZARD_STRENGTH and 0 < ((price or 0) - lv["price"]) * sgn <= (price or 1) * 0.012]
    if good:
        lv = good[0]
        d.append({"source": "liquidation", "verdict": "FOR",
                  "evidence": f"{'short' if long else 'long'}-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f}, ~${cluster_usd(lv):,.0f}M est, {lv.get('distPct', 0):+.2f}%) as target"})
    else:
        d.append({"source": "liquidation", "verdict": "NEUTRAL", "evidence": "no strong same-direction magnet in ±4%"})
    if bad:
        lv = bad[0]
        d.append({"source": "liquidation-hazard", "verdict": "AGAINST",
                  "evidence": f"{'long' if long else 'short'}-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f}) sits between entry and stop — sweep risk"})
    # 5. stops heatmap (BTC only)
    sm = deep.get("sm")
    if sm:
        fuel_down, fuel_up = sm["belowUsd"], sm["aboveUsd"]
        lean = (fuel_down - fuel_up) * sgn  # short: more below = fuel down = FOR
        d.append({"source": "stops(BTC heatmap)", "verdict": "FOR" if lean > 0 else ("AGAINST" if lean < 0 else "NEUTRAL"),
                  "evidence": f"24h liq exposure below ${fuel_down / 1e6:,.0f}M vs above ${fuel_up / 1e6:,.0f}M"})
    else:
        d.append({"source": "stops(BTC heatmap)", "verdict": "NEUTRAL", "evidence": "n/a (upstream: BTC-only)"})
    # 6. book walls
    bw = deep.get("bw") or {}
    imb = bw.get("imbalance")
    if imb is not None:
        imb_long_fav = imb > IMB_FOR
        imb_short_fav = imb < IMB_AGAINST
        v = "FOR" if (imb_long_fav if long else imb_short_fav) else ("AGAINST" if (imb_short_fav if long else imb_long_fav) else "NEUTRAL")
        delta = (imb - (bw.get("imbalance5mAgo") or imb))
        d.append({"source": "bookWalls", "verdict": v,
                  "evidence": f"±5% depth imbalance {imb:+.3f} (5m ago {bw.get('imbalance5mAgo'):+.3f}, {'rising' if delta > 0 else 'falling'} bids); bid ${ (bw.get('bidUsd') or 0) / 1e9:.2f}B vs ask ${(bw.get('askUsd') or 0) / 1e9:.2f}B"})
    else:
        d.append({"source": "bookWalls", "verdict": "NEUTRAL", "evidence": "unavailable"})
    # 7. cvd
    k = ((rec.get("cvd") or {}).get("kpis")) or {}
    br = k.get("buyRatio")
    if br is not None:
        ld = k.get("latestDiv") or {}
        q = k.get("quadrant")
        v_sign = clamp((br - 50) / 4, -1, 1) * sgn
        div_align = (ld.get("type") == ("bull" if long else "bear")) if ld.get("type") and now_ms - ld.get("ts", 0) < 24 * 3600_000 else None
        d.append({"source": "cvd", "verdict": "FOR" if v_sign > 0.1 or div_align else ("AGAINST" if v_sign < -0.1 else "NEUTRAL"),
                  "evidence": f"taker buy {br:.1f}%, perpCvd {k.get('perpCvd', 0):+.0f}, spotCvd {k.get('spotCvd', 0):+.0f}, quadrant {q}, latestDiv {ld.get('type') or 'none'} ({'recent' if div_align is not None else 'stale/none'})"})
    else:
        d.append({"source": "cvd", "verdict": "NEUTRAL", "evidence": "unavailable"})
    # 8. notifications
    nb = 0.0
    for n in fresh:
        if n.get("asset") != sym:
            continue
        dd = 1 if n.get("dir") == "bullish" else -1
        w = 2 if n.get("severity") == "high" else 1
        age_h = (now_ms - n.get("ts", 0)) / 3600_000
        nb += dd * w * (1 - 0.5 * clamp(age_h / 6, 0, 1))
    d.append({"source": "notifications", "verdict": "FOR" if nb * sgn > 0.5 else ("AGAINST" if nb * sgn < -0.5 else "NEUTRAL"),
              "evidence": f"6h weighted bias {nb:+.1f} ({len([n for n in fresh if n.get('asset') == sym])} events)"})
    return d


def debate_ok(deb, side):
    f = sum(1 for x in deb if x["verdict"] == "FOR")
    a = sum(1 for x in deb if x["verdict"] == "AGAINST")
    return f >= DEBATE_MIN_FOR and f > a, f, a



# ------------------------------------------------- 5b. regime detection (v3.2)
def regime_of(rec, parts):
    """TREND-UP / TREND-DOWN / RANGE / TRANSITION — decides the trade template."""
    trend = parts.get("trend", 0) or 0
    price, vw = rec.get("price"), rec.get("vwap") or {}
    vwap, b = vw.get("vwap") or price, vw.get("bands") or {}
    sd1 = b.get("sd1") or (price * 0.005 if price else 0)
    if not price or not sd1:
        return "TRANSITION", 0.0
    dist_sd = (price - vwap) / sd1
    if abs(trend) >= 2 and abs(dist_sd) >= 0.5:
        return ("TREND-DOWN" if trend < 0 else "TREND-UP"), dist_sd
    if abs(trend) <= 1 and abs(dist_sd) < 0.5:
        return "RANGE", dist_sd
    return "TRANSITION", dist_sd

regimes = {s: regime_of(assets[s], scored[s].get("parts") or {})[0]
           for s in scored if scored.get(s, {}).get("score") is not None}

# ------------------------------------------------- 6. build orders
new_orders, opp_lines = [], []
cands = [s for s in pre_rank if scored[s]["score"] is not None]


def build_order(sym, side, score, parts, rec, deep, regime="TRANSITION"):
    price, vw = rec.get("price"), rec.get("vwap") or {}
    vwap, b = vw.get("vwap") or price, vw.get("bands") or {}
    sd1, sd2 = b.get("sd1") or price * 0.005, b.get("sd2") or price * 0.01
    auc = rec.get("auction") or {}
    day, month = auc.get("day") or {}, auc.get("month") or {}
    liq, walls = deep.get("liq") or {}, deep.get("walls") or []
    long = side == "long"
    sgn = 1 if long else -1

    mode = "mean-revert" if regime == "RANGE" else "trend-pullback"
    if regime == "RANGE":
        # v3.2 mean-revert template: fade the 2-sigma band extreme back to the VWAP mean
        entry = vwap - 2.0 * sd1 if long else vwap + 2.0 * sd1
        if day.get("poc") and ((long and vwap > day["poc"] > entry) or (not long and vwap < day["poc"] < entry)):
            entry = day["poc"]
        base_risk = 0.75 * sd1
        stop = entry - sgn * base_risk
    else:
        # trend-pullback template (v2/v3): limit into the value band, aligned with the trend
        if long:
            entry = min(price, vwap - sd1)
            if day.get("poc") and day["poc"] < price and day["poc"] > entry:
                entry = day["poc"]
        else:
            entry = max(price, vwap + sd1)
            if day.get("poc") and day["poc"] > price and day["poc"] < entry:
                entry = day["poc"]

        base_risk = max(sd2 - sd1, price * 0.004)
        stop = entry - sgn * base_risk
    kl = liq.get("keyLevels", {})
    in_zone = (kl.get("below") if long else kl.get("above")) or []
    stop_note = ""
    for lv in in_zone:
        if long and 0 < entry - lv["price"] <= abs(entry - stop) and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
            new_stop = lv["price"] - base_risk * 0.15
            if abs(entry - new_stop) <= 1.6 * base_risk:
                stop, stop_note = new_stop, f"stop beyond long-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f})"
        elif (not long) and 0 < (lv["price"] - entry) <= abs(entry - stop) and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
            new_stop = lv["price"] + base_risk * 0.15
            if abs(entry - new_stop) <= 1.6 * base_risk:
                stop, stop_note = new_stop, f"stop beyond short-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f})"
    risk = abs(entry - stop)
    if risk <= 0:
        return None, "degenerate risk"

    for lv in in_zone:
        dist = (entry - lv["price"]) if long else (lv["price"] - entry)
        if 0 < dist <= 1.2 * risk and lv.get("strength", 0) >= CLUSTER_HAZARD_STRENGTH:
            return None, (f"opposite liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f}, "
                          f"~${cluster_usd(lv):,.0f}M est) within 1.2R of entry — wait for sweep")

    magnets = []
    if regime == "RANGE":
        magnets.append(((vwap - 0.2 * sd1) if long else (vwap + 0.2 * sd1), "VWAP mean (reversion)"))
    if long:
        if day.get("vah") and day["vah"] > entry:
            magnets.append((day["vah"], "day VAH"))
        if month.get("poc") and month["poc"] > entry:
            magnets.append((month["poc"], "month POC"))
        for lv in (kl.get("above") or []):
            if lv["price"] > entry and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
                magnets.append((lv["price"], f"short-liq cluster str {lv['strength']:.0f} (~${cluster_usd(lv):,.0f}M est)"))
    else:
        if day.get("val") and day["val"] < entry:
            magnets.append((day["val"], "day VAL"))
        if month.get("poc") and month["poc"] < entry:
            magnets.append((month["poc"], "month POC"))
        for lv in (kl.get("below") or []):
            if lv["price"] < entry and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
                magnets.append((lv["price"], f"long-liq cluster str {lv['strength']:.0f} (~${cluster_usd(lv):,.0f}M est)"))
    magnets = sorted(magnets, key=lambda m: abs(m[0] - entry))
    tgts = [m for m in magnets if cfg["min_r_multiple"] <= abs(m[0] - entry) / risk <= MAX_TARGET_R]
    if not tgts:
        near = magnets[0] if magnets else None
        nr = abs(near[0] - entry) / risk if near else 0
        return None, f"no structural target >= {cfg['min_r_multiple']}R (nearest magnet {fmt(sym, near[0]) if near else 'none'} = {nr:.1f}R)"
    ladder = []
    for m in tgts:
        if ladder and abs(m[0] - ladder[-1][0]) < 0.3 * risk:
            continue
        ladder.append(m)
        if len(ladder) == 3:
            break

    wall_note = ""
    for w in walls:
        adverse = (w["side"] == "ask") if long else (w["side"] == "bid")
        in_path = (entry < w["price"] < ladder[0][0]) if long else (ladder[0][0] < w["price"] < entry)
        if adverse and in_path:
            dr = abs(w["price"] - entry) / risk
            if dr < 1.5:
                return None, f"opposing {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} ({dr:.1f}R into path) caps the move to T1"
            wall_note = f"; {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} mid-path ({dr:.1f}R)"
    for w in walls:
        support = (w["side"] == "bid") if long else (w["side"] == "ask")
        between = (stop < w["price"] < entry) if long else (entry < w["price"] < stop)
        if support and between:
            wall_note += f"; {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} backs the stop"
            break

    r1 = abs(ladder[0][0] - entry) / risk
    if r1 < cfg["min_r_multiple"]:
        return None, f"R to T1 {r1:.1f} < {cfg['min_r_multiple']}"

    debate = build_debate(sym, side, rec, deep, regime=regime)
    ok, nf, na = debate_ok(debate, side)
    if not ok:
        return None, f"debate lost: FOR {nf} / AGAINST {na} (" + "; ".join(f"{x['source']}:{x['verdict']}" for x in debate if x['verdict'] != 'NEUTRAL') + ")"

    sig_names = []
    for st in (rec.get("sigSets") or []):
        lv = st.get("latest")
        if lv and now_ms - lv.get("barTs", 0) < 6 * 3600_000:
            sig_names.append(f"{lv.get('name', '?')}/{lv.get('side', '?')} ({st['bt']})")
    rationale = (
        f"confluence {score:+.1f} [notif {parts.get('notif', 0):+.1f} · signals {parts.get('signals', 0):+.1f} · "
        f"trend {parts.get('trend', 0):+.0f} · vwap {parts.get('vwap', 0):+.0f} · rsi {parts.get('rsi', 0):+.1f} · cvd {parts.get('cvd', 0):+.1f}]"
        f" · debate FOR {nf}/AGAINST {na}"
        f"; entry {'VWAP-1σ/day-POC' if long else 'VWAP+1σ/day-POC'} {fmt(sym, entry)} [{mode} · {regime}]"
        f"; stop beyond 2σ zone{' — ' + stop_note if stop_note else ''}"
        f"; T1 {ladder[0][1]} · T2 {ladder[1][1] if len(ladder) > 1 else '—'} · T3 {ladder[2][1] if len(ladder) > 2 else '—'}"
        f"{wall_note}; levels are PERP prices — translate to broker via live basis before MT5; liq clusters are Coinglass estimates"
    )
    if sig_names:
        rationale = f"recent signals: {', '.join(sig_names[:3])}; " + rationale

    return {
        "id": None, "createdTs": now_ms, "round": rid, "sym": sym,
        "mt5Symbol": cfg["symbol_map"].get(sym, sym),
        "side": side, "type": "limit",
        "entry": round(entry, DECS.get(sym, 2)),
        "stop": round(stop, DECS.get(sym, 2)),
        "targets": [round(m[0], DECS.get(sym, 2)) for m in ladder],
        "targetSources": [m[1] for m in ladder],
        "riskR": round(r1, 1), "expiresTs": now_ms + cfg["order_expiry_hours"] * 3600_000,
        "status": "suggested", "statusTs": now_ms,
        "perpRefPrice": price,
        "regime": regime, "mode": mode,
        "debate": debate,
        "rationale": rationale,
        "ticket": None, "actualEntry": None, "filledTs": None, "notes": None,
    }, None


deep_cache = {}
def deep_for(sym):
    if sym not in deep_cache:
        deep_cache[sym] = fetch_deep(sym)
    return deep_cache[sym]


# re-debate existing suggested orders with fresh data (proper review)
for o in state["orders"]:
    if o.get("status") != "suggested":
        continue
    sym = o["sym"]
    if scored.get(sym, {}).get("score") is None:
        continue
    deb = build_debate(sym, o["side"], assets[sym], deep_for(sym), regime=regimes.get(sym))
    o["debate"] = deb
    o["perpRefPrice"] = assets[sym].get("price")
    ok, nf, na = debate_ok(deb, o["side"])
    if not ok:
        o["status"] = "withdrawn"
        o["statusTs"] = now_ms
        o["withdrawReason"] = f"debate lost (FOR {nf}/AGAINST {na}) on fresh data"
        lifecycle_events.append(f"{o['id']} WITHDRAWN (re-debate lost: FOR {nf}/AGAINST {na})")
    else:
        lifecycle_events.append(f"{o['id']} re-debated: FOR {nf}/AGAINST {na} — stands")

state["closed"] = state.get("closed", []) + [o for o in state["orders"] if o.get("status") in ("expired", "withdrawn")]
state["orders"] = [o for o in state["orders"] if o.get("status") not in ("expired", "withdrawn")]

for sym in cands:
    sc = scored[sym]
    score, parts = sc["score"], sc["parts"]
    regime = regimes.get(sym, "TRANSITION")
    if regime == "RANGE":
        # v3.2 mean-revert lane: weak directional lean picks the fade side; no momentum alignment required
        if abs(score) < 1.5:
            continue
        side = "long" if score > 0 else "short"
    else:
        if abs(score) < MIN_CONF:
            continue
        side = "long" if score > 0 else "short"
        al = (1 if parts.get("signals", 0) * (1 if side == "long" else -1) > 0 else 0,
              1 if parts.get("trend", 0) * (1 if side == "long" else -1) > 0 else 0,
              1 if parts.get("vwap", 0) * (1 if side == "long" else -1) > 0 else 0)
        if sum(al) < 2:
            continue
    if any(o.get("sym") == sym and o.get("side") == side and o.get("status") in ("suggested", "placed", "filled")
           for o in state["orders"] + live_positions):
        continue
    if n_open_positions + len([o for o in state["orders"] if o.get("status") in ("suggested", "placed")]) >= cfg["max_concurrent_positions"]:
        break

    order, note = build_order(sym, side, score, parts, assets[sym], deep_for(sym), regime=regime)
    if order is None:
        opp_lines.append(f"- {sym} {side.upper()} confluence {score:+.1f} — REJECTED: {note}")
        continue
    order["id"] = f"{rid}-{sym}-{len(new_orders) + 1}"
    new_orders.append(order)
    state["orders"].append(order)
    tg = " · ".join(f"T{i+1} {fmt(sym, t)}" for i, t in enumerate(order["targets"]))
    opp_lines.append(f"- NEW {order['id']} {sym} {side.upper()} limit {fmt(sym, order['entry'])} · stop {fmt(sym, order['stop'])} · {tg} · R {order['riskR']}")
    for x in order["debate"]:
        if x["verdict"] != "NEUTRAL":
            opp_lines.append(f"      [{x['verdict']:<7}] {x['source']}: {x['evidence']}")

# ------------------------------------------------- 7. running-trade review
pos_lines = []
for p in live_positions:
    sym = p.get("sym")
    rec = assets.get(sym) or {}
    price = rec.get("price")
    sc = (scored.get(sym) or {}).get("score")
    entry, stop = p.get("entry"), p.get("stop")
    t1 = (p.get("targets") or [None])[0]
    if not price or entry is None or stop is None:
        pos_lines.append(f"- {p.get('id', sym)} — data missing, HOLD (manual check)")
        continue
    long = p.get("side", "long") == "long"
    risk = abs(entry - stop)
    open_r = ((price - entry) if long else (entry - price)) / risk if risk > 0 else 0
    verdict = "HOLD"
    if (long and price <= stop) or (not long and price >= stop):
        verdict = "CHECK_MT5 (price beyond stop — should be closed)"
    elif t1 and abs(price - t1) < 0.3 * risk:
        verdict = "TAKE_PARTIAL (within 0.3R of T1)"
    elif open_r >= 1.5:
        verdict = "TIGHTEN_STOP (lock > +1.5R)"
    elif open_r >= 1.0:
        verdict = "MOVE_STOP_TO_BREAKEVEN (+1R reached)"
    else:
        vw = rec.get("vwap") or {}
        regime_ok = (price > (vw.get("vwap") or price)) == long
        conf_ok = sc is None or (sc > 0) == long
        if not regime_ok and not conf_ok:
            verdict = f"CLOSE_RECOMMENDED (VWAP regime + confluence {sc:+.1f} flipped against)"
    pos_lines.append(f"- {p.get('id', sym)} {sym} {p.get('side', '').upper()}: {open_r:+.1f}R open @ {fmt(sym, price)} → {verdict}")

# ------------------------------------------------- 8. write state + log
watch = [{"sym": s, "score": scored[s]["score"]} for s in cands[:6] if abs(scored[s]["score"]) >= 1.5]
state["analysis"] = {
    "last_round": rid,
    "last_round_ts": now_ms,
    "engine": "v3.2 (regime-aware: trend-pullback + mean-revert templates | 9-source debate + microFlow vote | FOR>=3 & FOR>AGAINST | min R 2.0 | perpRefPrice basis stamp)",
    "assets": {s: {"price": assets[s].get("price"), "chgDayPct": assets[s].get("chgDayPct"),
                   "score": scored.get(s, {}).get("score"),
                   "parts": scored.get(s, {}).get("parts"),
                   "error": assets[s].get("error")}
               for s in SYMS},
    "watchlist": watch,
}
if not DRY:
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")

bias_tbl = "  ".join(f"{s}{scored[s]['score']:+.0f}({regimes.get(s, '?')[:5]})" for s in cands if abs(scored[s]["score"]) >= 2)
lines = [f"## {rid} · {now_iso} · zai-desk", ""]
mkt = "  ".join(f"{s} {fmt(s, assets[s].get('price'))} ({(assets[s].get('chgDayPct') or 0):+.1f}%)"
                for s in ("BTC", "ETH", "SOL", "XAU", "XAG") if assets.get(s, {}).get("price"))
lines += [f"**Market**: {mkt}", f"**Bias (|score|≥2)**: {bias_tbl or 'none significant'}", ""]
lines += [f"### Opportunities (engine v3.2 (regime-aware: trend-pullback + mean-revert) — debate-gated + microFlow vote, min R {cfg['min_r_multiple']})"] + (opp_lines or ["- none meeting the gates this round"]) + [""]
if lifecycle_events:
    lines += ["### Order lifecycle"] + [f"- {e}" for e in lifecycle_events] + [""]
lines += ["### Positions"] + (pos_lines or ["- no open positions"]) + [""]
if not DRY:
    with LOG_FILE.open("a") as f:
        f.write("\n".join(lines) + "\n")

print("=" * 96)
print(f"TRADE DESK {rid} · {now_iso} · engine v3.2 (regime-aware: trend-pullback + mean-revert) · {'DRY-RUN' if DRY else 'COMMITTED LOCALLY'}")
print("=" * 96)
for s in cands:
    sc = scored[s]
    if sc.get("score") is None:
        print(f"{s:<6} ERROR {sc.get('error', '')[:70]}")
    else:
        pp = " ".join(f"{k}={v:+.1f}" for k, v in sc["parts"].items())
        print(f"{s:<6} score {sc['score']:+5.1f}  {pp}")
print("-" * 96)
print("\n".join(opp_lines or ["no candidates"]))
if lifecycle_events:
    print("\n".join(lifecycle_events))
print("-" * 96)
print("\n".join(pos_lines or ["no open positions"]))
print(f"orders: {len(state['orders'])} active · positions: {n_open_positions} · closed: {len(state['closed'])}")
