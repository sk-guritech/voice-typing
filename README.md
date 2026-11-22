<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing icon">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>A small desktop panel for voice typing.</strong></p>
<p align="center">Use a shortcut to dictate with Soniox or OpenAI.</p>

<p align="center">
  <a href="#run">Run the app</a> · <a href="#quick-start">Quick start</a> · <a href="README.ja.md">日本語</a>
</p>

## Run

Open the build for your OS in [`release/`](release/).

| OS | Requirements | Launch |
| --- | --- | --- |
| Windows x64 | WebView2 Runtime | Run the `.exe`. |
| Linux x64 | GTK 3 and WebKitGTK 4.1 | Extract the `.tar.gz` and run `voice-typing`. |
| macOS (Apple Silicon or Intel) | macOS 13 or later | Extract the ZIP and open `Voice Typing.app`. |

The macOS app is ad hoc signed and awaits testing on a physical Mac.

## Quick start

1. **Set up.** Open the gear, choose Soniox or OpenAI, enter the API key, and click **Save** (保存). The gear also lets you change the shortcut and keep the panel on top.

   <img src="docs/settings.png" width="280" alt="Voice Typing settings">

2. **Record.** On Windows, put the cursor where you want the text. On Linux and macOS, focus the panel. Press <kbd>Page Down</kbd> and speak when the blue waveform moves.

   <img src="docs/recording.png" width="170" alt="Blue waveform during recording">

3. **Get the text.** Press <kbd>Page Down</kbd> again. When recording starts with the shortcut on Windows, the result is pasted into the original field if it still has focus. You can also paste the result from your clipboard.

<details>
<summary>Build locally</summary>

Use Go 1.27.4 from `webview/`.

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.0.0-windows-x64.exe .`
- **Linux** — `docker build -t voice-typing:linux .`, or use `go build -tags production,webkit2_41 .` with the GTK and WebKitGTK development libraries installed.
- **macOS** — Run `bash build-macos.sh` on a Mac with Apple command line tools installed.

</details>
