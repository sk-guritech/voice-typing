const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const gui = koffi.struct('VoiceTypingGuiInfo', {
  size: 'uint32_t', flags: 'uint32_t',
  active: 'void *', focus: 'void *', capture: 'void *', menu: 'void *',
  move: 'void *', caret: 'void *', rect: koffi.array('int32_t', 4),
});
const mouse = koffi.struct({
  x: 'int32_t', y: 'int32_t', data: 'uint32_t', flags: 'uint32_t',
  time: 'uint32_t', extra: 'size_t',
});
const keyboard = koffi.struct({
  key: 'uint16_t', scan: 'uint16_t', flags: 'uint32_t', time: 'uint32_t', extra: 'size_t',
});
const input = koffi.struct('VoiceTypingInput', {
  type: 'uint32_t', data: koffi.union({ keyboard, mouse }),
});
const foreground = user32.func('void * __stdcall GetForegroundWindow()');
const windowThread = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *window, _Out_ uint32_t *pid)');
const threadInfo = user32.func('int __stdcall GetGUIThreadInfo(uint32_t id, _Inout_ VoiceTypingGuiInfo *info)');
const className = user32.func('int __stdcall GetClassNameW(void *window, _Out_ uint16_t *name, int size)');
const keyState = user32.func('int16_t __stdcall GetAsyncKeyState(int key)');
const sendInput = user32.func('uint32_t __stdcall SendInput(uint32_t count, VoiceTypingInput *inputs, int size)');

function target() {
  const window = foreground();
  if (!window) return null;
  const pid = [0];
  const thread = windowThread(window, pid);
  if (!thread || pid[0] === process.pid) return null;
  const info = { size: koffi.sizeof(gui) };
  if (!threadInfo(thread, info) || !info.focus) return null;
  return { window, focus: info.focus, thread };
}

function matches(expected) {
  if (!expected) return false;
  const current = target();
  return current && current.window === expected.window && current.focus === expected.focus
    && current.thread === expected.thread;
}

function paste(expected, text) {
  if (!matches(expected)) return false;
  const name = new Uint16Array(128);
  const length = className(expected.window, name, name.length);
  const terminal = ['CASCADIA_HOSTING_WINDOW_CLASS', 'ConsoleWindowClass']
    .includes(String.fromCharCode(...name.subarray(0, length)));
  if (terminal && /[\x00-\x1f\x7f]/.test(text)) return false;
  const inputs = [[0x11, 0], [0x56, 0], [0x56, 2], [0x11, 2]]
    .map(([key, flags]) => ({ type: 1, data: { keyboard: { key, flags } } }));
  return sendInput(inputs.length, inputs, koffi.sizeof(input)) === inputs.length;
}

module.exports = {
  target, matches, paste,
  shortcutHeld: () => Boolean(keyState(0x22) & 0x8000),
  pasteKeysHeld: () => [0x10, 0x11, 0x12, 0x22, 0x5b, 0x5c].some(key => keyState(key) & 0x8000),
};
