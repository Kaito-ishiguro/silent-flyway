// HandControl - the bay, looked at with your hands.
//
// A mouse is a desk instrument. In a room where people walk up to a screen
// there is no desk, there is usually no mouse, and the first thing an
// audience does is nothing at all, because nothing in the frame invited them
// to touch it. So the camera gets a second driver: a webcam, one hand, and
// the two gestures everybody already owns from a phone.
//
//   pinch        thumb and index apart or together -> how close you stand to
//                the sculpture. Spread to come in, close to pull back, which
//                is the way round every phone on earth already works.
//   move         the hand off centre -> the bay turns. Rate, not position:
//                held out to the left it keeps turning left, so a whole
//                orbit costs one small movement instead of a wingspan.
//
// Everything here is ABSOLUTE for zoom and RATE for rotation on purpose. An
// absolute zoom cannot drift - put your hand in the same shape and you are at
// the same distance, so nobody arrives at a view they cannot get out of. A
// rate rotation can reach any angle from a hand that stays in frame.
//
// It is also strictly additive. Pull your hand out of frame and the mouse,
// the trackpad and the auto-orbit are exactly as they were: this never takes
// the camera somewhere the existing controls cannot immediately take it back.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import modelUrl from './assets/hand_landmarker.task?url';

// Served by the small plugin in vite.config.js. Not a CDN on purpose: an
// exhibition machine should not need the internet to answer a raised hand.
const WASM_BASE = '/mediapipe-wasm';

// Landmark indices we care about, from MediaPipe's 21-point hand.
const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_MCP = 9;

// The pinch is measured against the hand's own size, never in raw frame
// units. One camera cannot tell "fingers apart" from "hand nearer the lens",
// so an unnormalised pinch zooms every time somebody leans in - which they
// will, because leaning in is what you do when you are trying to see.
const PINCH_CLOSED = 0.22;
const PINCH_OPEN = 1.05;

// Where those two map to. Near enough to be inside the flock, far enough to
// see the whole bay, and no further - being able to fly away from the piece
// is not a feature.
const R_NEAR = 210;
const R_FAR = 1250;

const DEAD_ZONE = 0.11;   // hand near the middle of frame = hold still
const YAW_RATE = 2.9;     // radians/sec at the edge of frame
const PITCH_RATE = 1.5;
const PHI_MIN = 0.22, PHI_MAX = Math.PI - 0.30;   // never over the poles

// How long a hand may go missing before the camera is handed back. Long
// enough to survive a dropped frame or a hand turned edge-on, short enough
// that walking away releases it while you are still walking.
const LOST_GRACE = 0.55;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) || 0);

export class HandControl {
  /**
   * @param {HTMLVideoElement} video  the (hidden or preview) camera element
   * @param {(s: {state: string, detail?: string}) => void} onStatus
   */
  constructor(video, onStatus = () => {}) {
    this.video = video;
    this.onStatus = onStatus;
    this.landmarker = null;
    this.stream = null;
    this.running = false;

    this.hasHand = false;
    this.lostFor = 0;
    this.lastVideoTime = -1;

    // Smoothed control values. The raw landmarks jitter by a pixel or two
    // every frame, which on a camera radius is a visible shiver, so nothing
    // is ever applied raw.
    this.radius = null;       // null until a first reading exists
    this.wantRadius = null;
    this.yawRate = 0;
    this.pitchRate = 0;
  }

  async start() {
    if (this.running) return;
    this.onStatus({ state: 'starting' });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      this.onStatus({ state: 'denied', detail: err?.name || 'no camera' });
      throw err;
    }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});

    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } catch (err) {
      this.stop();
      this.onStatus({ state: 'failed', detail: err?.message || String(err) });
      throw err;
    }

    this.running = true;
    this.onStatus({ state: 'searching' });
  }

  stop() {
    this.running = false;
    this.hasHand = false;
    this.radius = this.wantRadius = null;
    this.yawRate = this.pitchRate = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.onStatus({ state: 'off' });
  }

  /**
   * Read the camera and fold this frame into the smoothed control values.
   * Returns null when nothing should touch the camera, or
   * { radius, yawRate, pitchRate } when a hand is driving.
   */
  read(dt) {
    if (!this.running || !this.landmarker) return null;

    // detectForVideo must not be handed the same frame twice - it throws on a
    // timestamp that has not advanced, and a render loop is easily faster
    // than a 30fps camera.
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      let res = null;
      try {
        res = this.landmarker.detectForVideo(this.video, performance.now());
      } catch {
        res = null;
      }
      const lm = res?.landmarks?.[0];
      if (lm) this._ingest(lm);
      else this.hasHand = false;
    }

    if (!this.hasHand) {
      this.lostFor += dt;
      if (this.lostFor > LOST_GRACE) {
        this.yawRate = this.pitchRate = 0;
        return null;
      }
      // Inside the grace window the last reading is held rather than decayed,
      // so a hand that flickers out for two frames does not make the bay
      // lurch and then recover.
      return this.radius == null ? null
        : { radius: this.radius, yawRate: this.yawRate, pitchRate: this.pitchRate };
    }

    this.lostFor = 0;
    // One-pole smoothing on the wall clock, so the feel does not change with
    // frame rate. ~0.12s to close most of a gap: quick enough to feel
    // attached to the hand, slow enough to eat the landmark jitter.
    const k = 1 - Math.pow(0.0008, dt);
    this.radius = this.radius == null
      ? this.wantRadius
      : this.radius + (this.wantRadius - this.radius) * k;

    return { radius: this.radius, yawRate: this.yawRate, pitchRate: this.pitchRate };
  }

  _ingest(lm) {
    this.hasHand = true;

    // ---- zoom, from the pinch measured against the hand's own span
    const scale = dist(lm[WRIST], lm[MIDDLE_MCP]) || 1e-3;
    const pinch = dist(lm[THUMB_TIP], lm[INDEX_TIP]) / scale;
    const t = clamp((pinch - PINCH_CLOSED) / (PINCH_OPEN - PINCH_CLOSED), 0, 1);
    // Spread wide = close in. Phone convention, and nobody has to be told it.
    this.wantRadius = R_FAR + (R_NEAR - R_FAR) * t;

    // ---- rotation, from where the hand sits in frame
    // The preview is mirrored so people see themselves the right way round,
    // so x is flipped to match what they think they are doing.
    const px = 1 - lm[MIDDLE_MCP].x;
    const py = lm[MIDDLE_MCP].y;
    this.yawRate = -axis(px) * YAW_RATE;
    this.pitchRate = axis(py) * PITCH_RATE;
  }
}

/** Offset from the centre of frame, with a dead zone, eased so the edges of
 *  the frame are not as twitchy as the middle is sluggish. */
function axis(v) {
  const d = clamp(v, 0, 1) - 0.5;
  const m = Math.abs(d) - DEAD_ZONE / 2;
  if (m <= 0) return 0;
  const n = clamp(m / (0.5 - DEAD_ZONE / 2), 0, 1);
  return Math.sign(d) * n * n;
}

export { PHI_MIN, PHI_MAX, R_NEAR, R_FAR };
