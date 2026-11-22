package main

import (
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	getForegroundWindow = panelUser32.NewProc("GetForegroundWindow")
	getGUIThreadInfo    = panelUser32.NewProc("GetGUIThreadInfo")
	getAsyncKeyState    = panelUser32.NewProc("GetAsyncKeyState")
	sendKeyboardInput   = panelUser32.NewProc("SendInput")
)

type guiThreadInfo struct {
	size, flags                               uint32
	active, focus, capture, menu, move, caret uintptr
	caretRect                                 panelRect
}

type windowsInputTarget struct {
	window, focus, thread uintptr
}

type keyboardInput struct {
	key, scan   uint16
	flags, time uint32
	extra       uintptr
}

type windowsInput struct {
	kind     uint32
	keyboard keyboardInput
	padding  [8]byte
}

func currentWindowsInput() windowsInputTarget {
	window, _, _ := getForegroundWindow.Call()
	if window == 0 {
		return windowsInputTarget{}
	}
	var pid uint32
	thread, _, _ := panelWindowPID.Call(window, uintptr(unsafe.Pointer(&pid)))
	if thread == 0 || pid == windows.GetCurrentProcessId() {
		return windowsInputTarget{}
	}
	info := guiThreadInfo{size: uint32(unsafe.Sizeof(guiThreadInfo{}))}
	ok, _, _ := getGUIThreadInfo.Call(thread, uintptr(unsafe.Pointer(&info)))
	if ok == 0 || info.focus == 0 {
		return windowsInputTarget{}
	}
	return windowsInputTarget{window: window, focus: info.focus, thread: thread}
}

func foregroundInput() inputTarget {
	target := currentWindowsInput()
	if target.window == 0 {
		return nil
	}
	return target
}

func (target windowsInputTarget) focused() bool { return currentWindowsInput() == target }

func (target windowsInputTarget) keysHeld() bool {
	for _, key := range [...]uintptr{0x10, 0x11, 0x12, 0x22, 0x5b, 0x5c, 0x56} {
		if state, _, _ := getAsyncKeyState.Call(key); state&0x8000 != 0 {
			return true
		}
	}
	return false
}

func (target windowsInputTarget) paste(text string) bool {
	if target.keysHeld() || !target.focused() {
		return false
	}
	var name [128]uint16
	panelWindowClass.Call(target.window, uintptr(unsafe.Pointer(&name[0])), uintptr(len(name)))
	switch windows.UTF16ToString(name[:]) {
	case "CASCADIA_HOSTING_WINDOW_CLASS", "ConsoleWindowClass":
		if strings.ContainsFunc(text, func(r rune) bool { return r < 0x20 || r == 0x7f }) {
			return false
		}
	}
	const keyboard = 1
	const up = 2
	inputs := [...]windowsInput{
		{kind: keyboard, keyboard: keyboardInput{key: 0x11}},
		{kind: keyboard, keyboard: keyboardInput{key: 0x56}},
		{kind: keyboard, keyboard: keyboardInput{key: 0x56, flags: up}},
		{kind: keyboard, keyboard: keyboardInput{key: 0x11, flags: up}},
	}
	count, _, _ := sendKeyboardInput.Call(uintptr(len(inputs)), uintptr(unsafe.Pointer(&inputs[0])), unsafe.Sizeof(inputs[0]))
	return count == uintptr(len(inputs))
}
