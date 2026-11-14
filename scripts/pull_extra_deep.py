import urllib.request
import json
import time

EXTRA = ["AVAX", "SOL", "XRP", "DOGE", "LTC", "SUI", "XLM"]

def fetch_json(url, timeout=10):
    try:
        req = urllib.request.urlopen(url, timeout=timeout)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e), "ok": False}

with open("desk/scratch_top_deep.json") as f:
    deep = json.load(f)

with open("desk/scratch_crypto_raw.json") as f:
    raw = json.load(f)

for sym in EXTRA:
    print(f"Fetching extra deep telemetry for {sym}...", flush=True)
    m = fetch_json(f"http://127.0.0.1:3000/api/cg/market?sym={sym}")
    s = fetch_json(f"http://127.0.0.1:3000/api/cg/signals?sym={sym}")
    l = fetch_json(f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}")
    b = fetch_json(f"http://127.0.0.1:3000/api/cg/bookwalls?sym={sym}")
    c = fetch_json(f"http://127.0.0.1:3000/api/cg/cvd?sym={sym}")
    
    if not l.get("ok") and raw.get(sym, {}).get("liq", {}).get("ok"):
        l = raw[sym]["liq"]
        
    deep[sym] = {
        "market": m, "signals": s, "liqlevels": l, "bookwalls": b, "cvd": c, "options": None
    }
    time.sleep(0.1)

with open("desk/scratch_top_deep.json", "w") as f:
    json.dump(deep, f, indent=2)

print(f"Total assets in deep telemetry: {len(deep)}", flush=True)
