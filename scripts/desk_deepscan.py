#!/usr/bin/env python3
"""desk_deepscan.py — 360° per-asset deep analysis (on demand).

Usage:
  python3 scripts/desk_deepscan.py BTC            # one symbol
  python3 scripts/desk_deepscan.py BTC ETH XAU    # several
  python3 scripts/desk_deepscan.py --top 3        # top |score| symbols from state.json
  python3 scripts/desk_deepscan.py --dry-run BTC  # no git commit/push

Writes desk/deepscan/<SYM>-<YYYYMMDD-HHMM>.md + DEEPSCAN log entry.
Covers EVERY data point the terminal exposes for the symbol:
  market (EMA stack 4 TFs, RSI 4 TFs, VWAP+σ, day/month POC-VAH-VAL)
  fp (300 m15 bars: per-level buy/sell footprint — candle forensics:
      delta, absorption, exhaustion, POC migration, Δ-divergence)
  signals (typed micro events 24h) · cvd (perp/spot, quadrant, div)
  liqlevels (magnets + squeeze fuel) · lto (whale walls)
  bookwalls (depth imbalance) · stopmap (BTC) · notifications (news 24h)
  desk/mt5.json (broker basis/spread + live exposure)
Section 9 constructs the actual LIMIT-trade candidates (entry zone confluence,
structural stop, magnet targets, R, size, broker translation, gates) and an
EVIDENCE MANIFEST: every fetched tab mapped to its role in the trade —
no data point is silently dropped, including for NO-TRADE / PARKED / REJECTED
outcomes (rejections print their reason).
Output ends with a playbook trade plan or an explicit NO-TRADE verdict.
"""
import json, sys, time, urllib.request, statistics
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
DESK = ROOT / "desk"
BASE = "http://localhost:3000/api/cg"
DECS = {"BTC": 1, "ETH": 2, "SOL": 2, "BNB": 2, "XRP": 4, "ADA": 4, "AVAX": 3,
        "DOGE": 5, "LINK": 3, "LTC": 2, "XAU": 2, "XAG": 3}
SYMS = list(DECS)
DRY = "--dry-run" in sys.argv
now_ms = int(time.time() * 1000)
now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def get(path, timeout=90):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.loads(r.read())


def fmt(sym, x):
    return "?" if x is None else f"{x:,.{DECS.get(sym, 2)}f}"


def hhmm(ts_s):
    return datetime.fromtimestamp(ts_s, timezone.utc).strftime("%H:%M")


def fnum(x, nd=1):
    try:
        return f"{x:,.{nd}f}"
    except Exception:
        return "?"


# ------------------------------------------------------------------ fetch
def fetch_all(sym):
    d = {"sym": sym, "errors": []}

    def safe(name, path, timeout=90):
        try:
            return get(path, timeout)
        except Exception as e:
            d["errors"].append(f"{name}: {str(e)[:80]}")
            return None

    d["market"] = safe("market", f"/market?sym={sym}")
    d["fp"] = safe("fp", f"/fp?sym={sym}")
    d["signals"] = safe("signals", f"/signals?sym={sym}", 120)
    d["cvd"] = safe("cvd", f"/cvd?sym={sym}&itv=15m&limit=200")
    d["liq"] = safe("liqlevels", f"/liqlevels?sym={sym}&range=3d&lvR=4")
    d["lto"] = safe("lto", f"/lto?symbol={sym}&minVolUsd=5000000")
    d["book"] = safe("bookwalls", f"/bookwalls?sym={sym}&market=futures&interval=15m&limit=30")
    d["funding"] = safe("funding", f"/funding?sym={sym}")
    d["oi"] = safe("oi", f"/oi?sym={sym}")
    if sym == "BTC":
        d["stopmap"] = safe("stopmap", "/stopmap?sym=BTC")
    try:
        notes = get("/notifications?limit=200")
        day = now_ms - 24 * 3600_000
        d["news"] = [n for n in notes.get("items", [])
                     if n.get("asset") == sym and n.get("ts", 0) > day][:12]
    except Exception as e:
        d["errors"].append(f"notifications: {str(e)[:80]}")
        d["news"] = []
    try:
        mt = json.loads((DESK / "mt5.json").read_text())
        d["mt5"] = mt
    except Exception:
        d["mt5"] = None
    return d


# ------------------------------------------------- footprint forensics
def fp_forensics(sym, fp, price):
    """Candle-history + per-level footprint analysis from /fp bars."""
    out = {"bars": [], "net6h": 0.0, "net24h": 0.0, "events": [], "div": None,
           "pocSlope": 0.0, "notes": []}
    bars = fp.get("bars") or []
    if not bars:
        out["notes"].append("no fp bars returned")
        return out

    rows = []
    for b in bars:
        f = b.get("fp") or {}
        bv = sum(f.get("b") or [])
        sv = sum(f.get("s") or [])
        levels = f.get("b") or []
        sells = f.get("s") or []
        lo, tick = f.get("lo"), f.get("tick") or 1
        tot = [x + y for x, y in zip(levels, sells)]
        poc_i = tot.index(max(tot)) if tot else 0
        poc = (lo + poc_i * tick) if lo is not None else None
        rng = (b.get("h") or 0) - (b.get("l") or 0)
        cpr = ((b.get("c") or 0) - (b.get("l") or 0)) / rng if rng > 0 else 0.5
        rows.append({"ts": b.get("ts"), "o": b.get("o"), "h": b.get("h"), "l": b.get("l"),
                     "c": b.get("c"), "bv": bv, "sv": sv, "delta": bv - sv,
                     "vol": bv + sv, "poc": poc, "cpr": cpr, "rng": rng})
    out["bars"] = rows

    last = rows[-1]["ts"]
    for r in rows:
        age_h = (last - r["ts"]) / 3600
        if age_h <= 6:
            out["net6h"] += r["delta"]
        if age_h <= 24:
            out["net24h"] += r["delta"]

    # absorption / exhaustion over last 48 bars (12h)
    w = rows[-48:]
    med_v = statistics.median([r["vol"] for r in w]) or 1
    med_r = statistics.median([r["rng"] for r in w]) or 1
    for r in rows[-48:]:
        lbl = None
        if r["delta"] < -0.35 * r["vol"] and r["cpr"] >= 0.60 and r["vol"] > 0.8 * med_v:
            lbl = "SELL-ABSORPTION (heavy sell effort, close high — buyers absorb)"
        elif r["delta"] > 0.35 * r["vol"] and r["cpr"] <= 0.40 and r["vol"] > 0.8 * med_v:
            lbl = "BUY-ABSORPTION (heavy buy effort, close low — sellers absorb)"
        if r["vol"] > 1.8 * med_v and r["rng"] < 0.7 * med_r:
            lbl = (lbl + " + " if lbl else "") + "EXHAUSTION (volume spike, tiny range)"
        if lbl:
            out["events"].append({"ts": r["ts"], "what": lbl, "c": r["c"], "delta": r["delta"]})

    # delta/price divergence over last 24 bars
    w = rows[-24:]
    if len(w) >= 12:
        half = len(w) // 2
        p1, p2 = w[:half], w[half:]
        ph = max(r["h"] for r in p2)
        prior_ph = max(r["h"] for r in p1)
        d1 = sum(r["delta"] for r in p1)
        d2 = sum(r["delta"] for r in p2)
        if ph > prior_ph and d2 < d1:
            out["div"] = "BEARISH Δ-divergence (higher high on weaker delta)"
        elif ph < prior_ph and d2 > d1:
            out["div"] = "BULLISH Δ-divergence (lower high on stronger delta)"

    # POC migration slope (last 20 bars, normalized)
    pocs = [r["poc"] for r in rows[-20:] if r["poc"]]
    if len(pocs) >= 8 and (price or 0) > 0:
        n = len(pocs)
        xs = list(range(n))
        mx, my = sum(xs) / n, sum(pocs) / n
        den = sum((x - mx) ** 2 for x in xs) or 1
        out["pocSlope"] = (sum((x - mx) * (p - my) for x, p in zip(xs, pocs)) / den) / price * 1e4  # bp/bar
    return out


# ------------------------------------------------- 9 · trade construction
def build_trades(sym, d, fpx, price, vwap, sd1, day, kl, k, cnt, bias, ns=0, nl=0):
    """Section 9 — construct limit-trade candidates + FULL justification (v3).
    (a) construction: entry-zone confluence, structural stop, str≥40 magnet
        targets, R≥2 gate, broker translation, sizing;
    (b) 'WHY THIS TRADE' written narrative (thesis / entry / stop / targets /
        size / invalidation) — explain, don't tabulate;
    (c) evidence manifest: EVERY tab fetched in fetch_all() appears with a
        reading, a verdict (✓ supports / ✗ opposes / ○ neutral) and a WRITTEN
        justification tied to THIS trade's levels — no data point silently
        dropped, whatever the outcome (PLACEABLE / PARKED / REJECTED /
        NO-TRADE; rejections print their reason). Returns md lines."""
    L = []
    ap = L.append
    mt = d["mt5"] or {}
    eq = (mt.get("account") or {}).get("equity") or 0
    sp = (mt.get("spreads") or {}).get(f"{sym}USD") or {}
    basis, spread, spec = sp.get("basisPct"), sp.get("spreadPct"), sp.get("spec") or {}
    risk_usd = (eq * 0.005) if eq else None
    # v3: construction state for the justification layer
    entry = stop = m_entry = m_stop = None
    tgts, m_tgts, zone = [], [], []
    confl = status = stop_src = why_out = None
    risk_dist = r1 = 0.0
    lots = risk_act = None
    # machine-readable trade card for auto-digest + WAKEUP broadcast (v3.1)
    card = {"sym": sym, "status": None, "side": bias, "reason": None, "recovery": None,
            "entry": None, "entry_b": None, "confl": None, "stop": None, "stop_b": None,
            "stop_src": None, "tgts": [], "r1": None, "lots": None, "risk_usd": None,
            "risk_pct": None, "basis": basis, "spread": spread, "caveat": None, "why": []}

    ap("")
    ap("## 9 · Limit-trade candidates — full construction (all tabs accounted)")

    if bias and not (price and vwap and sd1):
        ap(f"- **no candidate** — bias {bias} but core market data missing")
        status, why_out = "NO-DATA", "core market data missing"
        card["status"], card["reason"] = status, why_out
        card["recovery"] = "re-run when terminal endpoints respond"
    elif bias:
        # ---- entry zone: confluence of pullback/discount levels beyond spot
        zone = []
        if bias == "SHORT":
            if day.get("poc") and day["poc"] > price:
                zone.append(("day POC", day["poc"]))
            if vwap + sd1 > price:
                zone.append(("VWAP+1σ", vwap + sd1))
            if day.get("vah") and day["vah"] > price:
                zone.append(("day VAH", day["vah"]))
        else:
            if day.get("poc") and day["poc"] < price:
                zone.append(("day POC", day["poc"]))
            if vwap - sd1 < price:
                zone.append(("VWAP−1σ", vwap - sd1))
            if day.get("val") and day["val"] < price:
                zone.append(("day VAL", day["val"]))
        if not zone:
            ap(f"- **no candidate** — bias {bias} but price is already beyond every attack "
               f"zone (chasing forbidden by playbook)")
            status, why_out = "NO-ZONE", "price beyond every attack zone — chasing forbidden"
            card["status"], card["reason"] = status, why_out
            card["recovery"] = "re-scan on the next pullback — price must re-enter the attack zone; chasing is forbidden by the playbook"
        else:
            zone.sort(key=lambda t: abs(t[1] - price))
            entry_name, entry = zone[0]
            confl = "+".join(n for n, p in zone if abs(p - entry) <= 0.4 * sd1) or entry_name
            # ---- stop: beyond 2σ zone, extended past strong opposing magnet
            if bias == "SHORT":
                stop = max(vwap + 2 * sd1, entry + 0.8 * sd1)
            else:
                stop = min(vwap - 2 * sd1, entry - 0.8 * sd1)
            stop_src = "VWAP±2σ zone"
            opp = (kl.get("above") or []) if bias == "SHORT" else (kl.get("below") or [])
            for lv in opp:
                if (lv.get("strength") or 0) >= 40:
                    p = lv["price"]
                    if bias == "SHORT" and entry < p < stop + 0.5 * sd1 and p + 0.15 * sd1 > stop:
                        stop = p + 0.15 * sd1
                        stop_src = f"beyond {lv.get('lev', '')} magnet {fmt(sym, p)} (str {lv['strength']:.0f})"
                    elif bias == "LONG" and entry > p > stop - 0.5 * sd1 and p - 0.15 * sd1 < stop:
                        stop = p - 0.15 * sd1
                        stop_src = f"beyond {lv.get('lev', '')} magnet {fmt(sym, p)} (str {lv['strength']:.0f})"
            risk_dist = abs(stop - entry)
            # ---- targets: magnets on profit side, str >= 40 (engine rule)
            tgt_list = (kl.get("below") or []) if bias == "SHORT" else (kl.get("above") or [])
            strong = sorted([lv for lv in tgt_list if (lv.get("strength") or 0) >= 40],
                            key=lambda lv: abs(lv["price"] - entry))
            if not strong:
                near = tgt_list[:1]
                near_s = (f"nearest {fmt(sym, near[0]['price'])} str {near[0].get('strength', 0):.0f}"
                          if near else "none at all")
                ap(f"- **REJECTED** — bias {bias}, entry {fmt(sym, entry)} ({confl}) but NO magnet "
                   f"str≥40 on profit side ({near_s}) → no structural target, R unquantifiable")
                status, why_out = "REJECTED", f"no magnet str≥40 on profit side ({near_s})"
                card["status"], card["reason"] = status, why_out
                card["recovery"] = "re-scan after a str≥40 magnet prints on the profit side — until then R is unquantifiable"
            else:
                tgts = strong[:3]
                t1 = tgts[0]["price"]
                r1 = abs(entry - t1) / risk_dist if risk_dist > 0 else 0
                if r1 < 2.0:
                    ap(f"- **REJECTED** — R to T1 = {r1:.2f} < 2.0 mandate "
                       f"(entry {fmt(sym, entry)}, stop {fmt(sym, stop)}, T1 {fmt(sym, t1)} str {tgts[0]['strength']:.0f})")
                    status, why_out = "REJECTED", f"R to T1 {r1:.2f} < 2.0"
                    card["status"], card["reason"] = status, why_out
                    card["entry"], card["confl"], card["stop"], card["r1"] = entry, confl, stop, round(r1, 2)
                    card["recovery"] = (f"re-check on σ-compression (tighter stop) or T1 extension — "
                                        f"needs R ≥ 2.0, now {r1:.2f}")
                else:
                    # ---- broker translation + gates
                    if basis is not None:
                        b = basis / 100.0
                        m_entry, m_stop = entry * (1 + b), stop * (1 + b)
                        m_tgts = [lv["price"] * (1 + b) for lv in tgts]
                        ok = abs(basis) <= 0.5 and (spread if spread is not None else 9) <= 0.15
                        status = "PLACEABLE" if ok else "PARKED (broker)"
                        why = ("" if ok else
                               f" — |basis| {abs(basis):.3f}% / spread {fnum(spread, 3)}% outside limits")
                    else:
                        m_entry = m_stop = None
                        m_tgts = []
                        status = "PARKED (broker feed dead — DIR-0003)"
                        why = ""
                    # ---- size from broker spec (0.5% equity risk mandate)
                    lots = risk_act = None
                    if spec and risk_usd:
                        ts_, tv = spec.get("tickSize") or 0, spec.get("tickValue") or 0
                        if ts_ > 0 and tv > 0:
                            dist = abs((m_stop or stop) - (m_entry or entry))
                            lpl = dist / ts_ * tv
                            if lpl > 0:
                                step = spec.get("volumeStep") or 0.01
                                lots = max(spec.get("volumeMin") or 0.01,
                                           int(risk_usd / lpl / step + 0.5) * step)
                                lots = round(min(lots, spec.get("volumeMax") or lots), 6)
                                risk_act = lots * lpl
                    ap(f"- **{sym} {bias} LIMIT — {status}**{why}")
                    ap(f"  - entry (perp): **{fmt(sym, entry)}** — {confl} "
                       f"({(entry / price - 1) * 100:+.2f}% from spot)"
                       + (f" → broker {fmt(sym, m_entry)}" if m_entry else ""))
                    ap(f"  - stop (perp): {fmt(sym, stop)} — {stop_src} · 1R = {fnum(risk_dist, 4)}"
                       + (f" → broker {fmt(sym, m_stop)}" if m_stop else "")
                       + (" · SHORT SL triggers on ASK" if bias == "SHORT" else ""))
                    for i, lv in enumerate(tgts, 1):
                        t = lv["price"]
                        ap(f"  - T{i} (perp): {fmt(sym, t)} — magnet str {lv['strength']:.0f} "
                           f"{lv.get('lev', '')} ~${fnum((lv.get('usd') or 0) * t / 1e6, 0)}M est · "
                           f"{abs(entry - t) / risk_dist:.2f}R"
                           + (f" → broker {fmt(sym, m_tgts[i - 1])}" if m_tgts else ""))
                    if lots and eq:
                        ap(f"  - size: {fnum(lots, 2)} lots → risk ${fnum(risk_act, 2)} = "
                           f"{risk_act / eq * 100:.2f}% equity (mandate 0.5%)")
                    else:
                        ap("  - size: broker spec unavailable (feed dead) — compute at placement")
                    if status.startswith("PLACEABLE"):
                        ap("  - next: fresh round-engine pass (debate gates + live basis stamp) → "
                           "DIR for manual MT5 placement")
                    # ---- v3 mandate: WRITTEN justification, not just numbers
                    ap("")
                    ap("  **WHY THIS TRADE**")
                    ap(f"  - *Thesis*: {ns}×{bias} vs {nl}×{'LONG' if bias == 'SHORT' else 'SHORT'} "
                       f"scorecard · 24h footprint Δ {fnum(fpx.get('net24h'), 0)} "
                       f"({'sell' if (fpx.get('net24h') or 0) < 0 else 'buy'}-dominant) · "
                       f"CVD quadrant {(k or {}).get('quadrant', '?')} → "
                       f"{'sellers' if bias == 'SHORT' else 'buyers'} control the tape — we work the "
                       f"{bias} only from the pullback zone, never at market.")
                    zc = ""
                    if price and vwap and sd1:
                        zc = f" (spot {fmt(sym, price)} sits {(price - vwap) / sd1:+.2f}σ vs VWAP)"
                    ap(f"  - *Entry {fmt(sym, entry)}*: {confl} — nearest confluence of "
                       f"{', '.join(n for n, _ in zone)}{zc}; that is "
                       f"{(entry / price - 1) * 100:+.2f}% away — a paid-for "
                       f"{'bounce into supply' if bias == 'SHORT' else 'dip into demand'}, not a chase.")
                    shield_txt = "" if "VWAP" in (stop_src or "") else " + VWAP±2σ shield"
                    ap(f"  - *Stop {fmt(sym, stop)}*: {stop_src}{shield_txt} → 1R = "
                       f"{fnum(risk_dist, 4)}; the idea is wrong only if price "
                       f"{'reclaims the 2σ premium band' if bias == 'SHORT' else 'loses the 2σ discount band'}, "
                       f"not on noise." + (f" Broker stop {fmt(sym, m_stop)}." if m_stop else ""))
                    if tgts:
                        tstr = " · ".join(
                            f"T{i + 1} {fmt(sym, t['price'])} str {t['strength']:.0f} "
                            f"(~${fnum((t.get('usd') or 0) * t['price'] / 1e6, 0)}M est)"
                            for i, t in enumerate(tgts))
                        ap(f"  - *Targets*: liquidation-magnet clusters (engine rule str≥40) — {tstr}; "
                           f"price is structurally drawn there to unwind that leverage.")
                    ap("  - *Size*: 0.5% equity mandate → "
                       + (f"{fnum(lots, 2)} lots risks ${fnum(risk_act, 2)} of ${fnum(eq, 2)}."
                          if lots and risk_act else "computed at placement (broker spec pending)."))
                    risks = []
                    dv_ = fpx.get("div")
                    if dv_ and ("BULLISH" in dv_) == (bias == "SHORT"):
                        risks.append(f"{dv_} = counter-trend pressure live → limit-only, cancel if it persists")
                    fr_ = ((d["funding"] or {}).get("aggregate") or {}).get("fundingPct8h")
                    if fr_ is not None and fr_ < -0.003 and bias == "SHORT":
                        risks.append("shorts pay funding (crowded-short squeeze fuel)")
                    tot_ = ((d["liq"] or {}).get("stats") or {}).get("totals") or {}
                    if bias == "SHORT" and tot_.get("short") and tot_.get("long") and \
                            tot_["short"] > 1.2 * tot_["long"]:
                        risks.append(f"short-squeeze fuel {fnum(tot_['short'] / max(tot_['long'], 1e-9), 1)}× longs")
                    risks.append("all desk candidates share one risk-off tape — cap NEW entries at 1-2")
                    ap("  - *Invalidation*: " + "; ".join(risks) + ".")
                    # ---- fill trade card (digest + broadcast layer)
                    card["status"] = status
                    card["reason"] = (why.strip(" —") or None) if "PLACEABLE" not in status else None
                    card["entry"], card["entry_b"], card["confl"] = entry, m_entry, confl
                    card["stop"], card["stop_b"], card["stop_src"] = stop, m_stop, stop_src
                    card["tgts"] = [{"price": lv["price"], "str": round(lv.get("strength") or 0),
                                     "usd_m": fnum((lv.get("usd") or 0) * lv["price"] / 1e6, 0)} for lv in tgts]
                    card["r1"] = round(r1, 2)
                    card["lots"], card["risk_usd"] = lots, risk_act
                    if risk_act and eq:
                        card["risk_pct"] = round(risk_act / eq * 100, 2)
                        if card["risk_pct"] > 0.5:
                            card["caveat"] = (f"lot-step/min-lot floor makes real risk {card['risk_pct']}% "
                                              f"> 0.5% mandate — SKIP unless the user explicitly accepts")
                    if "feed dead" in status:
                        card["recovery"] = "needs the broker feed restored (DIR-0003) — levels stay valid on the perp side"
                    else:
                        card["recovery"] = (f"re-check when |basis| ≤ 0.5% and spread ≤ 0.15% "
                                            f"(now basis {basis:+.3f}% / spread {fnum(spread, 3)}%)")
                    card["why"] = [
                        f"Thesis: {ns}×{bias} vs {nl}×{'LONG' if bias == 'SHORT' else 'SHORT'} scorecard · "
                        f"24h Δ {fnum(fpx.get('net24h'), 0)} ({'sell' if (fpx.get('net24h') or 0) < 0 else 'buy'}-dominant) · "
                        f"CVD quadrant {(k or {}).get('quadrant', '?')}",
                        f"Entry {fmt(sym, entry)} ({confl}, {(entry / price - 1) * 100:+.2f}% from spot): a paid-for "
                        f"{'bounce into supply' if bias == 'SHORT' else 'dip into demand'} — never chase",
                        f"Stop {fmt(sym, stop)} ({stop_src}): the idea is wrong only beyond the "
                        f"{'2σ premium band' if bias == 'SHORT' else '2σ discount band'}, not on noise",
                        "Targets: " + " · ".join(f"T{i + 1} {fmt(sym, t['price'])} str{t['strength']:.0f}"
                                                  for i, t in enumerate(tgts)) +
                        " (liquidation magnets price is structurally drawn to unwind)",
                        "Size: " + (f"{fnum(lots, 2)} lots → ${fnum(risk_act, 2)} = {card['risk_pct']}% of ${fnum(eq, 2)}"
                                    if lots and risk_act else "computed at placement (broker spec pending)"),
                        "Invalidation: " + "; ".join(risks),
                    ]
    else:
        ap("- **no candidate** — NO-TRADE verdict (§8 dimensions disagree). "
           "Manifest below still accounts for every tab.")
        status, why_out = "NO-TRADE", "scorecard dimensions disagree"
        card["status"], card["reason"] = status, why_out
        card["recovery"] = "re-scan after the next impulse or when 2+ dimensions flip — do not force setups in a transition tape"

    # ---- evidence manifest v3: EVERY fetched tab, verdict + WRITTEN justification
    m = d["market"] or {}
    ema, rsi = m.get("ema") or {}, m.get("rsi") or {}
    mon = (m.get("auction") or {}).get("month") or {}

    def stk(t):
        e = ema.get(t) or {}
        return "▲" if e.get("e13", 0) > e.get("e89", 0) > e.get("e233", 0) else (
            "▼" if e.get("e13", 0) < e.get("e89", 0) < e.get("e233", 0) else "◆")

    S = bias

    def vv(sup):
        """verdict: ✓ supports the bias, ✗ opposes, ○ neutral/context."""
        if S is None or sup is None:
            return "○"
        return "✓" if sup else "✗"

    ap("")
    ap("### Evidence manifest — every fetched tab, justified against THIS verdict")
    ap("| tab | reading | ✓/✗ | justification — how it feeds the decision |")
    ap("|---|---|---|---|")

    # 1 · EMA stacks
    reading1 = " ".join(stk(t) + t for t in ("m15", "h1", "h4", "d1"))
    n_al = sum(1 for t in ("m15", "h1", "h4", "d1")
               if stk(t) == ("▼" if S == "SHORT" else "▲")) if S else 0
    if S:
        v1 = vv(n_al >= 3)
        j1 = (f"{n_al}/4 stacks aligned {S.lower()} — the pullback entry works WITH the higher-TF trend"
              if n_al >= 3 else
              f"only {n_al}/4 stacks aligned {S.lower()} — trend conviction partial: half-size or stand down")
    else:
        v1, j1 = "○", "mixed multi-TF stacks — a core reason the scorecard cannot resolve"
    ap(f"| market·EMA | {reading1} | {v1} | {j1} |")

    # 2 · RSI
    r4 = rsi.get("h4")
    if S and r4 is not None:
        if S == "SHORT":
            if r4 < 30:
                v2, j2 = "✓", (f"h4 {fnum(r4, 1)} oversold — the bounce INTO our limit is the expected "
                                "entry trigger; never chase the low")
            elif r4 < 45:
                v2, j2 = "✓", f"h4 {fnum(r4, 1)} weak momentum — room to extend lower once the pullback fades"
            else:
                v2, j2 = "✗", f"h4 {fnum(r4, 1)} recovering — bounce may overshoot the zone; wait for the level"
        else:
            if r4 > 70:
                v2, j2 = "✓", (f"h4 {fnum(r4, 1)} overbought — the dip INTO our limit is the expected "
                                "entry trigger; never chase the high")
            elif r4 > 55:
                v2, j2 = "✓", f"h4 {fnum(r4, 1)} strong momentum — room to extend higher once the pullback fades"
            else:
                v2, j2 = "✗", f"h4 {fnum(r4, 1)} still weak — bounce may fail before reaching the zone"
    else:
        v2, j2 = "○", f"h4 {fnum(r4, 1)} — momentum context only (no trade constructed)"
    ap(f"| market·RSI | h4 {fnum(r4, 1)} · d1 {fnum(rsi.get('d1'), 1)} | {v2} | {j2} |")

    # 3 · VWAP z-score
    zsc = ((price - vwap) / sd1) if (price and vwap and sd1) else None
    zstr = f"{zsc:+.2f}σ" if zsc is not None else "?"
    if S == "SHORT" and zsc is not None:
        v3_ = vv(zsc < 0)
        j3 = (f"price {zstr} vs VWAP {fmt(sym, vwap)} — discount regime; "
              + (f"entry {fmt(sym, entry)} re-tests fair value from below, where supply sits" if entry
                 else "wait for the re-test of fair value from below"))
    elif S == "LONG" and zsc is not None:
        v3_ = vv(zsc > 0)
        j3 = (f"price {zstr} vs VWAP {fmt(sym, vwap)} — premium regime; "
              + (f"entry {fmt(sym, entry)} buys the pullback to fair value" if entry
                 else "wait for the pullback to fair value"))
    else:
        v3_, j3 = "○", f"VWAP {fmt(sym, vwap)} (σ1 {fmt(sym, sd1)}) — location context only"
    ap(f"| market·VWAP | {fmt(sym, vwap)} (σ1 {fmt(sym, sd1)}) · price {zstr} | {v3_} | {j3} |")

    # 4 · day auction profile
    if S and entry:
        near4 = []
        if day.get("vah") and abs(entry - day["vah"]) <= 0.4 * (sd1 or 1):
            near4.append("VAH")
        if day.get("poc") and abs(entry - day["poc"]) <= 0.4 * (sd1 or 1):
            near4.append("day POC")
        v4 = "✓"
        j4 = (f"entry sits on the {'+'.join(near4)} — the value-area edge/POC is where mean-reversion "
              f"supply defends; {'selling the re-entry into value' if S == 'SHORT' else 'buying the re-entry into value'}"
              if near4 else "day POC/VAH/VAL confluence shapes the pullback zone")
    else:
        v4, j4 = "○", "day POC/VAH/VAL recorded — value context for any future construction"
    ap(f"| auction·day | POC {fmt(sym, day.get('poc'))} · VAH {fmt(sym, day.get('vah'))} · "
       f"VAL {fmt(sym, day.get('val'))} | {v4} | {j4} |")

    # 5 · month auction profile
    mpoc = mon.get("poc")
    if mpoc and price:
        side5 = "above" if mpoc > price else "below"
        j5 = (f"month POC {fmt(sym, mpoc)} sits {side5} spot — higher-TF value "
              + ("caps rallies (macro supply overhead)" if side5 == "above"
                 else "floors dips (macro demand beneath)")
              + " — context weight only")
    else:
        j5 = "month profile unavailable"
    ap(f"| auction·month | POC {fmt(sym, mpoc)} | ○ | {j5} |")

    # 6 · footprint delta
    n24 = fpx.get("net24h") or 0
    if S:
        sup6 = (n24 < 0) if S == "SHORT" else (n24 > 0)
        v6 = vv(sup6)
        j6 = (f"24h Δ {fnum(n24, 0)} contracts {'sell' if n24 < 0 else 'buy'}-dominant — "
              + ("confirms persistent sellers behind the bias" if sup6
                 else "OPPOSES the bias — flow does not support this direction; stand down or half-size"))
    else:
        v6, j6 = "○", f"24h Δ {fnum(n24, 0)} — flow context for the NO-TRADE split"
    ap(f"| footprint·Δ | 6h {fnum(fpx.get('net6h'), 0)} · 24h {fnum(n24, 0)} | {v6} | {j6} |")

    # 7 · typed footprint events
    evts = fpx.get("events") or []
    last_ev = evts[-1]["what"].split(" (")[0] if evts else "none — clean tape"
    if evts and S:
        last7 = evts[-1]
        sell7 = "sell" in last7["what"]
        lc7 = last7.get("c")
        near7 = bool(entry and lc7 and abs(lc7 - entry) <= 0.03 * entry)
        sup7 = sell7 if S == "SHORT" else (not sell7)
        v7 = vv(sup7)
        j7 = (f"last typed event {last7['what']} @ {fmt(sym, lc7)}"
              + (" — liquidity was defended RIGHT AT our zone → strong level confirmation" if near7
                 else f" — fresh {'sell' if sell7 else 'buy'}-side activity, timing context"))
    elif evts:
        v7, j7 = "○", f"{len(evts)} typed events 12h — timing context only (no trade constructed)"
    else:
        v7, j7 = "○", "clean tape — no fresh absorption/exhaustion to time against; levels + magnets carry the plan"
    ap(f"| footprint·events | {len(evts)} typed (12h) · last: {last_ev} | {v7} | {j7} |")

    # 8 · delta divergence
    dv8 = fpx.get("div")
    if dv8 and S:
        bull8 = "BULLISH" in dv8
        sup8 = bull8 if S == "LONG" else (not bull8)
        v8 = vv(sup8)
        j8 = (f"{dv8} — flow divergence confirms the {S} case" if sup8 else
              f"{dv8} — counter-trend pressure is LIVE: limit-only at the premium zone, never market; "
              f"cancel if it persists through the next impulse")
    elif dv8:
        v8, j8 = "○", f"{dv8} — recorded; no trade to apply it to"
    else:
        v8, j8 = "○", "no Δ-divergence — trend and flow agree"
    ap(f"| footprint·Δdiv | {dv8 or 'none'} | {v8} | {j8} |")

    # 9 · POC migration
    sl9 = fpx.get("pocSlope") or 0
    if S:
        sup9 = (sl9 < 0) if S == "SHORT" else (sl9 > 0)
        v9 = vv(sup9)
        j9 = (f"value migrating {'DOWN: sellers persistent' if sl9 < 0 else 'UP: buyers persistent'} → "
              + ("confirms direction persistence" if sup9 else "opposes the bias — value migrates against us"))
    else:
        v9, j9 = "○", "migration context only"
    ap(f"| footprint·POCmigr | {fnum(sl9, 2)} bp/bar | {v9} | {j9} |")

    # 10 · CVD + 11 · CVD divergence
    if k:
        pc10 = k.get("perpCvd") or 0
        if S:
            sup10 = (pc10 < 0) if S == "SHORT" else (pc10 > 0)
            v10 = vv(sup10)
            j10 = (f"quadrant {k.get('quadrant')}, taker-buy {fnum(k.get('buyRatio'), 1)}% — aggressor flow "
                   f"{'sells' if pc10 < 0 else 'buys'} → {'confirms' if sup10 else 'OPPOSES'} who controls the tape")
        else:
            v10, j10 = "○", "quadrant context for the NO-TRADE split"
        ap(f"| cvd | perp {fnum(pc10, 0)} · spot {fnum(k.get('spotCvd'), 0)} · "
           f"{k.get('quadrant', '?')} · taker-buy {fnum(k.get('buyRatio'), 1)}% | {v10} | {j10} |")
        ld = k.get("latestDiv")
        if ld:
            fresh = (time.time() - ld.get("ts", 0) / 1000) / 3600 < 6
            if S and fresh:
                bear11 = "bear" in (ld.get("type") or "").lower()
                sup11 = bear11 if S == "SHORT" else (not bear11)
                v11 = vv(sup11)
                j11 = (f"{ld.get('type')} @ {fmt(sym, ld.get('price'))} is FRESH → timing "
                       f"{'confirms' if sup11 else 'warns against'} the entry window")
            else:
                v11, j11 = "○", (f"{ld.get('type')} @ {fmt(sym, ld.get('price'))} "
                                 f"({'fresh' if fresh else 'stale'}) — no active timing weight")
            ap(f"| cvd·div | {ld.get('type')} | {v11} | {j11} |")
        else:
            ap("| cvd·div | none | ○ | no CVD divergence recorded |")
    else:
        ap("| cvd | unavailable (venue gap) | ○ | no CVD — direction read relies on footprint + magnets |")

    # 12 · typed micro signals
    b12 = cnt.get("bullish", 0) or 0
    s12 = cnt.get("bearish", 0) or 0
    if S and (b12 + s12) > 0:
        sup12 = (s12 > b12) if S == "SHORT" else (b12 > s12)
        thin12 = abs(b12 - s12) / (b12 + s12) < 0.15
        v12 = "○" if thin12 else vv(sup12)
        j12 = (f"bull {b12} vs bear {s12} typed micro-events — "
               + ("micro-flow leans our way" if sup12 else "micro-flow leans AGAINST the bias — flagged honestly")
               + (" (margin thin → neutral weight)" if thin12 else ""))
    else:
        v12, j12 = "○", "no typed micro events — neutral"
    ap(f"| signals·micro | bull {b12} / bear {s12} (24h events listed §3) | {v12} | {j12} |")

    # 13 · funding
    fr13 = ((d["funding"] or {}).get("aggregate") or {}).get("fundingPct8h")
    if fr13 is not None and S:
        if fr13 > 0.003:
            v13 = vv(S == "SHORT")
            j13 = f"+{fnum(fr13, 4)}%/8h — longs pay: crowded longs are liquidation fuel DOWN; shorts collect carry"
        elif fr13 < -0.003:
            v13 = vv(S == "LONG")
            j13 = f"{fnum(fr13, 4)}%/8h — shorts pay: crowded shorts are squeeze fuel UP against a short"
        else:
            v13, j13 = "○", f"{fnum(fr13, 4)}%/8h neutral — no squeeze fuel either way"
    else:
        v13, j13 = "○", f"{fnum(fr13, 4)}%/8h — positioning context only"
    ap(f"| funding | {fnum(fr13, 4)}%/8h OI-weighted | {v13} | {j13} |")

    # 14 · open interest × price
    oagg = (d["oi"] or {}).get("aggregate") or {}
    d24_ = oagg.get("oiDelta24hPct")
    chg14 = (m.get("price") or {}).get("chgDayPct") or 0
    if d24_ is not None and S:
        if chg14 < 0 and d24_ < 0:
            combo14, sup14 = "price↓ + OI↓ → forced long liquidation", (S == "SHORT")
        elif chg14 < 0 and d24_ > 0:
            combo14, sup14 = "price↓ + OI↑ → fresh shorts entering (continuation fuel, squeeze risk)", (S == "SHORT")
        elif chg14 > 0 and d24_ > 0:
            combo14, sup14 = "price↑ + OI↑ → new longs (bull confirmation)", (S == "LONG")
        else:
            combo14, sup14 = "price↑ + OI↓ → short-covering (weak rally)", (S == "SHORT")
        v14 = vv(sup14)
        j14 = f"{combo14} → {'supports' if sup14 else 'opposes'} the {S} case"
    else:
        v14, j14 = "○", "OI context only"
    ap(f"| oi | ${fnum((oagg.get('oiUsd') or 0) / 1e9, 2)}B · Δ1h {fnum(oagg.get('oiDelta1hPct'), 2)}% · "
       f"Δ24h {fnum(d24_, 2)}% | {v14} | {j14} |")

    # 15 · liquidation magnets
    ab15 = kl.get("above") or []
    be15 = kl.get("below") or []
    if S == "SHORT":
        fuel15, grav15 = be15, ab15
    elif S == "LONG":
        fuel15, grav15 = ab15, be15
    else:
        fuel15, grav15 = [], []
    if S and entry:
        if tgts:
            v15 = "✓"
            j15 = (f"{len(fuel15)} magnets on the profit side — T1 {fmt(sym, tgts[0]['price'])} str "
                   f"{tgts[0]['strength']:.0f} (~${fnum((tgts[0].get('usd') or 0) * tgts[0]['price'] / 1e6, 0)}M est) "
                   f"is the structural target; {len(grav15)} magnets on the entry side give the pullback "
                   f"somewhere to travel to")
        else:
            v15 = "✗"
            j15 = "no magnet str≥40 on the profit side → no structural target → " + (why_out or "rejected")
    else:
        v15, j15 = "○", (f"{len(ab15)} above / {len(be15)} below tracked — magnet map recorded "
                          "(no construction to attach)")
    ap(f"| liq·magnets | above {len(ab15)} / below {len(be15)} tracked (§5) | {v15} | {j15} |")

    # 16 · squeeze fuel
    tot16 = ((d["liq"] or {}).get("stats") or {}).get("totals") or {}
    if tot16.get("short") and tot16.get("long"):
        div_ = 1 if sym in ("XAU", "XAG") else 1000
        ratio16 = tot16["short"] / max(tot16["long"], 1e-9)
        read16 = (f"shorts {fnum(tot16['short'] / div_, 1)}K vs longs {fnum(tot16['long'] / div_, 1)}K "
                  f"({fnum(ratio16, 1)}×)")
        if S and ratio16 > 1.2:
            v16 = vv(S == "LONG")
            j16 = ("short-squeeze fuel dominates — a squeeze would run a SHORT stop: stop discipline mandatory"
                   if S == "SHORT" else "upside squeeze fuel accelerates LONG targets")
        elif S and ratio16 < 0.8:
            v16 = vv(S == "SHORT")
            j16 = ("downside long-liquidation fuel dominates — accelerates SHORT targets"
                   if S == "SHORT" else "long-liquidation fuel dominates — would run our LONG stop")
        elif S:
            v16, j16 = "○", "squeeze fuel balanced — no dominant side"
        else:
            v16, j16 = "○", "squeeze-fuel context for the NO-TRADE split"
    else:
        read16, v16, j16 = "totals unavailable", "○", "squeeze-fuel totals unavailable upstream"
    ap(f"| liq·squeeze | {read16} | {v16} | {j16} |")

    # 17 · whale walls (LTO)
    walls = []
    for g in (d["lto"] or {}).get("groups", []):
        for o in g.get("list", []):
            if (o.get("currentUsd") or 0) >= 5e6 and price and abs(o["price"] - price) / price < 0.04:
                walls.append(o)
    if walls and S:
        w0 = max(walls, key=lambda o: o.get("currentUsd") or 0)
        p0 = w0["price"]
        m0 = (w0.get("currentUsd") or 0) / 1e6
        is_ask = w0.get("side") == 1
        read17 = f"{len(walls)} ≥$5M in ±4% · biggest {'ASK' if is_ask else 'BID'} ${fnum(m0, 1)}M @ {fmt(sym, p0)}"
        if is_ask and p0 > (price or 0):
            if S == "SHORT":
                v17, j17 = "✓", (f"biggest wall ASK ${fnum(m0, 1)}M @ {fmt(sym, p0)} — caps the bounce toward "
                                  "our entry (fill help) and defends overhead")
            else:
                v17, j17 = "✗", f"biggest wall ASK ${fnum(m0, 1)}M @ {fmt(sym, p0)} — supply overhead resists the LONG path"
        elif (not is_ask) and p0 < (price or 0):
            if S == "LONG":
                v17, j17 = "✓", (f"biggest wall BID ${fnum(m0, 1)}M @ {fmt(sym, p0)} — floors the dip toward "
                                  "our entry (fill help) and defends beneath")
            else:
                v17, j17 = "✗", f"biggest wall BID ${fnum(m0, 1)}M @ {fmt(sym, p0)} — demand beneath absorbs the SHORT push"
        else:
            v17, j17 = "○", (f"biggest wall ${fnum(m0, 1)}M @ {fmt(sym, p0)} sits on the profit side — "
                             "may absorb the first touch; ladder exits")
    elif walls:
        read17 = f"{len(walls)} ≥$5M in ±4%"
        v17, j17 = "○", "wall map recorded — no construction to attach"
    else:
        read17, v17, j17 = "none ≥$5M in ±4%", "○", "no whale walls near price — levels rely on magnets/σ bands"
    ap(f"| lto·walls | {read17} | {v17} | {j17} |")

    # 18 · book walls
    bwm = (d["book"] or {}).get("model") or {}
    if bwm:
        imb18 = bwm.get("imbalance")
        imb5 = bwm.get("imbalance5mAgo")
        read18 = f"imb {fnum(imb18, 3)} (5m ago {fnum(imb5, 3)})"
        if S and imb18 is not None:
            if S == "SHORT":
                sup18 = (imb18 or 0) < 0
                j18 = (f"imbalance {fnum(imb18, 3)} (5m ago {fnum(imb5, 3)}) — "
                       + ("ask-heavy book → supply supports the short" if sup18
                          else "bid-heavy book → dip demand may slow the decline; watch the zone"))
            else:
                sup18 = (imb18 or 0) > 0
                j18 = (f"imbalance {fnum(imb18, 3)} (5m ago {fnum(imb5, 3)}) — "
                       + ("bid-heavy book → demand supports the long" if sup18
                          else "ask-heavy book → overhead supply may cap the rally; watch the zone"))
            v18 = vv(sup18)
        else:
            v18, j18 = "○", "depth-imbalance context only"
    else:
        read18, v18, j18 = "unavailable", "○", "book model unavailable"
    ap(f"| bookwalls | {read18} | {v18} | {j18} |")

    # 19 · stopmap
    if sym == "BTC":
        ap("| stopmap | stop heat above/below in §5 | ○ | stop-cluster context — heat concentration warns "
           "where stops get swept (BTC-only upstream) |")
    else:
        ap("| stopmap | n/a — upstream BTC-only (known gap) | ○ | not fetched for this symbol — marked, not dropped |")

    # 20 · news
    nws = d["news"] or []
    askn = sum(1 for n in nws if "ask wall" in (n.get("title") or "").lower())
    bidn = sum(1 for n in nws if "bid wall" in (n.get("title") or "").lower())
    if S and (askn or bidn):
        if S == "SHORT":
            v20 = vv(askn > bidn)
            j20 = (f"{len(nws)} items 24h — {askn} whale-ASK-wall vs {bidn} BID flags: "
                   + ("supply confirmed overhead" if askn > bidn else "demand reported beneath — caution"))
        else:
            v20 = vv(bidn > askn)
            j20 = (f"{len(nws)} items 24h — {bidn} whale-BID-wall vs {askn} ASK flags: "
                   + ("demand confirmed beneath" if bidn > askn else "supply reported overhead — caution"))
    else:
        v20, j20 = "○", f"{len(nws)} items 24h — invalidation watch only"
    ap(f"| news | {len(nws)} items 24h (§6) | {v20} | {j20} |")

    # 21 · broker gate
    if basis is not None:
        ok21 = abs(basis) <= 0.5 and (spread if spread is not None else 9) <= 0.15
        v21 = "✓" if ok21 else "✗"
        j21 = (f"basis {basis:+.3f}% (translation {'negligible' if abs(basis) < 0.05 else 'MUST be applied to every level'}), "
               f"spread {fnum(spread, 3)}% → "
               + ("GATE PASSED — tradeable now" if ok21
                  else "GATE FAILED — PARKED until basis/spread normalize (levels stay valid on the perp side)")
               + ("; SHORT SL triggers on ASK — the real stop distance is the ask-side distance" if S == "SHORT" else ""))
        read21 = (f"basis {basis:+.3f}% · spread {fnum(spread, 3)}% · "
                  f"{len(mt.get('positions') or [])} pos / {len(mt.get('orders') or [])} orders")
    else:
        read21, v21, j21 = "feed dead (no tick — DIR-0003)", "✗", \
            "cannot translate levels or check spread → PARKED, not pitched"
    ap(f"| broker | {read21} | {v21} | {j21} |")
    return L, card


# ------------------------------------------------------------------ report
def deep_report(sym):
    d = fetch_all(sym)
    m = d["market"] or {}
    price = (m.get("price") or {}).get("last")
    ema, rsi = m.get("ema") or {}, m.get("rsi") or {}
    vw = m.get("vwap") or {}
    vwap, bands = vw.get("vwap"), vw.get("bands") or {}
    sd1 = bands.get("sd1") or (price * 0.005 if price else None)
    auc = m.get("auction") or {}
    day, mon = auc.get("day") or {}, auc.get("month") or {}
    L = []
    ap = L.append

    ap(f"# 360° DEEP SCAN · {sym} · {now_iso}")
    ap("")
    ap(f"**Price {fmt(sym, price)}** · day {fnum((m.get('price') or {}).get('chgDayPct'), 2)}% · "
       f"VWAP {fmt(sym, vwap)} (σ1 {fmt(sym, sd1)}) · z={(price - vwap) / sd1:+.2f}σ" if price and vwap and sd1 else
       f"**Price {fmt(sym, price)}**")
    if d["errors"]:
        ap(f"\n> data gaps: {'; '.join(d['errors'])}")
    ap("")

    # 1 — trend & regime
    ap("## 1 · Trend & regime (all timeframes)")
    for tf in ("m15", "h1", "h4", "d1"):
        e = ema.get(tf) or {}
        if e:
            stack = "▲ bull" if e.get("e13", 0) > e.get("e89", 0) > e.get("e233", 0) else \
                    ("▼ bear" if e.get("e13", 0) < e.get("e89", 0) < e.get("e233", 0) else "◆ mixed")
            ap(f"- **{tf}**: {stack} · e13 {fmt(sym, e.get('e13'))} / e89 {fmt(sym, e.get('e89'))} / "
               f"e233 {fmt(sym, e.get('e233'))} · RSI {fnum(rsi.get(tf), 1)}")
    if price and vwap and sd1:
        z = (price - vwap) / sd1
        regime = "TREND (EMA stack aligned)" if all(
            (ema.get(tf, {}).get('e13', 0) or 0) > (ema.get(tf, {}).get('e89', 0) or 0)
            for tf in ("h4", "d1")) or all(
            (ema.get(tf, {}).get('e13', 0) or 0) < (ema.get(tf, {}).get('e89', 0) or 0)
            for tf in ("h4", "d1")) else "RANGE/TRANSITION (EMA stack mixed)"
        ap(f"- price vs VWAP: {z:+.2f}σ → {'premium' if z > 0 else 'discount'} regime · {regime}")
    if day:
        ap(f"- day profile: POC {fmt(sym, day.get('poc'))} · VAH {fmt(sym, day.get('vah'))} · "
           f"VAL {fmt(sym, day.get('val'))}" + (f" · month POC {fmt(sym, mon.get('poc'))}" if mon.get("poc") else ""))
    ap("")

    # 2 — candle history & footprint forensics
    ap("## 2 · Recent candle history + footprint forensics (m15)")
    fp = d["fp"] or {}
    fpx = fp_forensics(sym, fp, price)
    if fpx["bars"]:
        ap("| time | O | H | L | C | Δ (buy−sell) | vol | bar-POC | CPR |")
        ap("|---|---|---|---|---|---|---|---|---|")
        for r in fpx["bars"][-16:]:
            ap(f"| {hhmm(r['ts'])} | {fmt(sym, r['o'])} | {fmt(sym, r['h'])} | {fmt(sym, r['l'])} | "
               f"{fmt(sym, r['c'])} | {fnum(r['delta'], 1)} | {fnum(r['vol'], 0)} | {fmt(sym, r['poc'])} | "
               f"{r['cpr']:.2f} |")
        ap(f"\n- net footprint Δ: 6h {fnum(fpx['net6h'], 0)} · 24h {fnum(fpx['net24h'], 0)} "
           f"({'buy-side dominance' if fpx['net24h'] > 0 else 'sell-side dominance'})")
        if fpx["div"]:
            ap(f"- divergence: **{fpx['div']}**")
        ap(f"- bar-POC migration (20 bars): {fnum(fpx['pocSlope'], 2)} bp/bar "
           f"({'value migrating UP — buyers persistent' if fpx['pocSlope'] > 0 else 'value migrating DOWN — sellers persistent'})")
        if fpx["events"]:
            ap("- typed events (12h):")
            for e in fpx["events"][-8:]:
                ap(f"  - {hhmm(e['ts'])} @ {fmt(sym, e['c'])} · {e['what']} (Δ {fnum(e['delta'], 0)})")
        else:
            ap("- typed events (12h): none — clean tape")
    else:
        ap("- no footprint data (venue gap)")
    ap("")

    # 3 — order flow
    ap("## 3 · Order flow")
    c = d["cvd"] or {}
    k = c.get("kpis", {})
    if k:
        ap(f"- CVD: perp {fnum(k.get('perpCvd'), 0)} · spot {fnum(k.get('spotCvd'), 0)} · "
           f"taker-buy {fnum(k.get('buyRatio'), 1)}% · quadrant **{k.get('quadrant', '?')}** · "
           f"hit-rate {fnum(k.get('hitRate'), 0)}%")
        ld = k.get("latestDiv")
        if ld:
            ts = ld.get("ts", 0) / 1000
            age_h = (time.time() - ts) / 3600
            ap(f"- latest CVD divergence: {ld.get('type')} @ {fmt(sym, ld.get('price'))} "
               f"({fnum(age_h, 1)}h ago — {'fresh' if age_h < 6 else 'stale'})")
    s = d["signals"] or {}
    cnt = s.get("counts") or {}
    ap(f"- signal footprint: bull {cnt.get('bullish', 0)} / bear {cnt.get('bearish', 0)}")
    ev = []
    for st in s.get("sets", []):
        for sig in st.get("sigs", []):
            ts = sig.get("ts", 0)
            ts = ts / 1000 if ts > 1e12 else ts
            if time.time() - ts < 24 * 3600:
                ev.append(sig)
    if ev:
        ev.sort(key=lambda x: -x.get("ts", 0))
        ap(f"- micro events (24h, {len(ev)}):")
        for sig in ev[:10]:
            ts = sig.get("ts", 0)
            ts = ts / 1000 if ts > 1e12 else ts
            usd = sig.get("u") or (sig.get("q") or 0) * (sig.get("p") or 0)
            ap(f"  - {hhmm(ts)} {sig.get('t', '?')}/{sig.get('side', '?')} @ {fmt(sym, sig.get('p'))}"
               + (f" (~${fnum(usd / 1e6, 1)}M)" if usd > 5e5 else ""))
    else:
        ap("- micro events (24h): none")
    ap("")

    # 3.5 — positioning & funding (Tier-3 gap closed by DIR-0004)
    ap("## 4 · Positioning, funding & open interest")
    fu = d["funding"] or {}
    oi = d["oi"] or {}
    agg = fu.get("aggregate") or {}
    fr = agg.get("fundingPct8h")
    venues = fu.get("venues") or []
    if venues:
        parts = " · ".join(f"{v.get('name')} {fnum((v.get('rate8h') or 0), 4)}%" for v in venues[:4])
        ap(f"- funding (8h): {parts}")
        if fr is not None:
            tag = ("longs paying shorts — crowded longs (squeeze fuel DOWN)" if fr > 0.003 else
                   "shorts paying longs — crowded shorts (squeeze fuel UP)" if fr < -0.003 else
                   "neutral")
            ap(f"- OI-weighted funding: **{fnum(fr, 4)}%/8h** → {tag}")
    else:
        ap("- funding: no venue data")
    oagg = oi.get("aggregate") or {}
    if oagg:
        d1p, d24p = oagg.get("oiDelta1hPct"), oagg.get("oiDelta24hPct")
        chg = (m.get("price") or {}).get("chgDayPct") or 0
        ap(f"- OI: ${fnum((oagg.get('oiUsd') or 0) / 1e9, 2)}B · Δ1h {fnum(d1p, 2)}% · Δ24h {fnum(d24p, 2)}%")
        if d24p is not None:
            combo = ("price↓ + OI↓ → forced long liquidation (bear confirmation)" if chg < 0 and d24p < 0 else
                     "price↓ + OI↑ → fresh shorts entering (trend continuation fuel)" if chg < 0 and d24p > 0 else
                     "price↑ + OI↑ → new longs (bull confirmation)" if chg > 0 and d24p > 0 else
                     "price↑ + OI↓ → short covering rally (weak rally)")
            ap(f"- OI×price read: {combo}")
    else:
        ap("- OI: no venue data")
    pos = ((d["mt5"] or {}).get("positioning") or {}).get(sym)
    if pos:
        ap(f"- daemon positioning block: {json.dumps(pos)[:200]}")
    ap("")

    # 4 — liquidity map
    ap("## 5 · Liquidity map (Coinglass estimates)")
    liq = (d["liq"] or {}).get("stats") or {}
    kl = liq.get("keyLevels") or {}
    price_ref = price or (liq.get("last") or 0)
    if kl.get("above"):
        ap("- magnets ABOVE:")
        for lvv in kl["above"][:4]:
            ap(f"  - {fmt(sym, lvv['price'])} (+{fnum(lvv.get('distPct'), 2)}%) str {fnum(lvv.get('strength'), 0)} "
               f"{lvv.get('lev', '')} · ~${fnum(lvv.get('usd', 0) * lvv['price'] / 1e6, 0)}M est")
    if kl.get("below"):
        ap("- magnets BELOW:")
        for lvv in kl["below"][:4]:
            ap(f"  - {fmt(sym, lvv['price'])} (−{fnum(abs(lvv.get('distPct', 0)), 2)}%) str {fnum(lvv.get('strength'), 0)} "
               f"{lvv.get('lev', '')} · ~${fnum(lvv.get('usd', 0) * lvv['price'] / 1e6, 0)}M est")
    tot = liq.get("totals") or {}
    if tot.get("short") and tot.get("long"):
        ap(f"- squeeze fuel: shorts {fnum(tot['short'] / (1 if sym in ('XAU', 'XAG') else 1000), 1)}K vs "
           f"longs {fnum(tot['long'] / (1 if sym in ('XAU', 'XAG') else 1000), 1)}K "
           f"({fnum(tot['short'] / max(tot['long'], 1e-9), 1)}× — "
           f"{'upside squeeze fuel dominates' if tot['short'] > tot['long'] else 'downside fuel dominates'})")
    walls = []
    for g in (d["lto"] or {}).get("groups", []):
        for o in g.get("list", []):
            if o.get("currentUsd", 0) >= 5e6 and price and abs(o["price"] - price) / price < 0.04:
                walls.append(o)
    if walls:
        ap("- whale walls ≥$5M within ±4%:")
        for o in sorted(walls, key=lambda x: -x["currentUsd"])[:6]:
            side = "ASK" if o.get("side") == 1 else "BID"
            ap(f"  - {side} ${fnum(o['currentUsd'] / 1e6, 1)}M @ {fmt(sym, o['price'])} "
               f"({(o['price'] / price - 1) * 100:+.2f}%)")
    bwm = (d["book"] or {}).get("model") or {}
    if bwm:
        dp = bwm.get("depth") or {}
        ap(f"- book ±5%: imbalance {fnum(bwm.get('imbalance'), 3)} "
           f"(5m ago {fnum(bwm.get('imbalance5mAgo'), 3)}) · bid ${fnum((dp.get('bidUsd') or 0) / 1e9, 2)}B vs "
           f"ask ${fnum((dp.get('askUsd') or 0) / 1e9, 2)}B")
    if d.get("stopmap"):
        smod = (d["stopmap"] or {}).get("model") or {}
        y = smod.get("y") or []
        lp = smod.get("lastPrice") or price
        above = below = 0.0
        frames = smod.get("grid") or []
        for xi, val in ((frames[-1].get("cells") or []) if frames else []):
            if 0 <= xi < len(y) and y[xi] > (lp or 0):
                above += val
            elif 0 <= xi < len(y):
                below += val
        ap(f"- stopmap heat (BTC, latest frame): stops above ${fnum(above / 1e6, 0)}M vs below ${fnum(below / 1e6, 0)}M est")
    ap("")

    # 5 — news
    ap("## 6 · News & notifications (24h)")
    if d["news"]:
        for n in d["news"][:8]:
            ts = n.get("ts", 0) / 1000
            ap(f"- {hhmm(ts)} [{n.get('severity', '?')}] {n.get('title', '')[:100]}")
    else:
        ap("- none")
    ap("")

    # 6 — broker & exposure
    ap("## 7 · Broker state & current exposure")
    mt = d["mt5"] or {}
    mtsym = f"{sym}USD"
    sp = (mt.get("spreads") or {}).get(mtsym) or {}
    basis, spread = sp.get("basisPct"), sp.get("spreadPct")
    if basis is not None:
        ok = abs(basis) <= 0.5 and (spread or 9) <= 0.15
        ap(f"- {mtsym}: bid {fmt(sym, sp.get('bid'))} / ask {fmt(sym, sp.get('ask'))} · basis {basis:+.3f}% · "
           f"spread {fnum(spread, 3)}% → {'TRADEABLE' if ok else 'BLOCKED (outside limits)'}")
    else:
        ap(f"- {mtsym}: no ticks (feed dead or symbol mismatch — DIR-0003 open)")
    pos = [p for p in (mt.get("positions") or []) if p.get("symbol") == mtsym]
    ords = [o for o in (mt.get("orders") or []) if o.get("symbol") == mtsym]
    for p in pos:
        ap(f"- POSITION: {p.get('type', p.get('side'))} {p.get('volume')} @ {p.get('entry')} "
           f"SL {p.get('sl')} TP {p.get('tp')} · PnL {fnum(p.get('profit'), 2)}")
    for o in ords:
        ap(f"- PENDING: {o.get('ticket')} {o.get('type')} {o.get('volume')} @ {o.get('price')} "
           f"SL {o.get('sl')} TP {o.get('tp')}")
    if not pos and not ords:
        ap("- no live exposure on this symbol")
    ap("")

    # 7 — synthesis
    ap("## 8 · Synthesis — playbook verdict")
    votes = []
    if price and vwap:
        votes.append(("bias", "SHORT" if price < vwap else "LONG"))
    h4e, d1e = ema.get("h4") or {}, ema.get("d1") or {}
    if h4e:
        votes.append(("h4 EMA", "SHORT" if (h4e.get("e13") or 0) < (h4e.get("e89") or 0) else "LONG"))
    if d1e:
        votes.append(("d1 EMA", "SHORT" if (d1e.get("e13") or 0) < (d1e.get("e89") or 0) else "LONG"))
    if k:
        votes.append(("CVD", "SHORT" if (k.get("perpCvd") or 0) < 0 else "LONG"))
    if fpx["net24h"] != 0:
        votes.append(("footprint Δ24h", "SHORT" if fpx["net24h"] < 0 else "LONG"))
    if cnt:
        votes.append(("signals", "SHORT" if cnt.get("bearish", 0) > cnt.get("bullish", 0) else "LONG"))
    fr = ((d["funding"] or {}).get("aggregate") or {}).get("fundingPct8h")
    if fr is not None and abs(fr) > 0.003:
        votes.append(("funding", "SHORT" if fr > 0 else "LONG"))
    oagg = (d["oi"] or {}).get("aggregate") or {}
    d24 = oagg.get("oiDelta24hPct")
    chg = (m.get("price") or {}).get("chgDayPct") or 0
    if d24 is not None and chg < 0 and d24 < 0:
        votes.append(("OI×price", "SHORT"))  # forced long liquidation
    elif d24 is not None and chg < 0 and d24 > 0:
        votes.append(("OI×price", "LONG"))   # crowded fresh shorts — squeeze risk
    n_short = sum(1 for _, v in votes if v == "SHORT")
    n_long = len(votes) - n_short
    bias = None
    ap(f"- scorecard: {n_short}×SHORT vs {n_long}×LONG across {len(votes)} dimensions: "
       + ", ".join(f"{src}={v}" for src, v in votes))
    if abs(n_short - n_long) >= 3 and votes:
        bias = "SHORT" if n_short > n_long else "LONG"
        ap(f"- **bias: {bias}** (playbook 2-of-3 satisfied {'strongly' if abs(n_short - n_long) >= 5 else ''})")
        # candidate levels from data
        if bias == "SHORT" and price:
            zone = []
            if day.get("poc") and day["poc"] > price:
                zone.append(("day POC", day["poc"]))
            if vwap and sd1 and vwap + sd1 > price:
                zone.append(("VWAP+1σ", vwap + sd1))
            tgt = [lv["price"] for lv in (kl.get("below") or []) if lv.get("strength", 0) >= 40][:3]
            ap(f"- pullback zone to attack: {' / '.join(f'{n} {fmt(sym, p)}' for n, p in zone) or 'none clean — wait'}")
            ap(f"- magnet targets below: {', '.join(fmt(sym, t) for t in tgt) or 'none ≥str40'}")
        elif bias == "LONG" and price:
            zone = []
            if day.get("poc") and day["poc"] < price:
                zone.append(("day POC", day["poc"]))
            if vwap and sd1 and vwap - sd1 < price:
                zone.append(("VWAP−1σ", vwap - sd1))
            tgt = [lv["price"] for lv in (kl.get("above") or []) if lv.get("strength", 0) >= 40][:3]
            ap(f"- discount zone to attack: {' / '.join(f'{n} {fmt(sym, p)}' for n, p in zone) or 'none clean — wait'}")
            ap(f"- magnet targets above: {', '.join(fmt(sym, t) for t in tgt) or 'none ≥str40'}")
        ap("- full construction with every tab's evidence → §9 below")
    else:
        ap("- **NO-TRADE**: dimensions disagree — this is a transition/range tape; "
           "playbook says do not force setups. Re-scan after the next impulse or when a dimension flips 2+ votes.")
    tl, card = build_trades(sym, d, fpx, price, vwap, sd1, day, kl, k, cnt, bias, n_short, n_long)
    L.extend(tl)
    ap("")
    ap("> honesty: liq clusters, whale walls, stopmap and squeeze-fuel figures are Coinglass *estimates*; "
       "footprint volumes are 4-venue perp aggregates (XAU/XAG venues may differ). All numbers from live terminal pulls.")
    return "\n".join(L), d["errors"], card


# ------------------------------------------------------------------ main
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    syms = []
    if args and args[0] == "--top":
        n = int(args[1]) if len(args) > 1 else 3
        st = json.loads((DESK / "state.json").read_text())
        scored = {s: a.get("score") or 0 for s, a in (st.get("analysis", {}).get("assets") or {}).items()}
        syms = sorted(scored, key=lambda s: -abs(scored[s]))[:n]
    elif args and args[0].lower() == "all":
        syms = SYMS
    else:
        syms = [a.upper() for a in args if a.upper() in SYMS] or ["BTC"]
    if "--top" in sys.argv and not args:
        st = json.loads((DESK / "state.json").read_text())
        scored = {s: a.get("score") or 0 for s, a in (st.get("analysis", {}).get("assets") or {}).items()}
        syms = sorted(scored, key=lambda s: -abs(scored[s]))[:3]

    outdir = DESK / "deepscan"
    outdir.mkdir(exist_ok=True)
    log_entries = []
    for sym in syms:
        rep, errs = deep_report(sym)
        fn = outdir / f"{sym}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.md"
        fn.write_text(rep)
        print(f"=== {sym} → {fn.relative_to(ROOT)} ({len(rep.splitlines())} lines, "
              f"{'all sources OK' if not errs else str(len(errs)) + ' gap(s): ' + '; '.join(errs)}")
        log_entries.append(f"- {sym}: {fn.relative_to(ROOT)}" + (f" · gaps: {'; '.join(errs)}" if errs else ""))

    if not DRY:
        with (DESK / "log.md").open("a") as f:
            f.write(f"\n### DEEPSCAN · {now_iso} · zai-desk — 360° on-demand deep analysis\n")
            f.write("\n".join(log_entries) + "\n")
        import subprocess
        def run(cmd):
            return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True).returncode
        run(["git", "add", "desk/"])
        run(["git", "commit", "-q", "-m", f"desk(deepscan): 360° deep analysis {', '.join(syms)}"])
        ok = False
        for _ in range(4):  # daemon commits every ~60-90s — expect races
            rc = run(["git", "pull", "--rebase", "-q", "origin", "main"])
            if rc != 0:
                run(["git", "rebase", "--abort"])  # keep our commit local, retry after daemon push
                time.sleep(15)
                continue
            if run(["git", "push", "-q", "origin", "main"]) == 0:
                ok = True
                break
        print("committed + pushed" if ok else "WARNING: committed locally but push failed — resolve manually")


if __name__ == "__main__":
    main()
