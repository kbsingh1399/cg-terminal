import urllib.request
import json
import time

TARGETS = [
    "BTC", "ETH", "AVAX", "ATOM", "XLM", "XRP", "SOL", "BNB", "SUI", "TRX",
    "ADA", "DOGE", "LTC", "LINK", "DOT", "UNI", "FIL", "ICP"
]

def fetch_json(url):
    try:
        req = urllib.request.urlopen(url, timeout=10)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e), "ok": False}

deep_data = {}
for sym in TARGETS:
    print(f"Fetching deep data for {sym}...")
    t0 = time.time()
    market = fetch_json(f"http://127.0.0.1:3000/api/cg/market?sym={sym}")
    signals = fetch_json(f"http://127.0.0.1:3000/api/cg/signals?sym={sym}")
    liqlevels = fetch_json(f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}")
    bookwalls = fetch_json(f"http://127.0.0.1:3000/api/cg/bookwalls?sym={sym}")
    cvd = fetch_json(f"http://127.0.0.1:3000/api/cg/cvd?sym={sym}")
    
    options = None
    if sym in ["BTC", "ETH"]:
        options = fetch_json(f"http://127.0.0.1:3000/api/cg/options?sym={sym}")
        
    deep_data[sym] = {
        "market": market,
        "signals": signals,
        "liqlevels": liqlevels,
        "bookwalls": bookwalls,
        "cvd": cvd,
        "options": options,
        "fetchedAt": time.time()
    }
    time.sleep(0.1)

with open("desk/scratch_crypto_deep_done.json", "w") as f:
    json.dump(deep_data, f, indent=2)

print(f"Successfully saved {len(deep_data)} deep telemetry records to desk/scratch_crypto_deep_done.json")
