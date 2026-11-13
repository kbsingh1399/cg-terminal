#!/usr/bin/env python3
"""Find and repair missing fills using startPosition validation."""
import json, time, urllib.request
from collections import defaultdict

DATA = "/home/z/my-project/data"
API = "https://api.hyperliquid.xyz/info"
W = "0x76987ceada087975a0cedef7753f25bf86234480"

def post(payload, retries=8):
    for i in range(retries):
        try:
            req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception:
            time.sleep(min(2 ** i, 20))
    return None

def signed(f):
    q = float(f["sz"])
    return -q if f["side"] == "S" else q

fills = json.load(open(f"{DATA}/fills_all.json"))
fills.sort(key=lambda f: f["time"])

def find_gaps(fills):
    """Return list of (coin, time_before, time_after) where position continuity breaks."""
    gaps = []
    pos = defaultdict(float)
    by_coin = defaultdict(list)
    for f in fills: by_coin[f["coin"]].append(f)
    for coin, fl in by_coin.items():
        p = 0.0
        for f in fl:
            sp = float(f["startPosition"])
            if abs(sp - p) > 1e-9:
                gaps.append((coin, p, sp, f))
            p = sp + signed(f)
    return gaps

gaps = find_gaps(fills)
print(f"continuity gaps found: {len(gaps)}")
for coin, p, sp, f in gaps[:15]:
    print(f"  {coin}: expected {p:.2f} but startPosition={sp:.2f} at {time.strftime('%m-%d %H:%M:%S', time.gmtime(f['time']/1000))} (missing {sp-p:+.2f})")

# Repair: pull finer windows around gap times
if gaps:
    # sort unique gap timestamps
    gap_times = sorted(set(f["time"] for _,_,_,f in gaps))
    t_min = min(gap_times) - 3600*1000
    t_max = max(gap_times) + 1000
    seen = {f["tid"] for f in fills}
    cur = t_min
    step = 30*60*1000  # 30-min windows
    added = 0
    while cur < t_max:
        w_end = cur + step
        d = post({"type": "userFillsByTime", "user": W, "startTime": cur, "endTime": w_end})
        if d:
            new = [f for f in d if f["tid"] not in seen]
            for f in new:
                seen.add(f["tid"]); fills.append(f); added += 1
            if len(d) >= 1900:
                print(f"DENSE 30m window {time.strftime('%m-%d %H:%M', time.gmtime(cur/1000))}: {len(d)} fills, {len(new)} new")
        time.sleep(0.3)
        cur = w_end
    print(f"repair pass 1: +{added} fills")
    fills.sort(key=lambda f: f["time"])
    gaps2 = find_gaps(fills)
    print(f"remaining gaps: {len(gaps2)}")

    # second pass: 5-min windows on remaining gaps
    if gaps2:
        gap_times = sorted(set(f["time"] for _,_,_,f in gaps2))
        cur = min(gap_times) - 15*60*1000
        t_max = max(gap_times) + 1000
        added2 = 0
        while cur < t_max:
            w_end = cur + 5*60*1000
            d = post({"type": "userFillsByTime", "user": W, "startTime": cur, "endTime": w_end})
            if d:
                new = [f for f in d if f["tid"] not in seen]
                for f in new:
                    seen.add(f["tid"]); fills.append(f); added2 += 1
            time.sleep(0.3)
            cur = w_end
        print(f"repair pass 2: +{added2} fills")
        fills.sort(key=lambda f: f["time"])
        gaps3 = find_gaps(fills)
        print(f"remaining gaps after pass 2: {len(gaps3)}")
        for coin, p, sp, f in gaps3[:10]:
            print(f"  STILL MISSING {coin}: {sp-p:+.2f} at {time.strftime('%m-%d %H:%M', time.gmtime(f['time']/1000))}")

json.dump(fills, open(f"{DATA}/fills_all.json", "w"))
print(f"FINAL: {len(fills)} fills")

# Validate against UI positions
by_coin = defaultdict(list)
for f in fills: by_coin[f["coin"]].append(f)
final_pos = {coin: float(fl[-1]["startPosition"]) + signed(fl[-1]) for coin, fl in by_coin.items()}
print("\nFinal positions (last fill startPosition + fill):")
for coin, p in sorted(final_pos.items(), key=lambda x: -abs(x[1]))[:15]:
    print(f"  {coin:<15} {p:>12.2f}")
