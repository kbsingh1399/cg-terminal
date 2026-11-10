#!/usr/bin/env python3
"""Trade-desk round — the 15-minute analysis brain (zai-desk).

Reads the terminal's live API for all 12 assets, scores confluence,
manages the order lifecycle, reviews running trades, then rewrites
desk/state.json (analysis + orders) and appends a round entry to
desk/log.md. Git push is done by scripts/desk_round.sh, not here.

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

# fresh = last 6h, dedup by (asset, title), newest first
fresh = [n for n in notes_items if now_ms - n.get("ts", 0) < 6 * 3600_000]
seen, uniq = set(), []
for n in sorted(fresh, key=lambda x: -x.get("ts", 0)):
    k = (n.get("asset"), n.get("title"))
    if k not in seen:
        seen.add(k)
        uniq.append(n)

assets = {}          # sym -> analysis record
for sym in SYMS:
    rec = {"sym": sym, "error": None}
    try:
        m = get(f"/market?sym={sym}")
        p = m.get("price", {})
        rec["price"] = p.get("last")
        rec["chgDayPct"] = p.get("chgDayPct")
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
def score_asset(sym, rec):
    """Confluence score: >0 bullish, <0 bearish. Components capped."""
    s = 0.0
    parts = {}
    # notification bias, recency-weighted (6h window, decay 1.0 -> 0.5)
    nb = 0.0
    for n in fresh:
        if n.get("asset") != sym:
            continue
        d = 1 if n.get("dir") == "bullish" else -1
        w = 2 if n.get("severity") == "high" else 1
        age_h = (now_ms - n.get("ts", 0)) / 3600_000
        nb += d * w * (1 - 0.5 * clamp(age_h / 6, 0, 1))
    parts["notif"] = clamp(nb / 3, -2, 2)
    # footprint signal counts
    c = rec.get("signals") or {}
    parts["signals"] = clamp((c.get("bullish", 0) - c.get("bearish", 0)) * 0.33, -1, 1)
    # trend: h4 + d1 EMA13 vs EMA89
    tr = 0.0
    for tf in ("h4", "d1"):
        e = (rec.get("ema") or {}).get(tf) or {}
        if e.get("e13") and e.get("e89"):
            tr += 1 if e["e13"] > e["e89"] else -1
    parts["trend"] = tr
    # VWAP regime
    vw = rec.get("vwap") or {}
    if rec.get("price") and vw.get("vwap"):
        parts["vwap"] = 1 if rec["price"] > vw["vwap"] else -1
    else:
        parts["vwap"] = 0
    # RSI exhaustion modifier (h4)
    rsi = (rec.get("rsi") or {}).get("h4")
    parts["rsi"] = -0.5 if (rsi or 50) > 70 else (0.5 if (rsi or 50) < 30 else 0)
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

# ------------------------------------------------- 3. order lifecycle (old)
lifecycle_events = []
orders = state.get("orders", [])
live_positions = state.get("positions", [])
n_open_positions = len(live_positions)
for o in orders:
    if o.get("status") not in ("suggested", "placed"):
        continue
    # expiry
    if o.get("expiresTs") and now_ms > o["expiresTs"] and o.get("status") == "suggested":
        o["status"] = "expired"
        o["statusTs"] = now_ms
        lifecycle_events.append(f"{o['id']} EXPIRED (unfilled past expiry)")
        continue
    # confluence invalidated?
    sc = (scored.get(o["sym"]) or {}).get("score")
    need = o.get("side") == "long" and (sc is not None and sc < 0) or \
           o.get("side") == "short" and (sc is not None and sc > 0)
    if need and o.get("status") == "suggested":
        o["status"] = "withdrawn"
        o["statusTs"] = now_ms
        o["withdrawReason"] = f"confluence flipped ({sc:+.1f})"
        lifecycle_events.append(f"{o['id']} WITHDRAWN (confluence flipped to {sc:+.1f})")

# move dead orders to closed[]
state["closed"] = state.get("closed", []) + [o for o in orders if o.get("status") in ("expired", "withdrawn")]
state["orders"] = [o for o in orders if o.get("status") not in ("expired", "withdrawn")]

# ------------------------------------------------- 4. new opportunities
new_orders, opp_lines = [], []
cands = sorted([s for s in SYMS if scored.get(s, {}).get("score") is not None],
               key=lambda s: -abs(scored[s]["score"]))
for sym in cands:
    sc = scored[sym]
    score, parts = sc["score"], sc["parts"]
    if abs(score) < 3.0:
        continue
    side = "long" if score > 0 else "short"
    # alignment: ≥2 of 3 (signals, trend, vwap)
    al = (1 if parts.get("signals", 0) * (1 if side == "long" else -1) > 0 else 0,
          1 if parts.get("trend", 0) * (1 if side == "long" else -1) > 0 else 0,
          1 if parts.get("vwap", 0) * (1 if side == "long" else -1) > 0 else 0)
    if sum(al) < 2:
        continue
    # skip duplicate: already have a live suggested/placed order this side
    if any(o.get("sym") == sym and o.get("side") == side and o.get("status") in ("suggested", "placed", "filled")
           for o in state["orders"] + live_positions):
        continue
    # capacity
    if n_open_positions + len([o for o in state["orders"] if o.get("status") in ("suggested", "placed")]) >= cfg["max_concurrent_positions"]:
        break

    rec = assets[sym]
    price, vw = rec.get("price"), rec.get("vwap") or {}
    vwap, b = vw.get("vwap") or price, vw.get("bands") or {}
    sd1, sd2 = b.get("sd1") or price * 0.005, b.get("sd2") or price * 0.01
    auc = rec.get("auction") or {}
    day, month = auc.get("day") or {}, auc.get("month") or {}

    if side == "long":
        entry = min(price, vwap - sd1)                      # pullback magnet
        if day.get("poc") and day["poc"] < price and day["poc"] > entry:
            entry = day["poc"]                               # nearer magnet
        stop = entry - max(sd2 - sd1, price * 0.004)         # beyond -2σ zone
        if day.get("val") and day["val"] < stop and day["val"] > entry - sd2:
            stop = day["val"] - (entry - day["val"]) * 0.1
        t1 = (day.get("vah") or price * 1.01) if (day.get("vah") or 0) > entry else price * 1.01
        t2 = month.get("poc") if (month.get("poc") or 0) > t1 else None
    else:
        entry = max(price, vwap + sd1)
        if day.get("poc") and day["poc"] > price and day["poc"] < entry:
            entry = day["poc"]
        stop = entry + max(sd2 - sd1, price * 0.004)
        if day.get("vah") and day["vah"] > stop and day["vah"] < entry + sd2:
            stop = day["vah"] + (day["vah"] - entry) * 0.1
        t1 = (day.get("val") or price * 0.99) if 0 < (day.get("val") or 0) < entry else price * 0.99
        t2 = month.get("poc") if 0 < (month.get("poc") or 9e18) < t1 else None

    risk = abs(entry - stop)
    if risk <= 0:
        continue
    r1 = abs(t1 - entry) / risk
    if r1 < cfg["min_r_multiple"]:
        opp_lines.append(f"- {sym} {side.upper()} confluence {score:+.1f} but R to T1 only {r1:.1f} — watch, no order")
        continue

    oid = f"{rid}-{sym}-{len(new_orders) + 1}"
    order = {
        "id": oid, "createdTs": now_ms, "round": rid, "sym": sym,
        "mt5Symbol": cfg["symbol_map"].get(sym, sym),
        "side": side, "type": "limit",
        "entry": round(entry, DECS.get(sym, 2)),
        "stop": round(stop, DECS.get(sym, 2)),
        "targets": [round(t1, DECS.get(sym, 2))] + ([round(t2, DECS.get(sym, 2))] if t2 else []),
        "riskR": round(r1, 1), "expiresTs": now_ms + cfg["order_expiry_hours"] * 3600_000,
        "status": "suggested", "statusTs": now_ms,
        "rationale": f"confluence {score:+.1f} (notif {parts.get('notif', 0):+.1f}, signals {parts.get('signals', 0):+.1f}, "
                     f"trend {parts.get('trend', 0):+.0f}, vwap {parts.get('vwap', 0):+.0f}); entry at VWAP±1σ/POC, stop beyond 2σ zone",
        "ticket": None, "actualEntry": None, "filledTs": None, "notes": None,
    }
    new_orders.append(order)
    state["orders"].append(order)
    tg = " · ".join(f"T{i+1} {fmt(sym, t)}" for i, t in enumerate(order["targets"]))
    opp_lines.append(f"- NEW {oid} {sym} {side.upper()} limit {fmt(sym, entry)} · stop {fmt(sym, stop)} · {tg} · R {r1:.1f}")

# ------------------------------------------------- 5. running-trade review
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

# ------------------------------------------------- 6. write state + log
watch = [{"sym": s, "score": scored[s]["score"]} for s in cands[:6] if abs(scored[s]["score"]) >= 1.5]
state["analysis"] = {
    "last_round": rid,
    "last_round_ts": now_ms,
    "assets": {s: {"price": assets[s].get("price"), "chgDayPct": assets[s].get("chgDayPct"),
                   "score": scored.get(s, {}).get("score"),
                   "parts": scored.get(s, {}).get("parts"),
                   "error": assets[s].get("error")}
               for s in SYMS},
    "watchlist": watch,
}
if not DRY:
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")

# log entry
bias_tbl = "  ".join(f"{s}{'+' if scored[s]['score'] > 0 else ''}{scored[s]['score']:.0f}"
                     for s in cands if scored.get(s, {}).get("score") is not None and abs(scored[s]["score"]) >= 2)
lines = [f"## {rid} · {now_iso} · zai-desk", ""]
mkt = "  ".join(f"{s} {fmt(s, assets[s].get('price'))} ({(assets[s].get('chgDayPct') or 0):+.1f}%)"
                for s in ("BTC", "ETH", "SOL", "XAU", "XAG") if assets.get(s, {}).get("price"))
lines += [f"**Market**: {mkt}", f"**Bias (|score|≥2)**: {bias_tbl or 'none significant'}", ""]
lines += ["### Opportunities"] + (opp_lines or ["- none meeting the confluence bar this round"]) + [""]
if lifecycle_events:
    lines += ["### Order lifecycle"] + [f"- {e}" for e in lifecycle_events] + [""]
lines += ["### Positions"] + (pos_lines or ["- no open positions"]) + [""]
if not DRY:
    with LOG_FILE.open("a") as f:
        f.write("\n".join(lines) + "\n")

# ------------------------------------------------- 7. stdout summary
print("=" * 96)
print(f"TRADE DESK {rid} · {now_iso} · {'DRY-RUN' if DRY else 'COMMITTED LOCALLY'}")
print("=" * 96)
for s in cands:
    sc = scored[s]
    if sc.get("score") is None:
        print(f"{s:<6} ERROR {sc.get('error', '')[:70]}")
    else:
        pp = " ".join(f"{k}={v:+.1f}" for k, v in sc["parts"].items())
        print(f"{s:<6} score {sc['score']:+5.1f}  {pp}")
print("-" * 96)
print("\n".join(opp_lines or ["no new orders"]))
if lifecycle_events:
    print("\n".join(lifecycle_events))
print("-" * 96)
print("\n".join(pos_lines or ["no open positions"]))
print(f"orders: {len(state['orders'])} active · positions: {n_open_positions} · closed: {len(state['closed'])}")
