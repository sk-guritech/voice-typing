import ctypes as c
import sys

x11 = c.CDLL('libX11.so.6')
xtest = c.CDLL('libXtst.so.6')
display_type = c.c_void_p
window_type = c.c_ulong
integer = c.POINTER(c.c_int)
unsigned = c.POINTER(c.c_uint)
window_pointer = c.POINTER(window_type)
x11.XOpenDisplay.argtypes = [c.c_char_p]
x11.XOpenDisplay.restype = display_type
x11.XDefaultRootWindow.argtypes = [display_type]
x11.XDefaultRootWindow.restype = window_type
x11.XQueryTree.argtypes = [display_type, window_type, window_pointer, window_pointer,
                          c.POINTER(window_pointer), unsigned]
x11.XGetGeometry.argtypes = [display_type, window_type, window_pointer, integer, integer,
                            unsigned, unsigned, unsigned, unsigned]
x11.XSetInputFocus.argtypes = [display_type, window_type, c.c_int, c.c_ulong]
x11.XKeysymToKeycode.argtypes = [display_type, c.c_ulong]
x11.XKeysymToKeycode.restype = c.c_ubyte
x11.XFlush.argtypes = [display_type]
xtest.XTestFakeKeyEvent.argtypes = [display_type, c.c_uint, c.c_int, c.c_ulong]
x11.XFree.argtypes = [c.c_void_p]
x11.XCloseDisplay.argtypes = [display_type]

display = x11.XOpenDisplay(None)
if not display:
    sys.exit('Cannot open the isolated X11 display')
root = x11.XDefaultRootWindow(display)
root_return, parent = window_type(), window_type()
children, count = window_pointer(), c.c_uint()
if not x11.XQueryTree(display, root, root_return, parent, c.byref(children), count):
    sys.exit('Cannot list isolated X11 windows')
for handle in children[:count.value]:
    x, y = c.c_int(), c.c_int()
    width, height, border, depth = (c.c_uint() for _ in range(4))
    if x11.XGetGeometry(display, handle, root_return, x, y, width, height, border, depth) and (width.value, height.value) == (180, 69):
        x11.XSetInputFocus(display, handle, 2, 0)
        key = x11.XKeysymToKeycode(display, 0xff56)
        xtest.XTestFakeKeyEvent(display, key, 1, 0)
        xtest.XTestFakeKeyEvent(display, key, 0, 0)
        x11.XFlush(display)
        break
else:
    sys.exit('Cannot find the compact window in the isolated X11 display')
x11.XFree(children)
x11.XCloseDisplay(display)
