package main

import (
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const testTranscript = "音声合成テスト"

type inputTarget interface {
	focused() bool
	keysHeld() bool
	paste(string) bool
}

type trackedTarget struct {
	inputTarget
	done chan struct{}
}

func (p *Probe) CaptureTarget() {
	p.takeTarget()
	if target := foregroundInput(); target != nil {
		watch := &trackedTarget{inputTarget: target, done: make(chan struct{})}
		p.outputMu.Lock()
		p.target = watch
		p.outputMu.Unlock()
		go p.watchTarget(watch)
	}
}

func (p *Probe) watchTarget(target *trackedTarget) {
	ticker := time.NewTicker(35 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-target.done:
			return
		case <-ticker.C:
			if !target.focused() {
				p.outputMu.Lock()
				if p.target == target {
					p.target = nil
				}
				p.outputMu.Unlock()
				return
			}
		}
	}
}

func (p *Probe) takeTarget() *trackedTarget {
	p.outputMu.Lock()
	defer p.outputMu.Unlock()
	target := p.target
	if target != nil {
		close(target.done)
		p.target = nil
	}
	return target
}

func (p *Probe) publishResult(text string) {
	target := p.takeTarget()
	pasted := false
	if text != "" && (!p.IsSelfTest() || p.testPaste) {
		if target != nil {
			deadline := time.Now().Add(1500 * time.Millisecond)
			for target.focused() && target.keysHeld() && time.Now().Before(deadline) {
				time.Sleep(30 * time.Millisecond)
			}
		}
		if err := runtime.ClipboardSetText(p.ctx, text); err != nil {
			runtime.EventsEmit(p.ctx, "probe:error", "ui.clipboard")
			return
		}
		pasted = target != nil && target.paste(text)
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
