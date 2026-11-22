const api = window.voicePanel;
const status = document.querySelector('#status');
const settingsButton = document.querySelector('#open-settings');
const symbol = document.querySelector('#symbol');
const wave = document.querySelector('#wave');
const bars = Array.from(wave.children);
const states = {
  idle: ['○', '待機中'], connecting: ['◔', '接続中'], listening: ['', '録音中'],
  finishing: ['⋯', '確定中'], pasted: ['✓', '貼り付け完了'], copied: ['▣', 'コピー完了'],
  error: ['⚠', 'エラー'],
};
let active;
let currentState = 'idle';
let smooth = 0;

function display(state) {
  currentState = state;
  const [icon, label] = states[state];
  symbol.textContent = icon;
  status.dataset.state = state;
  status.setAttribute('aria-label', label);
  wave.hidden = state !== 'listening';
  symbol.hidden = !wave.hidden;
}

function drawWave(level) {
  if (currentState !== 'listening' || document.hidden) return;
  smooth += (Math.min(1, Math.sqrt(level) * 2.4) - smooth) * 0.33;
  const phase = performance.now() * 0.008;
  for (const [index, bar] of bars.entries()) {
    const envelope = 1 - Math.abs(index - 3) * 0.15;
    const pulse = 0.3 + 0.7 * Math.sin(phase - index * 0.72) ** 2;
    const scale = (4 + 2 * envelope * pulse * (2 + 12 * smooth)) / 32;
    bar.style.transform = `scaleY(${scale})`;
  }
}

function close(task) {
  clearTimeout(task.timer);
  task.node?.disconnect();
  task.stream?.getTracks().forEach(track => track.stop());
  void task.context?.close().catch(() => {});
  if (active === task) active = null;
}

async function start(id) {
  const task = { id };
  active = task;
  smooth = 0;
  for (const bar of bars) bar.style.transform = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
    if (active !== task) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    task.stream = stream;
    task.context = new AudioContext({ sampleRate: 16000 });
    await task.context.audioWorklet.addModule('pcm.js');
    if (active !== task) return;
    task.node = new AudioWorkletNode(task.context, 'pcm-capture', { channelCount: 1 });
    task.node.port.onmessage = ({ data }) => {
      if (active !== task) return;
      if (data.stopped) {
        close(task);
        api.audio(id, 'stopped');
      } else {
        api.audio(id, 'block', data.data);
        drawWave(data.level);
      }
    };
    task.node.onprocessorerror = () => {
      if (active === task) api.audio(id, 'error');
      close(task);
    };
    task.context.createMediaStreamSource(stream).connect(task.node);
    task.node.connect(task.context.destination);
    await task.context.resume();
    if (active === task && !task.stopping) api.audio(id, 'ready', task.context.sampleRate);
  } catch {
    if (active === task) api.audio(id, 'error');
    close(task);
  }
}

api.onStart(id => void start(id));
api.onStop(id => {
  const task = active;
  if (task?.id === id && task.node) {
    task.stopping = true;
    task.node.port.postMessage('flush');
    task.timer = setTimeout(() => {
      if (active !== task) return;
      close(task);
      api.audio(id, 'stopped');
    }, 700);
  } else {
    if (task?.id === id) close(task);
    api.audio(id, 'stopped');
  }
});
api.onCancel(id => { if (active?.id === id) close(active); });
api.onState(display);
void api.state().then(display);
settingsButton.addEventListener('click', api.settings);
settingsButton.addEventListener('contextmenu', event => {
  event.preventDefault();
  api.menu();
});
