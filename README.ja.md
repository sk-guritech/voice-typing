<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing のアイコン">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>ショートカットひとつで、話した言葉を文字入力。</strong></p>
<p align="center">Soniox または OpenAI を使える、小さなデスクトップパネル。</p>

<p align="center">
  <a href="#起動">起動</a> · <a href="#準備">準備</a> · <a href="#使い方">3ステップで使う</a> · <a href="README.md">English</a>
</p>

## 起動

下の手順でビルドすると、配布ファイルが [`release/`](release/) に入ります。

| OS | 必要な環境 | 起動方法 | 実環境での動作確認 |
| --- | --- | --- | --- |
| Windows x64 | WebView2 Runtime | `.exe` を起動します。 | ○ 確認済み |
| Linux x64 | GTK 3、WebKitGTK 4.1 | `.tar.gz` を展開し、`voice-typing` を起動します。 | × 未確認（Ubuntu コンテナで確認済み） |
| macOS（Apple Silicon / Intel） | macOS 13 以降 | ZIP を展開し、`Voice Typing.app` を開きます。 | × Mac 実機で未確認 |

macOS 版はアドホック署名済みです。

## 準備

使いたい認識サービスの API キーを取得します。

- **Soniox** — ログイン後、プロジェクトを選び、**API keys** でキーを作成します。[Soniox Console](https://console.soniox.com/)
- **OpenAI** — ログイン後、**Create new secret key** を選び、発行されたキーをコピーします。[OpenAI API keys](https://platform.openai.com/api-keys)

## 使い方

1. **設定する。** 歯車を開き、Soniox または OpenAI の API キーを入力して**保存**します。**表示言語**は選んだ時点で切り替わります。ショートカットと前面表示もここで変更できます。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

2. **話す。** Windows は入力欄にカーソルを置き、Linux・macOS はパネルにフォーカスを置きます。<kbd>Page Down</kbd> を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="音声入力中の青い波形">

3. **文字を入力する。** <kbd>Page Down</kbd> をもう一度押すと、話した内容が文字になります。Windows では、音声入力を始めたときと同じ入力欄にフォーカスがあれば自動で貼り付けます。クリップボードからも貼り付けられます。

## イシューの立て方

OS、アプリのバージョン、問題が起きた手順と結果を書いてください。画像やログを添える場合は、API キーや個人情報を消してください。[GitHub でイシューを作る](https://github.com/sk-guritech/voice-typing/issues/new)

<details>
<summary>ローカルビルド</summary>

Go 1.27.4 で `webview/` から実行します。

- **Windows** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.1.0-windows-x64.exe .`
- **Linux（Bash）** — `docker build -t voice-typing:linux .` の後、`docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-1.1.0-linux-x64.tar.gz` を実行します。
- **macOS** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh`。

</details>
