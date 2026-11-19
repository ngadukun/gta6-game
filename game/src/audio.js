// Sound, synthesised live with WebAudio: no audio files, nothing to load.
// Short noise-and-oscillator recipes for the street's vocabulary — gunshots,
// impacts, cash, and the little stings that mark a job done or a day ruined.
// The engine hum, sirens and music arrive in this file's second pass.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null;   // { osc, gain } while Leo drives
    this.siren = null;    // { osc, gain, lfo } while the SHD is close
    this.musicOn = false;
    this.musicStep = 0;
  }

  /** Browsers only allow sound after a gesture; main calls this on input. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.14, 0.5, 2600); this.tone(160, 0.1, 'square', 0.18, 60); }
  hit() { this.noise(0.05, 0.22, 4200); this.tone(2200, 0.04, 'square', 0.06, 900); }
  thud() { this.tone(120, 0.22, 'sine', 0.5, 40); this.noise(0.12, 0.25, 500); }
  crash() { this.noise(0.3, 0.5, 900); this.tone(90, 0.3, 'sawtooth', 0.2, 35); }
  reload() { this.tone(700, 0.04, 'square', 0.12); setTimeout(() => this.tone(500, 0.04, 'square', 0.12), 90); }
  cash() { this.tone(880, 0.09, 'sine', 0.22); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.22), 70); }
  pickup() { this.tone(620, 0.07, 'triangle', 0.2, 940); }
  horn() { this.tone(370, 0.16, 'square', 0.1); this.tone(466, 0.16, 'square', 0.08); }

  sting(good) {
    if (!this.ctx || this.muted) return;
    const notes = good ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((freq, i) => setTimeout(() => this.tone(freq, 0.22, 'triangle', 0.2), i * 110));
  }

  // --- Loops: engine, siren, and the radio that never quite turns off --------

  /** Called every frame by main: engineRatio is 0..1 while driving (else
   * null), sirenOn while officers are near with the heat up. */
  updateLoops(engineRatio, sirenOn) {
    if (!this.ctx) return;
    if (this.muted) {
      this.setEngine(null);
      this.setSiren(false);
      return;
    }
    this.setEngine(engineRatio);
    this.setSiren(sirenOn);
    if (!this.musicOn) this.startMusic();
  }

  setEngine(ratio) {
    if (ratio === null || ratio === undefined) {
      if (this.engine) {
        this.engine.gain.gain.value = 0;
        const eng = this.engine;
        setTimeout(() => { try { eng.osc.stop(); } catch { /* already gone */ } }, 120);
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      osc.type = 'sawtooth';
      gain.gain.value = 0.0;
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      this.engine = { osc, gain };
    }
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(52 + ratio * 118, t, 0.06);
    this.engine.gain.gain.setTargetAtTime(0.028 + ratio * 0.03, t, 0.09);
  }

  setSiren(on) {
    if (!on) {
      if (this.siren) {
        const s = this.siren;
        s.gain.gain.value = 0;
        setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch { /* already gone */ } }, 120);
        this.siren = null;
      }
      return;
    }
    if (this.siren) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 780;
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.016;
    osc.connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    this.siren = { osc, gain, lfo };
  }

  /** A slow synthwave pulse: bass eighths under a pad that changes every bar. */
  startMusic() {
    this.musicOn = true;
    const bass = [55, 55, 82.4, 55, 65.4, 55, 98, 82.4];       // A1 groove
    const pads = [220, 174.6, 196, 164.8];                       // Am F G E
    setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep;
      this.musicStep += 1;
      this.tone(bass[step % bass.length], 0.16, 'triangle', 0.055);
      if (step % 16 === 0) this.tone(pads[(step / 16) % pads.length], 2.4, 'sine', 0.028);
      if (step % 16 === 8) this.tone(pads[(step / 16) % pads.length] * 1.5, 2.2, 'sine', 0.02);
    }, 215);
  }
}
