// ExtinctionSting - the sound a species makes when it stops.
//
// It is a gunshot, and that is an argument, not a sound effect. Every other
// cue in this piece is observational: the calls are real recordings, the rim
// is a calendar, the numbers are counts. The one thing none of it says out
// loud is that a population does not fall the way a leaf falls. Somebody
// drained the bay, somebody built on the mudflat, somebody shot the birds.
// A low cinematic swell would let that stay ambient. A rifle report will not.
//
// Synthesised rather than sampled: a stock gunshot sample carries a licence
// and a room that is not this one, and the shape matters more than realism.
// Three parts, in the order a real report reaches you:
//
//   crack   a few milliseconds of high noise - the snap, the part that makes
//           you flinch before you have identified what it was
//   report  the body: a noise burst collapsing down the spectrum through a
//           lowpass, with a sine thump under it
//   valley  three progressively duller, quieter repeats at irregular spacing.
//           Deep Bay has hills around it. This is the sound going out and
//           finding nothing to come back to.
//
// Then, half a second later, the ringing: two sines a semitone apart, beating
// against each other, fading out unresolved under the banner. That part was
// here before the gunshot was and it stays, because the shot is the event and
// the ringing is what you are left holding.

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
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      // One noise bed, reused. A report fires four buffer sources, and
      // allocating two seconds of random floats for each of them, fifteen
      // times over a two-minute piece, is work for nothing.
      const len = Math.floor(this.ctx.sampleRate * 2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** One report: crack + body + thump, dulled and quietened for each echo. */
  _report(at, gain, openHz, thump) {
    const ctx = this.ctx;

    // ---- crack: the snap, almost too short to hear as a pitch
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    crack.playbackRate.value = 1.6;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = Math.min(6000, openHz * 1.4);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, at);
    cg.gain.exponentialRampToValueAtTime(gain, at + 0.0016);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.038);
    crack.connect(hp).connect(cg).connect(this.master);
    crack.start(at, Math.random() * 1.5);
    crack.stop(at + 0.06);

    // ---- body: the report collapsing down the spectrum
    const body = ctx.createBufferSource();
    body.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(openHz, at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(90, openHz * 0.16), at + 0.19);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, at);
    bg.gain.exponentialRampToValueAtTime(gain * 0.82, at + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    body.connect(lp).connect(bg).connect(this.master);
    body.start(at, Math.random() * 1.5);
    body.stop(at + 0.4);

    if (!thump) return;
    // ---- thump: the chest hit. Only the first report has one; an echo has
    // lost its low end by the time it comes back.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, at);
    o.frequency.exponentialRampToValueAtTime(44, at + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(gain * 0.9, at + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    o.connect(og).connect(this.master);
    o.start(at);
    o.stop(at + 0.35);
  }

  fire() {
    this.arm();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    this._report(t, 1.0, 5200, true);
    // irregular, because hills are not a delay line
    this._report(t + 0.163, 0.26, 2100, false);
    this._report(t + 0.397, 0.13, 1250, false);
    this._report(t + 0.845, 0.055, 720, false);

    // ---- the wash the report leaves in the air
    const tail = ctx.createBufferSource();
    tail.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.55;
    bp.frequency.setValueAtTime(1100, t);
    bp.frequency.exponentialRampToValueAtTime(320, t + 1.5);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.10, t + 0.09);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    tail.connect(bp).connect(tg).connect(this.master);
    tail.start(t + 0.02, Math.random() * 0.2);
    tail.stop(t + 1.9);

    // ---- and the ringing, once the shot has stopped being an event
    for (const [hz, gain, delay] of [[246.9, 0.075, 0.46], [261.6, 0.066, 0.49]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 3.2);
      o.connect(g).connect(this.master);
      o.start(t + delay);
      o.stop(t + delay + 3.3);
    }
  }
}
