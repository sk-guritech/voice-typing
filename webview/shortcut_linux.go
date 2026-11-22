package main

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/xproto"
	"github.com/jezek/xgb/xtest"
)

type x11Desktop struct {
	conn          *xgb.Conn
	root          xproto.Window
	keycodes      map[xproto.Keysym]xproto.Keycode
	modifierKeys  []xproto.Keycode
	modifierMasks map[xproto.Keycode]uint16
	activeWindow  xproto.Atom
	windowPID     xproto.Atom
}

var linuxDesktop = sync.OnceValue(openX11Desktop)

func openX11Desktop() *x11Desktop {
	if os.Getenv("XDG_SESSION_TYPE") == "wayland" || os.Getenv("WAYLAND_DISPLAY") != "" || os.Getenv("DISPLAY") == "" {
		return nil
	}
	conn, err := xgb.NewConn()
	if err != nil {
		return nil
	}
	setup := xproto.Setup(conn)
	keys, keyErr := xproto.GetKeyboardMapping(conn, setup.MinKeycode, byte(setup.MaxKeycode-setup.MinKeycode+1)).Reply()
	modifiers, modErr := xproto.GetModifierMapping(conn).Reply()
	if keyErr != nil || keys == nil || modErr != nil || modifiers == nil || xtest.Init(conn) != nil {
		conn.Close()
		return nil
	}
	desktop := &x11Desktop{
		conn: conn, root: setup.DefaultScreen(conn).Root,
		keycodes: make(map[xproto.Keysym]xproto.Keycode), modifierMasks: make(map[xproto.Keycode]uint16),
		activeWindow: x11Atom(conn, "_NET_ACTIVE_WINDOW"), windowPID: x11Atom(conn, "_NET_WM_PID"),
	}
	for index, symbol := range keys.Keysyms {
		if symbol != 0 && desktop.keycodes[symbol] == 0 {
			desktop.keycodes[symbol] = setup.MinKeycode + xproto.Keycode(index/int(keys.KeysymsPerKeycode))
		}
	}
	for index, key := range modifiers.Keycodes {
		if key != 0 {
			desktop.modifierKeys = append(desktop.modifierKeys, key)
			desktop.modifierMasks[key] |= 1 << (index / int(modifiers.KeycodesPerModifier))
		}
	}
	return desktop
}

func x11Atom(conn *xgb.Conn, name string) xproto.Atom {
	reply, err := xproto.InternAtom(conn, false, uint16(len(name)), name).Reply()
	if err != nil || reply == nil {
		return 0
	}
	return reply.Atom
}

const (
	x11Shift   = 0xffe1
	x11Control = 0xffe3
)

var x11SpecialKeys = map[string]xproto.Keysym{
	"PageUp": 0xff55, "PageDown": 0xff56, "Home": 0xff50, "End": 0xff57,
	"Insert": 0xff63, "Delete": 0xffff, "Space": ' ', "Backspace": 0xff08,
	"Left": 0xff51, "Up": 0xff52, "Right": 0xff53, "Down": 0xff54,
	"Tab": 0xff09, "Enter": 0xff0d,
}

func x11KeySymbol(name string) xproto.Keysym {
	if len(name) == 1 {
		return xproto.Keysym(strings.ToLower(name)[0])
	}
	if strings.HasPrefix(name, "F") {
		if n, err := strconv.Atoi(name[1:]); err == nil && n >= 1 && n <= 24 {
			return xproto.Keysym(0xffbd + n)
		}
	}
	return x11SpecialKeys[name]
}

type x11Shortcut struct {
	desktop *x11Desktop
	keycode atomic.Uint32
	masks   []uint16
}

func startNativeShortcut(onPress func()) nativeShortcut {
	desktop := linuxDesktop()
	if desktop == nil {
		return nil
	}
	shortcut := &x11Shortcut{desktop: desktop}
	go shortcut.listen(onPress)
	return shortcut
}

func (s *x11Shortcut) listen(activate func()) {
	for {
		event, eventErr := s.desktop.conn.WaitForEvent()
		if event == nil && eventErr == nil {
			return
		}
		release, ok := event.(xproto.KeyReleaseEvent)
		if !ok || uint32(release.Detail) != s.keycode.Load() {
			continue
		}
		// X11 can report a synthetic release while a key is auto-repeating.
		keys, err := xproto.QueryKeymap(s.desktop.conn).Reply()
		if err == nil && keys != nil && !x11KeyDown(keys, release.Detail) {
			activate()
		}
	}
}

func (s *x11Shortcut) set(shortcut string) error {
	d := s.desktop
	parts := strings.Split(shortcut, "+")
	key := d.keycodes[x11KeySymbol(parts[len(parts)-1])]
	var mask uint16
	for _, modifier := range parts[:len(parts)-1] {
		var bit uint16
		switch modifier {
		case "Shift":
			bit = xproto.ModMaskShift
		case "Control":
			bit = xproto.ModMaskControl
		case "Alt":
			bit = d.modifierMasks[d.keycodes[0xffe9]] // Alt_L
		case "Super", "Command":
			bit = d.modifierMasks[d.keycodes[0xffeb]] // Super_L
		}
		if bit == 0 {
			return errors.New("ui.shortcutRegister")
		}
		mask |= bit
	}
	// These combinations are used to deliver the result to the focused app.
	if key == 0 || key == d.keycodes['v'] && (mask == xproto.ModMaskControl || mask == xproto.ModMaskControl|xproto.ModMaskShift) {
		return errors.New("ui.shortcutRegister")
	}
	oldKey := xproto.Keycode(s.keycode.Load())
	if oldKey == key && mask == s.masks[0] {
		return nil
	}
	masks := []uint16{mask}
	var locks uint16
	for _, symbol := range [...]xproto.Keysym{0xffe5, 0xff7f, 0xff14} { // Caps, Num and Scroll Lock
		locks |= d.modifierMasks[d.keycodes[symbol]]
	}
	for bits := locks &^ mask; bits != 0; bits &= bits - 1 {
		bit := bits & -bits
		for _, existing := range masks {
			masks = append(masks, existing|bit)
		}
	}
	for index, modifiers := range masks {
		err := xproto.GrabKeyChecked(d.conn, false, d.root, modifiers, key, xproto.GrabModeAsync, xproto.GrabModeAsync).Check()
		if err != nil {
			s.ungrab(key, masks[:index])
			return errors.New("ui.shortcutRegister")
		}
	}
	s.ungrab(oldKey, s.masks)
	s.masks = masks
	s.keycode.Store(uint32(key))
	return nil
}

func (s *x11Shortcut) ungrab(key xproto.Keycode, masks []uint16) {
	for _, mask := range masks {
		xproto.UngrabKey(s.desktop.conn, key, s.desktop.root, mask)
	}
}

func (s *x11Shortcut) close() {
	s.keycode.Store(0)
	s.desktop.conn.Close()
}
