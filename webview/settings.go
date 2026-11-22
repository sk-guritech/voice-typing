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
const defaultSonioxModel = "stt-rt-v6"

var sonioxModels = []string{defaultSonioxModel, "stt-rt-v5"}

var shortcutPattern = regexp.MustCompile(`^(?:(?:Command|Super|Control|Alt|Shift)\+)*(?:PageDown|PageUp|Home|End|Insert|Delete|Space|Backspace|Up|Down|Left|Right|Tab|Enter|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$`)
var sonioxModelPattern = regexp.MustCompile(`^stt-rt-[a-z0-9][a-z0-9._-]{0,63}$`)

type Preferences struct {
	Provider    string `json:"provider"`
	SonioxModel string `json:"sonioxModel"`
	Shortcut    string `json:"shortcut"`
	AlwaysOnTop bool   `json:"alwaysOnTop"`
	Language    string `json:"language"`
}

type SettingsForm struct {
	Provider    string `json:"provider"`
	SonioxModel string `json:"sonioxModel"`
	Shortcut    string `json:"shortcut"`
	AlwaysOnTop bool   `json:"alwaysOnTop"`
	Key         string `json:"key"`
}

func validProvider(provider string) bool {
	return provider == "soniox" || provider == "openai"
}

func (p *Probe) loadPreferences() {
	p.prefs = Preferences{Provider: "soniox", SonioxModel: defaultSonioxModel, Shortcut: "PageDown", AlwaysOnTop: true, Language: "ja"}
	if p.IsSelfTest() {
		return
	}
	data, err := os.ReadFile(p.settingsPath)
	if err != nil {
		return
	}
	settings := p.prefs
	if json.Unmarshal(data, &settings) == nil && validProvider(settings.Provider) && shortcutPattern.MatchString(settings.Shortcut) {
		if settings.Language != "en" {
			settings.Language = "ja"
		}
		if !sonioxModelPattern.MatchString(settings.SonioxModel) {
			settings.SonioxModel = defaultSonioxModel
		}
		p.prefs = settings
	}
}

func (p *Probe) Config() map[string]any {
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	return map[string]any{
		"provider": p.prefs.Provider, "shortcut": p.prefs.Shortcut,
		"sonioxModel": p.prefs.SonioxModel, "sonioxModels": sonioxModels,
		"alwaysOnTop": p.prefs.AlwaysOnTop, "canKeepAbove": true,
		"language":       p.prefs.Language,
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
		return map[string]any{"error": "ui.credentialStore"}
	}
	value := ""
	if reveal {
		value = key
	}
	return map[string]any{"present": key != "", "value": value}
}

func (p *Probe) writePreferences(settings Preferences) error {
	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p.settingsPath), 0700); err != nil {
		return err
	}
	return os.WriteFile(p.settingsPath, data, 0600)
}

func (p *Probe) SetLanguage(language string) error {
	if language != "ja" && language != "en" {
		return errors.New("ui.invalidSettings")
	}
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	if language == p.prefs.Language {
		return nil
	}
	settings := p.prefs
	settings.Language = language
	if err := p.writePreferences(settings); err != nil {
		return errors.New("ui.saveLanguage")
	}
	p.prefs = settings
	return nil
}

func (p *Probe) Save(form SettingsForm) map[string]any {
	failure := func(message string) map[string]any { return map[string]any{"error": message} }
	if !validProvider(form.Provider) || !shortcutPattern.MatchString(form.Shortcut) {
		return failure("ui.invalidSettings")
	}
	key := strings.TrimSpace(form.Key)
	if strings.ContainsAny(key, "\r\n") || len(key) > 2000 {
		return failure("ui.invalidKey")
	}
	p.settingsMu.Lock()
	defer p.settingsMu.Unlock()
	settings := p.prefs
	settings.Provider = form.Provider
	settings.Shortcut = form.Shortcut
	settings.AlwaysOnTop = form.AlwaysOnTop
	if form.Provider == "soniox" {
		model := strings.TrimSpace(form.SonioxModel)
		if model == "" {
			model = defaultSonioxModel
		}
		if !sonioxModelPattern.MatchString(model) {
			return failure("ui.invalidSonioxModel")
		}
		settings.SonioxModel = model
	}
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
	if !p.IsSelfTest() && key != "" && keyring.Set(keyringService, form.Provider, key) != nil {
		return failure("ui.saveKey")
	}
	if err := p.writePreferences(settings); err != nil {
		return failure("ui.saveSettings")
	}
	p.prefs = settings
	if changedShortcut {
		p.shortcutError = ""
	}
	saved = true
	runtime.WindowSetAlwaysOnTop(p.ctx, settings.AlwaysOnTop)
	return map[string]any{"ok": true}
}

func (p *Probe) sessionSettings() (provider, model, key string, err error) {
	p.settingsMu.Lock()
	provider = p.prefs.Provider
	model = p.prefs.SonioxModel
	p.settingsMu.Unlock()
	if p.IsSelfTest() {
		return provider, model, "synthetic-test-credential", nil
	}
	key, err = keyring.Get(keyringService, provider)
	return
}
