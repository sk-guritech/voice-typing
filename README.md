# Voice Typing

English · [日本語](README.ja.md)

<img src="webview/assets/icon.png" width="64" height="64" alt="Voice Typing app icon">

Voice Typing turns speech into text using Soniox or OpenAI. It's a desktop app built with Go and Wails.

## Launch the app

Open the file for your OS and CPU in [`release/`](release/).

| OS | How to launch |
| --- | --- |
| Windows x64 | Double-click the `.exe`. Windows needs WebView2. |
| Linux x64 | Extract the `.tar.gz` and run `voice-typing`. GTK 3 and WebKitGTK 4.1 are required. |
| macOS | Extract the Apple Silicon (arm64) or Intel (x64) ZIP and open `Voice Typing.app`. The app is ad hoc signed. Testing on a physical Mac is still pending. |

## How to use it

These screenshots were captured from the Windows release executable. The recording screenshot uses a synthetic test tone.

### 1. Set up speech recognition

Click the gear on the small panel. Choose **Soniox** or **OpenAI**, enter your API key for that service, and click **Save** (保存). Allow microphone access if prompted.

On Windows and Linux, the settings panel closes after a successful save. If saving fails, the panel stays open and shows the error.

<img src="docs/settings.png" width="410" alt="Settings panel with fields for the speech provider, API key, and shortcut, plus an Always on top checkbox and a Save button">

Click **Change** (変更) to choose another shortcut, then click **Save**. You can also toggle **Always on top** (常に手前に表示) here. The app stores your API key in the operating system's credential store and sends recorded audio to your selected service.

### 2. Record

1. On Windows, put the cursor in the field where you want the text. On macOS and Linux, focus the Voice Typing panel.
2. Press **Page Down**. A faint waveform means the microphone is getting ready. **Start speaking when the blue waveform moves.**
3. Press **Page Down** again when you're done and wait for the result.

<img src="docs/recording.png" width="204" alt="Recording panel showing a blue waveform beside the settings and quit buttons">

The current macOS ZIP shows a circular icon while the microphone is getting ready. Start speaking once the blue waveform moves.

You can also start or stop recording by right-clicking the gear. Click **×** to quit the app.

### 3. Enter the text

On Windows, recording with the global shortcut pastes the result into the field that had focus when recording started. If you switch fields mid-recording, start recording from the right-click menu, or use macOS or Linux, paste the result from the clipboard.

If an error icon appears, open the gear menu and read the message in settings.

## Build locally

Use Go 1.27.4 and run these commands from `webview/`.

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.0.0-windows-x64.exe .`
- **Linux** — With the GTK and WebKitGTK development libraries installed, run `go build -tags production,webkit2_41 -trimpath -ldflags "-s -w" -o voice-typing .`. For a Docker build, run `docker build -t voice-typing:linux .`.
- **macOS** — On a Mac with the Apple command line tools installed, run `bash build-macos.sh`.
