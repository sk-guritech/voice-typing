# Voice Typing

Electron で動くデスクトップ音声入力です。小窓には状態アイコンを表示し、録音中はマイクの音量に合わせて波形が動きます。

## 起動

配布版はローカルの `release/` フォルダーに置きます。

- Windows x64 は `.exe` をダブルクリックします。
- Linux x64 は `.AppImage` に `chmod +x` で実行権限を付けて起動します。
- macOS は Apple Silicon 用（arm64）または Intel 用（x64）の ZIP を展開し、`Voice Typing.app` を開きます。macOS 版は Apple の公証を受けていません。

### ソースから起動

Node.js 24 を使い、プロジェクトのフォルダーで次を実行します。

```sh
npm ci
npm start
```

## 設定

歯車を押すと、小窓の上に **設定** が展開します。歯車をもう一度押すか、Esc キーで閉じられます。認識サービスを選び、そのサービスの API キーを入力して保存します。キーはサービスごとに OS の暗号化機能を使って保存され、**表示** を押すと確認できます。

**常に手前に表示** は初期状態でオンです。設定を切り替えて保存すると、すぐに反映されます。Linux の Wayland セッションでは、この項目は利用できません。

- **Soniox** は `stt-rt-v6` で録音中に音声を送信します。ソースから起動する場合は、既存の `soniox.key` も読み込めます。
- **OpenAI** は `gpt-transcribe` を使い、録音終了後に WAV を送信します。1回の録音は最長10分です。

環境変数 `SONIOX_API_KEY` と `OPENAI_API_KEY` も使えます。設定画面から保存したキーが優先されます。Linux でキーストアが利用できない場合は、環境変数を使ってください。

ショートカットの初期値は **Page Down** です。設定画面の **変更** を押して新しいキーを入力し、保存すると切り替わります。起動中はそのキーが音声入力に割り当てられます。

## 音声入力

1. 入力欄にカーソルを置き、ショートカットを押します。
2. 波形が表示されたら話します。
3. 同じキーをもう一度押すと、確定文をクリップボードに入れます。Windows では同じ入力先にフォーカスがある場合、自動で貼り付けます。macOS は **⌘V**、Linux は入力先の貼り付け操作を使います。

Windows Terminal や従来の Windows コンソールでは、改行を含む文章はクリップボードに残します。貼り付ける前に内容を確認してください。アプリは録音ファイルや文字起こし履歴を保存しません。

小窓はアイコンや波形の側をドラッグして移動できます。歯車を右クリックすると、録音の開始・終了、最小化、アプリの終了が選べます。

Linux では、Wayland のグローバルショートカットに対応したデスクトップ環境と、登録されたアプリのデスクトップエントリが必要です。

## パッケージ化

対象の OS 上で `npm run dist` を実行すると、配布用パッケージを `dist/` に作成できます。Windows ではインストール不要の単体 `.exe` を出力します。`npm run package` は、配布パッケージ化する前のアプリ一式を出力します。キーはパッケージに含まれません。macOS で配布する場合の署名や公証は別途必要です。

[Soniox WebSocket API](https://docs.soniox.com/api-reference/stt/websocket-api) · [OpenAI 音声認識 API](https://developers.openai.com/api/docs/guides/speech-to-text) · [Electron のグローバルショートカット](https://www.electronjs.org/docs/latest/api/global-shortcut/)
