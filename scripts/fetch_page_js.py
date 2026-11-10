#!/usr/bin/env python3
"""Download Coinglass page HTML + JS chunks for the LiquidityHeatmap and CVD pages,
then list the capi/fapi API endpoints each chunk references."""
import re, json, subprocess, sys, os

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
OUT = "/home/z/my-project/scripts/cg-js"
os.makedirs(OUT, exist_ok=True)

PAGES = {
    "heatmap": "https://www.coinglass.com/LiquidityHeatmap/BTC",
    "cvd": "https://www.coinglass.com/cvd/BTC",
}

def curl(url, extra=None):
    cmd = ["curl", "-s", "-L", "--max-time", "30", "-A", UA,
           "-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: en"]
    if extra:
        cmd += extra
    cmd.append(url)
    return subprocess.run(cmd, capture_output=True, text=True).stdout

for name, url in PAGES.items():
    html = curl(url)
    print(f"== {name}: html {len(html)} bytes")
    if not html:
        continue
    with open(f"{OUT}/{name}-page.html", "w") as f:
        f.write(html)
    # next.js chunk URLs look like /_next/static/chunks/....js
    chunks = sorted(set(re.findall(r'/_next/static/chunks/[^"\'\\]+?\.js', html)))
    print(f"   {len(chunks)} chunk refs in HTML")
    # also collect buildId for possible preload paths
    m = re.search(r'"buildId":"([^"]+)"', html)
    if m:
        print(f"   buildId={m.group(1)}")
    # download each chunk once (skip pages/_app style huge vendor chunks we already know)
    seen_eps = {}
    for c in chunks:
        cu = "https://www.coinglass.com" + c
        fn = f"{OUT}/{name}__{c.rsplit('/',1)[-1]}"
        if not os.path.exists(fn):
            body = curl(cu)
            if not body:
                continue
            with open(fn, "w") as f:
                f.write(body)
        else:
            with open(fn) as f:
                body = f.read()
        # find api endpoints
        eps = set(re.findall(r'["\'](?:/api/[A-Za-z0-9_/\-]+)', body))
        eps |= set(re.findall(r'(?:capi|fapi)\.coinglass\.com(/api/[A-Za-z0-9_/\-]+)', body))
        eps |= set(re.findall(r'["\'](?:/api/futures/[A-Za-z0-9_/\-]+)', body))
        if eps:
            for e in sorted(eps):
                seen_eps.setdefault(e, []).append(c.rsplit('/',1)[-1])
    print("   -- endpoints found --")
    for e, srcs in sorted(seen_eps.items()):
        print(f"   {e}   <- {srcs[0]}")
