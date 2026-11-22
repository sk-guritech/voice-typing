package main

import (
	"os"
	"strings"

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/xproto"
	"github.com/jezek/xgb/xtest"
)

type x11InputTarget struct {
	desktop  *x11Desktop
	focus    xproto.Window
	terminal bool
}

func (d *x11Desktop) focusWindow() xproto.Window {
	reply, err := xproto.GetInputFocus(d.conn).Reply()
	if err != nil || reply == nil || reply.Focus <= 1 || reply.Focus == d.root {
		return 0
	}
	return reply.Focus
}

func (d *x11Desktop) property(window xproto.Window, name, format xproto.Atom) []byte {
	if window == 0 || name == 0 {
		return nil
	}
	reply, err := xproto.GetProperty(d.conn, false, window, name, format, 0, 64).Reply()
	if err != nil || reply == nil {
		return nil
	}
	return reply.Value
}

func foregroundInput() inputTarget {
	d := linuxDesktop()
	if d == nil {
		return nil
	}
	focus := d.focusWindow()
	if focus == 0 {
		return nil
	}
	window := focus
	if active := d.property(d.root, d.activeWindow, xproto.AtomWindow); len(active) >= 4 && xgb.Get32(active) != 0 {
		window = xproto.Window(xgb.Get32(active))
	}
	if pid := d.property(window, d.windowPID, xproto.AtomCardinal); len(pid) >= 4 && xgb.Get32(pid) == uint32(os.Getpid()) {
		return nil
	}
	class := strings.ToLower(string(d.property(window, xproto.AtomWmClass, xproto.AtomString)))
	target := x11InputTarget{desktop: d, focus: focus}
	for _, name := range strings.Split(class, "\x00") {
		switch name {
		case "xfce4-terminal", "gnome-terminal", "gnome-terminal-server", "konsole", "kitty", "alacritty", "tilix", "terminator", "org.gnome.console", "com.mitchellh.ghostty":
			target.terminal = true
		case "xterm", "uxterm", "urxvt", "rxvt", "st":
			// These terminals may paste the primary selection or use a custom binding.
			return nil
		}
	}
	return target
}

func pasteTranscript(target *trackedTarget, text string) bool {
	return target != nil && target.paste(text)
}

func (target x11InputTarget) focused() bool {
	return target.desktop.focusWindow() == target.focus
}

func x11KeyDown(keys *xproto.QueryKeymapReply, key xproto.Keycode) bool {
	return keys.Keys[key/8]&(1<<(key%8)) != 0
}

func (target x11InputTarget) keysHeld() bool {
	d := target.desktop
	keys, err := xproto.QueryKeymap(d.conn).Reply()
	if err != nil || keys == nil {
		return true
	}
	for _, key := range d.modifierKeys {
		if x11KeyDown(keys, key) {
			return true
		}
	}
	return x11KeyDown(keys, d.keycodes['v'])
}

func (target x11InputTarget) paste(text string) bool {
	d := target.desktop
	keys := []xproto.Keycode{d.keycodes[x11Control]}
	if target.terminal {
		if strings.ContainsFunc(text, func(r rune) bool { return r < 0x20 || r == 0x7f }) {
			return false
		}
		keys = append(keys, d.keycodes[x11Shift])
	}
	keys = append(keys, d.keycodes['v'])
	for _, key := range keys {
		if key == 0 {
			return false
		}
	}
	if target.keysHeld() || !target.focused() {
		return false
	}
	var events []xtest.FakeInputCookie
	for _, key := range keys {
		events = append(events, xtest.FakeInputChecked(d.conn, xproto.KeyPress, byte(key), 0, d.root, 0, 0, 0))
	}
	for index := len(keys) - 1; index >= 0; index-- {
		events = append(events, xtest.FakeInputChecked(d.conn, xproto.KeyRelease, byte(keys[index]), 0, d.root, 0, 0, 0))
	}
	ok := true
	for _, event := range events {
		if event.Check() != nil {
			ok = false
		}
	}
	return ok
}
