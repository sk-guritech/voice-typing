<p align="center">
  <img src="webview/assets/icon.png" width="104" height="104" alt="Voice Typing のアイコン">
</p>

<h1 align="center">Voice Typing</h1>

<p align="center"><strong>ショートカットひとつで、話した言葉を文字入力。</strong></p>

<p align="center">
  <a href="https://ko-fi.com/skguritech"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" height="36" alt="Ko-fi で Voice Typing の開発を応援する"></a>
</p>

<p align="center">
  <a href="#準備">準備</a> · <a href="#ダウンロードと起動">ダウンロード</a> · <a href="#使い方">3ステップで使う</a> · <a href="#モデルと料金">モデルと料金</a> · <a href="README.md">English</a>
</p>

## 準備

使う音声認識サービスの API キーを用意します。

| サービス | 取得先 | 取得手順 |
| --- | --- | --- |
| Soniox | [Soniox Console](https://console.soniox.com/) | ログイン後、プロジェクトを選び、**API keys** でキーを作成します。 |
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) | ログイン後、**Create new secret key** を選び、発行されたキーをコピーします。 |

## ダウンロードと起動

お使いの OS に合ったファイルを選び、下の表に沿って起動します。[最新版をダウンロード](https://github.com/sk-guritech/voice-typing/releases/latest)

| OS | 必要な環境 | 起動方法 | 実環境での動作確認 |
| --- | --- | --- | --- |
| Windows x64 | WebView2 Runtime | `.exe` をダブルクリックします。 | ○ 確認済み |
| Linux x64 | GTK 3、WebKitGTK 4.1 | `.tar.gz` を展開し、`voice-typing` を起動します。 | × 未確認（Ubuntu コンテナで確認済み） |
| macOS | macOS 13 以降 | Apple Silicon（arm64）用または Intel（x64）用の ZIP を展開し、`Voice Typing.app` を開きます。 | × Mac 実機で未確認 |

## 使い方

1. **設定する。** 歯車を押してサービスを選び、API キーを入力して **保存** します。ショートカットや「常に手前に表示」の設定もここで変更できます。

   <img src="docs/settings.png" width="280" alt="Voice Typing の設定画面">

2. **話す。** Windows では入力したい欄にカーソルを置き、Linux と macOS では音声入力パネルをクリックします。<kbd>Page Down</kbd> を押し、青い波形が動いたら話します。

   <img src="docs/recording.png" width="170" alt="音声入力中の青い波形">

3. **文字を入力する。** <kbd>Page Down</kbd> をもう一度押すと、話した内容が入力されます（Linux と macOS ではクリップボードにコピーされます）。

## モデルと料金

料金は音声 1 時間あたりの米ドルです（2026 年 11 月確認）。トークン課金のモデルは目安です。[Soniox の料金](https://soniox.com/pricing#speech-to-text-api-pricing) · [OpenAI の料金](https://platform.openai.com/pricing)

| サービス | モデル | API 料金（1 時間） | 認識精度の特徴 |
| --- | --- | ---: | --- |
| Soniox | [`stt-rt-v6`](https://docs.soniox.com/stt/models#november-3-2026)（アプリの初期設定） | \$0.12 | v5 より、アクセントのある発話や言語が混ざる発話の認識を改善 |
| Soniox | [`stt-rt-v5`](https://docs.soniox.com/stt/models#june-16-2026) | \$0.12 | v4 より、雑音のある音声や多言語の認識を改善 |
| OpenAI | [`gpt-transcribe`](https://developers.openai.com/api/docs/models/gpt-transcribe) | \$0.27 | 録音済み音声向けに OpenAI が推奨する高精度モデル |
| OpenAI | [`gpt-4o-transcribe`](https://developers.openai.com/api/docs/models/gpt-4o-transcribe) | \$0.36 | Whisper より単語の誤りを減らし、言語の判定を改善 |
| OpenAI | [`gpt-4o-mini-transcribe`](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe) | \$0.18 | Whisper より単語の誤りを抑えた小型モデル |
| OpenAI | [`whisper-1`](https://developers.openai.com/api/docs/models/whisper-1) | \$0.36 | 多言語に対応する汎用モデル |

どのモデルでも、文字の入力は録音終了後です。精度の特徴は各社の公表資料に基づきます。

## 問題を報告する

使っている OS、アプリのバージョン、問題が起きたときの操作と結果を書いてください。画像やログを添える前に、API キーや個人情報を消してください。[GitHub で問題を報告する](https://github.com/sk-guritech/voice-typing/issues/new)

<details>
<summary>開発者向けの軽量版ビルド手順</summary>

Go 1.27.4 を使います。以下のコマンドは `webview/` で実行します。

- **Windows（WebView2 Runtime）** — `go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-windows-x64.exe .`
- **Linux（GTK 3、WebKitGTK 4.1。Ubuntu コンテナで確認済み）** — Bash で `docker build -t voice-typing:linux .` の後、`docker run --rm voice-typing:linux tar -cz -C /usr/local/bin voice-typing > ../release/Voice-Typing-linux-x64.tar.gz` を実行します。
- **macOS（macOS 13 以降）** — Apple のコマンドラインツールが入った Mac で `bash build-macos.sh` を実行します。

</details>

## ライセンス

[MIT](LICENSE)
