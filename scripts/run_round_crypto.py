import urllib.request
import json
import concurrent.futures
import time
import sys

CRYPTO_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "LINK", "LTC",
    "AVAX", "DOT", "NEAR", "UNI", "ATOM", "XLM", "ETC", "FIL", "ICP", "HBAR",
    "APT", "ARB", "OP", "SUI", "SEI", "INJ", "TIA", "VET", "1000PEPE", "1000SHIB"
]

def fetch_json(url, timeout=12):
    try:
        req = urllib.request.urlopen(url, timeout=timeout)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e), "ok": False}

print("=== STEP 1: PULLING FRESH TIER A FOR 30 CRYPTO ASSETS ===", flush=True)

def fetch_tier_a_pair(sym):
    n_url = f"http://127.0.0.1:3000/api/cg/narrative?sym={sym}"
    l_url = f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}"
    narrative = fetch_json(n_url, timeout=12)
    liq = fetch_json(l_url, timeout=12)
    return sym, narrative, liq

raw_results = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    futures = {executor.submit(fetch_tier_a_pair, sym): sym for sym in CRYPTO_SYMBOLS}
    for f in concurrent.futures.as_completed(futures):
        sym, nar, liq = f.result()
        raw_results[sym] = {"narrative": nar, "liq": liq}
        print(f"  [Tier A] {sym:8} | narrative: {nar.get('ok')} | liq: {liq.get('ok')}", flush=True)

with open("desk/scratch_crypto_raw.json", "w") as f:
    json.dump(raw_results, f, indent=2)

print("Saved fresh Tier A data to desk/scratch_crypto_raw.json\n", flush=True)

print("=== STEP 2: PROCESSING TIER A & IDENTIFYING QUALIFIERS ===", flush=True)
tier_a_rows = []
qualifiers = []

for sym in CRYPTO_SYMBOLS:
    data = raw_results.get(sym, {})
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
    
    reasons = []
    if is_grade_a: reasons.append(f"Grade {grade}")
    if is_conf_trig: reasons.append(f"Conf {conf} + M1/M2 Triggered")
    if is_lsr_magnet: reasons.append(f"LSR {lsr:.1f}:1 ({dominant})")
    if is_score_ext: reasons.append(f"|vwapZ| {abs(vwapZ):.2f} >= 2.0")

    row = {
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
        "qualifies": qualifies,
        "reasons": reasons
    }
    tier_a_rows.append(row)
    if qualifies:
        qualifiers.append(row)

grade_order = {"A+": 0, "A": 1, "B": 2, "C": 3, "UNKNOWN": 4}
tier_a_rows.sort(key=lambda x: (grade_order.get(x["grade"], 9), -x["conf"], -x["lsr"]))
qualifiers.sort(key=lambda x: (grade_order.get(x["grade"], 9), -x["conf"], -x["lsr"]))

print(f"Found {len(qualifiers)} qualifiers out of 30 assets.", flush=True)
for q in qualifiers[:12]:
    print(f"  Top: {q['sym']:8} | Gr:{q['grade']:3} Conf:{q['conf']:2}% | {' & '.join(q['reasons'])}", flush=True)

# Select Top 12 for Deep Telemetry
TOP_TARGETS = [q["sym"] for q in qualifiers[:12]]
# Ensure BTC and ETH are always in deep targets
for m_sym in ["BTC", "ETH"]:
    if m_sym not in TOP_TARGETS:
        TOP_TARGETS.append(m_sym)

print(f"\n=== STEP 3: PULLING DEEP TELEMETRY FOR TOP QUALIFIERS ({len(TOP_TARGETS)}) ===", flush=True)
deep_data = {}

for sym in TOP_TARGETS:
    print(f"Fetching deep telemetry for {sym}...", flush=True)
    m = fetch_json(f"http://127.0.0.1:3000/api/cg/market?sym={sym}", timeout=10)
    s = fetch_json(f"http://127.0.0.1:3000/api/cg/signals?sym={sym}", timeout=10)
    l = fetch_json(f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}", timeout=10)
    b = fetch_json(f"http://127.0.0.1:3000/api/cg/bookwalls?sym={sym}", timeout=10)
    c = fetch_json(f"http://127.0.0.1:3000/api/cg/cvd?sym={sym}", timeout=10)
    o = None
    if sym in ["BTC", "ETH"]:
        o = fetch_json(f"http://127.0.0.1:3000/api/cg/options?sym={sym}", timeout=10)
    
    # If liq failed on fresh call, fallback to Tier A call
    if not l.get("ok") and raw_results.get(sym, {}).get("liq", {}).get("ok"):
        l = raw_results[sym]["liq"]
        
    deep_data[sym] = {
        "market": m, "signals": s, "liqlevels": l, "bookwalls": b, "cvd": c, "options": o
    }
    time.sleep(0.1)

with open("desk/scratch_top_deep.json", "w") as f:
    json.dump(deep_data, f, indent=2)

print("Saved deep data to desk/scratch_top_deep.json\n", flush=True)
