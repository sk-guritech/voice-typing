# Voice Typing

[English](README.md) · 日本語

<img src="webview/assets/icon.png" width="48" height="48" alt="Voice Typing のアイコン">

Soniox または OpenAI で音声を文字にします。

## 起動

[`release/`](release/) から、お使いの OS に合ったファイルを開きます。

- **Windows x64** — WebView2 が入った PC で `.exe` を起動。
- **Linux x64** — 展開して `voice-typing` を起動。GTK 3 と WebKitGTK 4.1 が必要です。
- **macOS** — Apple Silicon または Intel 用の ZIP を展開し、`Voice Typing.app` を起動。アドホック署名済みで、Mac 実機での動作は未確認です。

## 使い方

1. 歯車を開き、認識サービスを選んで API キーを入力し、**保存**します。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

2. Windows は入力欄にカーソルを置き、Linux・macOS はパネルにフォーカスを置きます。**Page Down** を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="録音中の青い波形">

3. **Page Down** をもう一度押すと確定します。Windows でショートカットから録音し、同じ入力欄にフォーカスがあれば自動で貼り付けます。結果はクリップボードからも貼り付けられます。

<details>
<summary>ローカルビルド</summary>

Go 1.27.4 で `webview/` から実行します。

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.0.0-windows-x64.exe .`
- **Linux** — `docker build -t voice-typing:linux .`。GTK と WebKitGTK の開発ライブラリがあれば `go build -tags production,webkit2_41 .` でもビルドできます。
- **macOS** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh`。

</details>
