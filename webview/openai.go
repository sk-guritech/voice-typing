package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const openAITranscriptionURL = "https://api.openai.com/v1/audio/transcriptions"

type openAIRecording struct {
	ctx      context.Context
	cancel   context.CancelFunc
	key      string
	model    string
	rate     int
	pcm      []byte
	finished bool
}

func newOpenAIRecording(ctx context.Context, key, model string, rate int) *openAIRecording {
	ctx, cancel := context.WithCancel(ctx)
	return &openAIRecording{ctx: ctx, cancel: cancel, key: key, model: model, rate: rate}
}

func (r *openAIRecording) add(block []byte) error {
	if r.finished {
		return errors.New("ui.recordingEnded")
	}
	if len(r.pcm)+len(block) > min(24_000_000, r.rate*2*600) {
		return errors.New("ui.recordingLimit")
	}
	r.pcm = append(r.pcm, block...)
	return nil
}

func (r *openAIRecording) transcribe(endpoint string) (string, error) {
	if len(r.pcm) == 0 {
		return "", nil
	}
	var header [44]byte
	copy(header[:], "RIFF")
	copy(header[8:], "WAVEfmt ")
	copy(header[36:], "data")
	le := binary.LittleEndian
	le.PutUint32(header[4:], uint32(len(r.pcm)+36))
	le.PutUint32(header[16:], 16)
	le.PutUint16(header[20:], 1)
	le.PutUint16(header[22:], 1)
	le.PutUint32(header[24:], uint32(r.rate))
	le.PutUint32(header[28:], uint32(r.rate*2))
	le.PutUint16(header[32:], 2)
	le.PutUint16(header[34:], 16)
	le.PutUint32(header[40:], uint32(len(r.pcm)))
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	if err := form.WriteField("model", r.model); err != nil {
		return "", err
	}
	audio, err := form.CreateFormFile("file", "dictation.wav")
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(audio, io.MultiReader(bytes.NewReader(header[:]), bytes.NewReader(r.pcm))); err != nil {
		return "", err
	}
	if err := form.Close(); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(r.ctx, 90*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+r.key)
	request.Header.Set("Content-Type", form.FormDataContentType())
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", errors.New("ui.openaiSend")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ui.openaiError:%d", response.StatusCode)
	}
	var result struct {
		Text string `json:"text"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 5_000_000)).Decode(&result) != nil {
		return "", errors.New("ui.openaiRead")
	}
	return strings.TrimSpace(result.Text), nil
}

func (p *Probe) finishOpenAI(recording *openAIRecording) error {
	p.mu.Lock()
	if p.openAI != recording || recording.finished {
		p.mu.Unlock()
		return errors.New("ui.recordingEnded")
	}
	recording.finished = true
	p.mu.Unlock()
	go func() {
		defer recording.cancel()
		text, err := recording.transcribe(openAITranscriptionURL)
		p.mu.Lock()
		active := p.openAI == recording
		if active {
			p.openAI = nil
		}
		p.mu.Unlock()
		if !active {
			return
		}
		if err != nil {
			runtime.EventsEmit(p.ctx, "probe:error", err.Error())
			return
		}
		p.publishResult(text)
	}()
	return nil
}
