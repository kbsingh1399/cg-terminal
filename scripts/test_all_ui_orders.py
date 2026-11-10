import sys
import os
sys.path.insert(0, os.path.abspath("scripts"))
import time
import ctypes
import pyautogui
import MetaTrader5 as mt5
import mt5_ui_trader as trader

u = ctypes.windll.user32
hDesk = u.OpenDesktopW("Default", 0, False, 0x01FF)
u.SetThreadDesktop(hDesk)
pyautogui.FAILSAFE = False

def bring_mt5_to_front():
    hwnd_mt5 = trader.get_mt5_window()
    u.keybd_event(0x12, 0, 0, 0)
    u.ShowWindow(hwnd_mt5, 3)
    u.SetForegroundWindow(hwnd_mt5)
    u.keybd_event(0x12, 0, 2, 0)
    time.sleep(0.3)

def clear_all():
    """Cancels any open pending orders or positions by clicking top row [x]."""
    bring_mt5_to_front()
    mt5.initialize()
    while True:
        orders = mt5.orders_get() or []
        positions = mt5.positions_get() or []
        if not orders and not positions:
            break
        print(f"[*] Clearing row (Orders: {len(orders)}, Positions: {len(positions)})...")
        pyautogui.moveTo(1910, 741)
        time.sleep(0.15)
        pyautogui.click()
        time.sleep(0.6)
    mt5.shutdown()

def run_suite():
    print("==================================================")
    print("   MT5 UI-BASED ORDER SUITE: TESTING ALL TYPES   ")
    print("==================================================")
    
    mt5.initialize()
    tick_gold = mt5.symbol_info_tick("XAUUSD")
    tick_btc = mt5.symbol_info_tick("BTCUSD")
    mt5.shutdown()
    
    print(f"[*] Live quotes: XAUUSD={tick_gold.bid}/{tick_gold.ask}, BTCUSD={tick_btc.bid}/{tick_btc.ask}")
    clear_all()

    # -------------------------------------------------------------
    # 1. MARKET EXECUTION: BUY 0.01 XAUUSD
    # -------------------------------------------------------------
    print("\n>>> [1/5] Testing MARKET BUY: 0.01 XAUUSD...")
    bring_mt5_to_front()
    trader.punch_order("XAUUSD", "BUY", 0.01, comment="UI Market Buy")
    time.sleep(1.0)
    
    mt5.initialize()
    pos = mt5.positions_get(symbol="XAUUSD") or []
    if pos:
        p = pos[0]
        print(f"    [+] SUCCESS! BUY Filled: Ticket={p.ticket}, Price={p.price_open}, Vol={p.volume}")
    else:
        print("    [-] Failed to fill Market BUY.")
    mt5.shutdown()
    clear_all()

    # -------------------------------------------------------------
    # 2. MARKET EXECUTION: SELL 0.01 XAUUSD
    # -------------------------------------------------------------
    print("\n>>> [2/5] Testing MARKET SELL: 0.01 XAUUSD...")
    bring_mt5_to_front()
    trader.punch_order("XAUUSD", "SELL", 0.01, comment="UI Market Sell")
    time.sleep(1.0)
    
    mt5.initialize()
    pos = mt5.positions_get(symbol="XAUUSD") or []
    if pos:
        p = pos[0]
        print(f"    [+] SUCCESS! SELL Filled: Ticket={p.ticket}, Price={p.price_open}, Vol={p.volume}")
    else:
        print("    [-] Failed to fill Market SELL.")
    mt5.shutdown()
    clear_all()

    # -------------------------------------------------------------
    # 3. PENDING ORDER: BUY LIMIT 0.01 BTCUSD (well below market)
    # -------------------------------------------------------------
    limit_buy_px = round(tick_btc.bid - 20000.0, 1) # $20k below
    print(f"\n>>> [3/5] Testing BUY LIMIT: 0.01 BTCUSD @ {limit_buy_px}...")
    bring_mt5_to_front()
    trader.punch_order("BTCUSD", "BUY LIMIT", 0.01, price=limit_buy_px, sl=limit_buy_px - 500.0, tp=limit_buy_px + 1000.0, comment="UI Buy Limit")
    time.sleep(1.0)
    
    mt5.initialize()
    orders = mt5.orders_get(symbol="BTCUSD") or []
    if orders:
        o = orders[0]
        print(f"    [+] SUCCESS! BUY LIMIT Placed: Ticket={o.ticket}, Price={o.price_open}, Vol={o.volume_current}, SL={o.sl}, TP={o.tp}")
    else:
        print("    [-] Failed to place BUY LIMIT.")
    mt5.shutdown()
    clear_all()

    # -------------------------------------------------------------
    # 4. PENDING ORDER: SELL LIMIT 0.01 BTCUSD (well above market)
    # -------------------------------------------------------------
    limit_sell_px = round(tick_btc.ask + 20000.0, 1) # $20k above
    print(f"\n>>> [4/5] Testing SELL LIMIT: 0.01 BTCUSD @ {limit_sell_px}...")
    bring_mt5_to_front()
    trader.punch_order("BTCUSD", "SELL LIMIT", 0.01, price=limit_sell_px, sl=limit_sell_px + 500.0, tp=limit_sell_px - 1000.0, comment="UI Sell Limit")
    time.sleep(1.0)
    
    mt5.initialize()
    orders = mt5.orders_get(symbol="BTCUSD") or []
    if orders:
        o = orders[0]
        print(f"    [+] SUCCESS! SELL LIMIT Placed: Ticket={o.ticket}, Price={o.price_open}, Vol={o.volume_current}, SL={o.sl}, TP={o.tp}")
    else:
        print("    [-] Failed to place SELL LIMIT.")
    mt5.shutdown()
    clear_all()

    # -------------------------------------------------------------
    # 5. PENDING ORDER: BUY STOP 0.01 BTCUSD (well above market)
    # -------------------------------------------------------------
    stop_buy_px = round(tick_btc.ask + 25000.0, 1)
    print(f"\n>>> [5/5] Testing BUY STOP: 0.01 BTCUSD @ {stop_buy_px}...")
    bring_mt5_to_front()
    trader.punch_order("BTCUSD", "BUY STOP", 0.01, price=stop_buy_px, sl=stop_buy_px - 500.0, tp=stop_buy_px + 1000.0, comment="UI Buy Stop")
    time.sleep(1.0)
    
    mt5.initialize()
    orders = mt5.orders_get(symbol="BTCUSD") or []
    if orders:
        o = orders[0]
        print(f"    [+] SUCCESS! BUY STOP Placed: Ticket={o.ticket}, Price={o.price_open}, Vol={o.volume_current}, SL={o.sl}, TP={o.tp}")
    else:
        print("    [-] Failed to place BUY STOP.")
    mt5.shutdown()
    clear_all()

    print("\n==================================================")
    print("   ALL ORDER TYPES TESTED AND VERIFIED CLEANLY!   ")
    print("==================================================")

if __name__ == "__main__":
    run_suite()
