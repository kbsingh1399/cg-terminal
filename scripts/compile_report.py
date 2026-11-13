import json

# Load raw Tier A
with open("desk/scratch_crypto_raw.json") as f:
    tier_a_raw = json.load(f)

# Load deep Tier B
with open("desk/scratch_top_deep.json") as f:
    deep_raw = json.load(f)

# Load MT5
with open("desk/mt5.json") as f:
    mt5_data = json.load(f)

spreads_map = mt5_data.get("spreads", {})

CRYPTO_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "LINK", "LTC",
    "AVAX", "DOT", "NEAR", "UNI", "ATOM", "XLM", "ETC", "FIL", "ICP", "HBAR",
    "APT", "ARB", "OP", "SUI", "SEI", "INJ", "TIA", "VET", "1000PEPE", "1000SHIB"
]

# Build Tier A rows
tier_a_rows = []
for sym in CRYPTO_SYMBOLS:
    data = tier_a_raw.get(sym, {})
    nar = data.get("narrative") or {}
    liq = data.get("liq") or {}
    
    name = nar.get("name", sym)
    regime = nar.get("regime", "UNKNOWN")
    direction = nar.get("direction", "FLAT")
    grade = nar.get("grade", "C")
    conf = nar.get("confidence", 0)
    m1 = (nar.get("m1") or {}).get("status", "OFF")
    m2 = (nar.get("m2") or {}).get("status", "OFF")
    vetoes = (nar.get("plan") or {}).get("vetoes") or []
    vwapZ = (nar.get("context") or {}).get("vwapZ")
    price = (nar.get("context") or {}).get("price")
    
    # Compute +-2% liq
    bands = (liq.get("stats") or {}).get("bands") or []
    shorts_up_2pct = 0.0
    longs_down_2pct = 0.0
    for b in bands:
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

    is_grade_a = grade in ["A", "A+"]
    is_conf_trig = (conf >= 80) and (m1 == "TRIGGERED" or m2 == "TRIGGERED")
    is_lsr_magnet = lsr >= 2.5
    is_score_ext = vwapZ is not None and abs(vwapZ) >= 2.0
    qualifies = is_grade_a or is_conf_trig or is_lsr_magnet or is_score_ext
    
    tier_a_rows.append({
        "sym": sym,
        "name": name,
        "regime": regime,
        "direction": direction,
        "grade": grade,
        "conf": conf,
        "m1": m1,
        "m2": m2,
        "vetoes": vetoes,
        "vwapZ": vwapZ,
        "price": price,
        "longs_down_2pct": longs_down_2pct,
        "shorts_up_2pct": shorts_up_2pct,
        "lsr": lsr,
        "dominant": dominant,
        "qualifies": qualifies
    })

print(f"Tier A compiled for {len(tier_a_rows)} assets.")

# Analyze Deep Tier B
print(f"Deep Tier B available for {len(deep_raw)} assets:")
for sym, d in deep_raw.items():
    m = d.get("market") or {}
    p = (m.get("price") or {}).get("last")
    auc = m.get("auction") or {}
    dpoc = (auc.get("day") or {}).get("poc")
    dvah = (auc.get("day") or {}).get("vah")
    dval = (auc.get("day") or {}).get("val")
    sig = d.get("signals") or {}
    counts = sig.get("counts") or {}
    bw = d.get("bookwalls") or {}
    imb = (bw.get("depth") or {}).get("imbalance")
    cvd = d.get("cvd") or {}
    tb = cvd.get("takerBuyPct")
    print(f"  {sym:6} | P:{p} | Day POC:{dpoc} VAH:{dvah} VAL:{dval} | Sigs:{counts} | Imb:{imb} | TakerBuy:{tb}")
