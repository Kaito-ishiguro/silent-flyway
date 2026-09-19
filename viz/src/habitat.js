// HabitatDomain - the ground the birds are standing on, and what happens to it.
//
// This replaces the nested decline rings that used to fill the annulus around
// the bay. Those rings were true and unreadable: fifteen flat concentric lines
// seen in perspective, saying something the scoreboard already said better.
// The space is worth more than that, because the one thing the piece could not
// previously show is WHY. A population curve falling is an effect. The cause is
// standing all around it.
//
// So the annulus is a treeline. In 1959 it is forest - dot-matrix trees, warm
// red through the trunk and the heavy limbs, cold teal through the canopy,
// shimmering slightly, and behind them nothing but dark. As the years run the
// trees are taken: their particles lift, drift, and settle onto the wireframe
// of a tower standing in the same footprint. Nothing is added and nothing is
// deleted - the city is built out of the forest, particle for particle, which
// is the literal truth of what happened in Deep Bay. Canopy points become the
// upper floors, trunk points become the base, because the mapping is by height.
//
// Above it all a sodium haze climbs the sky. Light pollution is the part of
// urbanisation a bird actually experiences, and it is the reason the dark that
// the piece opens in is gone by the end.
//
// What drives it is the data, twice over:
//   - a slow ramp on the timeline, because Hong Kong was being built the whole
//     time whether or not the birds had started leaving yet
//   - the fraction of the bay lost against its own best year so far, which is
//     flat until about 1995 and then falls off a cliff. That is when the city
//     floods in.
//   - and every extirpation shoves it forward permanently. A species going is
//     not a milestone the city passes, it is a thing the city did.

import * as THREE from 'three';

const TREES = 18;             // trees in the near ring, one tower each
const FAR_TOWERS = 16;        // wireframe-only skyline behind them, for depth
const GRID = 3.2;             // the lattice every tree point snaps to

// The near ring sits outside MAX_R (420) so the birds never fly through the
// architecture - they are losing the place, not living in it.
const RING_R = 545;

// Conversion order. Sequential around the ring reads as a wipe, which looks
// authored; the golden ratio scatters it so the city appears in unrelated
// places at once, the way development actually arrives.
const PHI = 0.6180339887;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the tree
// Recursive branching in a mostly-tangential plane, then every sample snapped
// to a lattice and de-duplicated. The snapping is the whole look: it turns a
// smooth botanical fan into the dot matrix of the reference, and it is also
// what lets the same points sit convincingly on a building later - a lattice
// already looks like architecture.
function growTree(rng, height) {
  const segs = [];
  const zAxis = new THREE.Vector3(0, 0, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);

  function branch(p, dir, len, thick, depth) {
    const b = p.clone().addScaledVector(dir, len);
    segs.push({ a: p.clone(), b, depth, thick });
    if (depth >= 7 || len < 3.5) return;
    // the trunk forks late and wide; the crown forks often and tight
    const n = depth === 0 ? 3 : (rng() < 0.28 ? 3 : 2);
    for (let i = 0; i < n; i++) {
      const spread = 0.86 - depth * 0.09;
      const d = dir.clone()
        .applyAxisAngle(zAxis, (i - (n - 1) / 2) * spread + (rng() - 0.5) * 0.34)
        // depth is kept small so the tree stays a fan seen from the bay,
        // like the reference, rather than a shapeless ball
        .applyAxisAngle(xAxis, (rng() - 0.5) * 0.34)
        .normalize();
      // every branch still wants up a little, or the crown droops
      d.y += 0.12;
      d.normalize();
      branch(b, d, len * (0.70 + rng() * 0.13), thick * 0.52, depth + 1);
    }
  }

  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), height * 0.36, 7, 0);
  return segs;
}

const TRUNK = new THREE.Color('#ff4b33');    // the red core of the reference
const LIMB = new THREE.Color('#d9614e');
const LEAF = new THREE.Color('#79e6cf');
const TIP = new THREE.Color('#dff6f2');

function latticeTree(rng, height) {
  const segs = growTree(rng, height);
  const cells = new Map();
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3();
  const side = new THREE.Vector3();
  const p = new THREE.Vector3();

  for (const s of segs) {
    const dir = s.b.clone().sub(s.a);
    const len = dir.length();
    if (len < 1e-4) continue;
    dir.divideScalar(len);
    perp.crossVectors(dir, up).normalize();
    if (!Number.isFinite(perp.x)) perp.set(1, 0, 0);
    side.crossVectors(dir, perp).normalize();

    const steps = Math.max(2, Math.ceil(len / (GRID * 0.55)));
    // thick limbs are several cells wide, twigs are one - this is what makes
    // the trunk read as a solid red column and the crown as scattered dust
    const w = Math.max(0, Math.round(s.thick / GRID));
    for (let i = 0; i <= steps; i++) {
      for (let j = -w; j <= w; j++) {
        for (let k = -Math.min(w, 1); k <= Math.min(w, 1); k++) {
          p.copy(s.a).addScaledVector(dir, (i / steps) * len)
            .addScaledVector(perp, j * GRID)
            .addScaledVector(side, k * GRID);
          const qx = Math.round(p.x / GRID) * GRID;
          const qy = Math.round(p.y / GRID) * GRID;
          const qz = Math.round(p.z / GRID) * GRID;
          const key = `${qx}|${qy}|${qz}`;
          const prev = cells.get(key);
          if (prev === undefined || s.depth < prev.depth) {
            cells.set(key, { x: qx, y: qy, z: qz, depth: s.depth });
          }
        }
      }
    }
  }

  const out = [...cells.values()];
  const c = new THREE.Color();
  for (const v of out) {
    // colour by how structural the point is, not by height: the reference's
    // red runs all the way out along the big limbs, which is what gives it
    // that x-ray look rather than a plain gradient
    if (v.depth === 0) c.copy(TRUNK);
    else if (v.depth === 1) c.copy(TRUNK).lerp(LIMB, 0.55);
    else if (v.depth === 2) c.copy(LIMB).lerp(LEAF, 0.72);
    else c.copy(LEAF).lerp(TIP, Math.min(1, (v.depth - 3) / 3));
    v.r = c.r; v.g = c.g; v.b = c.b;
    v.size = v.depth === 0 ? 3.1 : v.depth <= 2 ? 2.5 : 2.1;
  }
  return out;
}

// --------------------------------------------------------------- the tower
// Box frame, floor lines, a few mullions per face. Deliberately over-ruled:
// the density of the horizontals is what makes a wireframe read as a tower
// block rather than a crate, and it is what the reference is made of.
function towerLines(rng, { w, d, h, floors, mullions }) {
  const segs = [];
  const hw = w / 2, hd = d / 2;
  const corner = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  const push = (ax, ay, az, bx, by, bz) => segs.push([ax, ay, az, bx, by, bz]);

  for (const [x, z] of corner) push(x, 0, z, x, h, z);

  for (let f = 0; f <= floors; f++) {
    const y = (f / floors) * h;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corner[i];
      const [bx, bz] = corner[(i + 1) % 4];
      push(ax, y, az, bx, y, bz);
    }
  }

  for (let i = 0; i < 4; i++) {
    const [ax, az] = corner[i];
    const [bx, bz] = corner[(i + 1) % 4];
    for (let m = 1; m <= mullions; m++) {
      const u = m / (mullions + 1);
      const x = ax + (bx - ax) * u, z = az + (bz - az) * u;
      push(x, 0, z, x, h, z);
    }
  }

  // a roof plant room, so the skyline is not a row of flat-topped boxes
  if (rng() < 0.6) {
    const rw = w * 0.34, rd = d * 0.34, rh = h * (0.05 + rng() * 0.07);
    const rc = [[-rw, -rd], [rw, -rd], [rw, rd], [-rw, rd]];
    for (const [x, z] of rc) push(x, h, z, x, h + rh, z);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = rc[i];
      const [bx, bz] = rc[(i + 1) % 4];
      push(ax, h + rh, az, bx, h + rh, bz);
    }
  }
  return segs;
}

/** Walk a segment list and drop n points along it, evenly by arc length. */
function sampleSegments(segs, n) {
  const lens = segs.map((s) => Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const out = [];
  let acc = 0, si = 0;
  for (let i = 0; i < n; i++) {
    const want = ((i + 0.5) / n) * total;
    while (si < segs.length - 1 && acc + lens[si] < want) { acc += lens[si]; si++; }
    const u = lens[si] > 1e-6 ? (want - acc) / lens[si] : 0;
    const s = segs[si];
    out.push({
      x: s[0] + (s[3] - s[0]) * u,
      y: s[1] + (s[4] - s[1]) * u,
      z: s[2] + (s[5] - s[2]) * u,
    });
  }
  return out;
}

// ------------------------------------------------------------------ shaders
const FOG_GLSL = /* glsl */ `
  uniform float uFog;
  varying float vDepth;
  float fogFade() {
    float f = 1.0 - exp(-uFog * uFog * vDepth * vDepth);
    return clamp(1.0 - f, 0.0, 1.0);
  }
`;

const CITY_LIGHT = new THREE.Color('#cfe4ff');   // the cold of an office floor
const CITY_WARM = new THREE.Color('#ffb066');    // and the sodium under it

export class HabitatDomain {
  constructor(meta, species, { y = -126, fog = 0.0009 } = {}) {
    this.group = new THREE.Group();
    this.y = y;
    this.duration = meta.duration;
    this.startYear = meta.start_year;
    this.years = meta.end_year - meta.start_year + 1;
    this.sculpture = false;

    // permanent shove from extirpations, plus a transient lurch that settles
    this.push = 0;
    this.kick = 0;
    this.cityness = 0;
    this.shown = 0;
    this.lastT = null;

    // ---- how much of the bay is gone, measured against its own best year so
    // far. Against the all-time peak instead, 1959 would open at 30% lost and
    // the piece would start with a third of a city already standing.
    const total = new Float32Array(this.years);
    for (const sp of species) {
      for (let i = 0; i < this.years; i++) total[i] += sp.curve[i] ?? 0;
    }
    this.lost = new Float32Array(this.years);
    let run = 0;
    for (let i = 0; i < this.years; i++) {
      run = Math.max(run, total[i]);
      this.lost[i] = run > 0 ? 1 - total[i] / run : 0;
    }

    const rng = mulberry32(0x5f1ea7);

    // ------------------------------------------------------ trees -> towers
    const pos = [], city = [], colA = [], colB = [], order = [], size = [], seed = [];
    const lineVerts = [], lineOrder = [];
    const rainVerts = [], rainOrder = [];

    for (let i = 0; i < TREES; i++) {
      const a = (i / TREES) * Math.PI * 2 + (rng() - 0.5) * 0.06;
      const R = RING_R + (rng() - 0.5) * 120;
      const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
      // face the bay, so the fan of the tree reads broadside from inside
      const rot = new THREE.Matrix4().makeRotationY(a);
      const ord = ((i * PHI) % 1) * 0.72;

      const h = 185 + rng() * 150;
      const tree = latticeTree(rng, h);

      const tw = 52 + rng() * 46;
      const td = 46 + rng() * 40;
      const th = 230 + rng() * 300;
      const segs = towerLines(rng, {
        w: tw, d: td, h: th,
        floors: Math.round(th / 15),
        mullions: 2 + Math.floor(rng() * 3),
      });

      // Height-ordered mapping: the canopy becomes the top floors and the
      // trunk becomes the lobby. Random assignment reads as a swarm; this
      // reads as the tree standing up into a building.
      tree.sort((p, q) => p.y - q.y);
      const targets = sampleSegments(segs, tree.length)
        .sort((p, q) => p.y - q.y);

      const v = new THREE.Vector3();
      for (let k = 0; k < tree.length; k++) {
        const t = tree[k], c = targets[k];
        v.set(t.x, t.y, t.z).applyMatrix4(rot);
        pos.push(cx + v.x, y + v.y, cz + v.z);
        v.set(c.x, c.y, c.z).applyMatrix4(rot);
        city.push(cx + v.x, y + v.y, cz + v.z);
        colA.push(t.r, t.g, t.b);
        // the city end of the ramp: mostly cold, warm near the ground
        const warm = 1 - Math.min(1, c.y / (th * 0.45));
        const cc = CITY_LIGHT.clone().lerp(CITY_WARM, warm * 0.75);
        colB.push(cc.r, cc.g, cc.b);
        order.push(ord);
        size.push(t.size);
        seed.push(rng());
      }

      for (const s of segs) {
        v.set(s[0], s[1], s[2]).applyMatrix4(rot);
        lineVerts.push(cx + v.x, y + v.y, cz + v.z);
        v.set(s[3], s[4], s[5]).applyMatrix4(rot);
        lineVerts.push(cx + v.x, y + v.y, cz + v.z);
        lineOrder.push(ord, ord);
      }

      // The vertical streaks over the reference tree - rain, or scanlines, or
      // whatever it is that makes the image feel like a readout rather than a
      // photograph. They belong to the forest, so they go when it does.
      const crown = tree.slice(Math.floor(tree.length * 0.45));
      for (let r = 0; r < 26; r++) {
        const t = crown[Math.floor(rng() * crown.length)];
        if (!t) continue;
        v.set(t.x, t.y, t.z).applyMatrix4(rot);
        rainVerts.push(cx + v.x, y + v.y, cz + v.z);
        rainVerts.push(cx + v.x, y + v.y + 40 + rng() * 120, cz + v.z);
        rainOrder.push(ord, ord);
      }
    }

    // ------------------------------------------------- the skyline behind
    // No particles: there was never forest this far out to convert. It is the
    // rest of the city arriving on its own, late and out of focus.
    for (let i = 0; i < FAR_TOWERS; i++) {
      const a = (i / FAR_TOWERS) * Math.PI * 2 + rng() * 0.3;
      const R = 900 + rng() * 420;
      const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
      const rot = new THREE.Matrix4().makeRotationY(a);
      const th = 380 + rng() * 520;
      const ord = 0.30 + ((i * PHI) % 1) * 0.62;
      const segs = towerLines(rng, {
        w: 90 + rng() * 80, d: 80 + rng() * 70, h: th,
        floors: Math.round(th / 22), mullions: 2 + Math.floor(rng() * 3),
      });
      const v = new THREE.Vector3();
      for (const s of segs) {
        v.set(s[0], s[1], s[2]).applyMatrix4(rot);
        lineVerts.push(cx + v.x, y + v.y, cz + v.z);
        v.set(s[3], s[4], s[5]).applyMatrix4(rot);
        lineVerts.push(cx + v.x, y + v.y, cz + v.z);
        lineOrder.push(ord, ord);
      }
    }

    // ------------------------------------------------------------ geometry
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aCity', new THREE.Float32BufferAttribute(city, 3));
    g.setAttribute('aColA', new THREE.Float32BufferAttribute(colA, 3));
    g.setAttribute('aColB', new THREE.Float32BufferAttribute(colB, 3));
    g.setAttribute('aOrder', new THREE.Float32BufferAttribute(order, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));

    this.pointMat = new THREE.ShaderMaterial({
      uniforms: {
        uCity: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 },
        uFog: { value: fog }, uSculpture: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aCity;
        attribute vec3 aColA;
        attribute vec3 aColB;
        attribute float aOrder;
        attribute float aSize;
        attribute float aSeed;
        uniform float uCity;
        uniform float uTime;
        uniform float uPR;
        varying vec3 vColor;
        varying float vFlight;
        ${FOG_GLSL}
        void main() {
          float m = smoothstep(aOrder, aOrder + 0.26, uCity);
          vec3 p = mix(position, aCity, m);
          // lift and swirl mid-flight, so the transfer is a migration of
          // material and not a set of points sliding down a wire
          float arc = sin(m * 3.14159265);
          p.y += arc * (34.0 + aSeed * 46.0);
          p.x += arc * (aSeed - 0.5) * 42.0;
          p.z += arc * (aSeed - 0.5) * 42.0;
          vColor = mix(aColA, aColB, m);
          vFlight = arc;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          float dist = max(80.0, vDepth);
          gl_PointSize = min(aSize * (300.0 / dist), 9.0) * uPR;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSculpture;
        varying vec3 vColor;
        varying float vFlight;
        ${FOG_GLSL}
        void main() {
          // square dots, not round: the reference is a lattice readout and a
          // circular sprite immediately turns it into bokeh
          vec2 q = abs(gl_PointCoord - 0.5);
          float d = max(q.x, q.y);
          float a = smoothstep(0.5, 0.33, d);
          // in flight a particle burns; settled, it sits
          float b = (1.0 + vFlight * 1.6) * (1.0 + 0.25 * uSculpture);
          gl_FragColor = vec4(vColor * b, a * fogFade());
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(g, this.pointMat);
    this.group.add(this.points);

    // ------------------------------------------------------------- the lines
    this.lineMat = this._lineMaterial(fog, 0, new THREE.Color('#bcd6f5'), 0.46);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    lg.setAttribute('aOrder', new THREE.Float32BufferAttribute(lineOrder, 1));
    this.group.add(new THREE.LineSegments(lg, this.lineMat));

    this.rainMat = this._lineMaterial(fog, 1, new THREE.Color('#5fbfae'), 0.15);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rainVerts, 3));
    rg.setAttribute('aOrder', new THREE.Float32BufferAttribute(rainOrder, 1));
    this.group.add(new THREE.LineSegments(rg, this.rainMat));

    // ------------------------------------------------------------- the haze
    // The sky stops being dark. This is the single most legible signal that
    // the place has changed, and the only one you can see with your eyes shut
    // halfway - which is the point, because it is what a bird navigates by.
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uCity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vP;
        void main() {
          vP = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uCity;
        varying vec3 vP;
        void main() {
          float h = clamp((vP.y + 200.0) / 1900.0, -1.0, 1.0);
          // A tight band hugging the horizon, not a wash over the whole dome.
          // Skyglow is brightest just above the source and falls away fast;
          // spread evenly it stops reading as a city and starts reading as a
          // sepia filter over the piece.
          float band = exp(-pow(max(h, 0.0) * 4.4, 1.3));
          float floorFade = smoothstep(-0.16, 0.05, h);
          vec3 sodium = mix(vec3(1.0, 0.42, 0.15), vec3(1.0, 0.74, 0.5), band * 0.45);
          gl_FragColor = vec4(sodium * band * floorFade * uCity * 0.28, 1.0);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1900, 40, 24), this.glowMat);
    glow.renderOrder = -1;
    this.group.add(glow);
  }

  _lineMaterial(fog, invert, color, opacity) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCity: { value: 0 }, uFog: { value: fog },
        uInvert: { value: invert }, uColor: { value: color },
        uOpacity: { value: opacity },
      },
      vertexShader: /* glsl */ `
        attribute float aOrder;
        uniform float uCity;
        uniform float uInvert;
        varying float vA;
        ${FOG_GLSL}
        void main() {
          // lines trail the particles slightly: the frame is only drawn once
          // enough material has arrived to justify it
          float m = smoothstep(aOrder + 0.06, aOrder + 0.34, uCity);
          vA = mix(m, 1.0 - m, uInvert);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vA;
        ${FOG_GLSL}
        void main() {
          gl_FragColor = vec4(uColor * vA, vA * uOpacity * fogFade());
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
  }

  setPointPixelRatio(r) { this.pointMat.uniforms.uPR.value = r; }

  /** An extirpation. The city takes the ground permanently, and lurches. */
  strike() {
    this.push = Math.min(0.24, this.push + 0.055);
    this.kick = 0.075;
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  setSculpture(on) {
    this.sculpture = on;
    this.pointMat.uniforms.uSculpture.value = on ? 1 : 0;
  }

  update(t) {
    const u = Math.max(0, Math.min(1, t / this.duration));
    const i = Math.min(this.years - 1, Math.max(0, Math.floor(u * this.years)));

    // Two drivers, both needed. The ramp alone would be a scheduled effect
    // with no argument behind it; the loss alone would leave the forest
    // untouched until 1995 and then flip, because that is what the numbers
    // do. Together the city creeps for thirty years and then floods.
    const want = Math.min(1, 0.34 * u + 0.78 * this.lost[i] + this.push);

    // Scrubbing backwards should rewind the city, so this follows rather than
    // ratchets - but it follows slowly, so it reads as growth rather than as a
    // slider being dragged.
    //
    // Eased against the AUDIO CLOCK, not per frame. A fixed per-frame factor
    // means the city creeps at whatever rate the GPU happens to manage, so a
    // slow machine or a backgrounded tab would leave the skyline lagging years
    // behind the number printed above it. The piece's clock is the audio and
    // nothing visual is allowed its own.
    const dt = this.lastT == null ? 0 : Math.min(0.25, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.shown += (want - this.shown) * (1 - Math.pow(0.02, dt));
    this.kick *= Math.pow(0.06, dt);
    this.cityness = Math.min(1, this.shown + this.kick);

    this.pointMat.uniforms.uCity.value = this.cityness;
    this.pointMat.uniforms.uTime.value = t;
    this.lineMat.uniforms.uCity.value = this.cityness;
    this.rainMat.uniforms.uCity.value = this.cityness;
    this.glowMat.uniforms.uCity.value = this.cityness;
  }
}
