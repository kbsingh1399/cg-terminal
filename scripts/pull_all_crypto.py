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

def fetch_asset_tier_a(sym):
    narrative_url = f"http://127.0.0.1:3000/api/cg/narrative?sym={sym}"
    liq_url = f"http://127.0.0.1:3000/api/cg/liqlevels?sym={sym}"
    
    narrative = fetch_json(narrative_url)
    liq = fetch_json(liq_url)
    
    return sym, narrative, liq

print("Fetching Tier A narrative and liqlevels for 30 crypto assets...")
results = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    future_to_sym = {executor.submit(fetch_asset_tier_a, sym): sym for sym in CRYPTO_SYMBOLS}
    for future in concurrent.futures.as_completed(future_to_sym):
        sym, narrative, liq = future.result()
        results[sym] = {"narrative": narrative, "liq": liq}

print(f"Fetched {len(results)} assets.")

# Save raw tier A results for processing
with open("desk/scratch_crypto_raw.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved to desk/scratch_crypto_raw.json")
