// Procedural Web Audio: waterfall & river ambience, birdsong, piece sounds.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._birdTimer = null;
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this._ambience();
    this._scheduleBird();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
  }

  _noiseBuffer(seconds = 4, brown = false) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
    }
    return buf;
  }

  _ambience() {
    const ctx = this.ctx;
    // Waterfall roar: brown noise through a lowpass
    const roar = ctx.createBufferSource();
    roar.buffer = this._noiseBuffer(6, true);
    roar.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const g1 = ctx.createGain(); g1.gain.value = 0.35;
    roar.connect(lp).connect(g1).connect(this.master);
    roar.start();
    // River babble: white noise, bandpassed, gently modulated
    const babble = ctx.createBufferSource();
    babble.buffer = this._noiseBuffer(5, false);
    babble.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.21;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 600;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start();
    babble.connect(bp).connect(g2).connect(this.master);
    babble.start();
    // Leaves rustling in the wind
    const wind = ctx.createBufferSource();
    wind.buffer = this._noiseBuffer(7, false);
    wind.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3500;
    const g3 = ctx.createGain(); g3.gain.value = 0.0;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07;
    const wlg = ctx.createGain(); wlg.gain.value = 0.012;
    wl.connect(wlg).connect(g3.gain);
    wl.start();
    wind.connect(hp).connect(g3).connect(this.master);
    wind.start();
  }

  _scheduleBird() {
    const delay = 2500 + Math.random() * 7000;
    this._birdTimer = setTimeout(() => {
      if (this.enabled && this.ctx && this.ctx.state === 'running') this._bird();
      this._scheduleBird();
    }, delay);
  }

  _bird() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const type = Math.random();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 0.05 + Math.random() * 0.04;
    if (pan) { pan.pan.value = Math.random() * 2 - 1; out.connect(pan).connect(this.master); } else out.connect(this.master);
    const notes = type < 0.4 ? 3 + Math.floor(Math.random() * 4) : 2;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const st = t0 + i * (type < 0.4 ? 0.13 : 0.35);
      const base = type < 0.4 ? 3200 + Math.random() * 1500 : 2200 + Math.random() * 600;
      o.frequency.setValueAtTime(base, st);
      if (type < 0.4) o.frequency.exponentialRampToValueAtTime(base * 1.5, st + 0.07);
      else { // cuckoo-like falling pair or blackbird warble
        o.frequency.exponentialRampToValueAtTime(base * (i % 2 ? 0.8 : 1.2), st + 0.18);
      }
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(1, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, st + (type < 0.4 ? 0.1 : 0.28));
      o.connect(g).connect(out);
      o.start(st);
      o.stop(st + 0.4);
    }
  }

  // Wooden "clack" for a piece landing; capture adds a deeper knock.
  move(capture = false) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._clickBuf || (this._clickBuf = this._noiseBuffer(0.12, false));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = capture ? 900 : 1700; bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(capture ? 0.9 : 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(capture ? 180 : 320, t);
    o.frequency.exponentialRampToValueAtTime(capture ? 90 : 200, t + 0.08);
    og.gain.setValueAtTime(capture ? 0.35 : 0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }

  _tone(freqs, dur = 0.5, type = 'triangle', vol = 0.12, gap = 0.12) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      const st = t + i * gap;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vol, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);
      o.connect(g).connect(this.master);
      o.start(st); o.stop(st + dur + 0.05);
    });
  }

  check() { this._tone([660, 880], 0.35, 'square', 0.05, 0.09); }
  select() { this._tone([520], 0.08, 'sine', 0.05); }
  star() { this._tone([988, 1319, 1568], 0.25, 'sine', 0.08, 0.06); }
  success() { this._tone([523, 659, 784, 1047], 0.6, 'triangle', 0.1, 0.12); }
  wrong() { this._tone([220, 196], 0.3, 'sawtooth', 0.04, 0.12); }
  // Hunting horn fanfare for game over
  fanfare() { this._tone([392, 523, 659, 784, 659, 784], 0.45, 'sawtooth', 0.05, 0.16); }
}
