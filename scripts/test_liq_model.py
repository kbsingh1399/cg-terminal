#!/usr/bin/env python3
"""Exact port of the Coinglass liquidation-levels R model (keyLevels) —
verify against the live page's 'Key liquidation levels' table."""
import json, sys
sys.path.insert(0, "/home/z/my-project/scripts")
from cg_client import fetch_decrypted

TIER = {"h1": 0, "h2": 1, "h3": 2}


def to_idx(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f == int(f) else None
    except (ValueError, TypeError):
        return None


def find_bar(ts_ms, ts_arr):
    """Their P(): last index with ts[i] <= t (binary search)."""
    lo, hi = 0, len(ts_arr) - 1
    if hi < 0 or ts_ms < ts_arr[0]:
        return -1
    while lo < hi:
        mid = (lo + hi + 1) >> 1
        if ts_arr[mid] <= ts_ms:
            lo = mid
        else:
            hi = mid - 1
    return lo


def build_model(payload):
    prices = payload["prices"]
    n = len(prices)
    ts = [float(p[0]) * 1000 for p in prices]
    o = [float(p[1]) for p in prices]
    h = [float(p[2]) for p in prices]
    l = [float(p[3]) for p in prices]
    c = [float(p[4]) for p in prices]

    lo_min, hi_max = float("inf"), float("-inf")
    for i in range(n):
        if not (l[i] > 0 and h[i] >= l[i]):
            l[i] = h[i] = o[i] = c[i] = (c[i - 1] if i else 1.0)
        lo_min = min(lo_min, l[i])
        hi_max = max(hi_max, h[i])
    g_min, g_max = 0.88 * lo_min, 1.12 * hi_max
    dp = (g_max - g_min) / 520

    def row_of(p):
        return min(519, max(0, int((p - g_min) / dp)))

    def price_of_row(r):
        return g_min + (r + 0.5) * dp

    levels = []
    for e in payload["data"]:
        t = to_idx(e.get("x"))
        en = to_idx(e.get("endX"))
        if t is None:
            t = find_bar(float(e["beginDate"]) * 1000, ts) if e.get("beginDate") else -1
        if en is None:
            en = find_bar(float(e["endDate"]) * 1000, ts) if e.get("endDate") else -1
        side = 0 if str(e.get("side")) == "1" else 1  # 1=long(below)->0, 2=short(above)->1
        levels.append({
            "s": t,
            "e": en if (en is not None and en >= t and en < n) else None,  # None = unhit/open
            "hit": en is not None and en >= t and en < n,
            "price": float(e["price"]),
            "size": float(e["size"]),
            "lev": TIER.get(e.get("level2"), 2),
            "side": side,
        })
    return {"ts": ts, "c": c, "g_min": g_min, "dp": dp, "row_of": row_of, "price_of_row": price_of_row, "levels": levels, "n": n}


def key_levels(model, lv_r, gran=0, lev_on=(True, True, True)):
    row_of, price_of_row = model["row_of"], model["price_of_row"]
    levels = model["levels"]
    sizes = sorted((lv["size"] for lv in levels), reverse=True)
    if sizes:
        n = len(sizes)
        gran_thr = [0, sizes[(n - 1) // 2], sizes[int((n - 1) * 0.2)]]
    else:
        gran_thr = [0, 0, 0]

    active = [0.0] * 520
    active_lev = [[0.0] * 3 for _ in range(520)]
    for lv in levels:
        if not lev_on[lv["lev"]]:
            continue
        if lv["size"] < gran_thr[gran]:
            continue
        if lv["hit"]:
            continue
        r = row_of(lv["price"])
        active[r] += lv["size"]
        active_lev[r][lv["lev"]] += lv["size"]

    price = model["c"][-1]
    a = row_of(price)
    rows_with = [r for r in range(520) if active[r] > 0]
    r_lo = row_of(price * (1 - lv_r / 100))
    r_hi = row_of(price * (1 + lv_r / 100))
    above = [r for r in rows_with if a < r <= r_hi]
    below = [r for r in rows_with if r_lo <= r < a]
    above.sort(key=lambda r: -active[r])
    below.sort(key=lambda r: -active[r])
    top_a = sorted(above[:5], reverse=True)
    top_b = sorted(below[:5], reverse=True)
    mx = max([1] + [active[r] for r in top_a + top_b])

    def fmt(r, side):
        p = price_of_row(r)
        lev = max(range(3), key=lambda i: active_lev[r][i])
        return {"side": "Short" if side else "Long", "price": round(p, 1), "dist%": round((p - price) / price * 100, 2), "lev": ["High", "Mid", "Low"][lev], "strength": round(100 * active[r] / mx, 1)}

    return {
        "last": price,
        "above": [fmt(r, 1) for r in top_a],
        "below": [fmt(r, 0) for r in top_b],
        "total_shorts": round(sum(active[r] for r in range(520) if active[r] > 0 and r > a) / 1e6, 0),
        "total_longs": round(sum(active[r] for r in range(520) if active[r] > 0 and r < a) / 1e6, 0),
    }


def main():
    venue = sys.argv[1] if len(sys.argv) > 1 else "Binance_BTCUSDT"
    rng = sys.argv[2] if len(sys.argv) > 2 else "3d"
    out = fetch_decrypted(f"https://capi.coinglass.com/api/liquidationLevels/v2?symbol={venue}&limit=4000&range={rng}")
    data = out if "prices" in (out or {}) else (out.get("data", out) if isinstance(out, dict) else out)
    model = build_model(data)
    res = key_levels(model, 4)
    print(f"=== {venue} · {rng} · ±4% · last {res['last']:.1f} ===")
    print("Shorts (above):")
    for x in res["above"]:
        print(f"  {x['price']:>10,.1f}  {x['dist%']:+.2f}%  {x['lev']:4s}  {x['strength']}")
    print("Longs (below):")
    for x in res["below"]:
        print(f"  {x['price']:>10,.1f}  {x['dist%']:+.2f}%  {x['lev']:4s}  {x['strength']}")
    print(f"active strength above: {res['total_shorts']}M · below: {res['total_longs']}M")


if __name__ == "__main__":
    main()
