// HEARTSTAR — audio: every sound is synthesized with WebAudio, no files.
// One job: sound effects and a low ambient drone. Silent until the player
// first interacts (the browser needs a gesture for AudioContext), and a
// no-op when no context exists yet (title screen, screenshot mode, muted).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.drone = null;
    this.muted = false;
  }

  /** Call from a user gesture. Safe to call twice. */
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(m ? 0 : 0.5, this.ctx.currentTime);
  }

  /** One oscillator blip: freq slides from f0 to f1 over dur seconds. */
  blip(f0, f1, dur, type, vol, when = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst, for explosions. */
  noise(dur, vol, freq) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.blip(880, 320, 0.09, 'square', 0.08); }
  enemyHit() { this.blip(220, 140, 0.05, 'triangle', 0.06); }
  boom(big) {
    this.noise(big ? 0.5 : 0.25, big ? 0.5 : 0.3, big ? 900 : 1400);
    this.blip(big ? 160 : 220, 40, big ? 0.5 : 0.3, 'sine', 0.35);
  }
  shard() { this.blip(1320, 1760, 0.07, 'sine', 0.1); }
  pickup() {
    this.blip(523, 523, 0.09, 'sine', 0.14);
    this.blip(784, 784, 0.12, 'sine', 0.14, 0.09);
  }
  hurt() {
    this.blip(300, 60, 0.35, 'sawtooth', 0.25);
    this.noise(0.2, 0.25, 800);
  }
  heartHit() {
    this.blip(180, 50, 0.4, 'sawtooth', 0.3);
    this.noise(0.3, 0.3, 500);
  }
  wave() {
    this.blip(392, 392, 0.1, 'triangle', 0.16);
    this.blip(523, 523, 0.1, 'triangle', 0.16, 0.1);
    this.blip(659, 659, 0.16, 'triangle', 0.16, 0.2);
  }
  boss() {
    this.blip(110, 55, 0.8, 'sawtooth', 0.3);
    this.blip(165, 82, 0.8, 'sawtooth', 0.2, 0.1);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, f, 0.22, 'triangle', 0.18, i * 0.14));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.blip(f, f * 0.94, 0.3, 'triangle', 0.16, i * 0.18));
  }

  /** Low two-tone drone under gameplay. Started once, stopped on end screens. */
  startDrone() {
    if (!this.ctx || !this.master || this.drone) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.master);
    const o1 = this.ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 82.5;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    o1.connect(gain);
    o2.connect(gain);
    o1.start();
    o2.start();
    lfo.start();
    this.drone = { gain, o1, o2, lfo };
  }

  stopDrone() {
    if (!this.drone) return;
    try {
      this.drone.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.drone.o1.stop();
      this.drone.o2.stop();
      this.drone.lfo.stop();
    } catch { /* already stopped */ }
    this.drone = null;
  }
}
