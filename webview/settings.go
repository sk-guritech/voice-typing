package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/zalando/go-keyring"
)

const keyringService = "Voice Typing WebView"

var shortcutPattern = regexp.MustCompile(`^(?:(?:Command|Super|Control|Alt|Shift)\+)*(?:PageDown|PageUp|Home|End|Insert|Delete|Space|Backspace|Up|Down|Left|Right|Tab|Enter|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$`)

type Preferences struct {
	Provider    string `json:"provider"`
	Shortcut    string `json:"shortcut"`
	AlwaysOnTop bool   `json:"alwaysOnTop"`
}

type SettingsForm struct {
	Provider    string `json:"provider"`
	Shortcut    string `json:"shortcut"`
	AlwaysOnTop bool   `json:"alwaysOnTop"`
	Key         string `json:"key"`
}

func validProvider(provider string) bool {
	return provider == "soniox" || provider == "openai"
}

func (p *Probe) loadPreferences() {
	p.prefs = Preferences{Provider: "soniox", Shortcut: "PageDown", AlwaysOnTop: true}
	if p.IsSelfTest() {
		return
	}
	data, err := os.ReadFile(p.settingsPath)
	if err != nil {
		return
	}
	settings := p.prefs
	if json.Unmarshal(data, &settings) == nil && validProvider(settings.Provider) && shortcutPattern.MatchString(settings.Shortcut) {
		p.prefs = settings
	}
}

func (p *Probe) Config() map[string]any {
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	return map[string]any{
		"provider": p.prefs.Provider, "shortcut": p.prefs.Shortcut,
		"alwaysOnTop": p.prefs.AlwaysOnTop, "canKeepAbove": true,
		"globalShortcut": p.shortcut != nil && p.shortcutError == "",
		"error":          p.shortcutError,
	}
}

func (p *Probe) KeyInfo(provider string, reveal bool) map[string]any {
	if p.IsSelfTest() || !validProvider(provider) {
		return map[string]any{"present": false}
	}
	key, err := keyring.Get(keyringService, provider)
	if errors.Is(err, keyring.ErrNotFound) {
		return map[string]any{"present": false}
	}
	if err != nil {
		return map[string]any{"error": "OS の資格情報ストアを利用できません。"}
	}
	value := ""
	if reveal {
		value = key
	}
	return map[string]any{"present": key != "", "value": value}
}

func (p *Probe) Save(form SettingsForm) map[string]any {
	failure := func(message string) map[string]any { return map[string]any{"error": message} }
	if !validProvider(form.Provider) || !shortcutPattern.MatchString(form.Shortcut) {
		return failure("設定を確認してください。")
	}
	key := strings.TrimSpace(form.Key)
	if strings.ContainsAny(key, "\r\n") || len(key) > 2000 {
		return failure("API キーの形式を確認してください。")
	}
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	settings := Preferences{Provider: form.Provider, Shortcut: form.Shortcut, AlwaysOnTop: form.AlwaysOnTop}
	changedShortcut := p.shortcut != nil && (settings.Shortcut != p.prefs.Shortcut || p.shortcutError != "")
	if changedShortcut {
		if err := p.shortcut.set(settings.Shortcut); err != nil {
			return failure(err.Error())
		}
	}
	saved := false
	defer func() {
		if changedShortcut && !saved {
			p.shortcutError = ""
			if err := p.shortcut.set(p.prefs.Shortcut); err != nil {
				p.shortcutError = err.Error()
			}
		}
	}()
	if !p.IsSelfTest() {
		if key != "" && keyring.Set(keyringService, form.Provider, key) != nil {
			return failure("API キーを OS の資格情報ストアに保存できませんでした。")
		}
		data, _ := json.Marshal(settings)
		if err := os.MkdirAll(filepath.Dir(p.settingsPath), 0700); err != nil {
			return failure("設定を保存できませんでした。")
		}
		if err := os.WriteFile(p.settingsPath, data, 0600); err != nil {
			return failure("設定を保存できませんでした。")
		}
	}
	p.prefs = settings
	if changedShortcut {
		p.shortcutError = ""
	}
	saved = true
	runtime.WindowSetAlwaysOnTop(p.ctx, settings.AlwaysOnTop)
	return map[string]any{"ok": true}
}

func (p *Probe) sessionSettings() (provider, key string, err error) {
	if p.IsSelfTest() {
		return "soniox", "synthetic-test-credential", nil
	}
	p.settingsMu.Lock()
	provider = p.prefs.Provider
	p.settingsMu.Unlock()
	key, err = keyring.Get(keyringService, provider)
	return
}
