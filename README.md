# Voice Typing

English · [日本語](README.ja.md)

<img src="webview/assets/icon.png" width="48" height="48" alt="Voice Typing icon">

Turn speech into text with Soniox or OpenAI.

## Run

Open the build for your OS in [`release/`](release/).

- **Windows x64** — Run the `.exe` with WebView2 installed.
- **Linux x64** — Extract the archive and run `voice-typing`. Requires GTK 3 and WebKitGTK 4.1.
- **macOS** — Extract the ZIP for Apple Silicon or Intel and open `Voice Typing.app`. The app is ad hoc signed and awaits testing on a physical Mac.

## Use

1. Open the gear, pick a service, enter its API key, and click **Save** (保存).

   <img src="docs/settings.png" width="280" alt="Voice Typing settings">

2. Put the cursor in the target field on Windows. On Linux and macOS, focus the panel. Press **Page Down** and speak when the blue waveform moves.

   <img src="docs/recording.png" width="170" alt="Blue waveform during recording">

3. Press **Page Down** again to finish. Windows pastes into the original field if it still has focus and recording started with the shortcut. The result is also available on the clipboard.

<details>
<summary>Build locally</summary>

Use Go 1.27.4 from `webview/`.

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.0.0-windows-x64.exe .`
- **Linux** — `docker build -t voice-typing:linux .`, or use `go build -tags production,webkit2_41 .` with the GTK and WebKitGTK development libraries installed.
- **macOS** — Run `bash build-macos.sh` on a Mac with Apple command line tools installed.

</details>
