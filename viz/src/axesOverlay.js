// AxesOverlay - the "why is this point THERE" layer.
// Labeled rulers floating in the scene, matching each domain's real mapping:
//   flock:    vertical pitch ruler in kHz, shared roam ring (loudness = stride)
//   rim:      the year clock, its decade ticks and its extinction marks
//   terrain:  the per-species decline rings outside the clock
// Toggleable so the art stays clean when you don't need the science.

import * as THREE from 'three';

function textSprite(text, size = 22, color = 'rgba(160,168,180,0.9)') {
  const pad = 6;
  const cv = document.createElement('canvas');
  let ctx = cv.getContext('2d');
  ctx.font = `${size}px 'Segoe UI', sans-serif`;
  cv.width = ctx.measureText(text).width + pad * 2;
  cv.height = size + pad * 2;
  ctx = cv.getContext('2d');
  ctx.font = `${size}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, pad, size + pad / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  }));
  s.scale.set(cv.width * 0.18, cv.height * 0.18, 1);
  return s;
}

function line(points, color = 0x3a4150, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 6, gapSize: 6, transparent: true, opacity: 0.7 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
  const l = new THREE.Line(geo, mat);
  if (dashed) l.computeLineDistances();
  return l;
}

export class AxesOverlay {
  constructor(meta, { pitchRef = 2000, estimated = false } = {}) {
    this.group = new THREE.Group();
    const add = (o, x, y, z) => { o.position.set(x, y, z); this.group.add(o); };

    // ---- flock pitch ruler: world y = 30 + log2(f / pitchRef) * 60.
    // Labelled in kHz, because nobody hears a wader's call as a note name.
    const callY = (hz) => 30 + Math.log2(hz / pitchRef) * 60;
    this.group.add(line([
      new THREE.Vector3(-170, callY(500), 0),
      new THREE.Vector3(-170, callY(8000), 0),
    ]));
    for (const hz of [500, 1000, 2000, 4000, 8000]) {
      this.group.add(line([
        new THREE.Vector3(-176, callY(hz), 0),
        new THREE.Vector3(-164, callY(hz), 0),
      ]));
      add(textSprite(`${(hz / 1000).toFixed(hz < 1000 ? 1 : 0)} kHz`, 18), -200, callY(hz), 0);
    }
    add(textSprite('call pitch ↑', 20, 'rgba(226,100,60,0.95)'), -170, callY(8000) + 16, 0);

    // ---- shared roam ring: every species calls into the SAME bay
    const ring = new THREE.EllipseCurve(0, 0, 135, 135).getPoints(72)
      .map((p) => new THREE.Vector3(p.x, 30, p.y));
    this.group.add(line(ring, 0x3a4150, true));
    add(textSprite('one bay - every species, colour = species', 18), 0, 34, 152);
    add(textSprite('louder call = longer stride, brighter flash', 17,
      'rgba(150,158,170,0.75)'), 0, 18, 152);

    // ---- the rim: the calendar, not a chord progression
    add(textSprite(
      `rim = the years - full circle is ${meta.start_year} to ${meta.end_year}, `
      + 'one ripple per year, brightest at each decade', 18), 0, -118, 262);
    add(textSprite(
      'green rim = a full bay, grey = an empty one; '
      + 'the marker floats higher the more has been lost', 18), 0, -140, 262);
    add(textSprite(
      'upright marks on the rim = the year a species was last recorded here', 18),
      0, -158, 262);
    if (estimated) {
      add(textSprite(
        'dashed stretches = population interpolated between surveys, not counted', 17,
        'rgba(226,160,60,0.9)'), 0, -176, 262);
    }
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
    });
  }

  setVisible(v) { this.group.visible = v; }
}
