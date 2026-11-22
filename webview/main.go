package main

import (
	"context"
	"embed"
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	linuxoptions "github.com/wailsapp/wails/v2/pkg/options/linux"
	macoptions "github.com/wailsapp/wails/v2/pkg/options/mac"
	winoptions "github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed ui
var embedded embed.FS

//go:embed assets/icon.png
var appIcon []byte

const settingsWidth, settingsHeight = 382, 396

type Probe struct {
	ctx           context.Context
	endpoint      string
	testLog       string
	mu            sync.Mutex
	socket        *websocket.Conn
	openAI        *openAIRecording
	settingsMu    sync.Mutex
	settingsPath  string
	prefs         Preferences
	shortcut      nativeShortcut
	shortcutError string
	testHotkey    bool
	testPaste     bool
	outputMu      sync.Mutex
	target        *trackedTarget
}

func (p *Probe) IsSelfTest() bool { return p.testLog != "" }

func (p *Probe) FixedPanelBounds() bool { return fixedPanelBounds }

func (p *Probe) IsHotkeyTest() bool { return p.testHotkey }

func (p *Probe) TestNeedsKeyPress() bool { return p.IsSelfTest() && goruntime.GOOS == "linux" }

func (p *Probe) TraceSelfTest(message string) {
	if p.IsSelfTest() {
		fmt.Fprintln(os.Stderr, "WebView self-test:", message)
		if p.testHotkey {
			trace, err := os.OpenFile(p.testLog+".progress", os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
			if err == nil {
				fmt.Fprintln(trace, message)
				trace.Close()
			}
		}
	}
}

func (p *Probe) ReportSelfTestFailure(message string) {
	if p.IsSelfTest() {
		fmt.Fprintln(os.Stderr, "WebView self-test:", message)
		_ = os.WriteFile(p.testLog, []byte("WebView self-test failed: "+message+"\n"), 0600)
		runtime.Quit(p.ctx)
	}
}

func (p *Probe) Connect(rate int) error {
	provider, model, key, err := p.sessionSettings()
	if err != nil || key == "" || strings.ContainsAny(key, "\r\n") {
		return errors.New("ui.missingKey")
	}
	if rate != 16000 {
		return errors.New("ui.sampleRate")
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.socket != nil || p.openAI != nil {
		return errors.New("ui.alreadyConnected")
	}
	if provider == "openai" {
		p.openAI = newOpenAIRecording(p.ctx, key, model, rate)
		return nil
	}
	ctx, cancel := context.WithTimeout(p.ctx, 8*time.Second)
	defer cancel()
	conn, resp, err := websocket.DefaultDialer.DialContext(ctx, p.endpoint, http.Header{"Authorization": {"Bearer " + key}})
	if err != nil {
		if resp != nil {
			resp.Body.Close()
		}
		return errors.New("ui.sonioxConnect")
	}
	if err := conn.WriteJSON(map[string]any{
		"model": model, "audio_format": "pcm_s16le", "sample_rate": rate,
		"num_channels": 1, "language_hints": []string{"ja", "en"},
	}); err != nil {
		conn.Close()
		return errors.New("ui.sonioxConfigure")
	}
	p.socket = conn
	go p.read(conn)
	return nil
}

func (p *Probe) Audio(encoded string) error {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(data) > 10240 {
		return errors.New("ui.audioBlock")
	}
	p.mu.Lock()
	if p.openAI != nil {
		defer p.mu.Unlock()
		return p.openAI.add(data)
	}
	p.mu.Unlock()
	return p.write(websocket.BinaryMessage, data)
}

func (p *Probe) Finish() error {
	p.mu.Lock()
	recording := p.openAI
	p.mu.Unlock()
	if recording != nil {
		return p.finishOpenAI(recording)
	}
	return p.write(websocket.TextMessage, nil)
}

func (p *Probe) Cancel() {
	p.takeTarget()
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.socket != nil {
		p.socket.Close()
		p.socket = nil
	}
	if p.openAI != nil {
		p.openAI.cancel()
		p.openAI = nil
	}
}

func (p *Probe) write(kind int, data []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.socket == nil {
		return errors.New("ui.sonioxDisconnected")
	}
	p.socket.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return p.socket.WriteMessage(kind, data)
}

func (p *Probe) read(conn *websocket.Conn) {
	defer func() {
		p.mu.Lock()
		if p.socket == conn {
			p.socket = nil
		}
		p.mu.Unlock()
		conn.Close()
	}()
	var transcript strings.Builder
	for {
		var response struct {
			ErrorCode int  `json:"error_code"`
			Finished  bool `json:"finished"`
			Tokens    []struct {
				Text  string `json:"text"`
				Final bool   `json:"is_final"`
			} `json:"tokens"`
		}
		if conn.ReadJSON(&response) != nil {
			p.mu.Lock()
			active := p.socket == conn
			p.mu.Unlock()
			if active {
				runtime.EventsEmit(p.ctx, "probe:error", "ui.sonioxDisconnected")
			}
			return
		}
		if response.ErrorCode != 0 {
			runtime.EventsEmit(p.ctx, "probe:error", fmt.Sprintf("ui.sonioxError:%d", response.ErrorCode))
			return
		}
		for _, token := range response.Tokens {
			if token.Final && token.Text != "<end>" && token.Text != "<fin>" {
				transcript.WriteString(token.Text)
			}
		}
		if response.Finished {
			p.publishResult(strings.TrimSpace(transcript.String()))
			return
		}
	}
}

func fixture() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer synthetic-test-credential" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Keep the connection pending long enough for the self-test to record first.
		time.Sleep(1200 * time.Millisecond)
		upgrader := websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		var config map[string]any
		if err := conn.ReadJSON(&config); err != nil || config["audio_format"] != "pcm_s16le" || config["sample_rate"] != float64(16000) {
			return
		}
		if config["model"] != "stt-rt-v5" {
			conn.WriteJSON(map[string]any{"error_code": 400})
			return
		}
		audioBytes := 0
		for {
			kind, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			if kind == websocket.BinaryMessage {
				audioBytes += len(data)
			}
			if kind == websocket.TextMessage && len(data) == 0 {
				if audioBytes < 2500 {
					return
				}
				conn.WriteJSON(map[string]any{"tokens": []map[string]any{{"text": testTranscript, "is_final": true}}, "finished": true})
				return
			}
		}
	}))
}

func main() {
	probe := &Probe{endpoint: "wss://stt-rt.soniox.com/transcribe-websocket"}
	userData, err := os.UserCacheDir()
	if err != nil {
		return
	}
	profile := filepath.Join(userData, "Voice Typing WebView Prototype")
	if configDir, err := os.UserConfigDir(); err == nil {
		probe.settingsPath = filepath.Join(configDir, "Voice Typing WebView", "settings.json")
	}
	if len(os.Args) == 3 && (os.Args[1] == "--self-test" || os.Args[1] == "--self-test-hotkey" || os.Args[1] == "--self-test-paste") {
		probe.testLog = os.Args[2]
		probe.settingsPath = probe.testLog + ".settings.json"
		probe.testPaste = os.Args[1] == "--self-test-paste"
		probe.testHotkey = probe.testPaste || os.Args[1] == "--self-test-hotkey"
		profile = filepath.Join(filepath.Dir(probe.testLog), "webview-profile")
		server := fixture()
		defer server.Close()
		probe.endpoint = "ws" + strings.TrimPrefix(server.URL, "http")
	}
	probe.loadPreferences()
	assets, _ := fs.Sub(embedded, "ui")
	width, height := 180, 69
	if fixedPanelBounds {
		width, height = settingsWidth, settingsHeight
	}
	err = wails.Run(&options.App{
		Title: "音声入力",
		Width: width, Height: height, DisableResize: goruntime.GOOS != "linux", Frameless: true,
		AlwaysOnTop:      probe.prefs.AlwaysOnTop,
		BackgroundColour: &options.RGBA{},
		AssetServer:      &assetserver.Options{Assets: assets},
		Windows: &winoptions.Options{
			WebviewUserDataPath:               profile,
			WebviewIsTransparent:              true,
			WindowIsTranslucent:               true,
			BackdropType:                      winoptions.None,
			DisableFramelessWindowDecorations: true,
			WindowClassName:                   windowClassName,
		},
		Mac:        &macoptions.Options{WebviewIsTransparent: true, WindowIsTranslucent: true, Preferences: &macoptions.Preferences{EnableAutoplayWithoutUserAction: macoptions.Enabled}},
		Linux:      &linuxoptions.Options{Icon: appIcon, WindowIsTranslucent: true, WebviewGpuPolicy: linuxoptions.WebviewGpuPolicyNever},
		OnStartup:  func(ctx context.Context) { probe.ctx = ctx },
		OnShutdown: func(ctx context.Context) { probe.stopShortcut(); probe.Cancel() },
		Bind:       []interface{}{probe},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
}
