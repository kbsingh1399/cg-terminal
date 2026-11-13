import json

with open("desk/scratch_top_deep.json") as f:
    deep = json.load(f)

with open("desk/scratch_crypto_raw.json") as f:
    raw = json.load(f)

with open("desk/mt5.json") as f:
    mt5_data = json.load(f)

spreads_map = mt5_data.get("spreads", {})

# Mapping MT5 symbol names
mt5_sym_alias = {
    "BTC": "BTCUSD", "ETH": "ETHUSD", "XRP": "XRPUSD", "XLM": "XLMUSD",
    "ADA": "ADAUSD", "DOGE": "DOGUSD", "LINK": "LNKUSD", "LTC": "LTCUSD",
    "AVAX": "AVAXUSD", "SOL": "SOLUSD", "BNB": "BNBUSD"
}

def fmt_usd(v):
    if v is None: return "n/a"
    if abs(v) >= 1e9: return f"${v/1e9:.2f}B"
    if abs(v) >= 1e6: return f"${v/1e6:.2f}M"
    if abs(v) >= 1e3: return f"${v/1e3:.1f}k"
    return f"${v:.2f}"

def fmt_num(v, dec=2):
    if v is None: return "n/a"
    return f"{v:.{dec}f}"

out_lines = []
out_lines.append("### Tier B: Deep Telemetry & Analysis on Top Qualifiers\n")

# Top qualifiers in priority order
qualifiers = ["AVAX", "ATOM", "XLM", "BTC", "ETH", "XRP", "TRX", "SOL", "BNB", "SUI", "ADA", "DOGE"]

for sym in qualifiers:
    d = deep.get(sym, {})
    r = raw.get(sym, {})
    nar = r.get("narrative") or {}
    
    m = d.get("market") or {}
    p_info = m.get("price") or {}
    last_price = p_info.get("last") or (nar.get("context") or {}).get("price")
    
    auc = m.get("auction") or {}
    sess = auc.get("session") or {}
    day_auc = auc.get("day") or {}
    mon_auc = auc.get("month") or {}
    
    emas = m.get("ema") or {}
    m15_ema = emas.get("m15") or {}
    h1_ema = emas.get("h1") or {}
    h4_ema = emas.get("h4") or {}
    d1_ema = emas.get("d1") or {}
    
    rsi = m.get("rsi") or {}
    
    vwap_obj = m.get("vwap") or {}
    vwap_val = vwap_obj.get("vwap")
    bands = vwap_obj.get("bands") or {}
    sd1 = bands.get("sd1", 0)
    sd2 = bands.get("sd2", 0)
    sd3 = bands.get("sd3", 0)
    
    # Liqlevels
    liq = d.get("liqlevels") or r.get("liq") or {}
    stats = liq.get("stats") or {}
    liq_bands = stats.get("bands") or []
    shorts_up_2pct = 0.0
    longs_down_2pct = 0.0
    for b in liq_bands:
        if b.get("b", 999) <= 2:
            shorts_up_2pct += b.get("up", 0.0)
            longs_down_2pct += b.get("down", 0.0)
            
    dominant = "BALANCED"
    lsr = 1.0
    if shorts_up_2pct > 0 and longs_down_2pct > 0:
        if shorts_up_2pct >= longs_down_2pct:
            lsr = shorts_up_2pct / longs_down_2pct
            dominant = "SHORT_ABOVE"
        else:
            lsr = longs_down_2pct / shorts_up_2pct
            dominant = "LONG_BELOW"
    elif shorts_up_2pct > 0:
        lsr = 999.0
        dominant = "SHORT_ABOVE"
    elif longs_down_2pct > 0:
        lsr = 999.0
        dominant = "LONG_BELOW"

    key_levels = stats.get("keyLevels") or {}
    above_levels = key_levels.get("above") or []
    below_levels = key_levels.get("below") or []
    
    # Signals
    sigs = d.get("signals") or {}
    sig_counts = sigs.get("counts") or {}
    sig_sets = sigs.get("sets") or []
    recent_sigs = []
    for s_set in sig_sets:
        label = s_set.get("label", s_set.get("bt"))
        for s in (s_set.get("sigs") or [])[-3:]:
            recent_sigs.append(f"{s.get('t').upper()} {s.get('side')} @ {s.get('p')} ({label})")

    # Bookwalls
    bw = d.get("bookwalls") or {}
    bw_depth = bw.get("depth") or {}
    imb = bw_depth.get("imbalance")
    walls = bw.get("walls") or []
    major_walls = []
    for w in walls[:4]:
        major_walls.append(f"{w.get('side')} {fmt_usd(w.get('usd'))} @ {w.get('price')} (age {w.get('ageH', 0):.1f}h)")

    # CVD
    cvd = d.get("cvd") or {}
    taker_buy = cvd.get("takerBuyPct")
    perp_cvd = cvd.get("perpCvdUsd")
    spot_cvd = cvd.get("spotCvdUsd")
    
    # MT5 spread info
    mt5_sym = mt5_sym_alias.get(sym, f"{sym}USD")
    mt5_sp_info = spreads_map.get(mt5_sym, {})
    mt5_sp_pct = mt5_sp_info.get("spreadPct")
    mt5_trade_allowed = mt5_sp_info.get("tradeAllowed")
    
    # Determine Magnet Gate
    # LSR >= 2.5:1 -> PASSIVE ENTRIES BANNED into magnet path
    if lsr >= 2.5:
        magnet_gate = f"**BANNED (LSR {lsr:.1f}:1 ≥ 2.5:1 {dominant})** — Passive limit orders into magnet banned; WAIT for liquidation sweep (S1)."
    elif lsr >= 2.0:
        magnet_gate = f"**RESTRICTED (LSR {lsr:.1f}:1 between 2.0–2.5:1)** — Half size max (Grade B cap); requires untouched wall + in-zone absorption."
    else:
        magnet_gate = f"**OPEN (LSR {lsr:.1f}:1 < 2.0:1)** — Eligible for passive front-running (S3) or pullback (M1)."

    # Broker Spread Gate
    if mt5_sp_pct is None or mt5_trade_allowed is not True:
        broker_gate = f"**NO MT5 VENUE** ({mt5_sym} not tradeable on broker account)"
    elif mt5_sp_pct >= 0.15:
        broker_gate = f"**FAIL (Spread {mt5_sp_pct:.4f}% ≥ 0.15%)** — High broker spread disqualifies order execution."
    else:
        broker_gate = f"**PASS (Spread {mt5_sp_pct:.4f}% < 0.15%)** — MT5 executable on {mt5_sym}."

    # Active model & narrative
    regime = nar.get("regime", "UNKNOWN")
    active_model = nar.get("activeModel", "NONE")
    direction = nar.get("direction", "FLAT")
    grade = nar.get("grade", "C")
    conf = nar.get("confidence", 0)
    m1_st = (nar.get("m1") or {}).get("status", "OFF")
    m2_st = (nar.get("m2") or {}).get("status", "OFF")
    plan = nar.get("plan") or {}
    vetoes = plan.get("vetoes") or []
    
    out_lines.append(f"#### {sym} (Grade {grade} · Conf {conf}% · {direction} · Regime: `{regime}`)")
    out_lines.append(f"- **Market Price**: `{last_price}` (24h Chg: `{p_info.get('chgDayPct', 0):.2f}%`)")
    out_lines.append(f"- **Auction Value Areas**:")
    out_lines.append(f"  - Session: VAL `{sess.get('val')}` | POC `{sess.get('poc')}` | VAH `{sess.get('vah')}`")
    out_lines.append(f"  - Day: VAL `{day_auc.get('val')}` | POC `{day_auc.get('poc')}` | VAH `{day_auc.get('vah')}`")
    if mon_auc.get("poc"):
        out_lines.append(f"  - Month: VAL `{mon_auc.get('val')}` | POC `{mon_auc.get('poc')}` | VAH `{mon_auc.get('vah')}`")
    if vwap_val:
        out_lines.append(f"- **VWAP & Bands**: Day VWAP `{vwap_val:.2f}` | +1σ `{vwap_val+sd1:.2f}` | +2σ `{vwap_val+sd2:.2f}` | -1σ `{vwap_val-sd1:.2f}` | -2σ `{vwap_val-sd2:.2f}` (Z-score: `{(nar.get('context') or {}).get('vwapZ', 0):.2f}σ`)")
    out_lines.append(f"- **HTF Trend EMAs & RSI**:")
    out_lines.append(f"  - H1: EMA13 `{h1_ema.get('e13')}` · EMA89 `{h1_ema.get('e89')}` | RSI `{rsi.get('h1', 'n/a')}`")
    out_lines.append(f"  - H4: EMA13 `{h4_ema.get('e13')}` · EMA89 `{h4_ema.get('e89')}` | RSI `{rsi.get('h4', 'n/a')}`")
    out_lines.append(f"  - D1: EMA13 `{d1_ema.get('e13')}` · EMA89 `{d1_ema.get('e89')}` | RSI `{rsi.get('d1', 'n/a')}`")
    out_lines.append(f"- **Exact ±2% Liquidation Telemetry**:")
    out_lines.append(f"  - Long Liquidations (down 0–2%): `{fmt_usd(longs_down_2pct)}`")
    out_lines.append(f"  - Short Liquidations (up 0–2%): `{fmt_usd(shorts_up_2pct)}`")
    out_lines.append(f"  - **LSR (±2%)**: `{lsr:.2f}:1` ({dominant})")
    out_lines.append(f"  - Nearest Sweep Magnets: Above `{above_levels[0].get('price') if above_levels else 'None'}` ({above_levels[0].get('distPct', 0):.2f}% dist, str {above_levels[0].get('strength', 0)}) | Below `{below_levels[0].get('price') if below_levels else 'None'}` ({below_levels[0].get('distPct', 0):.2f}% dist, str {below_levels[0].get('strength', 0)})")
    out_lines.append(f"- **Liquidation Magnet Gate**: {magnet_gate}")
    out_lines.append(f"- **Broker Spread & Executability**: {broker_gate}")
    out_lines.append(f"- **Footprint Signals & Order Flow**:")
    out_lines.append(f"  - Signal Counts: Bullish {sig_counts.get('bullish', 0)} / Bearish {sig_counts.get('bearish', 0)} (Total: {sig_counts.get('all', 0)})")
    if recent_sigs:
        out_lines.append(f"  - Recent Footprint Triggers: {'; '.join(recent_sigs[-4:])}")
    if major_walls:
        out_lines.append(f"  - Resting Order Walls: {'; '.join(major_walls)}")
    if taker_buy is not None:
        out_lines.append(f"  - CVD: Taker Buy `{taker_buy:.1f}%` | Perp Δ `{fmt_usd(perp_cvd)}` | Spot Δ `{fmt_usd(spot_cvd)}`")
    
    # Deribit Options Surface if BTC or ETH
    if sym in ["BTC", "ETH"] and d.get("options", {}).get("ok"):
        opt = d["options"]
        dvol = opt.get("dvol", {}).get("value")
        term = opt.get("termStructure", {})
        rr25 = opt.get("riskReversal25d", {}).get("value")
        mp = opt.get("maxPainStrike")
        gex = opt.get("gex", {})
        pcr = opt.get("putCallRatio", {})
        out_lines.append(f"- **Deribit Options Surface (Institutional Positioning)**:")
        out_lines.append(f"  - DVOL: `{dvol}` | Term Structure: 7d `{term.get('7d')}` · 30d `{term.get('30d')}` · 90d `{term.get('90d')}`")
        out_lines.append(f"  - 25-Delta Skew: `{rr25}` (Puts favored/bearish skew)")
        out_lines.append(f"  - Max Pain Strike: `{mp}`")
        out_lines.append(f"  - Dealer GEX Regime: `{gex.get('regime')}` | Gamma Flip Price: `{gex.get('gammaFlipPrice')}` (Spot `{last_price}` is {'BELOW flip -> Negative gamma accelerates selloffs' if last_price and gex.get('gammaFlipPrice') and last_price < gex.get('gammaFlipPrice') else 'ABOVE flip'})")
        out_lines.append(f"  - Put/Call Ratio: OI `{pcr.get('oi')}` | 24h Vol `{pcr.get('vol24h')}`")

    # M1 / M2 Plan & Active Vetoes
    out_lines.append(f"- **M1/M2 Engine Status & Plan**:")
    out_lines.append(f"  - M1: `{m1_st}` | M2: `{m2_st}`")
    if plan.get("entryZone"):
        ez = plan.get("entryZone")
        out_lines.append(f"  - Proposed Entry Zone: `{ez[0]:.2f} – {ez[1]:.2f}` | Composite: `{plan.get('compositeEntry', 0):.2f}`")
        out_lines.append(f"  - Structural Stop: `{plan.get('stop', 0):.2f}` | Best R: `{plan.get('bestR', 0):.2f}R`")
        targets_str = " | ".join([f"{t.get('label')}: {t.get('level'):.2f} ({t.get('rMultiple', 0):.2f}R)" for t in plan.get("targets", []) if t.get("level") is not None])
        out_lines.append(f"  - Targets: {targets_str}")
    if vetoes:
        out_lines.append(f"  - **Active Vetoes**: {'; '.join(vetoes)}")
    else:
        out_lines.append(f"  - **Active Vetoes**: None (Clean)")

    out_lines.append("")

with open("desk/scratch_tier_b_cards.md", "w") as f:
    f.write("\n".join(out_lines))

print("Saved Tier B cards markdown.")
