/**
 * Lightweight WebAudio synthesized SFX — no asset files needed.
 */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, type = 'square', gain = 0.08, slide = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noiseBurst(dur = 0.06, gain = 0.1) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  shot() {
    this.noiseBurst(0.05, 0.12);
    this.tone(180, 0.07, 'sawtooth', 0.06, -100);
  }

  dry() {
    this.tone(90, 0.05, 'square', 0.04);
  }

  hit() {
    this.tone(220, 0.05, 'triangle', 0.07, -80);
  }

  hurt() {
    this.tone(110, 0.15, 'sawtooth', 0.09, -60);
  }

  roar() {
    this.tone(70, 0.25, 'sawtooth', 0.05, 40);
  }

  pickup() {
    this.tone(520, 0.08, 'sine', 0.06, 200);
  }

  reload() {
    this.tone(300, 0.06, 'triangle', 0.04);
    setTimeout(() => this.tone(200, 0.08, 'triangle', 0.04), 80);
  }
}
