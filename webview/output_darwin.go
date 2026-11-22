package main

/*
#cgo LDFLAGS: -framework ApplicationServices
#include <ApplicationServices/ApplicationServices.h>
#include <stdbool.h>

bool voiceMacPasteKeysHeld(void);
bool voiceMacPaste(int key, bool hasControl);
void voiceMacPromptForInputAccess(void);
*/
import "C"

import (
	"strings"
	"sync"
	"time"
)

var macInputAccessPrompt sync.Once

func foregroundInput() inputTarget { return nil }

func pasteTranscript(_ *trackedTarget, text string) bool {
	if !bool(C.CGPreflightPostEventAccess()) {
		macInputAccessPrompt.Do(func() { C.voiceMacPromptForInputAccess() })
		return false
	}
	deadline := time.Now().Add(1500 * time.Millisecond)
	for bool(C.voiceMacPasteKeysHeld()) && time.Now().Before(deadline) {
		time.Sleep(30 * time.Millisecond)
	}
	hasControl := strings.ContainsFunc(text, func(r rune) bool { return r < 0x20 || r == 0x7f })
	return bool(C.voiceMacPaste(macLetterKey('V'), C.bool(hasControl)))
}
