package main

import (
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const testTranscript = "音声合成テスト"

type inputTarget interface {
	keysHeld() bool
	paste(string) bool
}

func pasteIntoForeground(foreground func() inputTarget, text string) bool {
	deadline := time.Now().Add(1500 * time.Millisecond)
	for {
		target := foreground()
		if target == nil {
			return false
		}
		if !target.keysHeld() {
			return target.paste(text)
		}
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(30 * time.Millisecond)
	}
}

func (p *Probe) publishResult(text string) {
	pasted := false
	if text != "" && (!p.IsSelfTest() || p.testPaste) {
		if err := runtime.ClipboardSetText(p.ctx, text); err != nil {
			runtime.EventsEmit(p.ctx, "probe:error", "ui.clipboard")
			return
		}
		pasted = pasteTranscript(text)
	}
	if p.IsSelfTest() && text == testTranscript {
		if p.testPaste && !pasted {
			p.ReportSelfTestFailure("The foreground input did not receive a paste event")
			return
		}
		_ = os.WriteFile(p.testLog, []byte("WebView audio → Go WebSocket → final result passed\n"), 0600)
	}
	runtime.EventsEmit(p.ctx, "probe:result", text, pasted)
}
