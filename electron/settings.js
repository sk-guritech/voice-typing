const settingsApi = window.voiceSettings;
const section = document.querySelector('#settings-panel');
const gear = document.querySelector('#open-settings');
const form = document.querySelector('#settings');
const provider = document.querySelector('#provider');
const alwaysOnTop = document.querySelector('#always-on-top');
const key = document.querySelector('#key');
const reveal = document.querySelector('#reveal');
const shortcut = document.querySelector('#shortcut');
const capture = document.querySelector('#capture');
const message = document.querySelector('#message');
let selectedShortcut = 'PageDown';
let capturing = false;
let changing = 0;
let opening = 0;

async function refreshKey() {
  const request = ++changing;
  key.value = '';
  key.type = 'password';
  reveal.textContent = '表示';
  const result = await settingsApi.key(provider.value, false);
  if (request !== changing || !result) return;
  key.placeholder = result.present ? '設定済み' : 'API キーを入力';
  if (result.error) message.textContent = result.error;
}

reveal.addEventListener('click', async () => {
  if (key.type === 'text') {
    key.type = 'password';
    if (!key.dataset.edited) key.value = '';
    reveal.textContent = '表示';
    return;
  }
  const request = changing;
  if (!key.value) {
    const result = await settingsApi.key(provider.value, true);
    if (request !== changing || !result) return;
    if (result.error) {
      message.textContent = result.error;
      return;
    }
    if (!key.value) key.value = result.value;
  }
  key.type = 'text';
  reveal.textContent = '隠す';
});
key.addEventListener('input', () => { key.dataset.edited = 'yes'; });
provider.addEventListener('change', () => {
  delete key.dataset.edited;
  message.textContent = '';
  void refreshKey();
});

capture.addEventListener('click', () => {
  capturing = !capturing;
  shortcut.textContent = capturing ? 'キーを押してください' : selectedShortcut;
  capture.textContent = capturing ? '取消' : '変更';
});

const keyNames = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
document.addEventListener('keydown', event => {
  if (section.hidden) return;
  if (!capturing) {
    if (event.key === 'Escape' && !event.defaultPrevented) settingsApi.close();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) return;
  if (event.key !== 'Escape') {
    const name = keyNames[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);
    if (!/^(?:PageDown|PageUp|Home|End|Insert|Delete|Space|Backspace|Up|Down|Left|Right|Tab|Enter|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(name)) return;
    const modifiers = [];
    if (event.metaKey) modifiers.push(navigator.platform.startsWith('Mac') ? 'Command' : 'Super');
    if (event.ctrlKey) modifiers.push('Control');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (!modifiers.length && /^[A-Z0-9]$/.test(name)) {
      message.textContent = '文字キーには修飾キーを組み合わせてください。';
      return;
    }
    selectedShortcut = [...modifiers, name].join('+');
    message.textContent = '';
  }
  capturing = false;
  shortcut.textContent = selectedShortcut;
  capture.textContent = '変更';
}, true);

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (capturing) return;
  const submit = form.querySelector('[type=submit]');
  const chosen = provider.value;
  const request = opening;
  submit.disabled = true;
  try {
    const result = await settingsApi.save({
      provider: chosen,
      shortcut: selectedShortcut,
      alwaysOnTop: alwaysOnTop.checked,
      key: key.dataset.edited ? key.value : '',
    });
    if (request !== opening) return;
    message.textContent = result?.ok ? '保存しました。' : result?.error ?? '保存できませんでした。';
    if (result?.ok && chosen === provider.value) {
      delete key.dataset.edited;
      await refreshKey();
    }
  } catch {
    if (request === opening) message.textContent = '設定を保存できませんでした。';
  } finally {
    submit.disabled = false;
  }
});

async function load(request) {
  const config = await settingsApi.config();
  if (!config || request !== opening) return;
  provider.value = config.provider;
  alwaysOnTop.checked = config.alwaysOnTop;
  alwaysOnTop.disabled = !config.canKeepAbove;
  selectedShortcut = config.shortcut;
  shortcut.textContent = selectedShortcut;
  message.textContent = config.error;
  await refreshKey();
}
settingsApi.onVisibility(visible => {
  const request = ++opening;
  ++changing;
  section.hidden = !visible;
  gear.setAttribute('aria-expanded', String(visible));
  capturing = false;
  capture.textContent = '変更';
  key.value = '';
  key.type = 'password';
  delete key.dataset.edited;
  reveal.textContent = '表示';
  message.textContent = '';
  if (visible) {
    provider.focus();
    void load(request);
  } else {
    gear.focus();
  }
});
