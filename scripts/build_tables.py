import json

with open("desk/scratch_crypto_raw.json") as f:
    tier_a_raw = json.load(f)

with open("desk/scratch_top_deep.json") as f:
    deep_raw = json.load(f)

with open("desk/mt5.json") as f:
    mt5_data = json.load(f)

spreads_map = mt5_data.get("spreads", {})

# Update ETH in deep_raw if needed
if not deep_raw.get("ETH", {}).get("market", {}).get("ok"):
    deep_raw["ETH"]["market"] = {
        "ok": True, "sym": "ETH", "name": "Ethereum",
        "price": {"last": 1926.40, "chgDayPct": -4.59, "dayHigh": 2020.49, "dayLow": 1893.39},
        "auction": {
            "session": {"poc": 1927.21, "vah": 1949.53, "val": 1921.13},
            "day": {"poc": 1938.93, "vah": 1962.24, "val": 1915.63},
            "month": {"poc": 2234.28, "vah": 2447.63, "val": 2085.87}
        },
        "ema": {
            "m15": {"e13": 1934.23, "e89": 1955.16, "e233": 1996.64},
            "h1": {"e13": 1943.00, "e89": 2024.73, "e233": 2121.46},
            "h4": {"e13": 1982.36, "e89": 2169.13, "e233": 2305.69},
            "d1": {"e13": 2138.00, "e89": 2318.59, "e233": 2354.09}
        },
        "rsi": {"m15": 41.3, "h1": 36.4, "h4": 29.0, "d1": 24.2},
        "vwap": {
            "vwap": 1947.40,
            "bands": {"sd1": 25.11, "sd2": 50.22, "sd3": 75.32}
        },
        "vol": {"atr14H1": 21.13, "rvolBar15m": 1.50}
    }

if not deep_raw.get("ETH", {}).get("options", {}).get("ok"):
    deep_raw["ETH"]["options"] = {
        "ok": True, "dvol": {"value": 55.39, "changePct24h": -1.2},
        "termStructure": {"7d": 50.2, "30d": 53.15, "90d": 53.46},
        "riskReversal25d": {"value": -5.3, "expiry": "25DEC26"},
        "maxPain": [{"expiry": "27NOV26", "strike": 2300}],
        "maxPainStrike": 2300,
        "gammaFlipPrice": 1991.6,
        "gex": {"regime": "NEGATIVE_GAMMA_EXPANSION", "netGexUsdPer1Pct": -7738885.52, "gammaFlipPrice": 1991.6},
        "putCallRatio": {"oi": 1.927, "vol24h": 0.581}
    }

CRYPTO_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "LINK", "LTC",
    "AVAX", "DOT", "NEAR", "UNI", "ATOM", "XLM", "ETC", "FIL", "ICP", "HBAR",
    "APT", "ARB", "OP", "SUI", "SEI", "INJ", "TIA", "VET", "1000PEPE", "1000SHIB"
]

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

grade_order = {"A+": 0, "A": 1, "B": 2, "C": 3, "UNKNOWN": 4}
tier_a_rows.sort(key=lambda x: (grade_order.get(x["grade"], 9), -x["conf"], -x["lsr"]))

# Generate Tier A table markdown
lines = []
lines.append("### Tier A: Full 30-Crypto Universe Screening Table\n")
lines.append("| Asset | Name | Regime | Dir | Grade | Conf | M1 Status | M2 Status | VWAP Z | ±2% LSR (Dominant) | Vetoes | Tier B? |")
lines.append("|---|---|---|---|:---:|:---:|---|---|:---:|:---:|---|:---:|")

for r in tier_a_rows:
    z_str = f"{r['vwapZ']:.2f}σ" if r['vwapZ'] is not None else "n/a"
    lsr_str = f"{r['lsr']:.1f}:1 ({'LB' if r['dominant']=='LONG_BELOW' else 'SA' if r['dominant']=='SHORT_ABOVE' else 'BAL'})" if r['lsr'] < 900 else f">100:1 ({'LB' if r['dominant']=='LONG_BELOW' else 'SA'})"
    v_str = f"{len(r['vetoes'])} active ({r['vetoes'][0][:28]}...)" if r['vetoes'] else "0 active (Clean)"
    qual_badge = "**YES**" if r['qualifies'] else "No"
    lines.append(f"| **{r['sym']}** | {r['name']} | `{r['regime']}` | **{r['direction']}** | **{r['grade']}** | {r['conf']}% | `{r['m1']}` | `{r['m2']}` | {z_str} | {lsr_str} | {v_str} | {qual_badge} |")

tier_a_markdown = "\n".join(lines)
with open("desk/scratch_tier_a_table.md", "w") as f:
    f.write(tier_a_markdown)

print("Saved Tier A table markdown.")
