const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, screen, session, safeStorage } = require('electron');
const { existsSync } = require('node:fs');
const { readFile, writeFile, rename } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PROVIDERS, createSession } = require('./providers.cjs');

const windows = process.platform === 'win32' ? require('./windows.cjs') : null;
const panelFile = path.join(__dirname, 'panel.html');
const panelUrl = pathToFileURL(panelFile).href;
const compactSize = { width: 180, height: 69 };
const settingsSize = { width: 382, height: 396 };
const fixedPanelBounds = process.platform === 'linux' &&
  (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY));
const defaults = { provider: 'soniox', shortcut: 'PageDown', alwaysOnTop: true };
let preferences = { ...defaults };
let panel;
let panelReady = false;
let settingsAnchor;
let pendingSettings = false;
let current;
let nextId = 0;
let lastState = 'idle';
let shortcutReady = false;
let lastPress = 0;
let heldTimer;
let errorMessage = '';
let saving = Promise.resolve();

function state(value, message = '') {
  lastState = value;
  errorMessage = message;
  panel?.webContents.send('state', value);
}

async function optionalRead(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
}

function dataPath(name) {
  return path.join(app.getPath('userData'), name);
}

async function atomicWrite(file, data) {
  await writeFile(`${file}.tmp`, data, { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}

async function keyFor(provider) {
  const saved = await optionalRead(dataPath(`${provider}.key.enc`));
  if (saved) return (await safeStorage.decryptStringAsync(saved)).result;
  const env = process.env[PROVIDERS[provider].env]?.trim();
  if (env) return env;
  if (provider === 'soniox' && !app.isPackaged) {
    return (await optionalRead(path.join(app.getAppPath(), 'soniox.key')))?.toString().trim() ?? '';
  }
  return '';
}

function validShortcut(value) {
  return typeof value === 'string' &&
    /^(?:(?:Command|Control|Alt|Shift|Super)\+)*(?:PageDown|PageUp|Home|End|Insert|Delete|Space|Backspace|Up|Down|Left|Right|Tab|Enter|Escape|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(value);
}

function register(shortcut) {
  try {
    return globalShortcut.register(shortcut, () => {
      if (shortcut !== preferences.shortcut || Date.now() - lastPress < 260) return;
      if (shortcut === 'PageDown' && windows?.shortcutHeld()) {
        if (heldTimer) return;
        heldTimer = setInterval(() => {
          if (windows.shortcutHeld()) return;
          clearInterval(heldTimer);
          heldTimer = null;
        }, 25);
      }
      lastPress = Date.now();
      void toggle();
    });
  } catch {
    return false;
  }
}

function movePanel(bounds, size, displayReference = bounds) {
  const area = screen.getDisplayMatching(displayReference).workArea;
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  panel.setBounds({
    width,
    height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
  });
}

function compactInputRegion() {
  const [width, height] = panel.getSize();
  panel.setShape([{
    x: width - compactSize.width, y: height - compactSize.height,
    ...compactSize,
  }]);
}

function openSettings() {
  if (!panelReady) {
    pendingSettings = true;
    return;
  }
  if (panel.isMinimized()) panel.restore();
  if (!settingsAnchor) {
    const compact = panel.getBounds();
    if (fixedPanelBounds) {
      panel.setShape([]);
    } else {
      movePanel({
        ...compact,
        x: compact.x + compact.width - settingsSize.width,
        y: compact.y + compact.height - settingsSize.height,
      }, settingsSize, compact);
    }
    settingsAnchor = { compact, expanded: panel.getBounds() };
    panel.webContents.send('settings-visibility', true);
  }
  panel.focus();
}

function closeSettings() {
  if (!settingsAnchor) return;
  const { compact, expanded } = settingsAnchor;
  const currentBounds = panel.getBounds();
  settingsAnchor = null;
  panel.webContents.send('settings-visibility', false);
  if (fixedPanelBounds) {
    compactInputRegion();
    return;
  }
  movePanel({
    ...compact,
    x: compact.x + currentBounds.x - expanded.x,
    y: compact.y + currentBounds.y - expanded.y,
  }, compactSize);
}

function menu() {
  const label = current ? '音声入力を終了' : '音声入力を開始';
  return Menu.buildFromTemplate([
    { label, enabled: !current?.ending, click: () => void toggle() },
    { label: settingsAnchor ? '設定を閉じる' : '設定…', click: settingsAnchor ? closeSettings : openSettings },
    ...(errorMessage ? [{ label: errorMessage, enabled: false }] : []),
    { type: 'separator' },
    { label: '最小化', click: () => panel?.minimize() },
    { label: '終了', role: 'quit' },
  ]);
}

function createWindow(options) {
  const window = new BrowserWindow({
    resizable: false, autoHideMenuBar: true, backgroundColor: '#14221f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
    ...options,
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.removeMenu();
  void window.loadFile(panelFile);
  return window;
}

function trusted(event) {
  return panel && event.sender === panel.webContents
    && event.senderFrame === event.sender.mainFrame
    && event.senderFrame.url === panelUrl;
}

function cleanup(task) {
  if (current !== task) return false;
  current = null;
  clearInterval(task.watch);
  clearTimeout(task.captureTimer);
  clearTimeout(task.pasteTimer);
  task.transport?.cancel();
  panel?.webContents.send('capture-cancel', task.id);
  return true;
}

function fail(task, message) {
  if (cleanup(task)) state('error', message);
}

function complete(task, text, deadline = Date.now() + 1500) {
  if (current !== task) return;
  if (!text) return fail(task, '音声を認識できませんでした。');
  if (task.target && windows.matches(task.target) && windows.pasteKeysHeld() && Date.now() < deadline) {
    task.pasteTimer = setTimeout(() => complete(task, text, deadline), 30);
    return;
  }
  clipboard.writeText(text);
  const pasted = task.target && !windows.pasteKeysHeld() && windows.paste(task.target, text);
  cleanup(task);
  state(pasted ? 'pasted' : 'copied');
}

async function toggle() {
  if (!panelReady) return;
  if (current) {
    const task = current;
    if (task.ending) return;
    task.ending = true;
    state('finishing');
    panel?.webContents.send('capture-stop', task.id);
    clearTimeout(task.captureTimer);
    task.captureTimer = setTimeout(() => fail(task, '録音を終了できませんでした。'), 4000);
    return;
  }
  const task = { id: ++nextId, provider: preferences.provider, target: windows?.target() };
  current = task;
  state('connecting');
  if (task.target) {
    task.watch = setInterval(() => {
      if (!windows.matches(task.target)) task.target = null;
    }, 35);
  }
  try {
    task.key = await keyFor(task.provider);
    if (current !== task) return;
    if (!task.key || !/^[!-~]+$/.test(task.key)) {
      fail(task, `${PROVIDERS[task.provider].name} の API キーを設定してください。`);
      openSettings();
      return;
    }
    if (task.ending) {
      cleanup(task);
      state('idle');
      return;
    }
    panel.webContents.send('capture-start', task.id);
    task.captureTimer = setTimeout(() => fail(task, 'マイクを開始できませんでした。'), 30000);
  } catch {
    fail(task, 'API キーを読み込めませんでした。');
  }
}

function setupIpc() {
  ipcMain.handle('config', async event => {
    if (!trusted(event) || !settingsAnchor) return null;
    return { ...preferences, canKeepAbove: !fixedPanelBounds, error: errorMessage };
  });
  ipcMain.handle('key-info', async (event, provider, reveal) => {
    if (!trusted(event) || !settingsAnchor || !Object.hasOwn(PROVIDERS, provider)) return null;
    const anchor = settingsAnchor;
    try {
      const key = await keyFor(provider);
      return { present: Boolean(key), value: settingsAnchor === anchor && reveal === true ? key : '' };
    } catch {
      return { error: 'API キーを読み込めませんでした。入力し直して保存できます。' };
    }
  });
  ipcMain.handle('save-config', (event, form) => {
    if (!trusted(event) || !settingsAnchor) return null;
    const operation = saving.then(() => save(form));
    saving = operation.catch(() => {});
    return operation;
  });
  ipcMain.handle('panel-state', event => trusted(event) ? lastState : 'idle');
  ipcMain.on('panel-settings', event => {
    if (!trusted(event)) return;
    if (settingsAnchor) closeSettings();
    else openSettings();
  });
  ipcMain.on('close-settings', event => {
    if (trusted(event)) closeSettings();
  });
  ipcMain.on('open-menu', event => {
    if (trusted(event)) menu().popup({ window: panel });
  });
  ipcMain.on('audio', (event, id, kind, value) => {
    const task = current;
    if (!trusted(event) || !task || task.id !== id) return;
    if (kind === 'ready' && !task.ending && !task.transport && Number.isInteger(value) && value >= 8000 && value <= 96000) {
      clearTimeout(task.captureTimer);
      task.transport = createSession[task.provider](task.key, value, text => complete(task, text), message => fail(task, message));
      delete task.key;
      state('listening');
    } else if (kind === 'block' && task.transport && value instanceof ArrayBuffer && value.byteLength <= 16000) {
      task.transport.add(Buffer.from(value));
    } else if (kind === 'stopped' && task.ending && !task.ended) {
      task.ended = true;
      clearTimeout(task.captureTimer);
      if (task.transport) task.transport.end();
      else if (cleanup(task)) state('idle');
    } else if (kind === 'error') {
      fail(task, 'マイクを開けませんでした。マイクへのアクセスを確認してください。');
    }
  });
}

async function save(form) {
  const { provider, shortcut, alwaysOnTop = preferences.alwaysOnTop } = form ?? {};
  const key = typeof form?.key === 'string' ? form.key.trim() : '';
  if (!Object.hasOwn(PROVIDERS, provider) || !validShortcut(shortcut) ||
      typeof alwaysOnTop !== 'boolean' || (key && !/^[!-~]+$/.test(key))) {
    return { error: '入力した設定を確認してください。' };
  }
  const next = { provider, shortcut, alwaysOnTop };
  const replace = !shortcutReady || shortcut !== preferences.shortcut;
  if (replace && !register(shortcut)) return { error: 'このショートカットは登録できません。別のキーを選んでください。' };
  try {
    if (key) {
      if (!await safeStorage.isAsyncEncryptionAvailable() ||
          (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
        throw new Error('キーを保存するには OS のキーストアが必要です。環境変数でも設定できます。');
      }
      const encrypted = await safeStorage.encryptStringAsync(key);
      await atomicWrite(dataPath(`${provider}.key.enc`), encrypted);
    }
    await atomicWrite(dataPath('settings.json'), JSON.stringify(next));
  } catch (error) {
    if (replace) globalShortcut.unregister(shortcut);
    return { error: error.code ? '設定を保存できませんでした。' : error.message };
  }
  if (replace && shortcutReady) globalShortcut.unregister(preferences.shortcut);
  if (!fixedPanelBounds && alwaysOnTop !== preferences.alwaysOnTop) {
    panel?.setAlwaysOnTop(alwaysOnTop);
  }
  preferences = next;
  shortcutReady = true;
  if (!current) state('idle');
  return { ok: true };
}

// Keep the existing profile so the renamed app can still decrypt saved API keys.
const appData = app.getPath('appData');
const previousProfile = path.join(appData, 'Soniox Voice Typing');
if (app.getPath('userData') === path.join(appData, 'Voice Typing') && existsSync(previousProfile)) {
  app.setPath('userData', previousProfile);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', openSettings);
  app.whenReady().then(async () => {
    try {
      const stored = JSON.parse((await optionalRead(dataPath('settings.json'))) ?? '{}');
      if (Object.hasOwn(PROVIDERS, stored.provider)) preferences.provider = stored.provider;
      if (validShortcut(stored.shortcut)) preferences.shortcut = stored.shortcut;
      if (typeof stored.alwaysOnTop === 'boolean') preferences.alwaysOnTop = stored.alwaysOnTop;
    } catch {
      // An unreadable preference file leaves the defaults available.
    }
    setupIpc();
    const isPanel = contents => panel?.webContents === contents && contents.getURL() === panelUrl;
    session.defaultSession.setPermissionRequestHandler((contents, name, reply, details) => {
      reply(isPanel(contents) && name === 'media' && details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'audio');
    });
    session.defaultSession.setPermissionCheckHandler((contents, name, _origin, details) => (
      isPanel(contents) && name === 'media' && details.mediaType === 'audio'
    ));
    const area = screen.getPrimaryDisplay().workArea;
    const size = fixedPanelBounds ? settingsSize : compactSize;
    panel = createWindow({
      ...size, x: area.x + area.width - size.width - 24,
      y: area.y + area.height - size.height - 24,
      frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
      alwaysOnTop: !fixedPanelBounds && preferences.alwaysOnTop, title: '音声入力',
    });
    if (fixedPanelBounds) compactInputRegion();
    panel.webContents.once('did-finish-load', () => {
      panelReady = true;
      if (pendingSettings) openSettings();
    });
    panel.on('closed', () => { panel = null; if (current) cleanup(current); app.quit(); });
    panel.webContents.on('render-process-gone', () => { if (current) cleanup(current); app.quit(); });
    shortcutReady = register(preferences.shortcut);
    if (!shortcutReady) state('error', 'ショートカットを登録できませんでした。設定で変更できます。');
  });
}
app.on('will-quit', () => {
  if (current) cleanup(current);
  clearInterval(heldTimer);
  globalShortcut.unregisterAll();
});
