// Shared age-aware materials: every vertex carries its emission time
// (aTime); the GPU compares it to the audio clock (uTime) and renders
//   - nothing before the note happens
//   - hot neon for the freshly played moment
//   - a fast decay to a dark ember that stays faintly visible
// so the sculpture never clutters and the "now" is always obvious.
// uSculpture = 1 switches to uniform mid-brightness for frozen viewing.

import * as THREE from 'three';

// gl_PointSize is in DEVICE pixels: when the renderer supersamples, points
// must scale with the pixel ratio or they shrink on screen. main.js sets
// this once at startup, before any domain builds a material.
let POINT_PR = 1;
export function setPointPixelRatio(r) { POINT_PR = r; }

const AGE_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uSculpture;
  uniform float uGain;
  uniform float uNeon;       // flash intensity (shooting-star head)
  uniform float uNeonDecay;  // lower = longer comet tail
  uniform float uFloor;      // >0: old vertices persist as faint embers
                             // (constellations) instead of vanishing
  uniform float uWinA;       // sculpture mode only: show the trace laid down
  uniform float uWinB;       // between these two times and nothing else

  // returns brightness multiplier for a vertex born at t;
  // negative means "do not draw"
  float ageBrightness(float t) {
    // Sculpture mode reveals every point ever emitted at once. With five jazz
    // stems that is a constellation; with fifteen species calling continuously
    // it is 25,000 points, and at the old 0.5 they summed through the bloom
    // into a white screen. Dimmer per point, same structure, still readable.
    if (uSculpture > 0.5) {
      // The window is how you compare a decade against a decade. Everything
      // the bay said between 1959 and 1969 next to everything it said between
      // 2016 and 2026 is the whole argument in one gesture, and it only works
      // if both are drawn the same way and the only difference is how much
      // there is.
      if (t < uWinA || t > uWinB) return -1.0;
      return 0.085 * uGain;
    }
    float age = uTime - t;
    if (age < 0.0) return -1.0;
    float neon = uNeon * exp(-age * uNeonDecay); // comet flash
    float body = 1.0 * exp(-age * 1.2);          // visible ~3s, then gone
    float b = max((neon + body) * uGain, uFloor * uGain);
    return b < 0.02 ? -1.0 : b;                  // fully invisible when old
  }
`;

export function makeAgedPointsMaterial({
  size = 2.6, gain = 1.0, neon = 2.8, neonDecay = 5.0, floor = 0, perVertexSize = false,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSculpture: { value: 0 },
      uSize: { value: size },
      uGain: { value: gain },
      uNeon: { value: neon },
      uNeonDecay: { value: neonDecay },
      uFloor: { value: floor },
      uWinA: { value: -1e9 },
      uWinB: { value: 1e9 },
      uPR: { value: POINT_PR },
    },
    vertexShader: /* glsl */ `
      attribute float aTime;
      attribute vec3 aColor;
      ${perVertexSize ? 'attribute float aSize;' : ''}
      uniform float uSize;
      uniform float uPR;
      varying vec3 vColor;
      varying float vBright;
      ${AGE_GLSL}
      void main() {
        vBright = ageBrightness(aTime);
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float fresh = clamp(vBright - 0.9, 0.0, 2.0);
        float dist = max(60.0, -mv.z);   // clamp: near points must not explode
        float s = uSize ${perVertexSize ? '* aSize' : ''};
        gl_PointSize = min(s * (1.0 + fresh) * (280.0 / dist), 12.0) * uPR;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vBright;
      void main() {
        if (vBright < 0.0) discard;
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        if (d > 0.25) discard;
        float soft = smoothstep(0.25, 0.1, d);   // feathered edge, no jaggies
        gl_FragColor = vec4(vColor * vBright * soft, soft);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
}

export function makeAgedLineMaterial({ gain = 1.0, neon = 2.8, neonDecay = 5.0, floor = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSculpture: { value: 0 },
      uGain: { value: gain },
      uNeon: { value: neon },
      uNeonDecay: { value: neonDecay },
      uFloor: { value: floor },
      uWinA: { value: -1e9 },
      uWinB: { value: 1e9 },
    },
    vertexShader: /* glsl */ `
      attribute float aTime;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vBright;
      ${AGE_GLSL}
      void main() {
        vBright = ageBrightness(aTime);
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vBright;
      void main() {
        if (vBright < 0.0) discard;
        gl_FragColor = vec4(vColor * vBright, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
}
