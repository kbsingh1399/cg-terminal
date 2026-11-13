import urllib.request
import json
import time

QUALIFIERS = [
    "AVAX", "ATOM", "XLM", "BTC", "ETH", "XRP", "SOL", "BNB", "SUI", "TRX", "ADA", "DOGE"
]

def fetch_json(url, timeout=7):
    try:
        req = urllib.request.urlopen(url, timeout=timeout)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e), "ok": False}

# Load previously cached raw data
raw_cache = {}
try:
    with open("desk/scratch_crypto_raw.json") as f:
        raw_cache = json.load(f)
except Exception:
    pass

deep_results = {}

for sym in QUALIFIERS:
    print(f"Pulling deep telemetry for {sym}...", flush=True)
    sym_data = {}
    
    # 1. Market
    m = fetch_json(f"http://127.0.0.1:3000/api/cg/market?sym={sym}")
    sym_data["market"] = m
    
    # 2. Signals
    s = fetch_json(f"http://127.0.0.1:3000/api/cg/signals?sym={sym}")
    sym_data["signals"] = s
    
    # 3. Liqlevels - check if we can fetch fresh or use cached
    l = fetch_json(f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}")
    if not l.get("ok") and sym in raw_cache and raw_cache[sym].get("liq", {}).get("ok"):
        print(f"  using cached liqlevels for {sym}", flush=True)
        l = raw_cache[sym]["liq"]
    sym_data["liqlevels"] = l
    
    # 4. Bookwalls
    b = fetch_json(f"http://127.0.0.1:3000/api/cg/bookwalls?sym={sym}")
    sym_data["bookwalls"] = b
    
    # 5. CVD
    c = fetch_json(f"http://127.0.0.1:3000/api/cg/cvd?sym={sym}")
    sym_data["cvd"] = c
    
    # 6. Options (BTC/ETH)
    if sym in ["BTC", "ETH"]:
        o = fetch_json(f"http://127.0.0.1:3000/api/cg/options?sym={sym}")
        sym_data["options"] = o
        
    deep_results[sym] = sym_data
    time.sleep(0.15)

with open("desk/scratch_top_deep.json", "w") as f:
    json.dump(deep_results, f, indent=2)

print("Saved deep results for top 12 qualifiers to desk/scratch_top_deep.json", flush=True)
