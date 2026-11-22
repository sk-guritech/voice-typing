<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing のアイコン">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>小さなパネルで使える、デスクトップの音声入力。</strong></p>
<p align="center">ショートカットで録音し、Soniox または OpenAI で文字にします。</p>

<p align="center">
  <a href="#起動">起動</a> · <a href="#使い方">3ステップで使う</a> · <a href="README.md">English</a>
</p>

## 起動

下の手順でビルドすると、配布ファイルが [`release/`](release/) に入ります。

| OS | 必要な環境 | 起動方法 |
| --- | --- | --- |
| Windows x64 | WebView2 Runtime | `.exe` を起動します。 |
| Linux x64 | GTK 3、WebKitGTK 4.1 | `.tar.gz` を展開し、`voice-typing` を起動します。 |
| macOS（Apple Silicon / Intel） | macOS 13 以降 | ZIP を展開し、`Voice Typing.app` を開きます。 |

macOS 版はアドホック署名済みで、Mac 実機での動作は未確認です。

## 使い方

1. **設定する。** 歯車を開き、Soniox または OpenAI の API キーを入力して**保存**します。ショートカットと前面表示もここで変更できます。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

2. **録音する。** Windows は入力欄にカーソルを置き、Linux・macOS はパネルにフォーカスを置きます。<kbd>Page Down</kbd> を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="録音中の青い波形">

3. **文字を入力する。** <kbd>Page Down</kbd> をもう一度押します。Windows でショートカットから録音し、同じ入力欄にフォーカスがあれば自動で貼り付けます。結果はクリップボードからも貼り付けられます。

<details>
<summary>ローカルビルド</summary>

Go 1.27.4 で `webview/` から実行します。

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.1.0-windows-x64.exe .`
- **Linux（Bash）** — `docker build -t voice-typing:linux .` の後、`docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-1.1.0-linux-x64.tar.gz` を実行します。
- **macOS** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh`。

</details>
