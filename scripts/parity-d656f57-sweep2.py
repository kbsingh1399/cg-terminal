#!/usr/bin/env python3
"""Asset-switch runtime sweep with correct field names. usage: py_sweep.py"""
import json, urllib.request, sys

B = "http://127.0.0.1:3171"

def get(path, timeout=45):
    try:
        with urllib.request.urlopen(B + path, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

print("=== market panel (price field) ===")
for s in ["BTC", "XRP", "XAU", "XAG", "DOGE"]:
    st, d = get(f"/api/cg/market?sym={s}")
    ema = d.get("ema", {})
    rsi = d.get("rsi", {})
    print(f"  market {s}: [{st}] price={d.get('price')} ema13={ema.get('ema13') if isinstance(ema, dict) else '-'} rsiM15={rsi.get('m15') if isinstance(rsi, dict) else '-'}")

print("=== bookwalls (model.mid) ===")
for s in ["BTC", "XRP", "XAU"]:
    st, d = get(f"/api/cg/bookwalls?sym={s}")
    m = d.get("model", {}) or {}
    print(f"  bookwalls {s}: [{st}] ok={d.get('ok')} mid={m.get('mid')} walls={len(m.get('walls', []))} venues={d.get('venues')} thr={d.get('minWallUsd')}")

print("=== lto (correct symbol= param) ===")
for s in ["BTC", "XRP", "XAU"]:
    st, d = get(f"/api/cg/lto?symbol={s}&minVolUsd=500000")
    print(f"  lto {s}: [{st}] ok={d.get('ok')} symbol={d.get('symbol')} groups={len(d.get('groups', []))} venues={list(d.get('perExchange', {}).keys())[:6]}")

print("=== 12-asset venue-routing matrix (futures) ===")
for s in ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XAU", "XAG"]:
    st, d = get(f"/api/cg/bookwalls?sym={s}")
    print(f"  {s}: [{st}] ok={d.get('ok')} venues={d.get('venues')} thr={d.get('minWallUsd')}")

print("=== ticker returns to BTC (no stale) ===")
st, d = get("/api/cg/ticker?sym=BTC")
print(f"  ticker BTC: [{st}] price={d.get('price')} stale={d.get('stale')}")
st, d = get("/api/cg/ticker?sym=XRP")
print(f"  ticker XRP: [{st}] price={d.get('price')} stale={d.get('stale')}")
