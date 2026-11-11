import sys
import os
sys.path.insert(0, os.path.abspath("scripts"))
import time
import MetaTrader5 as mt5
import mt5_ui_trader as trader

mt5.initialize()
orders_before = {o.ticket: o for o in (mt5.orders_get() or [])}
print(f"[*] Orders before test: {list(orders_before.keys())}")

# Place BUY LIMIT on BTCUSD @ 50,000 (well below 73,000)
sym = "BTCUSD"
price = 50000.0
vol = 0.01

print(f"\n--- [TEST 1] Placing BUY LIMIT {vol} {sym} @ {price} ---")
trader.punch_order(sym, "BUY LIMIT", vol, price=price, sl=49500.0, tp=51000.0, comment="Test UI Limit")

time.sleep(1.5)

orders_after = {o.ticket: o for o in (mt5.orders_get() or [])}
print(f"[*] Orders after test: {list(orders_after.keys())}")

new_tickets = [t for t in orders_after if t not in orders_before]
if new_tickets:
    new_order = orders_after[new_tickets[0]]
    print(f"\n[+] SUCCESS! New Order Placed: Ticket={new_order.ticket}, Symbol={new_order.symbol}, Type={new_order.type}, Price={new_order.price_open}, Vol={new_order.volume_current}, SL={new_order.sl}, TP={new_order.tp}, Comment={new_order.comment}")
else:
    print("\n[-] Order not detected in orders_get(). Checking why...")

mt5.shutdown()
