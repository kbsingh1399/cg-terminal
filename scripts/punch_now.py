import MetaTrader5 as mt5
import time

mt5.initialize()
sym = "XAUUSD"
mt5.symbol_select(sym, True)
tick = mt5.symbol_info_tick(sym)
info = mt5.symbol_info(sym)

filling = mt5.ORDER_FILLING_IOC
if info.filling_mode & mt5.ORDER_FILLING_FOK:
    filling = mt5.ORDER_FILLING_FOK
elif info.filling_mode & mt5.ORDER_FILLING_IOC:
    filling = mt5.ORDER_FILLING_IOC
else:
    filling = mt5.ORDER_FILLING_RETURN

print(f"XAUUSD Bid={tick.bid} Ask={tick.ask} Spread={tick.ask - tick.bid:.2f}")

# BUY 0.01
req = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": sym,
    "volume": 0.01,
    "type": mt5.ORDER_TYPE_BUY,
    "price": tick.ask,
    "deviation": 30,
    "magic": 888101,
    "comment": "Test Buy 0.01",
    "type_time": mt5.ORDER_TIME_GTC,
    "type_filling": filling,
}
res = mt5.order_send(req)
print(f"BUY  retcode={res.retcode} comment={res.comment}")
if res.retcode == mt5.TRADE_RETCODE_DONE:
    print(f"  -> SUCCESS ticket={res.order} deal={res.deal} price={res.price}")

# SELL 0.01
time.sleep(1)
tick2 = mt5.symbol_info_tick(sym)
req2 = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": sym,
    "volume": 0.01,
    "type": mt5.ORDER_TYPE_SELL,
    "price": tick2.bid,
    "deviation": 30,
    "magic": 888102,
    "comment": "Test Sell 0.01",
    "type_time": mt5.ORDER_TIME_GTC,
    "type_filling": filling,
}
res2 = mt5.order_send(req2)
print(f"SELL retcode={res2.retcode} comment={res2.comment}")
if res2.retcode == mt5.TRADE_RETCODE_DONE:
    print(f"  -> SUCCESS ticket={res2.order} deal={res2.deal} price={res2.price}")

# Show positions
pos = mt5.positions_get()
count = len(pos) if pos else 0
print(f"Open positions: {count}")
if pos:
    for p in pos:
        side = "BUY" if p.type == 0 else "SELL"
        print(f"  {p.symbol} {side} {p.volume} @ {p.price_open} profit={p.profit}")

mt5.shutdown()
