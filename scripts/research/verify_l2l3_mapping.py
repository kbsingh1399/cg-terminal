#!/usr/bin/env python3
"""
Verify Lighter DEX market-id -> instrument mapping by PRICE CROSS-CHECK vs Yahoo
+ enumerate the Hyperliquid xyz HIP-3 universe with live ctxs.

Wrong-instrument data is worse than no data (USO-ETF lesson, DIR-0009) — every
claimed id must price-match its intended instrument before it enters the registry.
"""
import json, time
from pathlib import Path
import requests

OUT = Path(__file__).parent / "probes" / "l2l3"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}

# claimed Lighter ids (external research) -> (terminal instrument, yahoo ref)
CLAIMS = [
    (92,  "XAU",      "XAUUSD=X"),
    (93,  "XAG",      "XAGUSD=X"),
    (180, "SPX500",   "^GSPC"),
    (181, "NDX100",   "^NDX"),
    (128, "SPY(ETF)", "SPY"),
    (129, "QQQ(ETF)", "QQQ"),
    (153, "IWM(ETF)", "IWM"),
    (145, "USO/WTI",  "CL=F"),
    (159, "UKO/Brent", "BZ=F"),
    (158, "NATGAS",   "NG=F"),
    (96,  "EURUSD",   "EURUSD=X"),
    (98,  "USDJPY",   "USDJPY=X"),
    (97,  "GBPUSD",   "GBPUSD=X"),
]

def yahoo_ref(sym):
    try:
        r = requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                         params={"range": "1d", "interval": "1d"}, headers=UA, timeout=15)
        r.raise_for_status()
        m = r.json()["chart"]["result"][0]["meta"]
        return m.get("regularMarketPrice")
    except Exception as e:
        return None

def lighter_book(mid, limit=60):
    r = requests.get("https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders",
                     params={"market_id": mid, "limit": limit}, headers=UA, timeout=15)
    r.raise_for_status()
    return r.json()

def lighter_trades(mid, limit=3):
    r = requests.get("https://mainnet.zklighter.elliot.ai/api/v1/recentTrades",
                     params={"market_id": mid, "limit": limit}, headers=UA, timeout=15)
    r.raise_for_status()
    return r.json()

print("=" * 100)
print("LIGHTER DEX — market id verification (price cross-check vs Yahoo, 2026-11-11 ~09:05 UTC)")
print("=" * 100)
rows = []
for mid, instr, ysym in CLAIMS:
    ref = yahoo_ref(ysym)
    try:
        b = lighter_book(mid)
        asks, bids = b.get("asks", []), b.get("bids", [])
        if not asks and not bids:
            rows.append({"id": mid, "instr": instr, "yahoo": ref, "verdict": "EMPTY BOOK"})
            print(f"  id={mid:<4} {instr:<10} yahoo={ref!s:<10} EMPTY BOOK")
            continue
        ba = min(float(a["price"]) for a in asks) if asks else None
        bb = max(float(x["price"]) for x in bids) if bids else None
        mid_px = ((ba + bb) / 2) if (ba and bb) else (ba or bb)
        # side sanity: asks above bids?
        sane = (ba is None or bb is None or ba > bb)
        diff = abs(mid_px - ref) / ref * 100 if ref else None
        verdict = ("MATCH" if (diff is not None and diff < 1.0 and sane)
                   else "MISMATCH!" if diff is not None else "?")
        rows.append({"id": mid, "instr": instr, "yahoo_sym": ysym, "yahoo_px": ref,
                     "lighter_mid": round(mid_px, 6), "best_bid": bb, "best_ask": ba,
                     "n_asks": len(asks), "n_bids": len(bids),
                     "diff_pct": round(diff, 3) if diff else None, "verdict": verdict})
        print(f"  id={mid:<4} {instr:<10} yahoo={ref!s:<10} lighter_mid={mid_px!s:<10} "
              f"diff={diff and round(diff,3)}% asks={len(asks):<3} bids={len(bids):<3} {verdict}")
    except Exception as e:
        rows.append({"id": mid, "instr": instr, "yahoo": ref, "verdict": f"ERROR {e}"})
        print(f"  id={mid:<4} {instr:<10} yahoo={ref!s:<10} ERROR {e}")
    time.sleep(0.3)

# trade attribution fields on XAU (id 92)
try:
    t = lighter_trades(92, 3)
    tr = t if isinstance(t, list) else t.get("trades", t.get("result", []))
    (OUT / "lighter-xau-trades.json").write_text(json.dumps(t, indent=1)[:100_000])
    print(f"\n  XAU recentTrades sample keys: {list(tr[0].keys()) if tr else t}")
    print(f"  XAU recentTrades[0]: {json.dumps(tr[0]) if tr else t}"[:400])
except Exception as e:
    print(f"  trades FAIL {e}")

print("\n" + "=" * 100)
print("HYPERLIQUID xyz HIP-3 — dex universe with live ctxs")
print("=" * 100)
try:
    r = requests.post("https://api.hyperliquid.xyz/info",
                      json={"type": "metaAndAssetCtxs", "dex": "xyz"}, headers=UA, timeout=15)
    meta, ctxs = r.json()
    uni = meta["universe"]
    table = []
    for u, c in zip(uni, ctxs):
        try:
            table.append({
                "coin": u["name"], "markPx": float(c.get("markPx") or 0),
                "vol24h$": round(float(c.get("dayNtlVlm") or 0)),
                "OI_base": round(float(c.get("openInterest") or 0), 3),
                "funding_1h_pct": round(float(c.get("funding") or 0) * 100, 5),
                "oraclePx": float(c.get("oraclePx") or 0),
            })
        except (ValueError, TypeError):
            pass
    table.sort(key=lambda x: -x["vol24h$"])
    (OUT / "hl-xyz-dex-universe.json").write_text(json.dumps(table, indent=1))
    print(f"  {len(table)} xyz markets (sorted by 24h notional volume):")
    for t2 in table[:30]:
        print(f"    {t2['coin']:<18} px={t2['markPx']:<11} vol24h=${t2['vol24h$']:>14,} "
              f"OI={t2['OI_base']:>13,} fund/1h={t2['funding_1h_pct']:>8}% oracle={t2['oraclePx']}")
except Exception as e:
    print(f"  FAIL {e}")

(OUT / "lighter-id-verification.json").write_text(json.dumps(rows, indent=1, default=str))
print(f"\nevidence: scripts/research/probes/l2l3/lighter-id-verification.json + hl-xyz-dex-universe.json")
