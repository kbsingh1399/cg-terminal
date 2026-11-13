import json

mt5 = json.load(open("desk/mt5.json"))
print("Spreads in desk/mt5.json:")
for k, v in mt5.get("spreads", {}).items():
    sp = v.get("spreadPct", 0)
    print(f"  {k:12} | spreadPct: {sp:.4f}% | bid: {v.get('bid')} ask: {v.get('ask')} | tradeAllowed: {v.get('tradeAllowed')}")
