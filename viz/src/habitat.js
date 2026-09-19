// HabitatDomain - the ground the birds are standing on, and what happens to it.
//
// This fills the space the nested decline rings used to occupy. Those rings
// were true and unreadable: fifteen flat concentric lines seen in perspective,
// saying what the scoreboard already says better. The space is worth more,
// because the one thing the piece could not previously show is WHY. A
// population curve falling is an effect. The cause is standing all around it.
//
// So the bay is a MANGROVE. Not a treeline at the horizon - Deep Bay's birds
// lived over mangrove, so the wetland has to be underneath them and around
// them at once. Three things make it read as mangrove rather than as trees:
//
//   prop roots   the arcing basket of legs that carries the trunk above the
//                tide, splayed all the way round, continuing below the mud
//   pneumatophores  the field of small vertical breathing spikes that covers
//                the flat between the trees. This is what fills the floor
//                under the bird cloud, so the piece is no longer birds
//                hovering over nothing.
//   a canopy that is a mass, not a fan - built by branching in every
//                direction from the fork, with leaf clusters at the twigs
//
// Everything is snapped to a 4-unit lattice, which is what gives the whole
// thing its readout look rather than a botanical drawing.
//
// Then the city takes it. Particles lift off the mangrove and settle onto the
// wireframes of towers - but NOT each tree into its own tower. Every target in
// the city is shuffled into one pool and dealt out at random, so a single tree
// disperses across the whole skyline and every tower is built from material
// taken from everywhere. That is both what the reference asks for and what is
// true: nothing was relocated, it was liquidated and spent elsewhere.
//
// The city crowds. Towers stand at the edge of the bay, and the last few to
// arrive stand INSIDE the year ring, in the air the birds were using. By 2026
// there is no polite distance left between the architecture and the sound.
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

const GRID = 4.0;             // the lattice every point snaps to

// Conversion order is scattered by the golden ratio. Sequential around the
// ring reads as a wipe, which looks authored; this way the city appears in
// unrelated places at once, the way development actually arrives.
const PHI = 0.6180339887;

// kinds, low to high. Low wins when two features land in the same cell, so
// structure stays legible through foliage.
const K_ROOT = 0, K_TRUNK = 1, K_LIMB = 2, K_LEAF = 3;

const C_ROOT = new THREE.Color('#ff4b33');   // the red core of the reference
const C_TRUNK = new THREE.Color('#e8573c');
const C_LIMB = new THREE.Color('#c07a63');
const C_LEAF = new THREE.Color('#4fe4c2');
const C_TIP = new THREE.Color('#dff6f2');

const CITY_LIGHT = new THREE.Color('#cfe4ff');   // the cold of an office floor
const CITY_WARM = new THREE.Color('#ffb066');    // and the sodium under it

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- the mangrove
// A lattice painter. Everything below draws into one of these: it snaps to the
// grid, de-duplicates, and lets the more structural feature win a shared cell.
function painter() {
  const cells = new Map();
  return {
    cells,
    add(x, y, z, kind) {
      const qx = Math.round(x / GRID) * GRID;
      const qy = Math.round(y / GRID) * GRID;
      const qz = Math.round(z / GRID) * GRID;
      const key = `${qx}|${qy}|${qz}`;
      const prev = cells.get(key);
      if (prev === undefined || kind < prev.k) cells.set(key, { x: qx, y: qy, z: qz, k: kind });
    },
  };
}

const _carP = new THREE.Vector3();
const _carD = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _ALT = new THREE.Vector3(1, 0, 0);

/** Two unit vectors perpendicular to dir, for thickness and for 3D branching. */
function basis(dir, u, v) {
  u.crossVectors(dir, Math.abs(dir.y) > 0.92 ? _ALT : _UP);
  if (u.lengthSq() < 1e-8) u.copy(_ALT);
  u.normalize();
  v.crossVectors(dir, u).normalize();
}

/** Paint a straight limb of given radius into the lattice. */
function limb(pt, a, b, thick, kind) {
  const dir = _p.copy(b).sub(a);
  const len = dir.length();
  if (len < 1e-4) return;
  dir.divideScalar(len);
  basis(dir, _u, _v);
  const w = Math.min(2, Math.floor(thick / GRID));
  const steps = Math.max(1, Math.ceil(len / (GRID * 0.85)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = a.x + dir.x * len * t;
    const cy = a.y + dir.y * len * t;
    const cz = a.z + dir.z * len * t;
    for (let j = -w; j <= w; j++) {
      for (let k = -w; k <= w; k++) {
        if (j * j + k * k > w * w) continue;   // round section, not a box
        pt.add(
          cx + (_u.x * j + _v.x * k) * GRID,
          cy + (_u.y * j + _v.y * k) * GRID,
          cz + (_u.z * j + _v.z * k) * GRID,
          kind,
        );
      }
    }
  }
}

/** Paint a quadratic arc - the shape every mangrove prop root makes. */
function arc(pt, p0, p1, p2, thick, kind, segs = 9) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    for (const [t, out] of [[t0, a], [t1, b]]) {
      const it = 1 - t;
      out.set(
        it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x,
        it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y,
        it * it * p0.z + 2 * it * t * p1.z + t * t * p2.z,
      );
    }
    limb(pt, a, b, thick * (1 - 0.45 * t0), kind);
  }
}

/**
 * One mangrove, local origin at the mud line, growing up and rooting down.
 * Returns lattice cells; the caller places and colours them.
 */
function mangrove(rng, h) {
  const pt = painter();
  const forkY = h * (0.26 + rng() * 0.10);
  const lean = new THREE.Vector3((rng() - 0.5) * 0.16, 1, (rng() - 0.5) * 0.16).normalize();
  const fork = _UP.clone().multiplyScalar(0).addScaledVector(lean, forkY);

  // ---- trunk
  limb(pt, new THREE.Vector3(0, 0, 0), fork, h * 0.045, K_TRUNK);

  // ---- canopy: branch in EVERY direction from the fork, not in a plane.
  // The old version fanned in one plane and read as a cut-out standing on the
  // floor; a canopy is a volume and has to be built as one.
  const dirU = new THREE.Vector3(), dirV = new THREE.Vector3();
  function branch(p, dir, len, thick, depth) {
    const b = p.clone().addScaledVector(dir, len);
    limb(pt, p, b, thick, depth <= 1 ? K_LIMB : K_LEAF);

    // Leaf mass, not leaf decoration. A crown drawn as branching wire with a
    // few specks at the tips reads as a dead tree; the reference's mangrove is
    // a solid green volume with the structure showing through it. Clusters go
    // on every branch from depth 3 outward, not only at the ends, so the crown
    // has an interior. They are also the cheapest points in the scene - no
    // limb painting, no lattice walk, just scatter - so density belongs here
    // rather than in another level of branching.
    const tip = depth >= 4 || len < GRID * 1.6;
    if (depth >= 3) {
      const n = tip ? 12 + Math.floor(rng() * 14) : 5 + Math.floor(rng() * 6);
      const rad = GRID * (tip ? 1.5 + rng() * 1.8 : 1.1 + rng() * 0.9);
      for (let i = 0; i < n; i++) {
        pt.add(
          b.x + (rng() - 0.5) * 2 * rad,
          b.y + (rng() - 0.5) * 2 * rad * 0.7,
          b.z + (rng() - 0.5) * 2 * rad,
          K_LEAF,
        );
      }
    }
    if (tip) return;
    basis(dir, dirU, dirV);
    const n = depth === 0 ? 3 : (rng() < 0.32 ? 3 : 2);
    for (let i = 0; i < n; i++) {
      const ang = 0.52 + rng() * 0.36;
      const az = (i / n) * Math.PI * 2 + rng() * 1.1;
      const d = dir.clone().multiplyScalar(Math.cos(ang))
        .addScaledVector(dirU, Math.sin(ang) * Math.cos(az))
        .addScaledVector(dirV, Math.sin(ang) * Math.sin(az));
      d.y += 0.05;                    // broad and low, the way a mangrove sits
      d.normalize();
      branch(b, d, len * (0.70 + rng() * 0.12), thick * 0.56, depth + 1);
    }
  }
  branch(fork, lean.clone(), h * 0.26, h * 0.035, 0);

  // ---- prop roots: the basket. This is the whole silhouette of a mangrove
  // and the reason the tree looks like it is standing in water rather than
  // planted in it.
  const nRoots = 11 + Math.floor(rng() * 9);
  for (let i = 0; i < nRoots; i++) {
    const az = (i / nRoots) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const sh = h * (0.10 + rng() * 0.40);
    const reach = h * (0.26 + rng() * 0.30);
    const p0 = new THREE.Vector3(lean.x * sh, sh, lean.z * sh);
    const foot = new THREE.Vector3(Math.cos(az) * reach, 0, Math.sin(az) * reach);
    // control point pushed out and held high: that is what makes the leg bow
    const p1 = new THREE.Vector3(foot.x * 0.62, sh * 0.92, foot.z * 0.62);
    arc(pt, p0, p1, foot, h * 0.016, K_ROOT);

    // a leg often forks before it lands
    if (rng() < 0.42) {
      const az2 = az + (rng() - 0.5) * 0.9;
      const r2 = reach * (0.7 + rng() * 0.5);
      const mid = new THREE.Vector3(
        (p0.x + foot.x) * 0.5, sh * 0.55, (p0.z + foot.z) * 0.5);
      const f2 = new THREE.Vector3(Math.cos(az2) * r2, 0, Math.sin(az2) * r2);
      arc(pt, mid, new THREE.Vector3(f2.x * 0.7, sh * 0.42, f2.z * 0.7), f2,
        h * 0.011, K_ROOT, 6);
    }

    // and it keeps going under the mud. The piece is watching the bay from
    // above; the roots going down are the part nobody counts.
    const deep = new THREE.Vector3(
      foot.x * (1.1 + rng() * 0.5), -h * (0.06 + rng() * 0.12), foot.z * (1.1 + rng() * 0.5));
    arc(pt, foot,
      new THREE.Vector3(foot.x * 1.15, -h * 0.02, foot.z * 1.15), deep,
      h * 0.010, K_ROOT, 5);
  }

  return [...pt.cells.values()];
}

/**
 * The flat between the trees: breathing spikes and surface root, scattered
 * thin. This is what stops the wetland reading as an empty floor with a
 * hedge around the edge.
 */
function understory(rng, count, rInner, rOuter, density) {
  const pt = painter();
  for (let i = 0; i < count; i++) {
    const az = rng() * Math.PI * 2;
    // sqrt so clumps spread evenly over area rather than piling at the middle
    const r = Math.sqrt(rInner * rInner
      + rng() * (rOuter * rOuter - rInner * rInner));
    const cx = Math.cos(az) * r, cz = Math.sin(az) * r;
    // thinner near the year clock, so the calendar stays readable through it
    if (rng() > density(r)) continue;

    // pneumatophores: the field of pegs
    const n = 3 + Math.floor(rng() * 6);
    for (let k = 0; k < n; k++) {
      const ox = cx + (rng() - 0.5) * 46;
      const oz = cz + (rng() - 0.5) * 46;
      const hh = 5 + rng() * 17;
      limb(pt, new THREE.Vector3(ox, 0, oz), new THREE.Vector3(ox, hh, oz), 0, K_ROOT);
    }
    // a knot of surface root crawling out of the clump and dipping under
    const m = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < m; k++) {
      const a2 = rng() * Math.PI * 2;
      const L = 26 + rng() * 54;
      const end = new THREE.Vector3(cx + Math.cos(a2) * L, -8 - rng() * 26,
        cz + Math.sin(a2) * L);
      arc(pt, new THREE.Vector3(cx, 3, cz),
        new THREE.Vector3(cx + Math.cos(a2) * L * 0.5, 6, cz + Math.sin(a2) * L * 0.5),
        end, 1.4, K_ROOT, 5);
    }
  }
  return [...pt.cells.values()];
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

// ----------------------------------------------------------------- roads
// The road network is grown, not drawn. A mangrove's surface root is a
// branching graph crawling outward across the mud, splitting as it goes, and a
// road network is the same graph with the curves taken out - which is why the
// roots are what becomes the roads here rather than becoming more building.
// Trunk roads run outward from the edge of the bay, throw off branches, and
// those branch once more; ring roads cross them in broken arcs.
//
// Each road is kept as a centreline polyline so traffic can be driven along it
// later, and drawn as two kerb lines so it reads as a road and not a wire.
function roadNetwork(rng) {
  const roads = [];   // { pts: Vector3[], w }

  const jitterOut = (a0, r0, r1, w, depth) => {
    const pts = [];
    let a = a0;
    const steps = Math.max(3, Math.round((r1 - r0) / 90));
    for (let i = 0; i <= steps; i++) {
      const r = r0 + (r1 - r0) * (i / steps);
      a += (rng() - 0.5) * 0.10;
      pts.push(new THREE.Vector3(Math.sin(a) * r, 3, Math.cos(a) * r));
    }
    roads.push({ pts, w });
    if (depth >= 2) return;
    const n = depth === 0 ? 2 + Math.floor(rng() * 2) : (rng() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const at = 0.25 + rng() * 0.6;
      const br0 = r0 + (r1 - r0) * at;
      jitterOut(a + (rng() < 0.5 ? -1 : 1) * (0.28 + rng() * 0.3),
        br0, br0 + 180 + rng() * 320, w * 0.66, depth + 1);
    }
  };

  for (let i = 0; i < 9; i++) {
    jitterOut((i / 9) * Math.PI * 2 + rng() * 0.3, 215, 1150 + rng() * 180,
      16 + rng() * 9, 0);
  }

  for (const R of [370, 620, 880, 1130]) {
    let a = rng() * Math.PI * 2;
    const arcs = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < arcs; k++) {
      const span = 0.8 + rng() * 1.5;
      const pts = [];
      const steps = Math.max(4, Math.round(span * 7));
      for (let i = 0; i <= steps; i++) {
        const t = a + span * (i / steps);
        const r = R + Math.sin(i * 0.7) * 16;
        pts.push(new THREE.Vector3(Math.sin(t) * r, 3, Math.cos(t) * r));
      }
      roads.push({ pts, w: 13 + rng() * 7 });
      a += span + 0.5 + rng() * 1.1;
    }
  }
  return roads;
}

/** The two kerb lines of a road, as flat segments. */
function roadKerbs(road) {
  const segs = [];
  const { pts, w } = road;
  const d = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (const side of [-1, 1]) {
    for (let i = 0; i < pts.length - 1; i++) {
      d.subVectors(pts[i + 1], pts[i]);
      nrm.set(-d.z, 0, d.x).normalize().multiplyScalar((w / 2) * side);
      segs.push([
        pts[i].x + nrm.x, pts[i].y, pts[i].z + nrm.z,
        pts[i + 1].x + nrm.x, pts[i + 1].y, pts[i + 1].z + nrm.z,
      ]);
    }
  }
  return segs;
}

/** Position and forward direction at arc-length fraction u along a road. */
function roadAt(road, u, outPos, outDir) {
  const pts = road.pts;
  const f = Math.max(0, Math.min(0.9999, u)) * (pts.length - 1);
  const i = Math.floor(f);
  const k = f - i;
  outPos.lerpVectors(pts[i], pts[i + 1], k);
  outDir.subVectors(pts[i + 1], pts[i]).normalize();
}

function segLen(s) {
  return Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]);
}

/** Walk a segment list and drop n points along it, evenly by arc length. */
function sampleSegments(segs, n) {
  const lens = segs.map(segLen);
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

// The cutaway. The sound is the subject; the habitat is the argument about
// why there is less of it. Whenever a tree or a tower comes between the camera
// and the bay it stops being an argument and becomes an obstruction, so
// anything inside the near plane dissolves. It is keyed on view depth rather
// than on a fixed region, which means it works from the orbit, from a follow
// camera, and from wherever the viewer drags to - there is no angle that can
// bury the trace.
const NEAR_GLSL = /* glsl */ `
  uniform float uNear;
  float nearFade() {
    return smoothstep(120.0, 380.0, vDepth * uNear);
  }
`;

export class HabitatDomain {
  constructor(meta, species, { y = -126, fog = 0.0009 } = {}) {
    // The landscape is fogged twice: once by distance, once by the near
    // cutaway removing its front half. At the scene's own density that
    // leaves a grey smear where the far treeline should be, so it breathes
    // through thinner air than everything else does.
    fog *= 0.72;
    this.group = new THREE.Group();
    this.y = y;
    this.duration = meta.duration;
    this.years = meta.end_year - meta.start_year + 1;
    this.sculpture = false;

    this.push = 0;
    this.kick = 0;
    this.cityness = 0;
    this.shown = 0;
    this.lastT = null;
    this.lastWall = null;
    this.dissolve = 0;

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

    // ================================================== 1. grow the wetland
    // Trees come in close. The old ring sat at 545 and left a moat of nothing
    // between the sound and the landscape; the bay is a mangrove the birds
    // are inside, so the nearest trees stand level with them.
    const wild = [];      // {x,y,z,k}
    const addTree = (cx, cz, h) => {
      const rot = new THREE.Matrix4().makeRotationY(rng() * Math.PI * 2);
      const v = new THREE.Vector3();
      for (const c of mangrove(rng, h)) {
        v.set(c.x, c.y, c.z).applyMatrix4(rot);
        wild.push({ x: cx + v.x, y: v.y, z: cz + v.z, k: c.k });
      }
    };

    // Four belts, low in the middle and tall behind. The inner ones are
    // deliberately short: they have to fill the floor the birds are calling
    // over without standing up into it. A mangrove of 70 units tops out well
    // below the flock, so the bay is occupied all the way in and still open
    // at the height the sound lives at.
    const belts = [
      // Inside the year ring: seedlings only. Something has to occupy the mud
      // the birds are calling over, but anything with a crown at flock height
      // becomes a wall between the audience and the data. At 26-52 units these
      // top out well under the cloud - you see the wetland through the birds
      // rather than instead of them.
      { n: 26, r0: 105, r1: 285, h0: 26, h1: 26 },
      { n: 12, r0: 305, r1: 500, h0: 150, h1: 130 },
      { n: 12, r0: 520, r1: 790, h0: 150, h1: 120 },
      { n: 10, r0: 840, r1: 1200, h0: 130, h1: 90 },
    ];
    for (const b of belts) {
      for (let i = 0; i < b.n; i++) {
        const a = (i / b.n) * Math.PI * 2 + (rng() - 0.5) * 0.42;
        const r = b.r0 + rng() * (b.r1 - b.r0);
        addTree(Math.sin(a) * r, Math.cos(a) * r, b.h0 + rng() * b.h1);
      }
    }

    // The flat, all the way in under the birds. Thinned near the year clock so
    // the calendar and its extinction marks stay readable through it.
    for (const c of understory(rng, 260, 30, 950,
      (r) => (r < 210 ? 0.6 : r < 290 ? 0.8 : 1))) {
      wild.push(c);
    }

    // ================================================== 2. build the city
    // Suffocating, per the reference: a dense field at every distance, a low
    // podium mass filling the ground between the towers, and a handful that
    // finally stand INSIDE the year ring, in the air the birds were using.
    const towers = [];    // { segs, order }
    const addTower = (cx, cz, order, opts) => {
      const rot = new THREE.Matrix4().makeRotationY(rng() * Math.PI * 2);
      const v = new THREE.Vector3();
      const local = towerLines(rng, opts);
      const segs = local.map((s) => {
        v.set(s[0], s[1], s[2]).applyMatrix4(rot);
        const a = [cx + v.x, v.y, cz + v.z];
        v.set(s[3], s[4], s[5]).applyMatrix4(rot);
        return [a[0], a[1], a[2], cx + v.x, v.y, cz + v.z];
      });
      towers.push({ segs, order });
    };

    const blocks = [
      // n,  r0,   r1,   h0,  h1,  w0, w1, ord0, ord1
      [28, 300, 780, 230, 380, 48, 52, 0.00, 0.62],
      [17, 840, 1300, 360, 520, 84, 76, 0.26, 0.70],
      [42, 270, 980, 40, 92, 62, 90, 0.10, 0.66],    // the podium mass
      [6, 175, 285, 190, 240, 40, 34, 0.68, 0.76],   // inside the ring, last
    ];
    let ti = 0;
    for (const [n, r0, r1, h0, h1, w0, w1, o0, o1] of blocks) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.5;
        const r = r0 + rng() * (r1 - r0);
        const th = h0 + rng() * h1;
        const ord = o0 + ((ti++ * PHI) % 1) * (o1 - o0);
        addTower(Math.sin(a) * r, Math.cos(a) * r, ord, {
          w: w0 + rng() * w1, d: w0 + rng() * w1, h: th,
          floors: Math.max(3, Math.round(th / 15)),
          mullions: 2 + Math.floor(rng() * 3),
        });
      }
    }

    // ================================================== 3. roads
    this.roads = roadNetwork(rng);
    const roadSegs = [];
    for (const r of this.roads) for (const g of roadKerbs(r)) roadSegs.push(g);

    // ================================================== 4. deal the targets
    // What a point becomes is decided by what it was. Root goes to road,
    // canopy goes to tower: the network crawling over the mud straightens into
    // the network crawling over the mud, and the thing that stood up becomes
    // the thing that stands up. Within each of those two pools the assignment
    // is shuffled, so no single tree becomes a single building - it is
    // dispersed across everything, which is what happened.
    const rootIdx = [], airIdx = [];
    wild.forEach((w, i) => (w.k === K_ROOT ? rootIdx : airIdx).push(i));

    const poolFrom = (items, count) => {
      const lens = items.map((t) => t.segs.reduce((a, g) => a + segLen(g), 0));
      const totalLen = lens.reduce((a, b) => a + b, 0) || 1;
      const out = [];
      items.forEach((t, i) => {
        const k = Math.max(1, Math.round(count * (lens[i] / totalLen)));
        const hMax = t.segs.reduce((m, g) => Math.max(m, g[1], g[4]), 1);
        for (const p of sampleSegments(t.segs, k)) {
          out.push({ x: p.x, y: p.y, z: p.z, order: t.order, hMax });
        }
      });
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };

    // Roads arrive early and all together - the ground is cleared and cut
    // before anything is built on it, which is both true and the reason the
    // transformation reads as deliberate rather than as weather.
    const roadPool = poolFrom(
      roadSegs.map((g) => ({ segs: [g], order: 0.02 + ((g[0] + g[2]) % 97) / 97 * 0.22 })),
      rootIdx.length);
    const towerPool = poolFrom(towers, airIdx.length);

    const targets = new Array(wild.length);
    rootIdx.forEach((wi, k) => { targets[wi] = roadPool[k % roadPool.length]; });
    airIdx.forEach((wi, k) => { targets[wi] = towerPool[k % towerPool.length]; });

    // ================================================== 5. buffers
    const n = wild.length;
    const pos = new Float32Array(n * 3);
    const city = new Float32Array(n * 3);
    const colA = new Float32Array(n * 3);
    const colB = new Float32Array(n * 3);
    const order = new Float32Array(n);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    const c = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const w = wild[i], t = targets[i];
      pos[i * 3] = w.x; pos[i * 3 + 1] = y + w.y; pos[i * 3 + 2] = w.z;
      city[i * 3] = t.x; city[i * 3 + 1] = y + t.y; city[i * 3 + 2] = t.z;

      // colour by how structural the point is, not by height: the reference's
      // red runs all the way out along the roots, which is what gives it that
      // x-ray look rather than a plain gradient
      if (w.k === K_ROOT) c.copy(C_ROOT);
      else if (w.k === K_TRUNK) c.copy(C_TRUNK);
      else if (w.k === K_LIMB) c.copy(C_LIMB).lerp(C_LEAF, 0.5);
      else c.copy(C_LEAF).lerp(C_TIP, 0.08 + rng() * 0.30);
      colA[i * 3] = c.r; colA[i * 3 + 1] = c.g; colA[i * 3 + 2] = c.b;

      const warm = 1 - Math.min(1, t.y / (t.hMax * 0.45));
      c.copy(CITY_LIGHT).lerp(CITY_WARM, warm * 0.75);
      colB[i * 3] = c.r; colB[i * 3 + 1] = c.g; colB[i * 3 + 2] = c.b;

      order[i] = t.order;
      size[i] = w.k === K_ROOT ? 2.6 : w.k === K_TRUNK ? 2.9 : w.k === K_LIMB ? 2.3 : 2.1;
      seed[i] = rng();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCity', new THREE.BufferAttribute(city, 3));
    g.setAttribute('aColA', new THREE.BufferAttribute(colA, 3));
    g.setAttribute('aColB', new THREE.BufferAttribute(colB, 3));
    g.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.pointCount = n;

    this.pointMat = new THREE.ShaderMaterial({
      uniforms: {
        uCity: { value: 0 }, uPR: { value: 1 },
        uFog: { value: fog }, uSculpture: { value: 0 },
        uNear: { value: 1 }, uDissolve: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aCity;
        attribute vec3 aColA;
        attribute vec3 aColB;
        attribute float aOrder;
        attribute float aSize;
        attribute float aSeed;
        uniform float uCity;
        uniform float uPR;
        varying vec3 vColor;
        varying float vFlight;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          // Every particle crosses on its own schedule inside its target's
          // window, so the transfer is a scatter and not a formation.
          float span = 0.16 + aSeed * 0.26;
          float m = smoothstep(aOrder, aOrder + span, uCity);
          vec3 p = mix(position, aCity, m);
          // a high, wide arc: these are travelling right across the bay now,
          // so they have to leave the ground to do it
          float arc = sin(m * 3.14159265);
          p.y += arc * (46.0 + aSeed * 90.0);
          p.x += arc * (aSeed - 0.5) * 120.0;
          p.z += arc * (fract(aSeed * 7.13) - 0.5) * 120.0;
          vColor = mix(aColA, aColB, m);
          vFlight = arc;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          gl_PointSize = min(aSize * (300.0 / max(80.0, vDepth)), 9.0) * uPR;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSculpture;
        uniform float uDissolve;
        uniform float uCity;
        varying vec3 vColor;
        varying float vFlight;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          // square dots, not round: the reference is a lattice readout and a
          // circular sprite immediately turns it into bokeh
          vec2 q = abs(gl_PointCoord - 0.5);
          float d = max(q.x, q.y);
          float a = smoothstep(0.5, 0.33, d);
          float b = (0.56 + vFlight * 1.5) * (1.0 + 0.3 * uSculpture)
            * mix(1.0, 0.68, uCity);
          gl_FragColor = vec4(vColor * b, a * fogFade() * nearFade() * (1.0 - uDissolve));
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(g, this.pointMat);
    this.group.add(this.points);

    // ------------------------------------------------------------- the lines
    const lineVerts = [], lineOrder = [];
    for (const t of towers) {
      for (const s of t.segs) {
        lineVerts.push(s[0], y + s[1], s[2], s[3], y + s[4], s[5]);
        lineOrder.push(t.order, t.order);
      }
    }
    // 0.30, not 0.40: at the density the reference asks for, every extra point
// of line opacity is multiplied by ninety towers stacked in depth, and the
// far side of the city washes the near side out.
    this.lineMat = this._lineMaterial(fog, new THREE.Color('#bcd6f5'), 0.30);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    lg.setAttribute('aOrder', new THREE.Float32BufferAttribute(lineOrder, 1));
    this.group.add(new THREE.LineSegments(lg, this.lineMat));

    // road kerbs, drawn warm and early - tarmac before towers
    const rv = [], ro = [];
    for (const g of roadSegs) {
      const ord = 0.02 + ((g[0] + g[2]) % 97) / 97 * 0.22;
      rv.push(g[0], y + g[1], g[2], g[3], y + g[4], g[5]);
      ro.push(ord, ord);
    }
    this.roadMat = this._lineMaterial(fog, new THREE.Color('#9fb0c4'), 0.34);
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
    rgeo.setAttribute('aOrder', new THREE.Float32BufferAttribute(ro, 1));
    this.group.add(new THREE.LineSegments(rgeo, this.roadMat));

    // ------------------------------------------------------------ traffic
    // Headlights out, tail lights back. Nothing else in the piece moves on its
    // own clock - the birds are a recording and the city is a slow ramp - so
    // the only thing in the frame with its own errand to run is the traffic,
    // which is exactly the point being made about whose bay it is now.
    this.cars = [];
    for (let i = 0; i < this.roads.length; i++) {
      const road = this.roads[i];
      const n = 2 + Math.floor(rng() * 5);
      for (let k = 0; k < n; k++) {
        const out = rng() < 0.5;
        this.cars.push({
          road,
          u: rng(),
          v: (out ? 1 : -1) * (0.030 + rng() * 0.034),
          side: out ? 1 : -1,
          warm: out,
        });
      }
    }
    const cn = this.cars.length;
    const carPos = new Float32Array(cn * 3);
    const carCol = new Float32Array(cn * 3);
    this.cars.forEach((c, i) => {
      const col = c.warm ? [1.0, 0.93, 0.78] : [1.0, 0.26, 0.18];
      carCol.set(col, i * 3);
    });
    const cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3));
    cgeo.setAttribute('aColor', new THREE.BufferAttribute(carCol, 3));
    this.carAttr = cgeo.attributes.position;
    this.carMat = new THREE.ShaderMaterial({
      uniforms: {
        uPR: { value: 1 }, uFog: { value: fog },
        uAlpha: { value: 0 }, uNear: { value: 1 }, uDissolve: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        uniform float uPR;
        varying vec3 vColor;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_PointSize = min(3.4 * (300.0 / max(80.0, vDepth)), 7.0) * uPR;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        uniform float uDissolve;
        varying vec3 vColor;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.12, length(q));
          gl_FragColor = vec4(vColor * 1.6,
            a * uAlpha * fogFade() * nearFade() * (1.0 - uDissolve));
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.group.add(new THREE.Points(cgeo, this.carMat));

    // ------------------------------------------------------------- the haze
    // The sky stops being dark. This is the single most legible signal that
    // the place has changed, and the only one you can see with your eyes half
    // shut - which matters, because it is what a bird navigates by.
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
          gl_FragColor = vec4(sodium * band * floorFade * uCity * 0.20, 1.0);
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

  _lineMaterial(fog, color, opacity) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCity: { value: 0 }, uFog: { value: fog },
        uColor: { value: color }, uOpacity: { value: opacity },
        uNear: { value: 1 }, uDissolve: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aOrder;
        uniform float uCity;
        varying float vA;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          // lines trail the particles slightly: the frame is only drawn once
          // enough material has arrived to justify it
          vA = smoothstep(aOrder + 0.08, aOrder + 0.36, uCity);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uDissolve;
        uniform float uCity;
        varying float vA;
        ${FOG_GLSL}
        ${NEAR_GLSL}
        void main() {
          // The city is meant to suffocate by MASS, not by glare. Ninety
          // towers stacked in depth at a fixed per-line opacity sum into a
          // white wall that the bird trace cannot punch through - and the
          // trace is the subject. So the more city there is, the quieter each
          // line of it draws. The bay still ends up surrounded on every side;
          // it just stays legible while that happens, which is the only way
          // anyone can see what is being lost.
          float crowd = mix(1.0, 0.46, uCity);
          gl_FragColor = vec4(uColor * vA * crowd,
            vA * uOpacity * crowd * fogFade() * nearFade() * (1.0 - uDissolve));
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
  }

  setPointPixelRatio(r) {
    this.pointMat.uniforms.uPR.value = r;
    this.carMat.uniforms.uPR.value = r;
  }

  _allMats() {
    return [this.pointMat, this.lineMat, this.roadMat, this.carMat];
  }

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
    // with no argument behind it; the loss alone would leave the wetland
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
    this.lineMat.uniforms.uCity.value = this.cityness;
    this.roadMat.uniforms.uCity.value = this.cityness;

    // ---- the city gets out of the way at the end.
    //
    // Sculpture mode exists to show the whole trace at once, and a skyline
    // standing in front of it defeats the only reason anybody switched to it.
    // Eased on the wall clock rather than the audio clock on purpose: when the
    // piece ends the audio clock stops, so anything keyed to it would freeze
    // half-faded.
    const now = performance.now();
    const wdt = this.lastWall == null ? 0
      : Math.min(0.2, (now - this.lastWall) / 1000);
    this.lastWall = now;
    const wantD = this.sculpture ? 1 : 0;
    this.dissolve += (wantD - this.dissolve) * (1 - Math.pow(0.06, wdt));
    for (const m of this._allMats()) m.uniforms.uDissolve.value = this.dissolve;
    this.glowMat.uniforms.uCity.value = this.cityness * (1 - this.dissolve);

    // ---- traffic
    const lit = Math.max(0, Math.min(1, (this.cityness - 0.3) / 0.35));
    this.carMat.uniforms.uAlpha.value = lit;
    if (lit > 0.01 && this.dissolve < 0.99) {
      const arr = this.carAttr.array;
      const p = _carP, d = _carD;
      for (let i = 0; i < this.cars.length; i++) {
        const c = this.cars[i];
        c.u += c.v * wdt;
        if (c.u > 1) c.u -= 1;
        if (c.u < 0) c.u += 1;
        roadAt(c.road, c.u, p, d);
        // sit in the correct lane rather than on the centre line
        const off = (c.road.w * 0.26) * c.side;
        arr[i * 3] = p.x + -d.z * off;
        arr[i * 3 + 1] = this.y + p.y + 1;
        arr[i * 3 + 2] = p.z + d.x * off;
      }
      this.carAttr.needsUpdate = true;
    }
  }
}
