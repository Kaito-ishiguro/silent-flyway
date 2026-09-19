// NetworkDomain - Lucio Arese's bird-song / Giant Steps point-network model.
//
// Every 60 fps frame with enough amplitude emits a data point:
//   { emission time, amplitude 0-1, dominant frequency band -> color }
// Position comes from an oscillatory walker driven by pitch and amplitude.
// The walker roams wide so each voice DANCES through its region instead of
// knotting up; the drawn trail is a continuous line whose freshly-played
// end burns neon while older passages decay to a dark ember (see
// agedMaterials.js). Sparse cross-links add the network structure.

import * as THREE from 'three';
import { makeAgedPointsMaterial, makeAgedLineMaterial } from './agedMaterials.js';

// dominant-band color ramp, low freq (deep blue) -> high freq (white),
// matching the 2kHz-8kHz legend in Arese's reference frames
export const BAND_STOPS = ['#2438d8', '#6d2bd8', '#c92e7a', '#e2643c', '#e8b04b', '#a8d84b', '#6fe0c8', '#f2f4f0']
  .map((c) => new THREE.Color(c));

// How far outside its own wedge a bird may drift before anything pushes back.
// 1.0 is a hard territory; above 1.0 neighbouring lanes overlap at the edges
// and species tangle with each other, which is what a real bay looks like.
// Colours stay readable because each voice still spends most of its time home.
const LANE_SLACK = 1.45;

// Hard limits on where a walker may be and how fast it may move. These are a
// backstop, not the design: the forces above should keep it in bounds on their
// own. But a feedback loop that escapes once will draw a line to infinity, and
// no amount of care in the force model is worth a streak across the finished
// piece. Cheap insurance, applied every frame.
const MAX_Y = 260;        // roughly two octaves either side of the stage
const MAX_R = 420;        // just outside the year ring
const MAX_SPEED = 26;     // units per frame

function clampWalker(pos, vel) {
  const sp = vel.length();
  if (sp > MAX_SPEED) vel.multiplyScalar(MAX_SPEED / sp);
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
    pos.set(0, 0, 0);
    vel.set(0, 0, 0);
    return;
  }
  if (pos.y > MAX_Y) { pos.y = MAX_Y; vel.y = Math.min(vel.y, 0); }
  if (pos.y < -MAX_Y) { pos.y = -MAX_Y; vel.y = Math.max(vel.y, 0); }
  const r = Math.hypot(pos.x, pos.z);
  if (r > MAX_R) {
    pos.x *= MAX_R / r;
    pos.z *= MAX_R / r;
    vel.x *= 0.5;
    vel.z *= 0.5;
  }
}

export class NetworkDomain {
  constructor(stem, meta, {
    center = new THREE.Vector3(),
    spread = 150,
    tint = new THREE.Color(1, 1, 1),   // per-instrument color identity
    gain = 1.0,                        // per-instrument brightness (lead > rest)
    threshold = 0.05,                  // emission gate: below = "not playing".
                                       // Stems are RMS-normalized to their own
                                       // max, so bleed-heavy quiet stems need a
                                       // higher gate or they dance to leakage.
    size = 2.4,
    neon = 2.8,                        // flash intensity at the head
    neonDecay = 5.0,                   // lower = longer comet tail
    starHead = false,                  // shooting-star glow sprite on the head
    constellation = true,              // note attacks persist as star clusters
    pitchRef = 220,                    // Hz mapped to the middle of the space.
                                       // 220 (A3) centres a jazz quartet; birds
                                       // call an octave and a half higher and
                                       // would fly straight off the top of the
                                       // stage, so the flyway passes ~2000 Hz.
    seed = 1,                          // per-species, so wander is organic but
                                       // reproducible: the same piece every run
    lane = null,                       // {a0, a1, radius} - confine this voice
                                       // to its own wedge of the bay.
                                       // Jazz wanted every instrument roaming
                                       // one shared space so the voices tangle
                                       // and argue. A dozen species doing that
                                       // is an unreadable knot: the audience
                                       // cannot tell how many birds are left,
                                       // which is the one thing this piece has
                                       // to communicate. Lanes trade the
                                       // conversation for a headcount.
  } = {}) {
    this.group = new THREE.Group();

    const fps = meta.fps;
    const rms = stem.rms;
    const f0 = stem.f0 || null;
    const voiced = stem.voiced || null;
    const bands = stem.dominant_band;

    // ---- emission pass: a wide-roaming walker driven by the signal
    const emissions = [];
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    // Seeded RNG: the wander must look random and be identical every run.
    let sd = (seed * 2654435761) >>> 0;
    const rnd = () => {
      sd = (sd + 0x6d2b79f5) >>> 0;
      let t = Math.imul(sd ^ (sd >>> 15), 1 | sd);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Three oscillators per axis at incommensurable ratios, each with its own
    // random phase. A single sine makes a circle and two make a lissajous -
    // both read as machine-drawn. Three that never come back into step read as
    // an animal wandering. The ratios are irrational-ish on purpose.
    const W = [0.0737, 0.1213 * 1.618, 0.2411 * 2.718];
    const ph = [rnd() * 6.283, rnd() * 6.283, rnd() * 6.283,
                rnd() * 6.283, rnd() * 6.283, rnd() * 6.283];
    const wob = (k, t) =>
      Math.sin(t * W[0] + ph[k * 3]) +
      0.62 * Math.sin(t * W[1] + ph[k * 3 + 1]) +
      0.38 * Math.sin(t * W[2] + ph[k * 3 + 2]);

    // Start somewhere random in the bay rather than at the origin, so fifteen
    // walkers do not all launch from the same point. With no lane, this is the
    // only thing giving each voice a different starting place - after that
    // they are free to go anywhere and cross each other.
    {
      const a = lane ? lane.a0 + rnd() * (lane.a1 - lane.a0) : rnd() * Math.PI * 2;
      const r0 = (lane?.inner ?? 30) + rnd() * (spread * 0.55);
      pos.set(Math.cos(a) * r0, (rnd() * 2 - 1) * 40, Math.sin(a) * r0);
    }
    let phase = rnd() * 6.28;

    for (let i = 0; i < rms.length; i++) {
      const amp = rms[i];
      const t = i / fps;
      if (amp < threshold) {
        // Silence: glide, don't snap home - but stay under control. Without a
        // restoring force here, a long gap turns stored velocity into a long
        // straight drift; the spring then has further to pull back, which
        // builds more velocity, which makes the next gap's drift longer. That
        // compounds, and on a gappy recording it threw the walker millions of
        // units off and drew a streak across the sky. Species with sparse
        // recordings hit it first - the Zitting Cisticola sounds in only 375
        // of 7,237 frames.
        vel.multiplyScalar(0.94);
        vel.y += (0 - pos.y) * 0.02;       // ease back to level while resting
        pos.addScaledVector(vel, 0.5);
        clampWalker(pos, vel);
        continue;
      }
      const hasPitch = f0 && f0[i] > 0 && (!voiced || voiced[i] > 0.4);
      const pitchY = hasPitch
        ? Math.log2(f0[i] / pitchRef) * 60
        : (bands[i] >= 0 ? (bands[i] - 3.5) * 22 : 0);

      // Free travel. The wander is what carries the bird; the signal only
      // sets how energetically it moves.
      phase += 1.0 + amp * 3.0;
      vel.x += wob(0, phase) * (0.5 + amp * 3.4);
      vel.z += wob(1, phase) * (0.5 + amp * 3.4);
      vel.y += (pitchY - pos.y) * 0.1;

      // EVERY boundary below is a FORCE on velocity, never a correction of
      // position. Setting position directly is what drew the polygon: a
      // walker pinned on a limit rides it exactly, and a wedge ridden exactly
      // becomes a straight chord between its two edges. Fifteen of those is a
      // fifteen-sided figure, which is precisely what it looked like. Push
      // instead of place, and the boundary bends the flight rather than
      // becoming the flight.
      const r = Math.hypot(pos.x, pos.z) || 1e-6;
      const ux = pos.x / r, uz = pos.z / r;

      if (r > spread) {
        const k = Math.min(1, (r - spread) / 60);
        vel.x -= ux * k * 2.2;
        vel.z -= uz * k * 2.2;
      }

      if (lane) {
        if (lane.inner && r < lane.inner) {
          const k = Math.min(1, (lane.inner - r) / 40);
          vel.x += ux * k * 2.0;
          vel.z += uz * k * 2.0;
        }
        // Soft territory, not a fence. The bird may drift out of its wedge and
        // tangle with its neighbours - which is what a real bay sounds and
        // looks like - and is only gently turned back once well outside.
        const mid = (lane.a0 + lane.a1) / 2;
        const half = (lane.a1 - lane.a0) / 2;
        let d = Math.atan2(pos.z, pos.x) - mid;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const over = Math.abs(d) - half * LANE_SLACK;
        if (over > 0) {
          // tangential nudge back toward the middle of the territory
          const s = -Math.sign(d) * Math.min(1, over / 0.35) * 1.6;
          vel.x += -uz * s;
          vel.z += ux * s;
        }
      }

      vel.multiplyScalar(0.9);
      pos.add(vel);
      clampWalker(pos, vel);

      const band = Math.max(0, Math.min(BAND_STOPS.length - 1, bands[i]));
      emissions.push({
        t, amp,
        x: pos.x, y: pos.y, z: pos.z,
        color: BAND_STOPS[band],
      });
    }
    this.emissions = emissions;
    const n = emissions.length;

    // ---- point cloud (age handled on the GPU)
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(n * 3);
    const pCol = new Float32Array(n * 3);
    const pTime = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e = emissions[i];
      pPos.set([e.x, e.y, e.z], i * 3);
      const c = e.color.clone().multiplyScalar(0.55 + 0.45 * e.amp).multiply(tint);
      pCol.set([c.r, c.g, c.b], i * 3);
      pTime[i] = e.t;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    pGeo.setAttribute('aTime', new THREE.BufferAttribute(pTime, 1));
    this.pointsMat = makeAgedPointsMaterial({ size, gain, neon, neonDecay });
    this.points = new THREE.Points(pGeo, this.pointsMat);

    // ---- trail: continuous path segments (the dancing line itself),
    //      plus sparse nearest-neighbor cross-links for network texture
    const verts = [];
    const cols = [];
    const times = [];
    const pushSeg = (a, b, brightness) => {
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const c = b.color.clone().multiply(tint);
      cols.push(c.r * brightness, c.g * brightness, c.b * brightness,
                c.r * brightness, c.g * brightness, c.b * brightness);
      times.push(b.t, b.t); // segment appears when its newer point plays
    };
    for (let i = 1; i < n; i++) {
      const e = emissions[i], p = emissions[i - 1];
      if (e.t - p.t < 0.1) pushSeg(p, e, 1.0);          // the melody path
      if (i % 4 === 0) {
        // one faint structural link to the nearest of the last ~1.5s
        let best = null, bestD = 1e9;
        for (let j = Math.max(0, i - 90); j < i - 4; j++) {
          const o = emissions[j];
          const d = (e.x - o.x) ** 2 + (e.y - o.y) ** 2 + (e.z - o.z) ** 2;
          if (d < bestD) { bestD = d; best = o; }
        }
        if (best) pushSeg(best, e, 0.25);
      }
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    eGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(cols), 3));
    eGeo.setAttribute('aTime', new THREE.BufferAttribute(new Float32Array(times), 1));
    this.edgesMat = makeAgedLineMaterial({ gain, neon, neonDecay });
    this.edges = new THREE.LineSegments(eGeo, this.edgesMat);

    // ---- note-attack constellation (Arese's nightingale grammar):
    // every articulated attack becomes a star at the walker's position -
    // size = attack strength - that flashes on impact and then PERSISTS
    // as a faint ember, so articulation accumulates into a constellation.
    // Stars within one phrase (gap < 1.2s) are linked; a breath breaks
    // the chain, so phrasing reads as separate clusters.
    this.stars = null;
    this.links = null;
    if (constellation && stem.onsets?.length) {
      const nodes = [];
      let ei = 0;
      for (const o of stem.onsets) {
        if (o.s < 0.25) continue;                       // ignore weak attacks
        while (ei < emissions.length && emissions[ei].t < o.t - 0.075) ei++;
        const e = emissions[ei];
        if (!e || Math.abs(e.t - o.t) > 0.15) continue; // attack while gated: skip
        nodes.push({ t: o.t, s: o.s, x: e.x, y: e.y, z: e.z, color: e.color });
      }
      if (nodes.length) {
        const sGeo = new THREE.BufferGeometry();
        const sPos = new Float32Array(nodes.length * 3);
        const sCol = new Float32Array(nodes.length * 3);
        const sTime = new Float32Array(nodes.length);
        const sSize = new Float32Array(nodes.length);
        nodes.forEach((nd, i) => {
          sPos.set([nd.x, nd.y, nd.z], i * 3);
          const c = nd.color.clone().multiply(tint).multiplyScalar(0.7 + 0.5 * nd.s);
          sCol.set([c.r, c.g, c.b], i * 3);
          sTime[i] = nd.t;
          sSize[i] = 1.6 + nd.s * 4.5;
        });
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
        sGeo.setAttribute('aTime', new THREE.BufferAttribute(sTime, 1));
        sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
        // floor 0: stars flash and fade during playback (clean stage);
        // the full constellation reveals in sculpture mode at the end
        this.starsMat = makeAgedPointsMaterial({
          size: 1.0, gain: gain * 1.1, neon: 7.0, neonDecay: 4.5,
          floor: 0, perVertexSize: true,
        });
        this.stars = new THREE.Points(sGeo, this.starsMat);

        const lVerts = [], lCols = [], lTimes = [];
        for (let i = 1; i < nodes.length; i++) {
          const a = nodes[i - 1], b = nodes[i];
          if (b.t - a.t > 1.2) continue;                // breath = new cluster
          lVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
          const c = b.color.clone().multiply(tint).multiplyScalar(0.5);
          lCols.push(c.r, c.g, c.b, c.r, c.g, c.b);
          lTimes.push(b.t, b.t);
        }
        const lGeo = new THREE.BufferGeometry();
        lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lVerts), 3));
        lGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(lCols), 3));
        lGeo.setAttribute('aTime', new THREE.BufferAttribute(new Float32Array(lTimes), 1));
        this.linksMat = makeAgedLineMaterial({ gain: gain * 0.8, neon: 2.0, neonDecay: 4.0, floor: 0 });
        this.links = new THREE.LineSegments(lGeo, this.linksMat);
        this.group.add(this.stars, this.links);
      }
    }

    // ---- head marker: the "now" of the voice
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.head.visible = false;
    this.cursor = 0;
    this.lastAmp = 0;   // amplitude of the newest emission; camera/graph food

    // shooting-star core: soft radial glow riding on the head
    this.glow = null;
    if (starHead) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,252,240,1)');
      grad.addColorStop(0.25, 'rgba(255,220,160,0.55)');
      grad.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }));
      this.glow.visible = false;
      this.group.add(this.glow);
    }

    this.group.add(this.points, this.edges, this.head);
    this.group.position.copy(center);
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.points.geometry.dispose();
    this.pointsMat.dispose();
    this.edges.geometry.dispose();
    this.edgesMat.dispose();
    if (this.stars) { this.stars.geometry.dispose(); this.starsMat.dispose(); }
    if (this.links) { this.links.geometry.dispose(); this.linksMat.dispose(); }
    this.head.geometry.dispose();
    this.head.material.dispose();
    if (this.glow) {
      this.glow.material.map.dispose();
      this.glow.material.dispose();
    }
  }

  update(t, playing) {
    this.pointsMat.uniforms.uTime.value = t;
    this.edgesMat.uniforms.uTime.value = t;
    if (this.stars) this.starsMat.uniforms.uTime.value = t;
    if (this.links) this.linksMat.uniforms.uTime.value = t;

    const em = this.emissions;
    if (this.cursor > 0 && em[this.cursor - 1]?.t > t) this.cursor = 0;
    while (this.cursor < em.length && em[this.cursor].t <= t) this.cursor++;
    const last = em[this.cursor - 1];
    const fresh = playing && !!last && t - last.t < 0.12;
    this.head.visible = fresh;
    this.lastAmp = fresh ? last.amp : 0;
    if (last) {
      this.head.position.set(last.x, last.y, last.z);
      this.head.scale.setScalar(0.8 + last.amp * 1.8);
    }
    if (this.glow) {
      this.glow.visible = fresh;
      if (last) {
        this.glow.position.copy(this.head.position);
        const s = 14 + last.amp * 30 + Math.sin(t * 21) * 2; // flicker
        this.glow.scale.set(s, s, 1);
      }
    }
    this.group.rotation.y = t * 0.015;
  }

  // world position of the "now" - the chase camera's prey
  headWorld(target) {
    return this.head.getWorldPosition(target);
  }

  setSculpture(on) {
    this.pointsMat.uniforms.uSculpture.value = on ? 1 : 0;
    this.edgesMat.uniforms.uSculpture.value = on ? 1 : 0;
    if (this.stars) this.starsMat.uniforms.uSculpture.value = on ? 1 : 0;
    if (this.links) this.linksMat.uniforms.uSculpture.value = on ? 1 : 0;
  }
}
