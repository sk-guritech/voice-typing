const settingsApi = window.voiceSettings;
const settingsLocale = window.voiceLocale;
const settingsText = settingsLocale.t;
const section = document.querySelector('#settings-panel');
const gear = document.querySelector('#open-settings');
const form = document.querySelector('#settings');
const provider = document.querySelector('#provider');
const language = document.querySelector('#language');
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
let keyPresent = false;
let messageCode = '';

function renderControls() {
  key.placeholder = settingsText(keyPresent ? 'keySaved' : 'keyPlaceholder');
  reveal.textContent = settingsText(key.type === 'text' ? 'hide' : 'show');
  shortcut.textContent = capturing ? settingsText('pressKey') : selectedShortcut;
  capture.textContent = settingsText(capturing ? 'cancel' : 'change');
  message.textContent = settingsLocale.error(messageCode);
}

function showMessage(code = '') {
  messageCode = code;
  message.textContent = settingsLocale.error(code);
}

async function refreshKey() {
  const request = ++changing;
  key.value = '';
  key.type = 'password';
  keyPresent = false;
  renderControls();
  const result = await settingsApi.key(provider.value, false);
  if (request !== changing || !result) return;
  keyPresent = Boolean(result.present);
  if (result.error) messageCode = result.error;
  renderControls();
}

reveal.addEventListener('click', async () => {
  if (key.type === 'text') {
    key.type = 'password';
    if (!key.dataset.edited) key.value = '';
    reveal.textContent = settingsText('show');
    return;
  }
  const request = changing;
  if (!key.value) {
    const result = await settingsApi.key(provider.value, true);
    if (request !== changing || !result) return;
    if (result.error) {
      showMessage(result.error);
      return;
    }
    if (!key.value) key.value = result.value ?? '';
  }
  key.type = 'text';
  reveal.textContent = settingsText('hide');
});
key.addEventListener('input', () => { key.dataset.edited = 'yes'; });
provider.addEventListener('change', () => {
  delete key.dataset.edited;
  showMessage();
  void refreshKey();
});
language.addEventListener('change', () => settingsApi.setLanguage(language.value));
settingsApi.onLanguage(value => {
  language.value = value;
  renderControls();
}, showMessage);

capture.addEventListener('click', () => {
  capturing = !capturing;
  renderControls();
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
      showMessage('ui.modifierRequired');
      return;
    }
    selectedShortcut = [...modifiers, name].join('+');
    showMessage();
  }
  capturing = false;
  renderControls();
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
    if (result?.ok) settingsApi.close();
    else showMessage(result?.error || 'ui.saveSettings');
  } catch {
    if (request === opening) showMessage('ui.saveSettings');
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
  showMessage(config.error);
  await refreshKey();
}
settingsApi.onVisibility(visible => {
  const request = ++opening;
  ++changing;
  section.hidden = !visible;
  capturing = false;
  key.value = '';
  key.type = 'password';
  keyPresent = false;
  delete key.dataset.edited;
  messageCode = '';
  renderControls();
  if (visible) {
    void load(request);
  } else {
    gear.focus();
  }
});
