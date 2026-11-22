package main

/*
#cgo LDFLAGS: -framework ApplicationServices
#include <ApplicationServices/ApplicationServices.h>
#include <stdbool.h>
#include <stdlib.h>

AXUIElementRef voiceMacFocusedInput(void);
bool voiceMacInputFocused(AXUIElementRef element);
bool voiceMacPasteKeysHeld(void);
bool voiceMacPaste(AXUIElementRef element, int key, const char *bytes, size_t length, bool hasControl);
void voiceMacPromptForInputAccess(void);
*/
import "C"

import (
	"runtime"
	"strings"
	"sync"
	"unsafe"
)

var macInputAccessPrompt sync.Once

type macInputTarget struct {
	element C.AXUIElementRef
}

func foregroundInput() inputTarget {
	if C.AXIsProcessTrusted() == 0 {
		macInputAccessPrompt.Do(func() { C.voiceMacPromptForInputAccess() })
		return nil
	}
	element := C.voiceMacFocusedInput()
	if element == 0 {
		return nil
	}
	target := &macInputTarget{element: element}
	runtime.AddCleanup(target, func(element C.AXUIElementRef) {
		C.CFRelease(C.CFTypeRef(element))
	}, element)
	return target
}

func (target *macInputTarget) focused() bool {
	focused := bool(C.voiceMacInputFocused(target.element))
	runtime.KeepAlive(target)
	return focused
}

func (target *macInputTarget) keysHeld() bool { return bool(C.voiceMacPasteKeysHeld()) }

func (target *macInputTarget) paste(text string) bool {
	bytes := C.CString(text)
	defer C.free(unsafe.Pointer(bytes))
	hasControl := strings.ContainsFunc(text, func(r rune) bool { return r < 0x20 || r == 0x7f })
	pasted := bool(C.voiceMacPaste(target.element, macLetterKey('V'), bytes, C.size_t(len(text)), C.bool(hasControl)))
	runtime.KeepAlive(target)
	return pasted
}
