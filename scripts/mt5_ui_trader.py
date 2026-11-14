import ctypes
import ctypes.wintypes
import time
import pyperclip
import pyautogui
import MetaTrader5 as mt5

u = ctypes.windll.user32
k = ctypes.windll.kernel32

BM_CLICK = 0x00F5
EM_SETSEL = 0x00B1
WM_PASTE = 0x0302
WM_GETTEXT = 0x000D
WM_CLOSE = 0x0010
WM_COMMAND = 0x0111
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
EN_CHANGE = 0x0300
VK_F9 = 0x78
VK_RETURN = 0x0D

pyautogui.FAILSAFE = False

def attach_desktop():
    hDesk = u.OpenDesktopW("Default", 0, False, 0x01FF)
    if not hDesk:
        raise RuntimeError("Failed to open WinSta0\\Default desktop")
    if not u.SetThreadDesktop(hDesk):
        raise RuntimeError("Failed to set thread desktop")

def get_mt5_window():
    attach_desktop()
    hwnd_mt5 = [None]
    def cb(h, _):
        cbuf = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(h, cbuf, 256)
        if "MetaTrader" in cbuf.value or "MetaQuotes" in cbuf.value:
            buf = ctypes.create_unicode_buffer(256)
            u.GetWindowTextW(h, buf, 256)
            if "FundedNext" in buf.value:
                hwnd_mt5[0] = h
        return True
    u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(cb), 0)
    return hwnd_mt5[0]

def bring_mt5_to_front(hwnd_mt5=None):
    attach_desktop()
    if not hwnd_mt5:
        hwnd_mt5 = get_mt5_window()
    u.keybd_event(0x12, 0, 0, 0)
    u.ShowWindow(hwnd_mt5, 3) # Maximize
    u.SetForegroundWindow(hwnd_mt5)
    u.keybd_event(0x12, 0, 2, 0)
    time.sleep(0.2)

def activate_chart_for_symbol(hwnd_mt5, symbol):
    """Activates or switches active chart to the requested symbol via fast navigation."""
    attach_desktop()
    bring_mt5_to_front(hwnd_mt5)
    target_sym = symbol.upper().strip()
    
    # Check if active chart is already target_sym
    buf = ctypes.create_unicode_buffer(512)
    u.GetWindowTextW(hwnd_mt5, buf, 512)
    if f"[{target_sym}," in buf.value:
        return True
        
    # Click center of chart to focus it
    pyautogui.click(800, 400)
    time.sleep(0.15)
    
    # Press Enter to open fast nav box
    pyautogui.press("enter")
    time.sleep(0.2)
    
    # Type symbol and commit with Enter
    pyautogui.typewrite(target_sym, interval=0.03)
    time.sleep(0.1)
    pyautogui.press("enter")
    time.sleep(0.4)
    return True

def close_stray_order_dialogs():
    attach_desktop()
    def close_cb(h, _):
        cbuf = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(h, cbuf, 256)
        if cbuf.value == "#32770":
            buf = ctypes.create_unicode_buffer(256)
            u.GetWindowTextW(h, buf, 256)
            if "Order" in buf.value:
                u.SendMessageW(h, WM_CLOSE, 0, 0)
        return True
    u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(close_cb), 0)

def open_order_dialog(hwnd_mt5):
    """Opens the Order dialog via F9 and returns its handle and child control dict."""
    attach_desktop()
    bring_mt5_to_front(hwnd_mt5)
    close_stray_order_dialogs()
    time.sleep(0.15)
    
    pyautogui.press("f9")
    
    dlg = [None]
    def find_dlg(h, _):
        cbuf = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(h, cbuf, 256)
        if cbuf.value == "#32770":
            buf = ctypes.create_unicode_buffer(256)
            u.GetWindowTextW(h, buf, 256)
            if "Order" in buf.value:
                dlg[0] = h
        return True
        
    for _ in range(15):
        time.sleep(0.2)
        u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(find_dlg), 0)
        if dlg[0]:
            break
            
    if not dlg[0]:
        raise RuntimeError("Order dialog did not appear after F9")
        
    hDlg = dlg[0]
    ctrls = get_dialog_controls(hDlg)
    return hDlg, ctrls

def get_dialog_controls(hDlg):
    ctrls = {}
    def enum_ctrls(h, _):
        cid = u.GetDlgCtrlID(h)
        if cid:
            ctrls[cid] = h
        return True
    u.EnumChildWindows(hDlg, ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(enum_ctrls), 0)
    return ctrls

def paste_val(hCtrl, val):
    if not hCtrl or val is None:
        return
    u.SendMessageW(hCtrl, EM_SETSEL, 0, -1)
    pyperclip.copy(str(val))
    u.SendMessageW(hCtrl, WM_PASTE, 0, 0)

def click_spin(hSpin):
    if not hSpin:
        return
    r = ctypes.wintypes.RECT()
    u.GetClientRect(hSpin, ctypes.byref(r))
    x = (r.right - r.left) // 2
    y = max(1, (r.bottom - r.top) // 4)
    lparam = (y << 16) | (x & 0xFFFF)
    u.SendMessageW(hSpin, WM_LBUTTONDOWN, 1, lparam)
    u.SendMessageW(hSpin, WM_LBUTTONUP, 0, lparam)
    time.sleep(0.15)

def punch_order(symbol, order_type, volume, price=None, sl=None, tp=None, comment="UI Trader"):
    """
    Punches any order type via MT5 GUI automation.
    order_type: 'BUY', 'SELL', 'BUY LIMIT', 'SELL LIMIT', 'BUY STOP', 'SELL STOP'
    """
    order_type = order_type.upper().strip()
    hwnd_mt5 = get_mt5_window()
    if not hwnd_mt5:
        raise RuntimeError("MT5 window not found")
        
    print(f"[*] Activating chart for {symbol}...")
    activate_chart_for_symbol(hwnd_mt5, symbol)
    time.sleep(0.2)
    
    print(f"[*] Opening Order Dialog...")
    hDlg, ctrls = open_order_dialog(hwnd_mt5)
    
    buf = ctypes.create_unicode_buffer(256)
    u.GetWindowTextW(hDlg, buf, 256)
    print(f"[*] Dialog opened: [{buf.value}]")
    
    try:
        if order_type in ["BUY", "SELL"]:
            # Market Execution tab
            btn_market = ctrls.get(11116)
            if btn_market:
                u.SendMessageW(btn_market, BM_CLICK, 0, 0)
                time.sleep(0.2)
                ctrls = get_dialog_controls(hDlg)
                
            paste_val(ctrls.get(10333), f"{volume:.2f}")
            if sl is not None:
                paste_val(ctrls.get(10334), f"{sl}")
            if tp is not None:
                paste_val(ctrls.get(10336), f"{tp}")
            if comment:
                paste_val(ctrls.get(1001), comment)
                
            time.sleep(0.2)
            btn_id = 10408 if order_type == "BUY" else 10409
            btn_action = ctrls.get(btn_id)
            print(f"[*] Clicking {'Buy' if order_type == 'BUY' else 'Sell'} by Market (enabled={bool(u.IsWindowEnabled(btn_action))})...")
            u.SendMessageW(btn_action, BM_CLICK, 0, 0)
            time.sleep(0.8)
            
        elif order_type in ["BUY LIMIT", "SELL LIMIT", "BUY STOP", "SELL STOP"]:
            tab_id = 11117 if "LIMIT" in order_type else 11118
            btn_tab = ctrls.get(tab_id)
            u.SendMessageW(btn_tab, BM_CLICK, 0, 0)
            time.sleep(0.25)
            
            ctrls = get_dialog_controls(hDlg)
            
            # Click spin to initialize price field in MT5
            click_spin(ctrls.get(10356))
            
            # Set values
            paste_val(ctrls.get(10333), f"{volume:.2f}")
            paste_val(ctrls.get(10424), f"{price}")
            if sl is not None:
                paste_val(ctrls.get(10334), f"{sl}")
            if tp is not None:
                paste_val(ctrls.get(10336), f"{tp}")
            if comment:
                paste_val(ctrls.get(1001), comment)
                
            time.sleep(0.2)
            # Buy button = 11135, Sell button = 11134
            is_buy = "BUY" in order_type
            btn_id = 11135 if is_buy else 11134
            btn_action = ctrls.get(btn_id)
            print(f"[*] Placing {order_type} @ {price} with vol {volume:.2f} (enabled={bool(u.IsWindowEnabled(btn_action))})...")
            u.SendMessageW(btn_action, BM_CLICK, 0, 0)
            time.sleep(0.8)
            
    finally:
        if u.IsWindow(hDlg):
            u.SendMessageW(hDlg, WM_CLOSE, 0, 0)

if __name__ == "__main__":
    wnd = get_mt5_window()
    print(f"Found MT5 Window: {wnd}")
