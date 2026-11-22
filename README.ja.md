# Voice Typing

[English](README.md) · 日本語

<img src="webview/assets/icon.png" width="64" height="64" alt="Voice Typing のアイコン">

Soniox または OpenAI で話した内容を文字にするデスクトップアプリです。Go と Wails を使います。

## 起動

[`release/`](release/) にある、お使いの OS と CPU に合ったファイルを開きます。

| OS | 起動方法 |
| --- | --- |
| Windows x64 | WebView2 が入った PC で `.exe` をダブルクリックします。 |
| Linux x64 | `.tar.gz` を展開して `voice-typing` を起動します。GTK 3 と WebKitGTK 4.1 が必要です。 |
| macOS | Apple Silicon（arm64）または Intel（x64）の ZIP を展開し、`Voice Typing.app` を開きます。実機での動作は未確認で、Apple の公証は未実施です。 |

## 使い方

画像は Windows の配布版を起動して撮影したものです。録音画面はテスト用の合成音で撮影しています。

### 1. 認識サービスを設定する

小さなパネルの歯車をクリックします。**Soniox** または **OpenAI** を選び、そのサービスの API キーを入力して **保存** を押します。マイクの許可を求められたら許可します。

Windows と Linux の配布版では、保存が完了すると設定が閉じます。保存に失敗すると、その場にエラーが表示されます。

<img src="docs/settings.png" width="410" alt="歯車で開いた設定。認識サービス、API キー、ショートカット、常に手前に表示、保存ボタンがある">

ショートカットを変えるときは **変更** をクリックし、使いたいキーを押して **保存** します。**常に手前に表示** もここで切り替えられます。API キーは OS の資格情報ストアに保存され、録音した音声は選んだサービスに送信されます。

### 2. 録音する

1. Windows では、文字を入れたい欄にカーソルを置きます。macOS と Linux ではパネルにフォーカスを置きます。
2. **Page Down** を押します。薄い波形はマイクの準備中です。**青い波形が動いたら**話し始めます。
3. 話し終わったら **Page Down** をもう一度押し、認識結果を待ちます。

<img src="docs/recording.png" width="204" alt="録音中の操作パネル。青い波形の横に設定と終了ボタンが並ぶ">

macOS の配布 ZIP では、準備中に円形のマークが表示されます。青い波形が動いたら話し始めます。

歯車の右クリックメニューからも録音を開始・終了できます。アプリを終了するには **×** をクリックします。

### 3. 文字を入力する

Windows でグローバルショートカットから録音した場合は、録音開始時にフォーカスがあった欄に自動で貼り付けます。途中で入力先を変えた場合、右クリックメニューから録音した場合、macOS と Linux では、結果をクリップボードから貼り付けます。

エラーのアイコンが出たら歯車を開き、設定内のメッセージを確認してください。

## 開発

Go 1.27.4 で `webview/` からビルドします。

- **Windows**　`go build -tags production -trimpath -ldflags "-s -w -H windowsgui" -o ../release/Voice-Typing-1.0.0-windows-x64.exe .`
- **Linux**　GTK と WebKitGTK の開発環境で `go build -tags production,webkit2_41 -trimpath -ldflags "-s -w" -o voice-typing .`。Docker を使う場合は `docker build -t voice-typing:linux .`。
- **macOS**　Apple の開発ツールが入った Mac で `bash build-macos.sh`。
