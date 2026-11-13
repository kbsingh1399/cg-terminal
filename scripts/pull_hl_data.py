#!/usr/bin/env python3
"""Pull all Hyperliquid data for a wallet via the public info API with backoff."""
import json, time, urllib.request, sys, os

API = "https://api.hyperliquid.xyz/info"
WALLET = "0x76987ceada087975a0cedef7753f25bf86234480"
OUT = "/home/z/my-project/data"
os.makedirs(OUT, exist_ok=True)

def post(payload, retries=8):
    for i in range(retries):
        try:
            req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            code = getattr(e, 'code', None)
            wait = min(2 ** i, 30)
            if code == 429 or i < retries - 1:
                time.sleep(wait)
            else:
                raise
    return None

def pull_fills_by_time(wallet):
    """userFillsByTime: paginate backwards from now. Returns up to 5000/request? Actually 2000. Loop over time windows."""
    all_fills = []
    seen = set()
    # Wallet started trading ~ Nov 2025 (first portfolio point 1763591880023 = 2025-11-20)
    start_ms = 1763000000000  # 2025-11-13
    end_ms = int(time.time() * 1000)
    cur_end = end_ms
    while cur_end > start_ms:
        payload = {"type": "userFillsByTime", "user": wallet,
                   "startTime": max(start_ms, cur_end - 14 * 86400 * 1000), "endTime": cur_end}
        fills = post(payload)
        if fills is None:
            print("FAILED window", cur_end); break
        new = [f for f in fills if f["tid"] not in seen]
        for f in new: seen.add(f["tid"])
        all_fills.extend(new)
        if not fills:
            # empty window, jump back
            cur_end -= 14 * 86400 * 1000
        else:
            oldest = min(f["time"] for f in fills)
            print(f"window ending {time.strftime('%Y-%m-%d', time.gmtime(cur_end/1000))}: {len(fills)} fills (new {len(new)}), oldest {time.strftime('%Y-%m-%d %H:%M', time.gmtime(oldest/1000))}", flush=True)
            if len(new) == 0:
                cur_end = oldest - 1  # avoid infinite loop
            else:
                cur_end = oldest
            if len(fills) >= 1990:
                pass  # dense window, keep stepping back from oldest
        time.sleep(0.35)
    return all_fills

def main():
    # 1. Current state
    for name, payload in [
        ("state", {"type": "clearinghouseState", "user": WALLET}),
        ("funding", {"type": "userFunding", "user": WALLET}),
        ("portfolio", {"type": "portfolio", "user": WALLET}),
    ]:
        d = post(payload)
        if d is not None:
            json.dump(d, open(f"{OUT}/{name}.json", "w"))
            print(f"{name}: saved ({len(d) if isinstance(d, list) else 'obj'})")
        time.sleep(0.5)

    # 2. All fills (paginated)
    fills = pull_fills_by_time(WALLET)
    json.dump(fills, open(f"{OUT}/fills_all.json", "w"))
    print(f"TOTAL FILLS: {len(fills)}")

if __name__ == "__main__":
    main()
