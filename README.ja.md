<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing のアイコン">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>ショートカットひとつで、話した言葉を文字入力。</strong></p>
<p align="center">Soniox または OpenAI を使える、小さなデスクトップパネル。</p>

<p align="center">
  <a href="#ダウンロードと起動">ダウンロード</a> · <a href="#準備">準備</a> · <a href="#使い方">3ステップで使う</a> · <a href="README.md">English</a>
</p>

## ダウンロードと起動

お使いの OS 向けの v1.0.0 をダウンロードして起動し、歯車から API キーを設定します。[GitHub Releases](https://github.com/sk-guritech/voice-typing/releases/tag/v1.0.0)

| OS | ダウンロード | 起動方法 | 実環境での動作確認 |
| --- | --- | --- | --- |
| Windows x64 | [EXE](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-x64.exe) | ファイルをダブルクリックします。 | ○ 確認済み |
| Linux x64 | [AppImage](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-linux-x64.AppImage) | ファイルのプロパティで実行を許可してから開きます。 | × 未確認 |
| macOS | [Apple Silicon 用 ZIP](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-mac-arm64.zip) / [Intel 用 ZIP](https://github.com/sk-guritech/voice-typing/releases/download/v1.0.0/Voice-Typing-1.0.0-mac-x64.zip) | ZIP を展開して `Voice Typing.app` を開きます。 | × Mac 実機で未確認 |

## 準備

使いたい認識サービスの API キーを取得します。

- **Soniox** — ログイン後、プロジェクトを選び、**API keys** でキーを作成します。[Soniox Console](https://console.soniox.com/)
- **OpenAI** — ログイン後、**Create new secret key** を選び、発行されたキーをコピーします。[OpenAI API keys](https://platform.openai.com/api-keys)

## 使い方

1. **設定する。** 歯車を開き、Soniox または OpenAI の API キーを入力して**保存**します。ショートカットと前面表示もここで変更できます。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

   画像は `main` の軽量版です。軽量版では **表示言語** を選ぶとすぐに切り替わります。

2. **話す。** Windows は入力欄にカーソルを置き、Linux・macOS はパネルにフォーカスを置きます。<kbd>Page Down</kbd> を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="音声入力中の青い波形">

3. **文字を入力する。** <kbd>Page Down</kbd> をもう一度押すと、話した内容が文字になります。Windows では、音声入力を始めたときと同じ入力欄にフォーカスがあれば自動で貼り付けます。クリップボードからも貼り付けられます。

## イシューの立て方

OS、アプリのバージョン、問題が起きた手順と結果を書いてください。画像やログを添える場合は、API キーや個人情報を消してください。[GitHub でイシューを作る](https://github.com/sk-guritech/voice-typing/issues/new)

<details>
<summary>開発者向けの軽量版ビルド手順</summary>

Go 1.27.4 で `webview/` から実行します。

- **Windows（WebView2 Runtime）** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.1.0-windows-x64.exe .`
- **Linux（GTK 3、WebKitGTK 4.1。Ubuntu コンテナで確認済み）** — Bash で `docker build -t voice-typing:linux .` の後、`docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-1.1.0-linux-x64.tar.gz` を実行します。
- **macOS（macOS 13 以降）** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh`。

</details>
