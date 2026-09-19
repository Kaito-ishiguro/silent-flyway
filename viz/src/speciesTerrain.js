// SpeciesTerrainDomain - the decline topography.
//
// The jazz sculpture laid twelve concentric rings flat around the harmony
// clock, one per pitch class, each rising where its note sounded. Here there
// is one ring per SPECIES, sharing the year clock's angle mapping, and each
// ring rises with that species' population rather than its loudness.
//
// The result is a set of nested profiles you read like tree rings: a ring
// that stays high is a species holding on, one that sags is a collapse, and
// one that drops flat to the floor and stays there is a local extinction -
// drawn in that species' own colour so it matches the voice you just heard
// stop. Because the ring is the population and not the sound, it keeps
// telling the truth during the stretches where a species is simply not
// calling.

import * as THREE from 'three';
import { makeAgedLineMaterial } from './agedMaterials.js';

const RING_N = 528;   // vertices per ring; 8 per year across 66 years

function sprite(text, color, size = 22) {
  const pad = 8;
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
  s.scale.set(cv.width * 0.17, cv.height * 0.17, 1);
  return s;
}

export class SpeciesTerrainDomain {
  constructor(meta, species, {
    y = -126, innerRadius = 272, ringGap = 11, amp = 26,
  } = {}) {
    this.group = new THREE.Group();
    const duration = meta.duration;
    const years = meta.end_year - meta.start_year + 1;

    // One shared aged material: each ring is drawn as its year is reached, so
    // the landscape builds under the sculpture as the piece plays, then stays.
    this.mat = makeAgedLineMaterial({ gain: 1.0, neon: 1.6, neonDecay: 2.5, floor: 0.5 });

    // Rings are scaled against the BIGGEST species, not each against its own
    // peak. Normalising per species would draw a 34-bird wader and a
    // 6,000-strong duck flock at the same height and quietly erase the thing
    // the piece is about.
    const globalMax = Math.max(...species.map((s) => s.peak)) || 1;

    species.forEach((sp, i) => {
      const R = innerRadius + i * ringGap;
      const col = new THREE.Color(sp.color);
      const pos = new Float32Array((RING_N + 1) * 3);
      const cbuf = new Float32Array((RING_N + 1) * 3);
      const times = new Float32Array(RING_N + 1);

      for (let k = 0; k <= RING_N; k++) {
        const u = k / RING_N;
        const a = u * Math.PI * 2;
        const t = Math.min(u * duration, duration - 1e-3);
        const yi = Math.min(years - 1, Math.floor(u * years));
        const v = (sp.curve[yi] ?? 0) / globalMax;
        // sqrt so a small population is still a visible ridge rather than a
        // line indistinguishable from extinction
        const h = Math.sqrt(v) * amp;
        pos.set([Math.sin(a) * R, y + 1 + h, Math.cos(a) * R], k * 3);
        const b = 0.25 + 0.75 * Math.sqrt(v);
        cbuf.set([col.r * b, col.g * b, col.b * b], k * 3);
        times[k] = t;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(cbuf, 3));
      geo.setAttribute('aTime', new THREE.BufferAttribute(times, 1));
      this.group.add(new THREE.Line(geo, this.mat));

      const gone = sp.extirpated_year != null;
      const label = sprite(
        gone ? `${sp.common_name} †` : sp.common_name,
        gone ? 'rgba(150,158,170,0.7)' : `#${col.getHexString()}`,
      );
      label.position.set(0, y + 4, -(R + 3));
      this.group.add(label);
    });

    const cap = sprite(
      'decline rings - each circle is one species, height = population',
      'rgba(200,208,220,0.85)');
    cap.position.set(0, y + 6, -(innerRadius + species.length * ringGap + 26));
    this.group.add(cap);
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && o.material !== this.mat) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.mat.dispose();
  }

  setSculpture(on) { this.mat.uniforms.uSculpture.value = on ? 1 : 0; }

  update(t) { this.mat.uniforms.uTime.value = t; }
}
