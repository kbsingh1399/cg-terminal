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
        ap("- full order construction (entry/stop/R/invalidation) → run the round engine "
           "(scripts/desk_round.sh) which applies the debate gates + broker translation, or ask the desk to build it")
    else:
        ap("- **NO-TRADE**: dimensions disagree — this is a transition/range tape; "
           "playbook says do not force setups. Re-scan after the next impulse or when a dimension flips 2+ votes.")
    ap("")
    ap("> honesty: liq clusters, whale walls, stopmap and squeeze-fuel figures are Coinglass *estimates*; "
       "footprint volumes are 4-venue perp aggregates (XAU/XAG venues may differ). All numbers from live terminal pulls.")
    return "\n".join(L), d["errors"]


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
