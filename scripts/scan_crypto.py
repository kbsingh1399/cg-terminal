import urllib.request
import json
import sys

CRYPTO_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "LINK", "LTC",
    "AVAX", "DOT", "NEAR", "UNI", "ATOM", "XLM", "ETC", "FIL", "ICP", "HBAR",
    "APT", "ARB", "OP", "SUI", "SEI", "INJ", "TIA", "VET", "1000PEPE", "1000SHIB"
]

def get_json(url):
    try:
        req = urllib.request.urlopen(url, timeout=10)
        return json.loads(req.read().decode())
    except Exception as e:
        return {"error": str(e)}

print(f"Testing test queries...")
d = get_json("http://127.0.0.1:3000/api/cg/market?sym=BTC")
print("market ok:", d.get("ok"))
d2 = get_json("http://127.0.0.1:3000/api/cg/bookwalls?sym=BTC")
print("bookwalls ok:", d2.get("ok"))
d3 = get_json("http://127.0.0.1:3000/api/cg/cvd?sym=BTC")
print("cvd ok:", d3.get("ok"))
d4 = get_json("http://127.0.0.1:3000/api/cg/options?sym=BTC")
print("options ok:", d4.get("ok"))
