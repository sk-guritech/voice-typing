(() => {
  const native = window.runtime;
  const backend = window.go.main.Probe;
  const compact = [180, 69];
  const settingsSize = [382, 396];
  const menuSize = [180, 202];
  const callbacks = {};
  const section = document.querySelector('#settings-panel');
  const gear = document.querySelector('#open-settings');
  const panel = document.querySelector('.floating-panel');
  const context = document.createElement('nav');
  context.className = 'panel-menu';
  context.setAttribute('aria-label', '音声入力メニュー');
  context.hidden = true;
  panel.before(context);

  let size = compact;
  let fixedViewport = false;
  let resizing = Promise.resolve();
  let settingsOpen = false;
  let settingsTransition = Promise.resolve();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let config;
  let state = 'idle';
  let lastError = '';
  let current;
  let nextId = 0;
  let selfTest = false;
  let hotkeyTest = false;
  let waveformSeen = false;
  let timeout;
  let testFinished = false;

  function waitForViewport([width, height]) {
    const ready = () => Math.abs(window.innerWidth - width) <= 1 && Math.abs(window.innerHeight - height) <= 1;
    if (ready()) return Promise.resolve();
    return new Promise(resolve => {
      function finish() {
        clearTimeout(fallback);
        window.removeEventListener('resize', onResize);
        resolve();
      }
      function onResize() {
        if (ready()) finish();
      }
      const fallback = setTimeout(finish, 180);
      window.addEventListener('resize', onResize);
    });
  }

  function resize(target) {
    resizing = resizing.then(async () => {
      if (size === target) return;
      if (fixedViewport && await backend.PlacePanel(...target, false)) {
        size = target;
        return;
      }
      fixedViewport = false;
      const { x, y } = await native.WindowGetPosition();
      const left = window.screen.availLeft ?? 0;
      const top = window.screen.availTop ?? 0;
      const x1 = Math.max(left, Math.min(x + size[0] - target[0], left + window.screen.availWidth - target[0]));
      const y1 = Math.max(top, Math.min(y + size[1] - target[1], top + window.screen.availHeight - target[1]));
      native.WindowSetSize(...target);
      native.WindowSetPosition(x1, y1);
      size = target;
      await waitForViewport(target);
    });
    return resizing;
  }

  function animateSettings(show) {
    if (reduceMotion.matches) return Promise.resolve();
    const closed = { opacity: 0, transform: 'translateY(14px) scale(.975)', transformOrigin: 'right bottom' };
    const open = { opacity: 1, transform: 'translateY(0) scale(1)', transformOrigin: 'right bottom' };
    return section.animate(show ? [closed, open] : [open, closed], {
      duration: show ? 220 : 155,
      easing: show ? 'cubic-bezier(.18,.8,.26,1)' : 'cubic-bezier(.45,0,.8,.45)',
    }).finished;
  }

  function showSettings(show) {
    settingsOpen = show;
    gear.setAttribute('aria-expanded', String(show));
    settingsTransition = settingsTransition.then(async () => {
      if (settingsOpen !== show) return;
      context.hidden = true;
      if (show) {
        await resize(settingsSize);
        if (!settingsOpen || !section.hidden) return;
        callbacks.visibility?.(true);
        await animateSettings(true);
        if (settingsOpen) section.querySelector('#provider').focus({ preventScroll: true });
      } else {
        if (!section.hidden) {
          gear.focus();
          section.inert = true;
          await animateSettings(false);
          callbacks.visibility?.(false);
          section.inert = false;
        }
        if (!settingsOpen) await resize(compact);
      }
    });
    return settingsTransition;
  }

  function setState(next) {
    state = next;
    callbacks.state?.(state);
    if (selfTest) void backend.TraceSelfTest(state);
  }

  function fail(message) {
    if (current) callbacks.cancel?.(current.id);
    current = null;
    clearTimeout(timeout);
    if (selfTest && !testFinished) {
      testFinished = true;
      void backend.ReportSelfTestFailure(String(message));
      return;
    }
    void backend.Cancel();
    lastError = String(message);
    setState('error');
  }

  function toggle(fromShortcut = false) {
    if (current) {
      if (state === 'finishing') return;
      setState('finishing');
      callbacks.stop?.(current.id);
      return;
    }
    if (settingsOpen || !section.hidden) return;
    const task = { id: ++nextId, writes: Promise.resolve(), queuedBytes: 0, ready: false, recording: false, connected: false };
    current = task;
    lastError = '';
    setState('connecting');
    timeout = setTimeout(() => fail('マイクの準備がタイムアウトしました。'), 20000);
    const start = () => { if (current === task) callbacks.start?.(task.id); };
    if (fromShortcut) {
      void backend.CaptureTarget().then(start).catch(error => {
        if (current === task) fail(error);
      });
    } else start();
  }

  function queue(task, operation) {
    task.writes = task.writes.then(async () => {
      if (current === task) await operation();
    }).catch(error => { if (current === task) fail(error); });
  }

  function audio(id, kind, value) {
    const task = current;
    if (!task || task.id !== id) return;
    if (kind === 'ready') {
      task.ready = true;
      queue(task, async () => {
        await backend.Connect(value);
        task.connected = true;
      });
    } else if (kind === 'block' && task.ready) {
      if (!task.recording) {
        clearTimeout(timeout);
        task.recording = true;
        if (state === 'connecting') setState('listening');
        const capturedBeforeConnection = !task.connected;
        if (selfTest && !hotkeyTest) setTimeout(() => {
          if (current !== task) return;
          waveformSeen = capturedBeforeConnection && !document.querySelector('#wave').hidden &&
            Boolean(document.querySelector('#wave i').style.transform);
          toggle();
        }, 850);
      }
      const bytes = value.byteLength;
      if (task.queuedBytes + bytes > 384_000) {
        fail('音声の送信が追いつきませんでした。');
        return;
      }
      const block = btoa(String.fromCharCode(...new Uint8Array(value)));
      task.queuedBytes += bytes;
      queue(task, async () => {
        await backend.Audio(block);
        task.queuedBytes -= bytes;
      });
    } else if (kind === 'stopped') {
      clearTimeout(timeout);
      if (!task.recording) {
        current = null;
        void backend.Cancel();
        setState('idle');
        return;
      }
      queue(task, () => backend.Finish());
      timeout = setTimeout(() => fail('応答がタイムアウトしました。'), config?.provider === 'openai' ? 93000 : 12000);
    } else if (kind === 'error') {
      fail('マイクを開けませんでした。マイクへのアクセスを確認してください。');
    }
  }

  async function showMenu() {
    await settingsTransition;
    if (!context.hidden) {
      context.hidden = true;
      await resize(section.hidden ? compact : settingsSize);
      return;
    }
    const entries = [
      [current ? '音声入力を終了' : '音声入力を開始', toggle],
      [section.hidden ? '設定…' : '設定を閉じる', () => showSettings(section.hidden)],
      ...(lastError ? [[lastError, null]] : []),
      ['最小化', native.WindowMinimise],
      ['終了', native.Quit],
    ];
    context.replaceChildren();
    for (const [label, action] of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = !action;
      button.addEventListener('click', () => {
        const hiding = showMenu();
        if (action === toggle) toggle();
        else void hiding.then(() => action?.());
      });
      context.append(button);
    }
    if (section.hidden) await resize(menuSize);
    context.hidden = false;
    context.querySelector('button').focus();
  }

  const keyNames = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !context.hidden) {
      event.preventDefault();
      void showMenu();
      gear.focus();
    }
    if (!config || config.globalShortcut || !section.hidden || event.repeat || event.defaultPrevented) return;
    const keys = [];
    if (event.metaKey) keys.push(navigator.platform.startsWith('Mac') ? 'Command' : 'Super');
    if (event.ctrlKey) keys.push('Control');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    keys.push(keyNames[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key));
    if (keys.join('+') === config.shortcut) {
      event.preventDefault();
      toggle();
    }
  });

  window.voicePanel = {
    state: async () => state,
    settings: () => void showSettings(!settingsOpen),
    quit: () => native.Quit(),
    menu: () => void showMenu(),
    audio,
    onState: fn => { callbacks.state = fn; },
    onStart: fn => { callbacks.start = fn; },
    onStop: fn => { callbacks.stop = fn; },
    onCancel: fn => { callbacks.cancel = fn; },
    trace: message => { if (selfTest) void backend.TraceSelfTest(message); },
    get useTestTone() { return selfTest; },
  };
  window.voiceSettings = {
    config: async () => {
      const settings = await backend.Config();
      return { ...settings, error: settings.error || lastError };
    },
    key: (provider, reveal) => backend.KeyInfo(provider, reveal),
    save: async form => {
      const result = await backend.Save(form);
      if (result.ok) config = await backend.Config();
      return result;
    },
    close: () => void showSettings(false),
    onVisibility: fn => { callbacks.visibility = fn; },
  };
  native.EventsOn('probe:shortcut', () => {
    if (hotkeyTest && current && state === 'listening') {
      waveformSeen = !document.querySelector('#wave').hidden &&
        Boolean(document.querySelector('#wave i').style.transform);
    }
    toggle(true);
  });
  native.EventsOn('probe:error', message => { if (current) fail(message); });
  native.EventsOn('probe:result', (text, pasted) => {
    if (!text) {
      fail('音声を認識できませんでした。');
      return;
    }
    clearTimeout(timeout);
    current = null;
    setState(pasted ? 'pasted' : 'copied');
    if (selfTest) {
      if (!waveformSeen) {
        fail('The recording waveform did not animate');
        return;
      }
      testFinished = true;
      document.querySelector('#quit-app').click();
    }
  });

  async function waitFor(stage, predicate) {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`${stage}: viewport ${window.innerWidth}×${window.innerHeight}, settings hidden=${section.hidden}`);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const screen = window.screen;
    const usesFixedBounds = await backend.FixedPanelBounds();
    fixedViewport = usesFixedBounds && await backend.PlacePanel(...compact, true);
    if (!fixedViewport) {
      if (usesFixedBounds) native.WindowSetSize(...compact);
      native.WindowSetPosition((screen.availLeft ?? 0) + screen.availWidth - compact[0] - 24,
        (screen.availTop ?? 0) + screen.availHeight - compact[1] - 24);
    }
    try {
      selfTest = await backend.IsSelfTest();
      hotkeyTest = await backend.IsHotkeyTest();
      await backend.StartShortcut();
      config = await backend.Config();
      if (!selfTest) return;
      void backend.TraceSelfTest(`Startup ${window.innerWidth}×${window.innerHeight}`);
      if (!section.hidden || panel.offsetWidth !== 164 || panel.offsetHeight !== 52) {
        throw new Error('The original compact panel was not rendered');
      }
      const viewportIs = ([width, height]) => window.innerWidth === width && window.innerHeight === height;
      await waitFor('Startup', () => viewportIs(fixedViewport ? settingsSize : compact));
      if (fixedViewport) await new Promise(resolve => setTimeout(resolve, 150));
      gear.click();
      await waitFor('Settings open', () => !section.hidden && viewportIs(settingsSize));
      if (!reduceMotion.matches) {
        await waitFor('Settings opening animation', () => section.getAnimations().some(animation => animation.effect.getKeyframes()[0].opacity === '0'));
      }
      void backend.TraceSelfTest('Settings opened');
      const form = section.querySelector('form');
      const input = section.querySelector('#key');
      input.value = 'x'.repeat(2001);
      input.dispatchEvent(new Event('input'));
      form.requestSubmit();
      await waitFor('Save error stays visible', () => !section.hidden && section.querySelector('#message').textContent.includes('形式'));
      input.value = '';
      input.dispatchEvent(new Event('input'));
      form.requestSubmit();
      if (!reduceMotion.matches) {
        await waitFor('Settings closing animation', () => section.getAnimations().some(animation => animation.effect.getKeyframes().at(-1).opacity === '0'));
      }
      await waitFor('Settings closed', () => section.hidden && viewportIs(fixedViewport ? settingsSize : compact));
      void backend.TraceSelfTest('Settings closed');
      if (hotkeyTest) {
        if (!config.globalShortcut) throw new Error(config.error);
        void backend.TraceSelfTest('Ready for global shortcut');
        return;
      }
      if (await backend.TestNeedsKeyPress()) {
        void backend.TraceSelfTest('Ready for Page Down');
        return;
      }
      toggle();
    } catch (error) {
      fail(error);
    }
  });
})();
