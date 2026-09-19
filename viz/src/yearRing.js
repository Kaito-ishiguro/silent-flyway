// YearRingDomain - the calendar clock.
//
// The jazz sculpture's rim was the harmony clock: the full circle was the
// song, one arc per chord, hue by root. Here the full circle is the SIXTY-SIX
// YEARS, one arc per decade, and the hue does not wander - it bleeds from the
// living green of a full wetland toward the grey of an empty one, following
// the total population of everything still calling. The marker sweeping the
// rim is the year you are hearing.
//
// Two things are written permanently onto the rim:
//   - an extinction mark at every year a species was last recorded, in that
//     species' own colour, labelled. They sit there from the first second,
//     visible ahead of the marker, so the piece is not a surprise - you can
//     see what is coming and hear it arrive.
//   - a dashed arc wherever the population figures are interpolated rather
//     than surveyed, so a guess never passes for a count.

import * as THREE from 'three';

const SEGMENTS = 792;   // 66 years x 12, so every year lands on a vertex

function labelTexture(text, color = 'rgba(235,238,245,0.95)', size = 40) {
  const pad = 10;
  const cv = document.createElement('canvas');
  let ctx = cv.getContext('2d');
  ctx.font = `600 ${size}px 'Segoe UI', sans-serif`;
  cv.width = ctx.measureText(text).width + pad * 2;
  cv.height = size + pad * 2;
  ctx = cv.getContext('2d');
  ctx.font = `600 ${size}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, pad, size + pad / 2);
  return { tex: new THREE.CanvasTexture(cv), w: cv.width, h: cv.height };
}

export class YearRingDomain {
  constructor(meta, species, { y = -126, radius = 250 } = {}) {
    this.group = new THREE.Group();
    this.duration = meta.duration;
    this.y0 = meta.start_year;
    this.y1 = meta.end_year;
    this.radius = radius;
    this.y = y;
    this.sculpture = false;
    this.labelShown = null;
    this.labelCache = new Map();

    // total population across every species, per year - the health of the bay
    const years = this.y1 - this.y0 + 1;
    const total = new Float32Array(years);
    for (const sp of species) {
      for (let i = 0; i < years; i++) total[i] += sp.curve[i] ?? 0;
    }
    const totalMax = Math.max(...total) || 1;
    this.total = total;
    this.totalMax = totalMax;

    // Any year where a still-present species rests on something short of a
    // figure read off its own source. Tested against 'documented' rather than
    // for 'estimated', so a new basis kind can never default to looking solid.
    const estimated = new Uint8Array(years);
    for (const sp of species) {
      for (let i = 0; i < years; i++) {
        if ((sp.curve[i] ?? 0) > 0 && sp.basis[i] !== 'documented') estimated[i] = 1;
      }
    }

    const pos = new Float32Array((SEGMENTS + 1) * 3);
    this.base = new Float32Array((SEGMENTS + 1) * 3);
    this.vertexTime = new Float32Array(SEGMENTS + 1);
    const live = new THREE.Color('#5fd08a');    // a bay still full of birds
    const dead = new THREE.Color('#3a4048');    // one that is not
    const c = new THREE.Color();

    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const t = u * this.duration;
      const a = u * Math.PI * 2;
      pos.set([Math.sin(a) * radius, y, Math.cos(a) * radius], i * 3);
      const yi = Math.min(years - 1, Math.floor(u * years));
      c.copy(dead).lerp(live, total[yi] / totalMax);
      // dashed look for interpolated stretches: every other vertex dimmed
      const dash = estimated[yi] && (i % 8 < 4) ? 0.18 : 1.0;
      this.base.set([c.r * dash, c.g * dash, c.b * dash], i * 3);
      this.vertexTime[i] = t;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(this.base), 3);
    geo.setAttribute('color', this.colorAttr);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.group.add(this.line);

    // ---- decade ticks, reading outward
    for (let yr = Math.ceil(this.y0 / 10) * 10; yr <= this.y1; yr += 10) {
      const a = ((yr - this.y0) / (this.y1 - this.y0)) * Math.PI * 2;
      const sx = Math.sin(a), cz = Math.cos(a);
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx * (radius - 6), y, cz * (radius - 6)),
          new THREE.Vector3(sx * (radius + 7), y, cz * (radius + 7)),
        ]),
        new THREE.LineBasicMaterial({ color: 0x5a6472, transparent: true, opacity: 0.8 }),
      );
      this.group.add(tick);
      const { tex, w, h } = labelTexture(String(yr), 'rgba(150,160,175,0.85)', 30);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      s.scale.set(w * 0.2, h * 0.2, 1);
      s.position.set(sx * (radius + 28), y + 5, cz * (radius + 28));
      this.group.add(s);
    }

    // ---- extinction marks: where each voice stops, in its own colour
    for (const sp of species) {
      if (sp.extirpated_year == null) continue;
      const a = ((sp.extirpated_year - this.y0) / (this.y1 - this.y0)) * Math.PI * 2;
      const sx = Math.sin(a), cz = Math.cos(a);
      const col = new THREE.Color(sp.color);
      const mark = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx * radius, y, cz * radius),
          new THREE.Vector3(sx * radius, y + 30, cz * radius),
        ]),
        new THREE.LineBasicMaterial({
          color: col, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      this.group.add(mark);
      const txt = `${sp.common_name} — last recorded ${sp.extirpated_year}`;
      const { tex, w, h } = labelTexture(txt, `#${col.getHexString()}`, 26);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      s.scale.set(w * 0.19, h * 0.19, 1);
      s.position.set(sx * radius, y + 38, cz * radius);
      this.group.add(s);
    }

    // ---- the now-marker, rising as the bay empties
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({
      transparent: true, depthWrite: false,
    }));
    this.lift = 0;
    this.group.add(this.marker, this.label);
  }

  labelFor(text) {
    if (!this.labelCache.has(text)) this.labelCache.set(text, labelTexture(text));
    return this.labelCache.get(text);
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
    });
    for (const { tex } of this.labelCache.values()) tex.dispose();
  }

  setSculpture(on) { this.sculpture = on; }

  update(t) {
    // past is lit, future waits dim, the sounding year burns
    const col = this.colorAttr.array;
    const w = this.duration / SEGMENTS;
    for (let i = 0; i <= SEGMENTS; i++) {
      const dt = this.vertexTime[i] - t;
      const b = this.sculpture ? 0.85
        : dt > 0 ? 0.14
        : dt > -w * 3 ? 1.0
        : 0.45;
      col[i * 3] = this.base[i * 3] * b;
      col[i * 3 + 1] = this.base[i * 3 + 1] * b;
      col[i * 3 + 2] = this.base[i * 3 + 2] * b;
    }
    this.colorAttr.needsUpdate = true;

    const u = Math.max(0, Math.min(1, t / this.duration));
    const year = this.y0 + u * (this.y1 - this.y0);
    const yi = Math.min(this.total.length - 1, Math.round(year - this.y0));

    // The marker floats higher the further the bay has fallen from its own
    // best year - the same gesture the jazz clock used for harmonic tension,
    // pointed at loss instead. It ends up hanging well above an empty rim.
    const lost = 1 - this.total[yi] / this.totalMax;
    this.lift += (lost * 44 - this.lift) * 0.05;
    const a = u * Math.PI * 2;
    this.marker.position.set(
      Math.sin(a) * this.radius, this.y + 2 + this.lift, Math.cos(a) * this.radius);
    this.marker.visible = !this.sculpture;

    const text = String(Math.round(year));
    this.label.visible = !this.sculpture;
    if (text !== this.labelShown) {
      const { tex, w: lw, h: lh } = this.labelFor(text);
      this.label.material.map = tex;
      this.label.material.needsUpdate = true;
      this.label.scale.set(lw * 0.3, lh * 0.3, 1);
      this.labelShown = text;
    }
    this.label.position.set(
      this.marker.position.x, this.marker.position.y + 17, this.marker.position.z);
  }
}
