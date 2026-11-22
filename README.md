# Voice Typing

Soniox または OpenAI で話した内容を文字にするデスクトップアプリです。

**[最新版をダウンロード](https://github.com/sk-guritech/voice-typing/releases/latest)**

- **Windows x64**　`.exe` をダブルクリック。
- **Linux x64**　`.AppImage` に `chmod +x` で実行権限を付けて起動。
- **macOS**　Apple Silicon（arm64）または Intel（x64）の ZIP を展開。Apple の公証は未実施です。

## 使い方

1. 歯車から認識サービスと API キーを設定します。
2. 入力欄を選び、**Page Down** を押して話します。もう一度押すと確定します。
3. Windows は同じ入力先に自動で貼り付けます。macOS・Linux はクリップボードから貼り付けます。

ショートカットと前面表示は歯車から変更できます。Linux でショートカットが使えない場合は、歯車の右クリックメニューから録音できます。音声は選んだサービスに送信されます。

## 開発

Node.js 24 で `npm ci`、`npm start`。配布物は `npm run dist` で作成します。
