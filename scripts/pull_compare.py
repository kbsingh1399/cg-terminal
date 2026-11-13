#!/usr/bin/env python3
"""Pull 2 days of fills for comparison wallets and profile their strategies."""
import json, time, urllib.request, statistics
from collections import Counter, defaultdict

API = "https://api.hyperliquid.xyz/info"
DATA = "/home/z/my-project/data"

def post(payload, retries=6):
    for i in range(retries):
        try:
            req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception:
            time.sleep(min(2 ** i, 15))
    return None

WALLETS = {
    "Auros": "0x023a3d058020fb76cca98f01b3c48c8938a22355",
    "Jump": "0xf5d81a135f756ca16544e53c20fc20643ec3ad53",
    "ManifoldTrading": "0x091144e651b334341eabdbbbfed644ad0100023e",
    "Cumberland1": "0xfc667adba8d4837586078f4fdcdc29804337ca06",
    "Selini2": "0x7ab80d2c05e5ed068454f4a7553047c8d0ff8136",
}

END = int(time.time() * 1000)
START = END - 2 * 86400 * 1000

results = {}
for name, w in WALLETS.items():
    fills = []
    seen = set()
    cur = START
    while cur < END:
        w_end = min(cur + 6*3600*1000, END)
        d = post({"type": "userFillsByTime", "user": w, "startTime": cur, "endTime": w_end})
        if d is None: break
        new = [f for f in d if f["tid"] not in seen]
        for f in new: seen.add(f["tid"])
        fills.extend(new)
        if len(d) >= 1900:
            # dense: subdivide
            sub = cur; sstep = 1*3600*1000
            while sub < w_end:
                sub_end = min(sub + sstep, w_end)
                d2 = post({"type": "userFillsByTime", "user": w, "startTime": sub, "endTime": sub_end})
                if d2:
                    n2 = [f for f in d2 if f["tid"] not in seen]
                    for f in n2: seen.add(f["tid"]); fills.append(f)
                time.sleep(0.25)
                sub = sub_end
        cur = w_end
        time.sleep(0.3)
    results[name] = fills
    json.dump(fills, open(f"{DATA}/fills_{name}.json", "w"))
    print(f"{name}: {len(fills)} fills in 2d", flush=True)

print("\n=== STRATEGY PROFILES (last 2 days) ===")
print(f"{'wallet':<16}{'fills':>7}{'mk%':>6}{'vol$M':>8}{'medClip$':>9}{'rPnL$':>9}{'mkPnL$':>9}{'topMkts':<40}")
for name, fills in results.items():
    if not fills:
        print(f"{name:<16} no fills"); continue
    mk = sum(1 for f in fills if not f["crossed"])
    vol = sum(float(f["px"])*float(f["sz"]) for f in fills)
    clips = sorted(float(f["px"])*float(f["sz"]) for f in fills)
    rpnl = sum(float(f.get("closedPnl") or 0) for f in fills)
    mkpnl = sum(float(f.get("closedPnl") or 0) for f in fills if not f["crossed"])
    coins = Counter(f["coin"].split(":")[-1] for f in fills).most_common(3)
    print(f"{name:<16}{len(fills):>7}{mk/len(fills)*100:>6.1f}{vol/1e6:>8.1f}{clips[len(clips)//2]:>9,.0f}{rpnl:>9,.0f}{mkpnl:>9,.0f}{str([(c,n) for c,n in coins]):<40}")

# deep dive per wallet: market distribution + maker ratios
for name, fills in results.items():
    if len(fills) < 30: continue
    print(f"\n--- {name} detail ---")
    byc = defaultdict(lambda: {"n":0,"vol":0.0,"mk":0,"pnl":0.0})
    for f in fills:
        s = byc[f["coin"]]; s["n"]+=1; s["vol"]+=float(f["px"])*float(f["sz"]); s["pnl"]+=float(f.get("closedPnl") or 0)
        if not f["crossed"]: s["mk"]+=1
    top = sorted(byc.items(), key=lambda x:-x[1]["vol"])[:8]
    for coin, s in top:
        print(f"  {coin:<16} n={s['n']:>5} vol=${s['vol']/1e6:>6.2f}M maker={s['mk']/s['n']*100:>4.0f}% pnl=${s['pnl']:>8,.0f}")
    # directions
    dirs = Counter(f["dir"] for f in fills)
    print(f"  dirs: {dict(dirs.most_common(5))}")
    # hour of day
    hod = Counter(time.gmtime(f["time"]/1000).tm_hour for f in fills)
    peak = hod.most_common(3)
    print(f"  peak hours (UTC): {peak}")
