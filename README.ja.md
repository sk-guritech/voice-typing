<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing のアイコン">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>ショートカットひとつで、話した言葉を文字入力。</strong></p>

<p align="center">
  <a href="#準備">準備</a> · <a href="#ダウンロードと起動">ダウンロード</a> · <a href="#使い方">3ステップで使う</a> · <a href="README.md">English</a>
</p>

## 準備

使う音声認識サービスの API キーを用意します。

| サービス | 取得先 | 取得手順 |
| --- | --- | --- |
| Soniox | [Soniox Console](https://console.soniox.com/) | ログイン後、プロジェクトを選び、**API keys** でキーを作成します。 |
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) | ログイン後、**Create new secret key** を選び、発行されたキーをコピーします。 |

## ダウンロードと起動

お使いの OS に合ったファイルを選び、下の表に沿って起動します。[最新版をダウンロード](https://github.com/sk-guritech/voice-typing/releases/latest)

| OS | 選ぶファイル | 起動方法 | 実環境での動作確認 |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | ファイルをダブルクリックします。 | ○ 確認済み |
| Linux x64 | AppImage / `.tar.gz` | AppImage は実行を許可してから開きます。`.tar.gz` は展開して `voice-typing` を起動します。 | × 未確認 |
| macOS | Apple Silicon（arm64）用または Intel（x64）用の ZIP | ZIP を展開して `Voice Typing.app` を開きます。 | × Mac 実機で未確認 |

## 使い方

1. **設定する。** 歯車を押してサービスを選び、API キーを入力して **保存** します。ショートカットや「常に手前に表示」の設定もここで変更できます。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

2. **話す。** Windows では入力したい欄にカーソルを置き、Linux と macOS では音声入力パネルをクリックします。<kbd>Page Down</kbd> を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="音声入力中の青い波形">

3. **文字を入力する。** <kbd>Page Down</kbd> をもう一度押すと、話した内容が入力されます（Linux と macOS ではクリップボードにコピーされます）。

## 問題を報告する

使っている OS、アプリのバージョン、問題が起きたときの操作と結果を書いてください。画像やログを添える前に、API キーや個人情報を消してください。[GitHub で問題を報告する](https://github.com/sk-guritech/voice-typing/issues/new)

<details>
<summary>開発者向けの軽量版ビルド手順</summary>

Go 1.27.4 を使います。以下のコマンドは `webview/` で実行します。

- **Windows（WebView2 Runtime）** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-windows-x64.exe .`
- **Linux（GTK 3、WebKitGTK 4.1。Ubuntu コンテナで確認済み）** — Bash で `docker build -t voice-typing:linux .` の後、`docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-linux-x64.tar.gz` を実行します。
- **macOS（macOS 13 以降）** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh` を実行します。

</details>
