package main

import (
	"errors"
	"runtime"
	"strconv"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	registerHotkey   = panelUser32.NewProc("RegisterHotKey")
	unregisterHotkey = panelUser32.NewProc("UnregisterHotKey")
	peekHotkeyMsg    = panelUser32.NewProc("PeekMessageW")
	getHotkeyMsg     = panelUser32.NewProc("GetMessageW")
	postHotkeyMsg    = panelUser32.NewProc("PostThreadMessageW")
)

const (
	wmQuit      = 0x0012
	wmHotkey    = 0x0312
	wmSetHotkey = 0x8001
	modNoRepeat = 0x4000
)

type hotkeyMessage struct {
	window         uintptr
	message        uint32
	wParam, lParam uintptr
	time           uint32
	x, y           int32
	private        uint32
}

type hotkeyRequest struct {
	shortcut string
	reply    chan error
}

type hotkeyThread struct {
	id       uint32
	requests chan hotkeyRequest
	done     chan struct{}
}

var windowsKey = map[string]uintptr{
	"PageUp": 0x21, "PageDown": 0x22, "Home": 0x24, "End": 0x23,
	"Insert": 0x2d, "Delete": 0x2e, "Space": 0x20, "Backspace": 0x08,
	"Left": 0x25, "Up": 0x26, "Right": 0x27, "Down": 0x28,
	"Tab": 0x09, "Enter": 0x0d,
}

func parseHotkey(shortcut string) (modifiers, key uintptr) {
	parts := strings.Split(shortcut, "+")
	for _, modifier := range parts[:len(parts)-1] {
		switch modifier {
		case "Alt":
			modifiers |= 1
		case "Control":
			modifiers |= 2
		case "Shift":
			modifiers |= 4
		case "Command", "Super":
			modifiers |= 8
		}
	}
	last := parts[len(parts)-1]
	if len(last) == 1 && (last[0] >= 'A' && last[0] <= 'Z' || last[0] >= '0' && last[0] <= '9') {
		return modifiers, uintptr(last[0])
	}
	if strings.HasPrefix(last, "F") {
		if n, err := strconv.Atoi(last[1:]); err == nil && n >= 1 && n <= 24 {
			return modifiers, uintptr(0x6f + n)
		}
	}
	return modifiers, windowsKey[last]
}

func startNativeShortcut(onPress func()) nativeShortcut {
	worker := &hotkeyThread{requests: make(chan hotkeyRequest, 1), done: make(chan struct{})}
	ready := make(chan struct{})
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		defer close(worker.done)
		var message hotkeyMessage
		peekHotkeyMsg.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0, 0)
		worker.id = windows.GetCurrentThreadId()
		close(ready)

		var registered, lastModifiers, lastKey uintptr
		defer func() {
			if registered != 0 {
				unregisterHotkey.Call(0, registered)
			}
		}()
		for {
			result, _, _ := getHotkeyMsg.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
			if int32(result) <= 0 {
				return
			}
			switch message.message {
			case wmHotkey:
				if registered != 0 && message.wParam == registered {
					onPress()
				}
			case wmSetHotkey:
				request := <-worker.requests
				modifiers, key := parseHotkey(request.shortcut)
				if registered != 0 && modifiers == lastModifiers && key == lastKey {
					request.reply <- nil
					continue
				}
				next := uintptr(1)
				if registered == next {
					next = 2
				}
				ok, _, _ := registerHotkey.Call(0, next, modifiers|modNoRepeat, key)
				if ok == 0 {
					request.reply <- errors.New("Windows でショートカットを登録できませんでした。別のキーを選んでください。")
					continue
				}
				if registered != 0 {
					unregisterHotkey.Call(0, registered)
				}
				registered, lastModifiers, lastKey = next, modifiers, key
				request.reply <- nil
			}
		}
	}()
	<-ready
	return worker
}

func (h *hotkeyThread) set(shortcut string) error {
	request := hotkeyRequest{shortcut: shortcut, reply: make(chan error, 1)}
	select {
	case h.requests <- request:
	case <-h.done:
		return errors.New("ショートカットを利用できません。")
	}
	ok, _, _ := postHotkeyMsg.Call(uintptr(h.id), wmSetHotkey, 0, 0)
	if ok == 0 {
		<-h.requests
		return errors.New("ショートカットを利用できません。")
	}
	select {
	case result := <-request.reply:
		return result
	case <-h.done:
		return errors.New("ショートカットを利用できません。")
	}
}

func (h *hotkeyThread) close() {
	postHotkeyMsg.Call(uintptr(h.id), wmQuit, 0, 0)
}
