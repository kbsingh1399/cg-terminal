import ctypes
import ctypes.wintypes
import time

u = ctypes.windll.user32
hDesk = u.OpenDesktopW("Default", 0, False, 0x01FF)
u.SetThreadDesktop(hDesk)

hwnd_mt5 = u.FindWindowW("MetaQuotes::MetaTrader::5.00", None)
print(f"MT5 Window: {hwnd_mt5}")
if not hwnd_mt5:
    # Try finding by title
    def find_mt5(h, _):
        buf = ctypes.create_unicode_buffer(256)
        u.GetWindowTextW(h, buf, 256)
        if "FundedNext" in buf.value:
            hwnd_mt5 = h
            print(f"Found MT5 by title: {h} - {buf.value}")
        return True
    u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(find_mt5), 0)

u.SetForegroundWindow(hwnd_mt5)
time.sleep(0.2)

# Open F9
u.PostMessageW(hwnd_mt5, 0x0100, 0x78, 0)
u.PostMessageW(hwnd_mt5, 0x0101, 0x78, 0)
time.sleep(0.6)

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
u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)(find_dlg), 0)

print(f"Order Dialog: {dlg[0]}")
if dlg[0]:
    WM_SETTEXT = 0x000C
    # Set Volume to 0.01
    edit_vol = u.GetDlgItem(dlg[0], 10333)
    u.SendMessageW(edit_vol, WM_SETTEXT, 0, "0.01")
    
    # Read it back to verify
    buf = ctypes.create_unicode_buffer(256)
    u.GetWindowTextW(edit_vol, buf, 256)
    print(f"Set Volume readback: {buf.value}")
    
    # Set Stop Loss
    edit_sl = u.GetDlgItem(dlg[0], 10334)
    u.SendMessageW(edit_sl, WM_SETTEXT, 0, "1.0500")
    u.GetWindowTextW(edit_sl, buf, 256)
    print(f"Set SL readback: {buf.value}")
    
    # Set Take Profit
    edit_tp = u.GetDlgItem(dlg[0], 10336)
    u.SendMessageW(edit_tp, WM_SETTEXT, 0, "1.1000")
    u.GetWindowTextW(edit_tp, buf, 256)
    print(f"Set TP readback: {buf.value}")
    
    # Set Comment
    edit_comm = u.GetDlgItem(dlg[0], 1001)
    if edit_comm:
        u.SendMessageW(edit_comm, WM_SETTEXT, 0, "Test Comment")
        u.GetWindowTextW(edit_comm, buf, 256)
        print(f"Set Comment readback: {buf.value}")
        
    time.sleep(0.5)
    # Close dialog without placing
    u.SendMessageW(dlg[0], 0x0010, 0, 0)
    print("Closed dialog.")
