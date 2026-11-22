(() => {
  const native = window.runtime;
  const backend = window.go.main.Probe;
  const locale = window.voiceLocale;
  const t = locale.t;
  const compact = [180, 69];
  const settingsSize = [382, 396];
  const menuSize = [180, 202];
  const callbacks = {};
  const section = document.querySelector('#settings-panel');
  const gear = document.querySelector('#open-settings');
  const panel = document.querySelector('.floating-panel');
  const context = document.createElement('nav');
  context.className = 'panel-menu';
  context.dataset.l10nAria = 'menu';
  context.hidden = true;
  panel.before(context);

  let size = compact;
  let nativePlacement = false;
  let fixedViewport = false;
  let resizing = Promise.resolve();
  let settingsOpen = false;
  let settingsTransition = Promise.resolve();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let config;
  let savedLanguage = 'ja';
  let languageWrite = Promise.resolve();
  let state = 'idle';
  let lastError = '';
  let current;
  let nextId = 0;
  let selfTest = false;
  let hotkeyTest = false;
  let waveformSeen = false;
  let timeout;
  let testFinished = false;

  function applyLanguage(language) {
    locale.set(language);
    native.WindowSetTitle(t('appTitle'));
    callbacks.state?.(state);
    callbacks.language?.(language);
  }

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
      if (nativePlacement && await backend.PlacePanel(...target, false)) {
        size = target;
        if (!fixedViewport) await waitForViewport(target);
        return;
      }
      nativePlacement = false;
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
    if (reduceMotion.matches) return null;
    const closed = { opacity: 0, transform: 'translateY(14px) scale(.975)', transformOrigin: 'right bottom' };
    const open = { opacity: 1, transform: 'translateY(0) scale(1)', transformOrigin: 'right bottom' };
    return section.animate(show ? [closed, open] : [open, closed], {
      duration: show ? 220 : 155,
      easing: show ? 'cubic-bezier(.18,.8,.26,1)' : 'cubic-bezier(.45,0,.8,.45)',
      fill: 'both',
    });
  }

  function showSettings(show) {
    settingsOpen = show;
    gear.setAttribute('aria-expanded', String(show));
    settingsTransition = settingsTransition.then(async () => {
      if (settingsOpen !== show) return;
      context.hidden = true;
      if (show) {
        await resize(settingsSize);
        if (nativePlacement && !fixedViewport && !reduceMotion.matches) {
          // Let the resized native WebView paint before revealing the settings.
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        if (!settingsOpen || !section.hidden) return;
        callbacks.visibility?.(true);
        const animation = animateSettings(true);
        await animation?.finished;
        animation?.cancel();
      } else {
        if (!section.hidden) {
          if (section.contains(document.activeElement)) gear.focus({ preventScroll: true });
          section.inert = true;
          const animation = animateSettings(false);
          await animation?.finished;
          callbacks.visibility?.(false);
          animation?.cancel();
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
    timeout = setTimeout(() => fail('ui.micTimeout'), 20000);
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
        fail('ui.queueFull');
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
      timeout = setTimeout(() => fail('ui.responseTimeout'), config?.provider === 'openai' ? 93000 : 12000);
    } else if (kind === 'error') {
      fail('ui.micUnavailable');
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
      [t(current ? 'stopRecording' : 'startRecording'), toggle],
      [t(section.hidden ? 'openSettings' : 'closeSettings'), () => showSettings(section.hidden)],
      ...(lastError ? [[locale.error(lastError), null]] : []),
      [t('minimise'), native.WindowMinimise],
      [t('quit'), native.Quit],
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
    setLanguage: language => {
      applyLanguage(language);
      const write = languageWrite.then(async () => {
        await backend.SetLanguage(language);
        savedLanguage = language;
      });
      const pending = write.catch(error => {
        if (languageWrite !== pending) return;
        applyLanguage(savedLanguage);
        callbacks.languageError?.(error);
      });
      languageWrite = pending;
    },
    save: async form => {
      const result = await backend.Save(form);
      if (result.ok) config = await backend.Config();
      return result;
    },
    close: () => void showSettings(false),
    onLanguage: (fn, onError) => { callbacks.language = fn; callbacks.languageError = onError; },
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
    clearTimeout(timeout);
    current = null;
    if (!text) {
      setState('idle');
      return;
    }
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
    nativePlacement = await backend.PlacePanel(...compact, true);
    fixedViewport = usesFixedBounds && nativePlacement;
    if (!nativePlacement) {
      if (usesFixedBounds) native.WindowSetSize(...compact);
      native.WindowSetPosition((screen.availLeft ?? 0) + screen.availWidth - compact[0] - 24,
        (screen.availTop ?? 0) + screen.availHeight - compact[1] - 24);
    }
    try {
      selfTest = await backend.IsSelfTest();
      hotkeyTest = await backend.IsHotkeyTest();
      await backend.StartShortcut();
      config = await backend.Config();
      savedLanguage = config.language;
      applyLanguage(savedLanguage);
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
      await settingsTransition;
      if (fixedViewport) await new Promise(resolve => setTimeout(resolve, 250));
      if (section.contains(document.activeElement)) throw new Error('A settings control received focus automatically');
      void backend.TraceSelfTest('Settings opened');
      const form = section.querySelector('form');
      function checkSaveFits() {
        const card = section.getBoundingClientRect();
        const save = form.querySelector('[type=submit]').getBoundingClientRect();
        if (save.left < card.left || save.right > card.right || save.top < card.top || save.bottom > card.bottom) {
          throw new Error('The Save button is clipped');
        }
      }
      checkSaveFits();
      const input = section.querySelector('#key');
      const provider = section.querySelector('#provider');
      const model = section.querySelector('#model');
      function selectProvider(value) {
        provider.value = value;
        provider.dispatchEvent(new Event('change'));
      }
      await waitFor('Default Soniox model', () => model.value === 'stt-rt-v6');
      input.value = 'x'.repeat(2001);
      input.dispatchEvent(new Event('input'));
      form.requestSubmit();
      await waitFor('Save error stays visible', () => !section.hidden && section.querySelector('#message').textContent === t('invalidKey'));
      const language = section.querySelector('#language');
      function selectLanguage(value) {
        language.value = value;
        language.dispatchEvent(new Event('change'));
      }
      selectLanguage('en');
      checkSaveFits();
      if (section.hidden || document.documentElement.lang !== 'en' ||
          section.querySelector('h1').textContent !== 'Settings' ||
          section.querySelector('#message').textContent !== 'The API key format is invalid.' ||
          input.value !== 'x'.repeat(2001) ||
          document.querySelector('#status').getAttribute('aria-label') !== 'Ready') {
        throw new Error('Selecting English did not immediately translate the open settings');
      }
      await languageWrite;
      if ((await backend.Config()).language !== 'en') {
        throw new Error('The new language was not saved immediately');
      }
      gear.click();
      await settingsTransition;
      gear.click();
      await waitFor('Saved language in settings', () => !section.hidden && language.value === 'en');
      await settingsTransition;
      selectLanguage('ja');
      if (document.documentElement.lang !== 'ja') throw new Error('Selecting Japanese did not immediately translate the UI');
      await languageWrite;
      selectProvider('openai');
      if (model.value !== 'gpt-transcribe' ||
          Array.from(model.options, option => option.value).join(',') !==
            'gpt-transcribe,gpt-4o-transcribe,gpt-4o-mini-transcribe,whisper-1') {
        throw new Error('OpenAI model dropdown options were not available');
      }
      model.value = 'gpt-4o-mini-transcribe';
      form.requestSubmit();
      await waitFor('OpenAI settings saved', () => section.hidden);
      gear.click();
      await waitFor('Saved OpenAI model', () => !section.hidden && provider.value === 'openai' &&
        model.value === 'gpt-4o-mini-transcribe');
      await settingsTransition;
      selectProvider('soniox');
      if (model.tagName !== 'SELECT' || Array.from(model.options, option => option.value).join(',') !== 'stt-rt-v6,stt-rt-v5') {
        throw new Error('Soniox model dropdown options were not available');
      }
      model.value = 'stt-rt-v5';
      form.requestSubmit();
      if (!reduceMotion.matches) {
        await waitFor('Settings closing animation', () => section.getAnimations().some(animation => animation.effect.getKeyframes().at(-1).opacity === '0'));
      }
      await waitFor('Settings closed in Japanese', () => section.hidden && document.documentElement.lang === 'ja' &&
        viewportIs(fixedViewport ? settingsSize : compact));
      if (config.sonioxModel !== 'stt-rt-v5' || config.openAIModel !== 'gpt-4o-mini-transcribe') {
        throw new Error('The models were not saved independently');
      }
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
