// audio.js — every sound in Sunhaven, synthesised on the spot.
//
// WebAudio throughout: noise through a filter for the things that bang
// and scrape, oscillators for the things that ring. No audio files,
// nothing to fetch. Under the one-shot recipes sit three loops: the
// engine under Leo's right foot, the siren that means the SHD is near,
// and a slow radio pulse that never quite turns off.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null;   // { osc, gain } while Leo is driving
    this.siren = null;    // { osc, gain, lfo } while officers are close
    this.musicOn = false;
    this.musicStep = 0;
  }

  /** Browsers refuse sound before a gesture, so main calls this whenever
   * the player touches a key or the mouse. Safe to call forever after. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      // Everything plays through one gentle limiter on the way out: a
      // crash, a shot and the radio landing on the same sample should
      // squash, not clip.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 18;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      this.master.connect(limiter).connect(this.ctx.destination);
    } catch {
      this.ctx = null;   // no audio in this browser: the game goes on quietly
    }
  }

  /** One oscillator note with an exponential fall and an optional slide. */
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

  /** One burst of filtered noise, shaped like a slap: loud at the front,
   * gone at the back. */
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

  // The street's vocabulary, one recipe each.
  shot() { this.noise(0.14, 0.5, 2600); this.tone(160, 0.1, 'square', 0.18, 60); }
  hit() { this.noise(0.05, 0.22, 4200); this.tone(2200, 0.04, 'square', 0.06, 900); }
  thud() { this.tone(120, 0.22, 'sine', 0.5, 40); this.noise(0.12, 0.25, 500); }
  crash() { this.noise(0.3, 0.5, 900); this.tone(90, 0.3, 'sawtooth', 0.2, 35); }
  reload() { this.tone(700, 0.04, 'square', 0.12); setTimeout(() => this.tone(500, 0.04, 'square', 0.12), 90); }
  cash() { this.tone(880, 0.09, 'sine', 0.22); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.22), 70); }
  pickup() { this.tone(620, 0.07, 'triangle', 0.2, 940); }
  horn() { this.tone(370, 0.16, 'square', 0.1); this.tone(466, 0.16, 'square', 0.08); }
  /** A car door: a soft thunk with a latch click on top of it. */
  door() { this.tone(170, 0.09, 'sine', 0.28, 65); this.noise(0.045, 0.12, 1100); }

  /** Four notes, up for a job done and down for a day ruined. */
  sting(good) {
    if (!this.ctx || this.muted) return;
    const notes = good ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((freq, i) => setTimeout(() => this.tone(freq, 0.22, 'triangle', 0.2), i * 110));
  }

  // --- The loops ---------------------------------------------------------

  /** Called every frame by main: engineRatio runs 0..1 while Leo drives
   * (null on foot), sirenOn while the heat is up and officers are near. */
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
        const eng = this.engine;
        eng.gain.gain.value = 0;
        setTimeout(() => { try { eng.osc.stop(); } catch { /* already stopped */ } }, 120);
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
        setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch { /* already stopped */ } }, 120);
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

  /** The radio: bass eighths ticking under a pad that turns over every
   * bar — A minor, F, G, E, the sound of driving nowhere in particular. */
  startMusic() {
    this.musicOn = true;
    const bass = [55, 55, 82.4, 55, 65.4, 55, 98, 82.4];   // the A1 groove
    const pads = [220, 174.6, 196, 164.8];                  // Am, F, G, E
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
