import sys
import MetaTrader5 as mt5

def main():
    if not mt5.initialize():
        print("[!] Failed to initialize MT5:", mt5.last_error())
        sys.exit(1)

    term = mt5.terminal_info()
    acc = mt5.account_info()
    print(f"[*] Account: {acc.login} ({acc.server})")
    print(f"[*] Terminal trade_allowed (Algo Trading): {term.trade_allowed}")
    print(f"[*] Account trade_allowed: {acc.trade_allowed}")

    if not term.trade_allowed:
        print("[!] ERROR: Algo Trading is currently toggled OFF in MT5 client.")
        print("[!] Please click the 'Algo Trading' button in MT5 toolbar (or press Ctrl+O -> Expert Advisors -> Allow Algo Trading).")
        mt5.shutdown()
        sys.exit(2)

    sym = "XAUUSD"
    mt5.symbol_select(sym, True)
    tick = mt5.symbol_info_tick(sym)
    info = mt5.symbol_info(sym)

    if not tick or not info:
        print(f"[!] Could not get tick/info for {sym}")
        mt5.shutdown()
        sys.exit(1)

    print(f"[*] {sym} Bid: {tick.bid}, Ask: {tick.ask}")

    filling = mt5.ORDER_FILLING_IOC
    if info.filling_mode & mt5.ORDER_FILLING_FOK:
        filling = mt5.ORDER_FILLING_FOK
    elif info.filling_mode & mt5.ORDER_FILLING_IOC:
        filling = mt5.ORDER_FILLING_IOC
    else:
        filling = mt5.ORDER_FILLING_RETURN

    # 1. Test BUY 0.01
    print("\n--- [1] Punching BUY 0.01 XAUUSD ---")
    req_buy = {
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
    res_buy = mt5.order_send(req_buy)
    print("Buy Retcode:", res_buy.retcode if res_buy else "None")
    print("Buy Comment:", res_buy.comment if res_buy else "None")
    if res_buy and res_buy.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"[+] BUY SUCCESS! Deal Ticket: {res_buy.deal}, Order: {res_buy.order}")

    # 2. Test SELL 0.01
    tick = mt5.symbol_info_tick(sym)
    print("\n--- [2] Punching SELL 0.01 XAUUSD ---")
    req_sell = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": sym,
        "volume": 0.01,
        "type": mt5.ORDER_TYPE_SELL,
        "price": tick.bid,
        "deviation": 30,
        "magic": 888102,
        "comment": "Test Sell 0.01",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }
    res_sell = mt5.order_send(req_sell)
    print("Sell Retcode:", res_sell.retcode if res_sell else "None")
    print("Sell Comment:", res_sell.comment if res_sell else "None")
    if res_sell and res_sell.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"[+] SELL SUCCESS! Deal Ticket: {res_sell.deal}, Order: {res_sell.order}")

    mt5.shutdown()

if __name__ == "__main__":
    main()
