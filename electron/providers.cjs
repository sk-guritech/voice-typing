const WebSocket = require('ws');

const PROVIDERS = {
  soniox: { name: 'Soniox', env: 'SONIOX_API_KEY' },
  openai: { name: 'OpenAI', env: 'OPENAI_API_KEY' },
};

function soniox(key, sampleRate, done, fail) {
  const socket = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket', {
    headers: { Authorization: `Bearer ${key}` },
    handshakeTimeout: 8000,
  });
  const queued = [];
  const confirmed = [];
  let buffered = 0;
  let ending = false;
  let timer;

  function sendEnd() {
    socket.send('');
    timer = setTimeout(() => fail('Soniox の応答がタイムアウトしました。'), 10000);
  }
  socket.on('open', () => {
    socket.send(JSON.stringify({
      model: 'stt-rt-v6', audio_format: 'pcm_s16le', sample_rate: sampleRate,
      num_channels: 1, language_hints: ['ja', 'en'], enable_endpoint_detection: true,
    }));
    for (const block of queued) socket.send(block);
    queued.length = 0;
    if (ending) sendEnd();
  });
  socket.on('message', data => {
    let response;
    try {
      response = JSON.parse(data.toString());
    } catch {
      fail('Soniox の応答を読み込めませんでした。');
      return;
    }
    if (response.error_code) {
      fail(`Soniox がエラーを返しました（${response.error_code}）。`);
      return;
    }
    for (const token of response.tokens ?? []) {
      if (token.is_final && !['<end>', '<fin>'].includes(token.text)) confirmed.push(token.text);
    }
    if (response.finished) done(confirmed.join('').trim());
  });
  socket.on('error', () => fail('Soniox に接続できませんでした。'));
  socket.on('close', () => fail('Soniox との接続が切れました。'));
  return {
    add(block) {
      if (ending) return;
      if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 1024 * 1024) {
        socket.send(block);
      } else if (socket.readyState === WebSocket.CONNECTING && buffered < 2 * sampleRate * 9) {
        queued.push(block);
        buffered += block.length;
      } else {
        fail('音声を送信できませんでした。');
      }
    },
    end() {
      ending = true;
      if (socket.readyState === WebSocket.OPEN) sendEnd();
    },
    cancel() {
      clearTimeout(timer);
      socket.terminate();
    },
  };
}

function waveHeader(size, rate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(size + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(size, 40);
  return header;
}

function openai(key, sampleRate, done, fail) {
  const blocks = [];
  const abort = new AbortController();
  let bytes = 0;
  return {
    add(block) {
      bytes += block.length;
      if (bytes > 24_000_000 || bytes > sampleRate * 2 * 600) {
        fail('OpenAI 用の録音が上限に達しました。短く区切って録音してください。');
        return;
      }
      blocks.push(block);
    },
    async end() {
      if (!bytes) return done('');
      const form = new FormData();
      form.set('model', 'gpt-transcribe');
      form.set('file', new Blob([waveHeader(bytes, sampleRate), ...blocks], { type: 'audio/wav' }), 'dictation.wav');
      try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', body: form, headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(90000)]),
        });
        if (!response.ok) return fail(`OpenAI がエラーを返しました（${response.status}）。`);
        const result = await response.json();
        done(result.text?.trim() ?? '');
      } catch {
        fail('OpenAI への送信、または応答の読み取りに失敗しました。');
      }
    },
    cancel: () => abort.abort(),
  };
}

module.exports = { PROVIDERS, createSession: { soniox, openai } };
