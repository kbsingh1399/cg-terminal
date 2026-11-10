#!/usr/bin/env python3
"""MT5 snapshot -> desk/mt5.json: account, open positions, running PnL,
bid/ask/spread for every mapped asset (from desk/state.json symbol_map).

Requirements (Windows only): MetaTrader5 terminal RUNNING + `pip install MetaTrader5`.
The desk daemon (scripts/desk_daemon.mjs) calls this every mt5.interval_secs.
Output is committed to git — zai-desk reads it on every wake to review
running trades and quote honest spreads. Errors are reported, never guessed.
"""
import json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "desk" / "mt5.json"
TERMINAL = "http://127.0.0.1:3000/api/cg"


def perp_price(asset):
    """Terminal perp mid price (the terminal runs on this same PC)."""
    try:
        with urllib.request.urlopen(f"{TERMINAL}/live?sym={asset}", timeout=5) as r:
            d = json.loads(r.read())
        if d.get("ok") and d.get("price"):
            return float(d["price"])
    except Exception:
        pass
    return None


def fail(msg):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "ts": int(time.time() * 1000), "error": msg,
        "account": None, "floating": None, "positions": [], "spreads": {},
    }, indent=2) + "\n")
    print(f"[mt5_report] {msg}", file=sys.stderr)
    sys.exit(1)


try:
    import MetaTrader5 as mt5
except Exception as e:  # not installed / not Windows
    fail(f"MetaTrader5 python package unavailable: {e} (pip install MetaTrader5, Windows only)")

if not mt5.initialize(timeout=15_000):
    fail(f"mt5.initialize failed: {mt5.last_error()} (is the MT5 terminal running?)")

try:
    acc = mt5.account_info()
    if acc is None:
        fail(f"account_info failed: {mt5.last_error()}")
    a = acc._asdict()
    account = {k: a.get(k) for k in
               ("login", "currency", "leverage", "balance", "equity",
                "margin", "margin_free", "margin_level", "profit")}

    state = json.loads((ROOT / "desk" / "state.json").read_text())
    smap = state.get("config", {}).get("symbol_map", {})
    rev = {v: k for k, v in smap.items()}

    positions = []
    for p in (mt5.positions_get() or []):
        d = p._asdict()
        positions.append({
            "ticket": d.get("ticket"),
            "asset": rev.get(d.get("symbol")),
            "symbol": d.get("symbol"),
            "side": "buy" if d.get("type") == 0 else "sell",
            "volume": d.get("volume"),
            "open": d.get("price_open"),
            "current": d.get("price_current"),
            "sl": d.get("sl"), "tp": d.get("tp"),
            "profit": round(float(d.get("profit", 0.0)), 2),
            "swap": round(float(d.get("swap", 0.0)), 2),
            "comment": d.get("comment"),
            "openedTs": int(d.get("time", 0)) * 1000,
        })
    floating = round(sum(p["profit"] + p["swap"] for p in positions), 2)

    # pending orders (limits/stops not yet filled) — the desk's eyes on
    # unexecuted tickets (e.g. verifying a placement or a cancel)
    ORDER_TYPES = {0: "buy", 1: "sell", 2: "buy_limit", 3: "sell_limit",
                   4: "buy_stop", 5: "sell_stop", 6: "buy_stop_limit", 7: "sell_stop_limit"}
    orders = []
    for o in (mt5.orders_get() or []):
        d = o._asdict()
        orders.append({
            "ticket": d.get("ticket"),
            "asset": rev.get(d.get("symbol")),
            "symbol": d.get("symbol"),
            "type": ORDER_TYPES.get(d.get("type"), str(d.get("type"))),
            "volume": d.get("volume_current"),
            "price": d.get("price_open"),
            "sl": d.get("sl"), "tp": d.get("tp"),
            "placedTs": int(d.get("time_setup", 0)) * 1000,
            "comment": d.get("comment"),
        })

    spreads = {}
    for asset, sym in sorted(smap.items()):
        try:
            mt5.symbol_select(sym, True)
            t = mt5.symbol_info_tick(sym)
            info = mt5.symbol_info(sym)
            if t is None or info is None:
                spreads[sym] = {"ok": False, "reason": "no tick — check broker symbol name/suffix in config.symbol_map"}
                continue
            mid = (t.ask + t.bid) / 2 if (t.ask + t.bid) > 0 else None
            pp = perp_price(asset)
            basis = round((mid / pp - 1) * 100, 4) if (mid and pp) else None
            spreads[sym] = {
                "ok": True, "bid": t.bid, "ask": t.ask,
                "spreadPoints": round((t.ask - t.bid) / info.point, 1) if info.point else None,
                "spreadPct": round((t.ask - t.bid) / mid * 100, 4) if mid else None,
                "tradeAllowed": info.trade_mode == 4,  # SYMBOL_TRADE_MODE_FULL
                "asset": asset,
                "perpMid": pp,                # terminal price the levels are built from
                "basisPct": basis,            # mt5 mid vs perp mid, % — translate levels: mt5 = perp * (1 + basis/100)
                # broker contract specs — sizing math: risk$ = stopDist × contractSize × lots
                "spec": {
                    "contractSize": info.trade_contract_size,
                    "volumeMin": info.volume_min,
                    "volumeStep": info.volume_step,
                    "volumeMax": info.volume_max,
                    "tickValue": info.trade_tick_value,
                    "tickSize": info.trade_tick_size,
                    "stopsLevelPoints": info.trade_stops_level,
                    "currencyProfit": info.currency_profit,
                },
            }
        except Exception as e:
            spreads[sym] = {"ok": False, "reason": str(e)[:120]}

    # DIR-0004: fetch funding & open interest positioning for top assets
    positioning = {}
    top_symbols = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XAU"]
    for s in top_symbols:
        try:
            with urllib.request.urlopen(f"{TERMINAL}/funding?sym={s}", timeout=3) as r:
                f_data = json.loads(r.read())
            with urllib.request.urlopen(f"{TERMINAL}/oi?sym={s}", timeout=3) as r:
                oi_data = json.loads(r.read())
            f_agg = f_data.get("aggregate", {})
            oi_agg = oi_data.get("aggregate", {})
            positioning[s] = {
                "fundingPct8h": f_agg.get("fundingPct8h"),
                "oiUsd": oi_agg.get("oiUsd"),
                "oiDelta1hPct": oi_agg.get("oiDelta1hPct"),
                "oiDelta4hPct": oi_agg.get("oiDelta4hPct"),
                "oiDelta24hPct": oi_agg.get("oiDelta24hPct"),
            }
        except Exception as e:
            positioning[s] = {"error": str(e)[:100]}

    pos_file = ROOT / "desk" / "positioning.json"
    pos_file.write_text(json.dumps({
        "ts": int(time.time() * 1000),
        "positioning": positioning,
    }, indent=2) + "\n")

    OUT.write_text(json.dumps({
        "ts": int(time.time() * 1000), "error": None,
        "account": account,
        "floating": {"total": floating, "positions": len(positions)},
        "positions": positions,
        "orders": orders,   # pending (unfilled) orders — mt5.orders_get()
        "spreads": spreads,
        "positioning": positioning,
    }, indent=2) + "\n")
    print(f"[mt5_report] ok — {len(positions)} positions, {len(orders)} pending orders, floating {floating:+.2f} {account.get('currency')}")
finally:
    mt5.shutdown()
