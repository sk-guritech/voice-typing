package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

type nativeShortcut interface {
	set(string) error
	close()
}

func (p *Probe) StartShortcut() bool {
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	if p.IsSelfTest() && !p.testHotkey {
		return false
	}
	if p.shortcut == nil {
		p.shortcut = startNativeShortcut(func() {
			runtime.EventsEmit(p.ctx, "probe:shortcut")
		})
	}
	if p.shortcut == nil {
		return false
	}
	err := p.shortcut.set(p.prefs.Shortcut)
	p.shortcutError = ""
	if err != nil {
		p.shortcutError = err.Error()
	}
	return err == nil
}

func (p *Probe) stopShortcut() {
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	if p.shortcut != nil {
		p.shortcut.close()
		p.shortcut = nil
	}
}
