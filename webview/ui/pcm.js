class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = Math.round(sampleRate / 25);
    this.reset();
    this.port.onmessage = () => {
      this.emit();
      this.stopped = true;
      this.port.postMessage({ stopped: true });
    };
  }

  reset() {
    this.pcm = new Int16Array(this.size);
    this.used = 0;
    this.energy = 0;
  }

  emit() {
    if (!this.used) return;
    const level = Math.sqrt(this.energy / this.used);
    const data = (this.used === this.size ? this.pcm : this.pcm.slice(0, this.used)).buffer;
    this.port.postMessage({ data, level }, [data]);
    this.reset();
  }

  process(inputs) {
    if (this.stopped) return false;
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      const clipped = Math.max(-1, Math.min(1, sample));
      this.pcm[this.used++] = clipped < 0 ? clipped * 32768 : clipped * 32767;
      this.energy += clipped * clipped;
      if (this.used === this.size) this.emit();
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
