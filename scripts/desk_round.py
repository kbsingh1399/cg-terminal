#!/usr/bin/env python3
"""Trade-desk round — the 15-minute analysis brain (zai-desk). v2

Full-parameter trade formulation:
  Stage 1 (all 12 assets): market snapshot (price, VWAP+-1/2/3sigma,
    EMA 13/89/233 h4/d1, RSI, auction POC/VAH/VAL day/month), footprint
    signal engine counts, recency-weighted notification bias.
  Stage 1b (top candidates): CVD — taker buy share, perp CVD slope,
    latest divergence + recency.
  Stage 2 (order candidates only): liquidation clusters (sweep magnets +
    hazards), whale resting walls (path blockers + stop supports).

Order gates (ALL must pass):
  |confluence| >= 3.0 · >=2/3 alignment (signals/trend/vwap) ·
  R to T1 >= config.min_r_multiple (2.0) · no opposite liq magnet within
  1.2R of entry (strength>=50) · no opposing whale wall >= $5M within 1.5R
  in the profit path · stop pushed beyond any liq magnet inside the risk
  zone (geometry must stay <= 1.6x base risk).

Usage: python3 scripts/desk_round.py [--dry-run]
"""
import json, sys, time, urllib.request, urllib.error, re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent          # repo root
DESK = ROOT / "desk"
STATE_FILE = DESK / "state.json"
LOG_FILE = DESK / "log.md"
BASE = "http://localhost:3000/api/cg"
SYMS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XAU", "XAG"]
DECS = {"BTC": 1, "ETH": 2, "SOL": 2, "BNB": 2, "XRP": 4, "ADA": 4, "AVAX": 3,
        "DOGE": 5, "LINK": 3, "LTC": 2, "XAU": 2, "XAG": 3}

# engine constants (technical thresholds, not human config)
WALL_MIN_USD = 5_000_000        # whale wall that matters
CLUSTER_MIN_STRENGTH = 40.0     # liq cluster counts as a target magnet
CLUSTER_HAZARD_STRENGTH = 50.0  # opposite magnet too close -> skip
MAX_TARGET_R = 6.0              # targets beyond this are not tradable
MIN_CONF = 3.0                  # |score| bar for order candidacy
CVD_TOP_N = 6                   # cvd fetch budget per round

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


# ---------------------------------------------------------------- load state
state = json.loads(STATE_FILE.read_text())
cfg = state["config"]

# ---------------------------------------------------------------- round no.
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
    except Exception as e:
        rec["error"] = (rec["error"] + "; " if rec["error"] else "") + f"signals: {e}"
    assets[sym] = rec

# ---------------------------------------------------------------- 2. score
def score_asset(sym, rec, cvd=None):
    """Confluence score: >0 bullish, <0 bearish."""
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
    if rec.get("price") and vw.get("vwap"):
        parts["vwap"] = 1 if rec["price"] > vw["vwap"] else -1
    else:
        parts["vwap"] = 0
    rsi = (rec.get("rsi") or {}).get("h4")
    parts["rsi"] = -0.5 if (rsi or 50) > 70 else (0.5 if (rsi or 50) < 30 else 0)
    # CVD component (fetched for top candidates only)
    if cvd:
        k = cvd.get("kpis", {})
        comp = 0.0
        br = k.get("buyRatio")
        if br is not None:
            comp += clamp((br - 50) / 4, -0.5, 0.5)          # taker buy share
        ld = k.get("latestDiv") or {}
        if ld.get("type") and now_ms - ld.get("ts", 0) < 24 * 3600_000:
            comp += 1 if ld["type"] == "bull" else -1         # recent divergence
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

# stage 1b: CVD for the top candidates by |score|
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
    except Exception as e:
        print(f"[warn] cvd {sym} failed: {e}", file=sys.stderr)

# ------------------------------------------------- 3. order lifecycle (old)
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
    # user mandate: orders below the configured minimum R are withdrawn
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

# ------------------------------------------------- 4. deep data (candidates)
def fetch_deep(sym):
    """Liquidation clusters + whale walls for one asset. Never raises."""
    deep = {"liq": None, "walls": None, "errors": []}
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
    return deep


# ------------------------------------------------- 5. new opportunities
new_orders, opp_lines = [], []
cands = [s for s in pre_rank if scored[s]["score"] is not None]


def build_order(sym, side, score, parts, rec, deep):
    """Full-parameter level construction. Returns (order|None, note)."""
    price, vw = rec.get("price"), rec.get("vwap") or {}
    vwap, b = vw.get("vwap") or price, vw.get("bands") or {}
    sd1, sd2 = b.get("sd1") or price * 0.005, b.get("sd2") or price * 0.01
    auc = rec.get("auction") or {}
    day, month = auc.get("day") or {}, auc.get("month") or {}
    liq, walls = deep.get("liq") or {}, deep.get("walls") or []
    long = side == "long"
    sgn = 1 if long else -1

    # ---- entry: pullback magnet (VWAP -1σ / +1σ, or day POC nearer)
    if long:
        entry = min(price, vwap - sd1)
        if day.get("poc") and day["poc"] < price and day["poc"] > entry:
            entry = day["poc"]
    else:
        entry = max(price, vwap + sd1)
        if day.get("poc") and day["poc"] > price and day["poc"] < entry:
            entry = day["poc"]

    # ---- stop: beyond the ±2σ zone
    base_risk = max(sd2 - sd1, price * 0.004)
    stop = entry - sgn * base_risk

    # ---- stop pushed beyond any liq magnet inside the risk zone
    #   long: long-liq clusters below entry; short: short-liq clusters above
    kl = liq.get("keyLevels", {})
    in_zone = (kl.get("below") if long else kl.get("above")) or []
    stop_note = ""
    for lv in in_zone:
        if long and entry - lv["price"] > 0 and entry - lv["price"] <= abs(entry - stop) and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
            new_stop = lv["price"] - base_risk * 0.15
            if abs(entry - new_stop) <= 1.6 * base_risk:
                stop, stop_note = new_stop, f"stop beyond long-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f})"
        elif (not long) and (lv["price"] - entry) > 0 and (lv["price"] - entry) <= abs(entry - stop) and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
            new_stop = lv["price"] + base_risk * 0.15
            if abs(entry - new_stop) <= 1.6 * base_risk:
                stop, stop_note = new_stop, f"stop beyond short-liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f})"
    risk = abs(entry - stop)
    if risk <= 0:
        return None, "degenerate risk"

    # ---- hazard: opposite magnet within 1.2R of entry
    hz = (kl.get("below") if long else kl.get("above")) or []  # same side list = magnets; opposite list:
    opp = (kl.get("above") if long else kl.get("below")) or []
    # for a long, magnets ABOVE are short-liq (targets); long-liq BELOW within stop are handled; but a strong long-liq just below entry (not yet beyond stop) = sweep danger
    for lv in in_zone:
        dist = (entry - lv["price"]) if long else (lv["price"] - entry)
        if 0 < dist <= 1.2 * risk and lv.get("strength", 0) >= CLUSTER_HAZARD_STRENGTH:
            return None, f"opposite liq magnet {fmt(sym, lv['price'])} (str {lv['strength']:.0f}, ~${lv.get('usd', 0) * lv['price'] / 1e6:,.0f}M est) within 1.2R of entry — wait for sweep"

    # ---- target ladder from structural magnets (nearest first, same direction)
    magnets = []
    if long:
        if day.get("vah") and day["vah"] > entry:
            magnets.append((day["vah"], "day VAH"))
        if month.get("poc") and month["poc"] > entry:
            magnets.append((month["poc"], "month POC"))
        for lv in (kl.get("above") or []):
            if lv["price"] > entry and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
                magnets.append((lv["price"], f"short-liq cluster str {lv['strength']:.0f} (~${lv.get('usd', 0) * lv['price'] / 1e6:,.0f}M est)"))
    else:
        if day.get("val") and day["val"] < entry:
            magnets.append((day["val"], "day VAL"))
        if month.get("poc") and month["poc"] < entry:
            magnets.append((month["poc"], "month POC"))
        for lv in (kl.get("below") or []):
            if lv["price"] < entry and lv.get("strength", 0) >= CLUSTER_MIN_STRENGTH:
                magnets.append((lv["price"], f"long-liq cluster str {lv['strength']:.0f} (~${lv.get('usd', 0) * lv['price'] / 1e6:,.0f}M est)"))
    magnets = sorted(magnets, key=lambda m: abs(m[0] - entry))
    # keep only magnets >= min R away; first one is T1
    tgts = [m for m in magnets if abs(m[0] - entry) / risk >= cfg["min_r_multiple"] and abs(m[0] - entry) / risk <= MAX_TARGET_R]
    if not tgts:
        near = magnets[0] if magnets else None
        nr = abs(near[0] - entry) / risk if near else 0
        return None, f"no structural target >= {cfg['min_r_multiple']}R (nearest magnet {fmt(sym, near[0]) if near else 'none'} = {nr:.1f}R)"
    # de-dup close targets (within 0.3R of each other) and cap at 3
    ladder = []
    for m in tgts:
        if ladder and abs(m[0] - ladder[-1][0]) < 0.3 * risk:
            continue
        ladder.append(m)
        if len(ladder) == 3:
            break

    # ---- whale walls: opposing wall in the profit path?
    wall_note = ""
    for w in walls:
        adverse = (w["side"] == "ask") if long else (w["side"] == "bid")
        in_path = (entry < w["price"] < ladder[0][0]) if long else (ladder[0][0] < w["price"] < entry)
        if adverse and in_path:
            d = abs(w["price"] - entry) / risk
            if d < 1.5:
                return None, f"opposing {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} ({d:.1f}R into path) caps the move to T1"
            wall_note = f"; {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} mid-path ({d:.1f}R)"
    # supporting wall behind stop (adds conviction)
    for w in walls:
        support = (w["side"] == "bid") if long else (w["side"] == "ask")
        between = (stop < w["price"] < entry) if long else (entry < w["price"] < stop)
        if support and between:
            wall_note += f"; {w['side']} wall ${w['usd'] / 1e6:.1f}M @ {fmt(sym, w['price'])} backs the stop"
            break

    r1 = abs(ladder[0][0] - entry) / risk
    if r1 < cfg["min_r_multiple"]:
        return None, f"R to T1 {r1:.1f} < {cfg['min_r_multiple']}"

    sig_names = []
    for st in (rec.get("sigSets") or []):
        lv = st.get("latest")
        if lv and now_ms - lv.get("barTs", 0) < 6 * 3600_000:
            sig_names.append(f"{lv.get('name', '?')}/{lv.get('side', '?')} ({st['bt']})")
    rationale = (
        f"confluence {score:+.1f} [notif {parts.get('notif', 0):+.1f} · signals {parts.get('signals', 0):+.1f} · "
        f"trend {parts.get('trend', 0):+.0f} · vwap {parts.get('vwap', 0):+.0f} · rsi {parts.get('rsi', 0):+.1f} · cvd {parts.get('cvd', 0):+.1f}]"
        f"; entry {('VWAP-1σ/day-POC' if long else 'VWAP+1σ/day-POC')} {fmt(sym, entry)}"
        f"; stop beyond 2σ zone{' — ' + stop_note if stop_note else ''}"
        f"; T1 {ladder[0][1]} · T2 {ladder[1][1] if len(ladder) > 1 else '—'} · T3 {ladder[2][1] if len(ladder) > 2 else '—'}"
        f"{wall_note}; liq clusters are Coinglass estimates"
    )
    if sig_names:
        rationale = f"recent signals: {', '.join(sig_names[:3])}; " + rationale

    return {
        "id": None,  # filled by caller
        "createdTs": now_ms, "round": rid, "sym": sym,
        "mt5Symbol": cfg["symbol_map"].get(sym, sym),
        "side": side, "type": "limit",
        "entry": round(entry, DECS.get(sym, 2)),
        "stop": round(stop, DECS.get(sym, 2)),
        "targets": [round(m[0], DECS.get(sym, 2)) for m in ladder],
        "targetSources": [m[1] for m in ladder],
        "riskR": round(r1, 1), "expiresTs": now_ms + cfg["order_expiry_hours"] * 3600_000,
        "status": "suggested", "statusTs": now_ms,
        "rationale": rationale,
        "ticket": None, "actualEntry": None, "filledTs": None, "notes": None,
    }, None


for sym in cands:
    sc = scored[sym]
    score, parts = sc["score"], sc["parts"]
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

    deep = fetch_deep(sym)
    order, note = build_order(sym, side, score, parts, assets[sym], deep)
    if order is None:
        opp_lines.append(f"- {sym} {side.upper()} confluence {score:+.1f} — REJECTED by deep gates: {note}")
        continue
    order["id"] = f"{rid}-{sym}-{len(new_orders) + 1}"
    new_orders.append(order)
    state["orders"].append(order)
    tg = " · ".join(f"T{i+1} {fmt(sym, t)}" for i, t in enumerate(order["targets"]))
    opp_lines.append(f"- NEW {order['id']} {sym} {side.upper()} limit {fmt(sym, order['entry'])} · stop {fmt(sym, order['stop'])} · {tg} · R {order['riskR']}")
    opp_lines.append(f"      gates passed: {order['rationale']}")

# ------------------------------------------------- 6. running-trade review
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

# ------------------------------------------------- 7. write state + log
watch = [{"sym": s, "score": scored[s]["score"]} for s in cands[:6] if abs(scored[s]["score"]) >= 1.5]
state["analysis"] = {
    "last_round": rid,
    "last_round_ts": now_ms,
    "engine": "v2 (full params: notif+signals+trend+vwap+rsi+cvd | liq clusters + whale walls in levels | min R 2.0)",
    "assets": {s: {"price": assets[s].get("price"), "chgDayPct": assets[s].get("chgDayPct"),
                   "score": scored.get(s, {}).get("score"),
                   "parts": scored.get(s, {}).get("parts"),
                   "error": assets[s].get("error")}
               for s in SYMS},
    "watchlist": watch,
}
if not DRY:
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")

bias_tbl = "  ".join(f"{s}{scored[s]['score']:+.0f}"
                     for s in cands if abs(scored[s]["score"]) >= 2)
lines = [f"## {rid} · {now_iso} · zai-desk", ""]
mkt = "  ".join(f"{s} {fmt(s, assets[s].get('price'))} ({(assets[s].get('chgDayPct') or 0):+.1f}%)"
                for s in ("BTC", "ETH", "SOL", "XAU", "XAG") if assets.get(s, {}).get("price"))
lines += [f"**Market**: {mkt}", f"**Bias (|score|≥2)**: {bias_tbl or 'none significant'}", ""]
lines += ["### Opportunities (engine v2 — full parameter gates, min R %.1f)" % cfg["min_r_multiple"]] + (opp_lines or ["- none meeting the confluence bar this round"]) + [""]
if lifecycle_events:
    lines += ["### Order lifecycle"] + [f"- {e}" for e in lifecycle_events] + [""]
lines += ["### Positions"] + (pos_lines or ["- no open positions"]) + [""]
if not DRY:
    with LOG_FILE.open("a") as f:
        f.write("\n".join(lines) + "\n")

# ------------------------------------------------- 8. stdout summary
print("=" * 96)
print(f"TRADE DESK {rid} · {now_iso} · engine v2 · {'DRY-RUN' if DRY else 'COMMITTED LOCALLY'}")
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
