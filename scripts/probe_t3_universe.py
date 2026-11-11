#!/usr/bin/env python3
"""T3 universe probe — live-verify market-data coverage for the FundedNext
96-instrument expansion (research compendium input, 2026-11-11).

Probes:
  A. Terminal capability matrix — every /api/cg/* route with BTC (sanity) and
     US30 (Tier-3 symbol, expected registry rejection).
  B. Yahoo Finance chart API — the full known-complete FundedNext set
     (14 indices, 5 metals/energy, 9 cryptos cross-check) + FX majors/minors
     sample + equities sample. Records price/volume/exchange/timezone per sym.
  C. Binance fapi public endpoints for the 9 broker-listed cryptos (+ XPT/USO
     lead-instrument check that drives the OKX-lead decision).
  D. Stooq CSV endpoint retry (blocked-or-not documentation).

Writes scripts/t3_probe_results.json + prints a readable matrix.
"""
import json, time, urllib.request, urllib.error, sys

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
OUT = {"ts": int(time.time() * 1000), "sections": {}}


def fetch(url, timeout=12, headers=None):
    req = urllib.request.Request(url, headers=headers or UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return -1, str(e).encode()


def jbody(b):
    try:
        return json.loads(b)
    except Exception:
        return None


# ------------------------------------------------------------------ A. terminal
def probe_terminal():
    routes = [
        "/assets", "/market?sym={s}", "/fp?sym={s}", "/signals?sym={s}",
        "/cvd?sym={s}&itv=15m&limit=3", "/liqlevels?sym={s}&range=1d&lvR=4",
        "/lto?symbol={s}&minVolUsd=5000000",
        "/bookwalls?sym={s}&market=futures&interval=15m&limit=3",
        "/funding?sym={s}", "/oi?sym={s}", "/stopmap?sym={s}", "/ticker?sym={s}",
        "/kline?sym={s}", "/live?sym={s}", "/livebook?sym={s}",
        "/orderflow?sym={s}", "/orderflow-agg?sym={s}", "/largeorder?sym={s}",
        "/notifications?limit=3", "/engine/status",
    ]
    rows = []
    for r in routes:
        for s, tag in (("BTC", "sanity"), ("US30", "t3")):
            if "{s}" not in r:
                if s != "BTC":
                    continue
                path = r
            else:
                path = r.format(s=s)
            st, b = fetch(f"http://localhost:3000/api/cg{path}", timeout=30)
            j = jbody(b)
            note = ""
            if j and isinstance(j, dict):
                note = (j.get("error") or ("ok" if j.get("ok") else list(j.keys())[:5]).__str__())[:60] if not j.get("ok") else "ok"
            rows.append({"route": path, "probe_sym": s, "status": st, "note": note[:80]})
            time.sleep(0.1)
    OUT["sections"]["terminal"] = rows
    return rows


# ------------------------------------------------------------------ B. yahoo
YAHOO_SETS = {
    "indices": {
        "US30": "^DJI", "SPX500": "^GSPC", "NDX100": "^NDX", "US2000": "^RUT",
        "VIX": "^VIX", "GER30": "^GDAXI", "UK100": "^FTSE", "FRA40": "^FCHI",
        "EUSTX50": "^STOXX50E", "SWI20": "^SSMI", "NTH25": "^AEX",
        "JP225": "^N225", "HK50": "^HSI", "AUS200": "^AXJO",
    },
    "commodities_metals": {
        "XAU": "GC=F", "XAG": "SI=F", "XPT": "PL=F", "USO": "CL=F", "UKO": "BZ=F",
        "XAU_spot": "XAUUSD=X", "XAG_spot": "XAGUSD=X",
    },
    "crypto_xcheck": {
        "BTC": "BTC-USD", "ETH": "ETH-USD", "XRP": "XRP-USD", "ADA": "ADA-USD",
        "DOGE": "DOGE-USD", "LINK": "LINK-USD", "LTC": "LTC-USD",
        "XLM": "XLM-USD", "XMR": "XMR-USD",
    },
    "index_futures": {
        "SPX500_fut": "ES=F", "NDX100_fut": "NQ=F", "US30_fut": "YM=F",
        "US2000_fut": "RTY=F", "VIX_fut": "VX=F",
    },
    "fx": {
        "AUDCAD": "AUDCAD=X", "AUDCHF": "AUDCHF=X", "AUDJPY": "AUDJPY=X",
        "AUDNZD": "AUDNZD=X", "AUDSGD": "AUDSGD=X", "AUDUSD": "AUDUSD=X",
        "CADCHF": "CADCHF=X", "CADJPY": "CADJPY=X", "CHFJPY": "CHFJPY=X",
        "EURAUD": "EURAUD=X", "EURCAD": "EURCAD=X", "EURCHF": "EURCHF=X",
        "EURGBP": "EURGBP=X", "EURHKD": "EURHKD=X", "EURJPY": "EURJPY=X",
        "EURNOK": "EURNOK=X", "EURNZD": "EURNZD=X", "EURSGD": "EURSGD=X",
        "EURUSD": "EURUSD=X", "GBPAUD": "GBPAUD=X", "GBPCAD": "GBPCAD=X",
        "GBPCHF": "GBPCHF=X", "GBPJPY": "GBPJPY=X", "GBPNZD": "GBPNZD=X",
        "GBPSGD": "GBPSGD=X", "GBPUSD": "GBPUSD=X", "NZDCAD": "NZDCAD=X",
        "NZDCHF": "NZDCHF=X", "NZDJPY": "NZDJPY=X", "NZDSGD": "NZDSGD=X",
        "SGDJPY": "SGDJPY=X", "USDCAD": "USDCAD=X", "USDCHF": "USDCHF=X",
        "USDCNH": "USDCNH=X", "USDDKK": "USDDKK=X", "USDHUF": "USDHUF=X",
        "USDJPY": "USDJPY=X", "USDMXN": "USDMXN=X", "USDNOK": "USDNOK=X",
        "USDSEK": "USDSEK=X", "USDSGD": "USDSGD=X", "USDZAR": "USDZAR=X",
        "NZDUSD": "NZDUSD=X",
    },
    "equities": {
        "AAPL": "AAPL", "AMZN": "AMZN", "GOOG": "GOOG", "MSFT": "MSFT",
        "NVDA": "NVDA", "TSLA": "TSLA", "AMD": "AMD", "SPCX": "SPCX",
        "META": "META", "BABA": "BABA", "NFLX": "NFLX", "INTC": "INTC",
        "NKE": "NKE", "KO": "KO", "MBG": "MBG.DE", "BAYN": "BAYN.DE",
        "MC": "MC.PA", "VOW3": "VOW3.DE", "ADS": "ADS.DE", "BMW": "BMW.DE",
    },
}


def probe_yahoo():
    res = {}
    for set_name, syms in YAHOO_SETS.items():
        res[set_name] = {}
        for fn, y in syms.items():
            st, b = fetch(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(y)}?interval=15m&range=1d")
            j = jbody(b)
            row = {"yahoo": y, "status": st}
            if st == 200 and j and j.get("chart", {}).get("result"):
                m = j["chart"]["result"][0].get("meta", {})
                try:
                    bars = j["chart"]["result"][0]["indicators"]["quote"][0] or {}
                except Exception:
                    bars = {}
                vols = [v for v in (bars.get("volume") or []) if v]
                row.update({
                    "price": m.get("regularMarketPrice"),
                    "instrumentType": m.get("instrumentType"),
                    "exchange": m.get("fullExchangeName") or m.get("exchangeName"),
                    "tz": m.get("exchangeTimezoneName"),
                    "has_volume": bool(vols),
                    "n_bars_15m_1d": len(bars.get("close") or []),
                    "market_time": m.get("regularMarketTime"),
                })
            elif j and j.get("chart", {}).get("error"):
                row["err"] = (j["chart"]["error"].get("description") or "")[:70]
            res[set_name][fn] = row
            time.sleep(0.25)
    # interval granularity + history depth checks on representatives
    depth = {}
    for fn, y in [("US30", "^DJI"), ("EURUSD", "EURUSD=X"), ("AAPL", "AAPL"), ("XPT", "PL=F"), ("UKO", "BZ=F"), ("BTC", "BTC-USD")]:
        row = {}
        for itv, rng in [("1m", "1d"), ("5m", "5d"), ("15m", "5d"), ("1h", "1mo"), ("1d", "1y")]:
            st, b = fetch(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(y)}?interval={itv}&range={rng}")
            j = jbody(b)
            if st == 200 and j and j.get("chart", {}).get("result"):
                try:
                    bars = j["chart"]["result"][0]["indicators"]["quote"][0] or {}
                except Exception:
                    bars = {}
                row[f"{itv}/{rng}"] = len(bars.get("close") or [])
            else:
                row[f"{itv}/{rng}"] = f"HTTP {st}"
            time.sleep(0.25)
        depth[fn] = row
    OUT["sections"]["yahoo"] = res
    OUT["sections"]["yahoo_depth"] = depth
    return res, depth


# ------------------------------------------------------------------ C. binance
def probe_binance():
    res = {}
    cryptos = ["BTC", "ETH", "XRP", "ADA", "DOGE", "LINK", "LTC", "XLM", "XMR", "XPT", "USO", "UKO", "XAU", "XAG"]
    for c in cryptos:
        row = {}
        # kline
        st, b = fetch(f"https://fapi.binance.com/fapi/v1/klines?symbol={c}USDT&interval=15m&limit=2")
        row["perp_kline"] = "ok" if st == 200 else f"HTTP {st}"
        # funding
        st, b = fetch(f"https://fapi.binance.com/fapi/v1/premiumIndex?symbol={c}USDT")
        row["premium_funding"] = "ok" if st == 200 else f"HTTP {st}"
        # OI
        st, b = fetch(f"https://fapi.binance.com/fapi/v1/openInterest?symbol={c}USDT")
        row["open_interest"] = "ok" if st == 200 else f"HTTP {st}"
        res[c] = row
        time.sleep(0.2)
    OUT["sections"]["binance"] = res
    return res


# ------------------------------------------------------------------ D. stooq
def probe_stooq():
    tests = {
        "spx_csv": "https://stooq.com/q/l/?s=%5Espx&f=sd2t2ohlcv&h&e=csv",
        "eurusd_csv": "https://stooq.com/q/l/?s=eurusd&f=sd2t2ohlcv&h&e=csv",
        "hist_daily": "https://stooq.com/q/d/l/?s=%5Espx&i=d",
    }
    res = {}
    for k, u in tests.items():
        st, b = fetch(u, headers={**UA, "Accept": "text/csv"})
        body = b[:120].decode("utf-8", "replace") if isinstance(b, bytes) else str(b)[:120]
        res[k] = {"status": st, "body_head": body}
    OUT["sections"]["stooq"] = res
    return res


if __name__ == "__main__":
    print("A. terminal capability matrix ...")
    t = probe_terminal()
    ok_btc = sum(1 for r in t if r["probe_sym"] == "BTC" and r["status"] == 200)
    rej_t3 = sum(1 for r in t if r["probe_sym"] == "US30" and r["status"] == 400)
    print(f"   BTC sanity: {ok_btc}/{sum(1 for r in t if r['probe_sym']=='BTC')} routes 200 · US30 rejected: {rej_t3}/{sum(1 for r in t if r['probe_sym']=='US30')}")
    print("B. yahoo coverage ...")
    y, depth = probe_yahoo()
    for set_name, syms in y.items():
        ok = [k for k, v in syms.items() if v.get("status") == 200 and v.get("price") is not None]
        nofix = [k for k, v in syms.items() if v.get("status") != 200 or v.get("price") is None]
        novol = [k for k, v in syms.items() if v.get("status") == 200 and not v.get("has_volume")]
        print(f"   {set_name}: {len(ok)}/{len(syms)} OK · no-volume: {novol if novol else '-'}" + (f" · FAILED: {nofix}" if nofix else ""))
    print("   depth:", json.dumps(depth)[:400])
    print("C. binance ...")
    bn = probe_binance()
    for c, r in bn.items():
        print(f"   {c}: kline={r['perp_kline']} funding={r['premium_funding']} oi={r['open_interest']}")
    print("D. stooq ...")
    print("  ", json.dumps(probe_stooq(), indent=1)[:500])
    with open("/home/z/my-project/scripts/t3_probe_results.json", "w") as f:
        json.dump(OUT, f, indent=1)
    print("\nsaved scripts/t3_probe_results.json")
