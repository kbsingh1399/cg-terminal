import urllib.request
import json
import concurrent.futures
import time

CRYPTO_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "LINK", "LTC",
    "AVAX", "DOT", "NEAR", "UNI", "ATOM", "XLM", "ETC", "FIL", "ICP", "HBAR",
    "APT", "ARB", "OP", "SUI", "SEI", "INJ", "TIA", "VET", "1000PEPE", "1000SHIB"
]

def fetch_json(url):
    try:
        req = urllib.request.urlopen(url, timeout=12)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e), "ok": False}

def fetch_deep_telemetry(sym):
    endpoints = {
        "market": f"http://127.0.0.1:3000/api/cg/market?sym={sym}",
        "signals": f"http://127.0.0.1:3000/api/cg/signals?sym={sym}",
        "liqlevels": f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}",
        "bookwalls": f"http://127.0.0.1:3000/api/cg/bookwalls?sym={sym}",
        "cvd": f"http://127.0.0.1:3000/api/cg/cvd?sym={sym}",
    }
    if sym in ["BTC", "ETH"]:
        endpoints["options"] = f"http://127.0.0.1:3000/api/cg/options?sym={sym}"
        
    data = {"sym": sym}
    for key, url in endpoints.items():
        data[key] = fetch_json(url)
    return sym, data

print("Fetching deep telemetry for 30 crypto assets...")
results = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    future_to_sym = {executor.submit(fetch_deep_telemetry, sym): sym for sym in CRYPTO_SYMBOLS}
    for future in concurrent.futures.as_completed(future_to_sym):
        sym, data = future.result()
        results[sym] = data
        print(f"Fetched deep telemetry for {sym}")

with open("desk/scratch_crypto_deep.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved deep telemetry to desk/scratch_crypto_deep.json")
