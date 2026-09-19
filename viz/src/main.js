// Silent Flyway - viewer bootstrap.
// Loads compose.py output, plays the composed mixdown, and drives every
// visual domain from the audio clock so image and sound stay one thing.
//
// This is the jazz sound sculpture's viewer with its subject changed. The
// structure is deliberately identical, because the structure was right:
//
//   jazz                              silent flyway
//   ------------------------------    ------------------------------------
//   one shared circle = every         one shared bay = every BIRD SPECIES,
//   melodic stem, own identity        own identity colour, so you watch the
//   colour, reacting to each other    voices disappear from around each other
//   floor rim = harmony clock         floor rim = the YEAR clock, 1960-2026
//   ripple per beat = tempo           ripple per year, weakening as the bay
//                                     empties
//   12 harmony rings = pitch classes  one decline ring per species
//   sculpture mode at the end         the same - and here it is the record of
//                                     everything this bay used to hear
//
// Removed rather than adapted: the drum scatter, the bass ribbon, the chord
// ring and the lyrics. They answer questions about music that a wetland does
// not raise.

import * as THREE from 'three';
import { setPointPixelRatio } from './agedMaterials.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NetworkDomain } from './networkDomain.js';
import { YearRingDomain } from './yearRing.js';
import { YearPulseDomain } from './yearPulse.js';
import { SpeciesTerrainDomain } from './speciesTerrain.js';
import { AxesOverlay } from './axesOverlay.js';
import { Scoreboard, SCOREBOARD_CSS } from './scoreboard.js';

const style = document.createElement('style');
style.textContent = SCOREBOARD_CSS;
document.head.appendChild(style);

// Birds call far above the musical register the jazz viewer was built for;
// this is the frequency that sits at the middle of the stage.
const PITCH_REF = 2000;

const el = {
  scene: document.getElementById('scene'),
  play: document.getElementById('playBtn'),
  sculpt: document.getElementById('sculptBtn'),
  cam: document.getElementById('camMode'),
  axes: document.getElementById('axesBtn'),
  seek: document.getElementById('seek'),
  status: document.getElementById('status'),
  meta: document.getElementById('meta'),
  clock: document.getElementById('clock'),
  empty: document.getElementById('empty'),
  graph: document.getElementById('graph'),
  graphStem: document.getElementById('graphStem'),
  voices: document.getElementById('voices'),
  year: document.getElementById('year'),
  banner: document.getElementById('banner'),
};

// ---------------------------------------------------------------- three.js
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const PIXEL_RATIO = Math.min(Math.max(window.devicePixelRatio, 2), 2.5);
renderer.setPixelRatio(PIXEL_RATIO);
setPointPixelRatio(PIXEL_RATIO);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
el.scene.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050608, 0.0009);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
camera.position.set(0, 90, 480);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;
controls.addEventListener('start', () => (controls.autoRotate = false));

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
  innerWidth, innerHeight, { samples: 8, type: THREE.HalfFloatType },
));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.4));
composer.addPass(new OutputPass());
composer.setSize(innerWidth, innerHeight);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------- audio
const audio = new Audio();
audio.preload = 'auto';
// dev hook: scrub, inspect, and rebuild the scene after poking at the data
window.__flyway = {
  audio,
  get domains() { return domains; },
  get f() { return features; },
  rebuild: () => buildDomains(features),
};
let playing = false;

el.play.addEventListener('click', () => (playing ? audio.pause() : audio.play()));
audio.addEventListener('play', () => {
  playing = true;
  el.play.innerHTML = '&#10074;&#10074; pause';
  setSculpture(false);
});
audio.addEventListener('pause', () => { playing = false; el.play.innerHTML = '&#9654; play'; });
audio.addEventListener('ended', () => {
  setSculpture(true);
  banner('Silent Flyway', 'everything this bay used to hear');
});

let sculpture = false;
function setSculpture(on) {
  sculpture = on;
  for (const d of domains) d.setSculpture?.(on);
  el.sculpt.classList.toggle('active', on);
}
el.sculpt.addEventListener('click', () => setSculpture(!sculpture));

let scrubbing = false;
el.seek.addEventListener('input', () => {
  scrubbing = true;
  audio.currentTime = Number(el.seek.value);
});
el.seek.addEventListener('change', () => (scrubbing = false));

// ------------------------------------------------------------------ domains
let domains = [];
let features = null;
let networkDomains = [];    // the species voices; camera + graph hunt among them
let axesOverlay = null;
let axesOn = true;
let laneLabels = [];
let scoreboard = null;

/** Floating name for one species' lane, in that species' own colour. */
function speciesLabel(s) {
  const size = 30, pad = 8;
  const cv = document.createElement('canvas');
  let ctx = cv.getContext('2d');
  ctx.font = `600 ${size}px 'Segoe UI', sans-serif`;
  cv.width = ctx.measureText(s.common_name).width + pad * 2;
  cv.height = size + pad * 2;
  ctx = cv.getContext('2d');
  ctx.font = `600 ${size}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = s.color;
  ctx.fillText(s.common_name, pad, size + pad / 2);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  }));
  sprite.scale.set(cv.width * 0.2, cv.height * 0.2, 1);
  sprite.userData.slug = s.slug;
  return sprite;
}

function buildDomains(f) {
  for (const d of domains) d.dispose(scene);
  for (const l of laneLabels) {
    scene.remove(l);
    l.material.map.dispose();
    l.material.dispose();
  }
  domains = [];
  networkDomains = [];
  laneLabels = [];

  const sp = f.species.filter((s) => f.stems[s.slug]);
  // The loudest species leads: it gets the shooting-star head, the way the
  // lead instrument did. In a full flyway that is whichever duck was most
  // abundant, which is exactly who dominated the real soundscape.
  const leadSlug = sp.reduce((a, b) => ((a.share ?? 0) >= (b.share ?? 0) ? a : b), sp[0])?.slug;

  // Lanes. Each species gets its own wedge of the bay so an audience can see
  // how many different birds are present and watch one wedge go dark. A single
  // species keeps the whole circle to itself and roams like the jazz voices.
  const n = sp.length;
  const LANE_GAP = 0.14;          // radians of empty space between streams

  sp.forEach((s, i) => {
    const isLead = s.slug === leadSlug;
    const span = (Math.PI * 2) / n;
    const lane = n === 1 ? null : {
      a0: i * span + LANE_GAP / 2,
      a1: (i + 1) * span - LANE_GAP / 2,
      inner: 42,                  // keeps the streams off the centre pole
    };

    const d = new NetworkDomain(f.stems[s.slug], f.meta, {
      center: new THREE.Vector3(0, 30, 0),
      spread: isLead ? 130 : 115,
      tint: new THREE.Color(s.color),
      gain: isLead ? 1.8 : 1.0,
      size: isLead ? 3.0 : 2.3,
      neon: isLead ? 5.0 : 3.4,
      neonDecay: isLead ? 3.2 : 4.2,
      starHead: isLead,
      pitchRef: PITCH_REF,
      lane,
      // Stems here are composed, not separated, so there is no bleed to gate
      // against - a species is silent exactly when it is not calling.
      threshold: 0.05,
    });
    d.stemKey = s.slug;
    d.stemName = s.common_name;
    d.species = s;
    d.isLead = isLead;
    domains.push(d);
    networkDomains.push(d);

    // name the lane in the scene itself, in the species' colour, so the 3D
    // stands on its own in a screenshot without the HTML scoreboard
    if (lane) {
      const mid = (lane.a0 + lane.a1) / 2;
      const label = speciesLabel(s);
      label.position.set(Math.cos(mid) * 168, 30, Math.sin(mid) * 168);
      laneLabels.push(label);
      scene.add(label);
    }
  });

  const years = f.meta.end_year - f.meta.start_year + 1;
  const total = new Array(years).fill(0);
  for (const s of f.species) for (let i = 0; i < years; i++) total[i] += s.curve[i] ?? 0;
  const tmax = Math.max(...total) || 1;

  domains.push(new YearRingDomain(f.meta, f.species, { y: -126, radius: 250 }));
  domains.push(new YearPulseDomain(f.meta, f.years, total.map((v) => v / tmax),
    { y: -126, radius: 250 }));
  domains.push(new SpeciesTerrainDomain(f.meta, f.species, { y: -126 }));

  const prevCam = el.cam.value;
  el.cam.innerHTML = '<option value="orbit">orbit camera</option>' + networkDomains
    .map((d) => `<option value="follow:${d.stemKey}">follow ${d.stemName}</option>`)
    .join('');
  el.cam.value = [...el.cam.options].some((o) => o.value === prevCam) ? prevCam : 'orbit';
  applyCamMode();

  const anyEstimated = f.species.some((s) => s.basis.includes('estimated'));
  axesOverlay?.dispose(scene);
  axesOverlay = new AxesOverlay(f.meta, { pitchRef: PITCH_REF, estimated: anyEstimated });
  axesOverlay.setVisible(axesOn);
  axesOverlay.addTo(scene);

  scoreboard = new Scoreboard(document.getElementById('scoreboard'), f.species, f.meta);

  for (const d of domains) d.addTo(scene);
  drawRadar();
}

el.axes.addEventListener('click', () => {
  axesOn = !axesOn;
  el.axes.classList.toggle('active', axesOn);
  axesOverlay?.setVisible(axesOn);
});

// A lane whose species has gone stays in place but dims to a ghost of itself,
// so the empty wedge is still legible as something that used to be occupied
// rather than just absence.
function updateLaneLabels(year) {
  if (!features) return;
  const i = Math.round(year - features.meta.start_year);
  for (const l of laneLabels) {
    const s = features.species.find((x) => x.slug === l.userData.slug);
    if (!s) continue;
    const n = s.curve[Math.max(0, Math.min(s.curve.length - 1, i))] ?? 0;
    l.material.opacity = n <= 0 ? 0.22 : 0.55 + 0.45 * Math.sqrt(n / (s.peak || 1));
  }
}

let bannerTimer = null;
function banner(title, sub) {
  el.banner.innerHTML = `${title}<small>${sub}</small>`;
  el.banner.style.opacity = '1';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.banner.style.opacity = '0'; }, 4200);
}

// ------------------------------------------------------------- radar chart
// The ecological fingerprint of each species, one polygon per species in its
// own colour - the jazz radar compared two songs, this compares the birds
// sharing one bay.
const RADAR_AXES = [
  { key: 'peakLog', label: 'peak flock', min: 0, max: 4 },       // log10 individuals
  { key: 'decline', label: 'decline', min: 0, max: 1 },
  { key: 'nowLog', label: 'left now', min: 0, max: 4 },
  { key: 'pitchK', label: 'call pitch', min: 0.5, max: 8 },      // kHz
  { key: 'callLen', label: 'call length', min: 0, max: 6 },      // seconds
  { key: 'risk', label: 'risk', min: 0, max: 4 },
];
const IUCN_RISK = {
  'Least Concern': 0, 'Near Threatened': 1, Vulnerable: 2,
  Endangered: 3, 'Critically Endangered': 4,
};
const rctx = document.getElementById('radar').getContext('2d');
const radarLegend = document.getElementById('radarLegend');

function radarValues(s) {
  return {
    peakLog: Math.log10(Math.max(1, s.peak)),
    decline: s.decline,
    nowLog: Math.log10(Math.max(1, s.now)),
    pitchK: (s.median_hz ?? 0) / 1000,
    callLen: s.call_duration ?? 0,
    risk: IUCN_RISK[s.iucn] ?? 0,
  };
}

function radarPoly(vals, color) {
  const cx = 120, cy = 112, R = 78;
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  rctx.strokeStyle = `rgba(${rgb},1)`;
  rctx.fillStyle = `rgba(${rgb},0.13)`;
  rctx.lineWidth = 1.5;
  rctx.beginPath();
  RADAR_AXES.forEach((ax, i) => {
    const v = vals[ax.key];
    const k = v == null ? 0 : Math.min(1, Math.max(0, (v - ax.min) / (ax.max - ax.min)));
    const a = (i / RADAR_AXES.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R * k;
    const y = cy + Math.sin(a) * R * k;
    i === 0 ? rctx.moveTo(x, y) : rctx.lineTo(x, y);
  });
  rctx.closePath();
  rctx.fill();
  rctx.stroke();
}

function drawRadar() {
  const cx = 120, cy = 112, R = 78;
  rctx.clearRect(0, 0, 240, 230);
  rctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (const k of [0.33, 0.66, 1]) {
    rctx.beginPath(); rctx.arc(cx, cy, R * k, 0, 6.283); rctx.stroke();
  }
  rctx.fillStyle = 'rgba(200,205,215,.6)';
  rctx.font = '9px "Segoe UI", sans-serif';
  RADAR_AXES.forEach((ax, i) => {
    const a = (i / RADAR_AXES.length) * Math.PI * 2 - Math.PI / 2;
    rctx.beginPath();
    rctx.moveTo(cx, cy);
    rctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    rctx.stroke();
    const lx = cx + Math.cos(a) * (R + 12), ly = cy + Math.sin(a) * (R + 12);
    rctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
    rctx.fillText(ax.label, lx, ly + 3);
  });
  if (!features) return;
  radarLegend.innerHTML = features.species.map((s) => {
    radarPoly(radarValues(s), s.color);
    return `<span style="color:${s.color}">■</span> ${s.common_name}`;
  }).join('<br/>');
}

// ------------------------------------------------------------------ loading
async function load() {
  try {
    const index = await fetch('/index.json').then((r) => r.json());
    if (!index.length) throw new Error('empty');
    el.empty.hidden = true;
    const slug = index[0].slug;
    el.status.textContent = 'loading...';
    features = await fetch(`/${slug}/features.json`).then((r) => r.json());
    audio.src = `/${slug}/${features.meta.audio}`;
    audio.currentTime = 0;
    el.seek.max = features.meta.duration;
    el.seek.value = 0;
    buildDomains(features);
    setSculpture(false);

    const m = features.meta;
    el.meta.innerHTML = [
      `${m.species_count} species &nbsp; ${m.calls_total} calls &nbsp; `
      + `${m.extinct_count} locally extinct`,
      `${m.peak_total} birds at peak &rarr; ${m.now_total} by ${m.end_year} `
      + `&nbsp; (&minus;${Math.round(m.decline_total * 100)}%)`,
      `${m.start_year}&ndash;${m.end_year} in ${Math.round(m.duration)}s `
      + `&nbsp; ${m.seconds_per_decade}s per decade`,
    ].join('<br/>');
    el.play.disabled = false;
    el.status.textContent = '';
  } catch (err) {
    el.empty.hidden = false;
    el.status.textContent = '';
    console.error(err);
  }
}

// ----------------------------------------------------------- follow camera
const HOME = new THREE.Vector3(0, 30, 0);
const follow = {
  angle: 0,
  focus: new THREE.Vector3(0, 30, 0),
  prey: new THREE.Vector3(0, 30, 0),
  aim: new THREE.Vector3(0, 30, 0),
  lastSeen: -999,
  dist: 300,
  height: 75,
};

function followedDomain() {
  if (!el.cam.value.startsWith('follow:')) return null;
  const key = el.cam.value.slice(7);
  return networkDomains.find((n) => n.stemKey === key) ?? null;
}

function updateFollowCamera(dt, t) {
  if (t < follow.lastSeen) follow.lastSeen = -999;
  const d = followedDomain();
  if (d && d.head.visible) {
    d.headWorld(follow.prey);
    follow.lastSeen = t;
  }
  const silence = t - follow.lastSeen;

  // Frame the bird, don't chase it. The silences here are much longer than a
  // jazz phrase gap - a rare species may not call for a decade - so the
  // camera holds its last known spot for a good while before drifting home,
  // and pulls back rather than cutting away.
  if (silence < 8) {
    follow.aim.copy(HOME).lerp(follow.prey, 0.45);
    follow.focus.lerp(follow.aim, 0.006);
  } else {
    follow.focus.lerp(HOME, 0.003);
  }
  const wantDist = silence < 8 ? 300 : 380;
  const wantHeight = silence < 8 ? 75 : 100;
  follow.dist += (wantDist - follow.dist) * 0.004;
  follow.height += (wantHeight - follow.height) * 0.004;

  follow.angle += dt * 0.1;
  camera.position.set(
    follow.focus.x + Math.sin(follow.angle) * follow.dist,
    follow.focus.y + follow.height,
    follow.focus.z + Math.cos(follow.angle) * follow.dist,
  );
  camera.lookAt(follow.focus);
}

function applyCamMode() {
  const orbit = el.cam.value === 'orbit';
  controls.enabled = orbit;
  controls.autoRotate = orbit;
  if (!orbit) {
    const dx = camera.position.x - follow.focus.x;
    const dz = camera.position.z - follow.focus.z;
    follow.angle = Math.atan2(dx, dz);
    follow.dist = Math.max(60, Math.hypot(dx, dz));
    follow.height = camera.position.y - follow.focus.y;
    follow.lastSeen = -999;
  }
}
el.cam.addEventListener('change', applyCamMode);

// -------------------------------------------------------------- live graph
// Scrolling window of one species' driving signals - the "why" behind the 3D
// motion - with that species' population curve drawn underneath, so you can
// see the call thinning against the number of birds that are left.
const gctx = el.graph.getContext('2d');

function polyline(vals, i0, i1, vmin, vmax, color, W, H) {
  gctx.strokeStyle = color;
  gctx.lineWidth = 1.2;
  gctx.beginPath();
  let started = false;
  for (let i = i0; i < i1; i++) {
    const v = vals[i];
    if (v == null || (vmin === 0 && v <= 0)) { started = false; continue; }
    const x = ((i - i0) / (i1 - i0)) * W;
    const y = H - ((Math.min(v, vmax) - vmin) / (vmax - vmin)) * (H - 6) - 3;
    if (!started) { gctx.moveTo(x, y); started = true; }
    else gctx.lineTo(x, y);
  }
  gctx.stroke();
}

function drawGraph(t) {
  const W = el.graph.width, H = el.graph.height;
  gctx.clearRect(0, 0, W, H);
  const d = followedDomain()
    ?? networkDomains.find((n) => n.isLead)
    ?? networkDomains[0]
    ?? null;
  const stem = d ? features?.stems?.[d.stemKey] : null;
  el.graphStem.textContent = d ? d.stemName : '';
  if (!stem) return;

  const fps = features.meta.fps;
  const half = 5 * fps;
  const center = Math.round(t * fps);
  const i0 = Math.max(0, center - half);
  const i1 = Math.min(stem.rms.length, center + half);
  if (i1 <= i0) return;

  // population underneath, as a filled area: the ground truth the call is
  // supposed to be following
  const sp = d.species;
  const yrs = sp.curve.length;
  gctx.fillStyle = 'rgba(95,208,138,0.13)';
  gctx.beginPath();
  gctx.moveTo(0, H);
  for (let i = i0; i < i1; i++) {
    const u = (i / fps) / features.meta.duration;
    const v = (sp.curve[Math.min(yrs - 1, Math.floor(u * yrs))] ?? 0) / (sp.peak || 1);
    gctx.lineTo(((i - i0) / (i1 - i0)) * W, H - v * (H - 6) - 3);
  }
  gctx.lineTo(W, H);
  gctx.closePath();
  gctx.fill();

  const nowX = ((center - i0) / (i1 - i0)) * W;
  gctx.strokeStyle = 'rgba(255,255,255,.25)';
  gctx.lineWidth = 1;
  gctx.beginPath(); gctx.moveTo(nowX, 0); gctx.lineTo(nowX, H); gctx.stroke();

  polyline(stem.f0 ?? [], i0, i1, 500, 8000, '#e2643c', W, H);          // pitch
  polyline(stem.rms, i0, i1, 0.0001, 1, 'rgba(232,230,227,.9)', W, H);  // loudness
  polyline(stem.centroid, i0, i1, 500, 9000, '#6fe0c8', W, H);          // brightness
}

// --------------------------------------------------------------- main loop
const announced = new Set();

let lastFrame = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  const t = audio.currentTime || 0;
  for (const d of domains) d.update(t, playing);
  if (!scrubbing) el.seek.value = t;
  if (el.cam.value.startsWith('follow:')) updateFollowCamera(dt, t);
  else controls.update();
  drawGraph(t);

  if (features) {
    const m = features.meta;
    const year = m.start_year + (t / m.duration) * (m.end_year - m.start_year);
    el.year.textContent = Math.min(m.end_year, Math.round(year));
    scoreboard?.update(year);
    updateLaneLabels(year);
    el.clock.textContent = `${Math.round(year)} · ${t.toFixed(1)}s / ${Math.round(m.duration)}s`;

    // call the extinctions as they land
    for (const s of features.species) {
      if (s.extirpated_t != null && t >= s.extirpated_t && !announced.has(s.slug)) {
        announced.add(s.slug);
        if (playing) banner(`${s.common_name} — gone`,
          `last recorded in Hong Kong, ${s.extirpated_year}`);
      }
    }
    if (t < 1) announced.clear();
  }

  composer.render();
});

load();
