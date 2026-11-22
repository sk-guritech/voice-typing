window.voiceLocale = (() => {
  const messages = {
    appTitle: ['音声入力', 'Voice Typing'],
    settings: ['設定', 'Settings'],
    language: ['表示言語', 'Language'],
    provider: ['認識サービス', 'Service'],
    model: ['モデル', 'Model'],
    keyLabel: ['API キー', 'API key'],
    keyPlaceholder: ['API キーを入力', 'Enter an API key'],
    keySaved: ['設定済み', 'API key saved'],
    show: ['表示', 'Show'],
    hide: ['隠す', 'Hide'],
    shortcut: ['ショートカット', 'Shortcut'],
    change: ['変更', 'Change'],
    cancel: ['取消', 'Cancel'],
    pressKey: ['キーを押してください', 'Press a key'],
    modifierRequired: ['文字キーには修飾キーを組み合わせてください。', 'Use a modifier with a letter or number.'],
    save: ['保存', 'Save'],
    alwaysOnTop: ['常に手前に表示', 'Always on top'],
    settingsButton: ['音声入力の設定', 'Voice Typing settings'],
    quitButton: ['アプリを終了', 'Quit Voice Typing'],
    idle: ['待機中', 'Ready'],
    connecting: ['マイク準備中', 'Preparing microphone'],
    listening: ['録音中', 'Recording'],
    finishing: ['確定中', 'Finishing'],
    pasted: ['貼り付け完了', 'Pasted'],
    copied: ['コピー完了', 'Copied'],
    error: ['エラー', 'Error'],
    menu: ['音声入力メニュー', 'Voice Typing menu'],
    stopRecording: ['音声入力を終了', 'Stop recording'],
    startRecording: ['音声入力を開始', 'Start recording'],
    openSettings: ['設定…', 'Settings…'],
    closeSettings: ['設定を閉じる', 'Close settings'],
    minimise: ['最小化', 'Minimize'],
    quit: ['終了', 'Quit'],
    micTimeout: ['マイクの準備がタイムアウトしました。', 'The microphone took too long to start.'],
    queueFull: ['音声の送信が追いつきませんでした。', 'Audio could not be sent fast enough.'],
    responseTimeout: ['応答がタイムアウトしました。', 'The speech recognition service took too long to respond.'],
    micUnavailable: ['マイクを開けませんでした。マイクへのアクセスを確認してください。', 'Could not open the microphone. Check microphone access.'],
    credentialStore: ['保存した API キーを読み込めませんでした。', 'Could not read the saved API key.'],
    invalidSettings: ['設定の内容が正しくありません。', 'Check the settings and try again.'],
    invalidSonioxModel: ['Soniox のリアルタイムモデルを選んでください。', 'Select a Soniox real-time model.'],
    invalidOpenAIModel: ['OpenAI の音声認識モデルを選んでください。', 'Select an OpenAI transcription model.'],
    invalidKey: ['API キーの形式が正しくありません。', 'The API key format is invalid.'],
    saveKey: ['API キーを保存できませんでした。', 'Could not save the API key.'],
    saveSettings: ['設定を保存できませんでした。', 'Could not save settings.'],
    saveLanguage: ['表示言語を保存できませんでした。', 'Could not save the display language.'],
    missingKey: ['歯車の設定から API キーを保存してください。', 'Save an API key in Settings.'],
    sampleRate: ['このマイクのサンプルレートには対応していません。', 'The microphone sample rate is unsupported.'],
    alreadyConnected: ['音声認識サービスに接続済みです。', 'Already connected to the speech recognition service.'],
    sonioxConnect: ['Soniox に接続できませんでした。', 'Could not connect to Soniox.'],
    sonioxConfigure: ['Soniox の設定を送信できませんでした。', 'Could not send settings to Soniox.'],
    audioBlock: ['音声データの形式が正しくありません。', 'The audio data format is invalid.'],
    sonioxDisconnected: ['Soniox との接続が切れました。', 'The connection to Soniox was lost.'],
    sonioxError: ['Soniox エラー（{code}）', 'Soniox returned an error ({code}).'],
    recordingEnded: ['録音は終了しました。', 'Recording has ended.'],
    recordingLimit: ['短く区切って録音してください。', 'Record in shorter sections.'],
    openaiSend: ['OpenAI への送信に失敗しました。', 'Could not send audio to OpenAI.'],
    openaiError: ['OpenAI がエラーを返しました（{code}）。', 'OpenAI returned an error ({code}).'],
    openaiRead: ['OpenAI の応答を読み込めませんでした。', 'Could not read the OpenAI response.'],
    clipboard: ['クリップボードにコピーできませんでした。', 'Could not copy to the clipboard.'],
    shortcutRegister: ['ショートカットを登録できませんでした。別のキーを選んでください。', 'Could not register the shortcut. Choose another key.'],
    shortcutUnavailable: ['ショートカットを利用できません。', 'The shortcut is unavailable.'],
    operationFailed: ['処理を完了できませんでした。', 'Could not complete the operation.'],
  };
  let index = 0;
  const t = key => messages[key][index];

  function error(reason) {
    if (!reason) return '';
    const match = /^(?:Error: )?ui\.([A-Za-z]+)(?::(\d+))?$/.exec(String(reason));
    const key = match?.[1];
    return Object.hasOwn(messages, key) ? t(key).replace('{code}', match[2] ?? '') : t('operationFailed');
  }

  function set(language) {
    index = language === 'en' ? 1 : 0;
    document.documentElement.lang = index ? 'en' : 'ja';
    document.title = t('appTitle');
    document.querySelectorAll('[data-l10n]').forEach(element => {
      element.textContent = t(element.dataset.l10n);
    });
    document.querySelectorAll('[data-l10n-aria]').forEach(element => {
      element.setAttribute('aria-label', t(element.dataset.l10nAria));
    });
  }

  return { t, error, set };
})();
