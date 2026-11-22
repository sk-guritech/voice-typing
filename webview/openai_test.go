package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenAITranscriptionUsesSavedModel(t *testing.T) {
	const model = "gpt-4o-mini-transcribe"
	settingsPath := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(settingsPath, []byte(`{"provider":"openai","openAIModel":"gpt-4o-mini-transcribe"}`), 0600); err != nil {
		t.Fatal(err)
	}
	probe := &Probe{ctx: context.Background(), settingsPath: settingsPath}
	probe.loadPreferences()
	probe.testLog = filepath.Join(filepath.Dir(settingsPath), "result.txt")
	if err := probe.Connect(16000); err != nil {
		t.Fatal(err)
	}
	recording := probe.openAI
	defer recording.cancel()
	if err := recording.add([]byte{0, 0}); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Errorf("read transcription request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if got := r.FormValue("model"); got != model {
			t.Errorf("sent model %q, want %q", got, model)
		}
		fmt.Fprint(w, `{"text":"dictation result"}`)
	}))
	defer server.Close()
	if text, err := recording.transcribe(server.URL); err != nil || text != "dictation result" {
		t.Fatalf("transcribe returned %q, %v", text, err)
	}
}
