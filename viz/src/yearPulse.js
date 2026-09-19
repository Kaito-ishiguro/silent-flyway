// YearPulseDomain - the pulse of the flyway made visible.
//
// The jazz sculpture fired one ripple per beat, reaching the rim exactly as
// the next beat landed, so ripple speed WAS the tempo. Here one ripple fires
// per year and reaches the rim as the next year lands, so ripple speed is the
// pace of the timeline - and the start of each decade fires the bright one,
// the way a bar start did.
//
// One thing is different, and it is the point: the ripple's strength is the
// bay's total population that year. The pulse does not merely mark time, it
// weakens. By the end the years still tick past and barely disturb the water.

import * as THREE from 'three';

export class YearPulseDomain {
  constructor(meta, years, strength, { y = -126, radius = 250 } = {}) {
    this.group = new THREE.Group();
    this.y = y;
    this.radius = radius;
    this.years = years;          // time in seconds of each year boundary
    this.strength = strength;    // 0..1 bay health at that year
    this.startYear = meta.start_year;
    this.cursor = 0;
    this.sculpture = false;

    this.pool = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.965, 1, 96),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.userData = { born: -1, dur: 0.5, peak: 0, maxR: 1 };
      this.pool.push(m);
      this.group.add(m);
    }
    this.poolIdx = 0;
  }

  fire(born, dur, peak, maxR, color) {
    const m = this.pool[this.poolIdx++ % this.pool.length];
    m.userData = { born, dur, peak, maxR };
    m.material.color.set(color);
  }

  addTo(scene) { scene.add(this.group); }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  setSculpture(on) { this.sculpture = on; }

  update(t) {
    const ys = this.years;
    if (this.cursor > 0 && ys[this.cursor - 1] > t) this.cursor = 0;

    // fire only the newest year crossed this frame, so a seek does not dump
    // sixty years of ripples at once
    let fired = -1;
    while (this.cursor < ys.length && ys[this.cursor] <= t) fired = this.cursor++;
    if (fired >= 0 && !this.sculpture && t - ys[fired] < 0.4) {
      const dur = (ys[fired + 1] ?? ys[fired] + 1.8) - ys[fired];
      const decade = (this.startYear + fired) % 10 === 0;
      const s = this.strength[fired] ?? 0;
      this.fire(ys[fired], dur,
        (decade ? 0.62 : 0.24) * (0.18 + 0.82 * s),
        1.0, decade ? 0xffffff : 0xbfe8cf);
    }

    for (const m of this.pool) {
      const { born, dur, peak, maxR } = m.userData;
      const age = t - born;
      if (born < 0 || age < 0 || age > dur || this.sculpture) {
        m.material.opacity = 0;
        continue;
      }
      const k = age / dur;
      m.scale.setScalar(this.radius * maxR * (0.1 + 0.9 * k));
      m.material.opacity = peak * (1 - k);
    }
  }
}
