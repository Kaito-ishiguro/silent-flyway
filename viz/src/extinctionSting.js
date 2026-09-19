// ExtinctionSting - the sound a species makes when it stops.
//
// This was a gunshot for one draft, on the argument that a population does not
// fall the way a leaf falls and somebody ought to be audibly at fault. The
// argument was right and the sound was wrong: a rifle report is a game cue. It
// makes an audience flinch and then relax, which is the opposite of what a
// room full of people reading population figures should be doing, and it is
// not a noise you can put in a gallery for six hours a day.
//
// So it is a bell instead. A struck low tone with inharmonic partials - the
// ratios a real bell has, not a harmonic series - over a soft swell of air,
// under two sines a semitone apart that beat against each other and never
// settle. Slow attack, very long decay, no transient to jump at.
//
// It is the older sound, not the louder one: a passing bell is what a place
// rings when somebody is gone, and every culture that has one rings it once.
// The event is still the loudest thing in the piece, but it earns that by
// lasting eight seconds and refusing to resolve rather than by hitting hard.

// Inharmonic partials. A bell's overtones are not whole multiples of its
// fundamental, which is exactly why a bell sounds like grief and a sine
// sounds like a test tone. The minor third at 1.19 is the note you actually
// hear as the bell's pitch, and it is what makes the sound sad rather than
// merely low.
const PARTIALS = [
  // ratio, gain, decay (s)
  [0.50, 0.55, 8.0],   // hum
  [1.00, 0.85, 6.4],   // prime
  [1.19, 0.62, 5.2],   // minor third - the tierce
  [1.50, 0.30, 4.0],   // fifth
  [2.00, 0.26, 3.2],   // nominal
  [2.55, 0.15, 2.2],
  [3.42, 0.09, 1.6],
];

const FUNDAMENTAL = 61.7;   // B1, low enough to be felt as much as heard

export class ExtinctionSting {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  /** Must be reached from a user gesture at least once, or nothing sounds. */
  arm() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.62;
      this.master.connect(this.ctx.destination);
      // One noise bed, reused rather than reallocated fifteen times.
      const len = Math.floor(this.ctx.sampleRate * 3);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  fire() {
    this.arm();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // ---- the bell
    for (const [ratio, gain, decay] of PARTIALS) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = FUNDAMENTAL * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      // 14ms, not 1ms: enough to have a body and not a click, slow enough
      // that nobody in the room jumps
      g.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + decay + 0.1);

      // Two partials detuned a fraction of a hertz apart beat slowly against
      // each other, the way a real casting does. Without it the bell is a
      // synthesiser doing an impression of one.
      if (ratio <= 2) {
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = FUNDAMENTAL * ratio * 1.0016;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(gain * 0.30, t + 0.02);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.9);
        o2.connect(g2).connect(this.master);
        o2.start(t);
        o2.stop(t + decay);
      }
    }

    // ---- air: a swell rather than an impact. It arrives after the strike
    // and opens out, so the sound grows into the room instead of retreating
    // from it.
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.5;
    bp.frequency.setValueAtTime(240, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 1.1);
    bp.frequency.exponentialRampToValueAtTime(190, t + 3.4);
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.0001, t);
    ag.gain.exponentialRampToValueAtTime(0.075, t + 0.9);
    ag.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    air.connect(bp).connect(ag).connect(this.master);
    air.start(t, Math.random() * 0.4);
    air.stop(t + 3.9);

    // ---- and the ringing that will not settle, once the bell has stopped
    // being an event. Two sines a semitone apart: the interval nothing
    // resolves out of.
    for (const [hz, gain, delay] of [[246.9, 0.055, 0.7], [261.6, 0.048, 0.74]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 4.6);
      o.connect(g).connect(this.master);
      o.start(t + delay);
      o.stop(t + delay + 4.7);
    }
  }
}
