const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel, fn) => ipcRenderer.on(channel, (_event, value) => fn(value));
contextBridge.exposeInMainWorld('voiceSettings', {
  config: () => ipcRenderer.invoke('config'),
  key: (provider, reveal) => ipcRenderer.invoke('key-info', provider, reveal),
  save: form => ipcRenderer.invoke('save-config', form),
  close: () => ipcRenderer.send('close-settings'),
  onVisibility: fn => listen('settings-visibility', fn),
});
contextBridge.exposeInMainWorld('voicePanel', {
  state: () => ipcRenderer.invoke('panel-state'),
  settings: () => ipcRenderer.send('panel-settings'),
  menu: () => ipcRenderer.send('open-menu'),
  audio: (id, kind, value) => ipcRenderer.send('audio', id, kind, value),
  onState: fn => listen('state', fn),
  onStart: fn => listen('capture-start', fn),
  onStop: fn => listen('capture-stop', fn),
  onCancel: fn => listen('capture-cancel', fn),
});
