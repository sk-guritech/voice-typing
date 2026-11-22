package main

/*
#cgo LDFLAGS: -framework Cocoa -framework Carbon
#include <Carbon/Carbon.h>
#include <stdint.h>
OSStatus voiceRegisterMacShortcut(UInt32 key, UInt32 modifiers, uintptr_t callback);
void voiceUnregisterMacShortcut(void);
int voiceMacLetterKey(unsigned char character);
*/
import "C"

import (
	"errors"
	"runtime/cgo"
	"strings"
)

type macShortcut struct {
	callback cgo.Handle
}

var macKey = map[string]C.UInt32{
	"PageUp": C.kVK_PageUp, "PageDown": C.kVK_PageDown,
	"Home": C.kVK_Home, "End": C.kVK_End, "Insert": C.kVK_Help, "Delete": C.kVK_ForwardDelete,
	"Backspace": C.kVK_Delete, "Space": C.kVK_Space, "Tab": C.kVK_Tab, "Enter": C.kVK_Return,
	"Left": C.kVK_LeftArrow, "Right": C.kVK_RightArrow, "Up": C.kVK_UpArrow, "Down": C.kVK_DownArrow,
	"F1": C.kVK_F1, "F2": C.kVK_F2, "F3": C.kVK_F3, "F4": C.kVK_F4, "F5": C.kVK_F5,
	"F6": C.kVK_F6, "F7": C.kVK_F7, "F8": C.kVK_F8, "F9": C.kVK_F9, "F10": C.kVK_F10,
	"F11": C.kVK_F11, "F12": C.kVK_F12, "F13": C.kVK_F13, "F14": C.kVK_F14, "F15": C.kVK_F15,
	"F16": C.kVK_F16, "F17": C.kVK_F17, "F18": C.kVK_F18, "F19": C.kVK_F19, "F20": C.kVK_F20,
}

func startNativeShortcut(onPress func()) nativeShortcut {
	return &macShortcut{callback: cgo.NewHandle(onPress)}
}

func macLetterKey(character byte) C.int {
	return C.voiceMacLetterKey(C.uchar(character))
}

func (h *macShortcut) set(shortcut string) error {
	parts := strings.Split(shortcut, "+")
	var modifiers C.UInt32
	for _, part := range parts[:len(parts)-1] {
		switch part {
		case "Command", "Super":
			modifiers |= C.cmdKey
		case "Control":
			modifiers |= C.controlKey
		case "Alt":
			modifiers |= C.optionKey
		case "Shift":
			modifiers |= C.shiftKey
		}
	}
	last := parts[len(parts)-1]
	key, ok := macKey[last]
	if len(last) == 1 {
		code := macLetterKey(last[0])
		key, ok = C.UInt32(code), code >= 0
	}
	if !ok || C.voiceRegisterMacShortcut(key, modifiers, C.uintptr_t(h.callback)) != C.noErr {
		return errors.New("ui.shortcutRegister")
	}
	return nil
}

func (h *macShortcut) close() {
	C.voiceUnregisterMacShortcut()
	h.callback.Delete()
}

//export voiceMacShortcutPressed
func voiceMacShortcutPressed(handle C.uintptr_t) {
	onPress := cgo.Handle(handle).Value().(func())
	go onPress()
}
