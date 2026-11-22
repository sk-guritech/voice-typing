<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing icon">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>Type with your voice using a single shortcut.</strong></p>
<p align="center">A small desktop panel powered by Soniox or OpenAI.</p>

<p align="center">
  <a href="#get-an-api-key">Get an API key</a> · <a href="#download-and-run">Download and run</a> · <a href="#quick-start">Quick start</a> · <a href="README.ja.md">日本語</a>
</p>

## Get an API key

Create a key for the speech recognition service you want to use.

| Service | Where to get a key | Steps |
| --- | --- | --- |
| Soniox | [Soniox Console](https://console.soniox.com/) | Sign in, select a project, and create a key under **API keys**. |
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) | Sign in, choose **Create new secret key**, and copy the key. |

## Download and run

Download the v1.0.0 package for your computer, open it, and set up an API key in the gear menu. [GitHub Releases](https://github.com/sk-guritech/voice-typing/releases/tag/v1.0.0)

| OS | Download | Launch | Tested on a desktop |
| --- | --- | --- | --- |
| Windows x64 | [EXE](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-x64.exe) | Double-click the file. | ○ Verified |
| Linux x64 | [AppImage](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-linux-x64.AppImage) | Make it executable in file properties, then open it. | × Unverified |
| macOS | [Apple Silicon ZIP](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-mac-arm64.zip) / [Intel ZIP](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-mac-x64.zip) | Extract the ZIP and open `Voice Typing.app`. | × Unverified on a physical Mac |

## Quick start

1. **Set up.** Open the gear, choose Soniox or OpenAI, enter the API key, and click **Save** (保存). The gear also lets you change the shortcut and keep the panel on top.

   <img src="docs/settings.png" width="280" alt="Voice Typing settings">

2. **Speak.** On Windows, put the cursor where you want the text. On Linux and macOS, focus the panel. Press <kbd>Page Down</kbd> and speak when the blue waveform moves.

   <img src="docs/recording.png" width="170" alt="Blue waveform while dictating">

3. **Enter the text.** Press <kbd>Page Down</kbd> again to finish, then paste if needed.

## Report a problem

Include your OS, Voice Typing version, what you did, and what happened. Remove API keys and personal information from screenshots and logs before sharing. [Open a GitHub issue](https://github.com/sk-guritech/voice-typing/issues/new)

<details>
<summary>Build the lightweight app from source</summary>

Use Go 1.27.4 from `webview/`.

- **Windows (WebView2 Runtime)** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.1.0-windows-x64.exe .`
- **Linux (GTK 3 and WebKitGTK 4.1, tested in an Ubuntu container)** — In Bash, run `docker build -t voice-typing:linux .`, then `docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-1.1.0-linux-x64.tar.gz`.
- **macOS (macOS 13 or later)** — Run `bash build-macos.sh` on a Mac with Apple command line tools installed.

</details>
