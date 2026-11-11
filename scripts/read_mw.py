import ctypes
import ctypes.wintypes

u = ctypes.windll.user32
k = ctypes.windll.kernel32

hDesk = u.OpenDesktopW("Default", 0, False, 0x01FF)
u.SetThreadDesktop(hDesk)

hwnd_mt5 = u.FindWindowW("MetaQuotes::MetaTrader::5.00", None)

hwnd_lv = 1508930 # Market watch
cnt = u.SendMessageW(hwnd_lv, 0x1004, 0, 0)
print(f"Total items in MW: {cnt}")

pid = ctypes.wintypes.DWORD()
u.GetWindowThreadProcessId(hwnd_lv, ctypes.byref(pid))
hProc = k.OpenProcess(0x1F0FFF, False, pid.value)

class LVITEMW(ctypes.Structure):
    _fields_ = [
        ("mask", ctypes.wintypes.UINT),
        ("iItem", ctypes.c_int),
        ("iSubItem", ctypes.c_int),
        ("state", ctypes.wintypes.UINT),
        ("stateMask", ctypes.wintypes.UINT),
        ("pszText", ctypes.c_void_p),
        ("cchTextMax", ctypes.c_int),
        ("iImage", ctypes.c_int),
        ("lParam", ctypes.c_void_p),
        ("iIndent", ctypes.c_int),
        ("iGroupId", ctypes.c_int),
        ("cColumns", ctypes.wintypes.UINT),
        ("puColumns", ctypes.c_void_p),
        ("piColFmt", ctypes.c_void_p),
        ("iGroup", ctypes.c_int),
    ]

# Allocate remote memory
BUF_SIZE = 512
pRemote = k.VirtualAllocEx(hProc, None, ctypes.sizeof(LVITEMW) + BUF_SIZE, 0x1000, 0x04)
pTextRemote = pRemote + ctypes.sizeof(LVITEMW)

LVIF_TEXT = 0x0001
LVM_GETITEMTEXTW = 0x1073

symbols = {}
for i in range(cnt):
    lvi = LVITEMW()
    lvi.iItem = i
    lvi.iSubItem = 0
    lvi.mask = LVIF_TEXT
    lvi.pszText = pTextRemote
    lvi.cchTextMax = 250
    
    k.WriteProcessMemory(hProc, pRemote, ctypes.byref(lvi), ctypes.sizeof(LVITEMW), None)
    u.SendMessageW(hwnd_lv, LVM_GETITEMTEXTW, i, pRemote)
    
    buf = ctypes.create_unicode_buffer(256)
    k.ReadProcessMemory(hProc, pTextRemote, ctypes.byref(buf), 256 * 2, None)
    symbols[buf.value] = i
    print(f"Index {i:2d}: {buf.value}")

k.VirtualFreeEx(hProc, pRemote, 0, 0x8000)
k.CloseHandle(hProc)
