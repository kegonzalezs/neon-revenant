import ctypes, ctypes.wintypes as wt, time, sys
from PIL import ImageGrab

u = ctypes.windll.user32
k = ctypes.windll.kernel32
SW_RESTORE = 9
HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_SHOWWINDOW = 0x0040

# proceso principal de electron (el que tiene ventana de primer nivel)
import subprocess
out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq electron.exe', '/FO', 'CSV', '/NH'],
                     capture_output=True, text=True).stdout
pids = []
for line in out.splitlines():
    parts = [p.strip('"') for p in line.split('","')]
    if len(parts) > 1 and parts[1].isdigit():
        pids.append(int(parts[1]))
print('pids electron:', pids)

found = []
@ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
def cb(h, l):
    pid = wt.DWORD()
    u.GetWindowThreadProcessId(h, ctypes.byref(pid))
    if pid.value in pids and u.IsWindowVisible(h):
        n = u.GetWindowTextLengthW(h)
        b = ctypes.create_unicode_buffer(n + 1)
        u.GetWindowTextW(h, b, n + 1)
        r = wt.RECT()
        u.GetWindowRect(h, ctypes.byref(r))
        if (r.right - r.left) > 600 and (r.bottom - r.top) > 400:
            found.append((h, b.value, pid.value, (r.left, r.top, r.right, r.bottom)))
    return True

u.EnumWindows(cb, 0)
if not found:
    print('NO ENCONTRADA')
    sys.exit(1)
h, title, pid, rect = found[0]
print('ventana:', h, '|', title, '| pid', pid, '|', rect)

u.ShowWindow(h, SW_RESTORE)
u.SetWindowPos(h, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
u.SetForegroundWindow(h)
time.sleep(1.2)

img = ImageGrab.grab(bbox=rect)
img.save('window-open.png')
print('capture ok', img.size)

u.SetWindowPos(h, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
