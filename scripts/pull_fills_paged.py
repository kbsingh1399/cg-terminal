#!/usr/bin/env python3
"""Pull ALL fills for the Selini wallet in 12h windows, Nov 2 - now."""
import json, time, urllib.request, os

API = "https://api.hyperliquid.xyz/info"
W = "0x76987ceada087975a0cedef7753f25bf86234480"
OUT = "/home/z/my-project/data"

def post(payload, retries=8):
    for i in range(retries):
        try:
            req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            time.sleep(min(2 ** i, 20))
    return None

START = 1791110400000  # 2026-11-05 00:00 UTC (we already have Nov 2-4 from first pull)
END = int(time.time() * 1000)

all_fills = json.load(open(f"{OUT}/fills_all.json"))
seen = {f["tid"] for f in all_fills}
print(f"loaded {len(all_fills)} existing fills")

cur = START
step = 12 * 3600 * 1000
while cur < END:
    w_end = min(cur + step, END)
    d = post({"type": "userFillsByTime", "user": W, "startTime": cur, "endTime": w_end})
    if d is None:
        print("FAIL", time.strftime('%m-%d %H:%M', time.gmtime(cur/1000))); break
    new = [f for f in d if f["tid"] not in seen]
    for f in new: seen.add(f["tid"])
    all_fills.extend(new)
    print(f"{time.strftime('%m-%d %H:%M', time.gmtime(cur/1000))}-{time.strftime('%m-%d %H:%M', time.gmtime(w_end/1000))}: {len(d)} fills ({len(new)} new)", flush=True)
    if len(d) >= 1900:
        # dense: subdivide this window in 3h steps
        sub = cur
        substep = 3 * 3600 * 1000
        while sub < w_end:
            sub_end = min(sub + substep, w_end)
            d2 = post({"type": "userFillsByTime", "user": W, "startTime": sub, "endTime": sub_end})
            if d2:
                n2 = [f for f in d2 if f["tid"] not in seen]
                for f in n2: seen.add(f["tid"])
                all_fills.extend(n2)
                if len(d2) >= 1900:
                    print(f"  STILL DENSE {time.strftime('%m-%d %H:%M', time.gmtime(sub/1000))}: {len(d2)}", flush=True)
            time.sleep(0.3)
            sub = sub_end
    cur = w_end
    time.sleep(0.35)

json.dump(all_fills, open(f"{OUT}/fills_all.json", "w"))
all_fills.sort(key=lambda f: f["time"])
print(f"TOTAL: {len(all_fills)} fills, {time.strftime('%Y-%m-%d %H:%M', time.gmtime(all_fills[0]['time']/1000))} -> {time.strftime('%Y-%m-%d %H:%M', time.gmtime(all_fills[-1]['time']/1000))}")
