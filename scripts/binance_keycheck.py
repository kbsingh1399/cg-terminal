#!/usr/bin/env python3
"""Read-only classification of the user-provided Binance API credentials.

Probes signed GET account endpoints on all four environments (futures/spot
x testnet/mainnet). Prints ONLY environment name + HTTP status + non-secret
account facts. Never prints the API key/secret. Read-only: no order is ever
placed by this script.
"""
import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

ENV_PATH = "/home/z/my-project/.env"
TIMEOUT = 10

def load_env(path):
    out = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out

def signed_get(base, path, key, secret):
    params = {"timestamp": int(time.time() * 1000), "recvWindow": 5000}
    qs = urllib.parse.urlencode(params)
    sig = hmac.new(secret.encode(), qs.encode(), hashlib.sha256).hexdigest()
    url = f"{base}{path}?{qs}&signature={sig}"
    req = urllib.request.Request(url, headers={"X-MBX-APIKEY": key})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:200]
        return e.code, body
    except Exception as e:  # noqa: BLE001
        return None, str(e)[:120]

def summarize(status, body):
    if status == 200 and isinstance(body, dict):
        facts = []
        for k in ("canTrade", "canWithdraw", "canDeposit", "totalWalletBalance", "totalMarginBalance", "totalUnrealizedProfit"):
            if k in body:
                facts.append(f"{k}={body[k]}")
        n_bal = len(body.get("balances", [])) or len(body.get("assets", []))
        facts.append(f"entries={n_bal}")
        perms = body.get("permissions") or body.get("accountType")
        if perms:
            facts.append(f"perms={perms}")
        return "OK " + " ".join(facts)
    if isinstance(body, str):
        return f"HTTP {status} {body[:120]}"
    return f"HTTP {status} {json.dumps(body)[:120]}"

def main():
    env = load_env(ENV_PATH)
    key = env.get("BINANCE_API_KEY", "")
    secret = env.get("BINANCE_API_SECRET", "")
    if not key or not secret:
        print("NO CREDENTIALS in .env")
        return
    print(f"key loaded: {key[:4]}...{key[-4:]} (len {len(key)}) — classifying environment (read-only)")
    probes = [
        ("futures TESTNET", "https://testnet.binancefuture.com", "/fapi/v2/account"),
        ("spot    TESTNET", "https://testnet.binance.vision", "/api/v3/account"),
        ("futures MAINNET", "https://fapi.binance.com", "/fapi/v2/account"),
        ("spot    MAINNET", "https://api.binance.com", "/api/v3/account"),
    ]
    for name, base, path in probes:
        st, body = signed_get(base, path, key, secret)
        print(f"{name:17s} -> {summarize(st, body)}")

if __name__ == "__main__":
    main()
