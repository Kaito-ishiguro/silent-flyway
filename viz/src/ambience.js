// Ambience - the score under the piece.
//
// The composed mixdown is the bay itself: fifteen real recordings, looped and
// thinned as the populations fall. It carries the argument but it is not a
// mood, and an audience hearing ducks over silence does not feel the dread the
// numbers deserve. So a second layer sits underneath it - one anxious piece of
// music, held low enough that it never competes with a bird.
//
// It is streamed from YouTube through the official IFrame player rather than
// bundled: the track is not ours, and embedding is the one way to use it that
// the rights holder has actually sanctioned. That costs us a network
// dependency and a player we can only control through its API, which is why
// everything here is defensive - if the embed is blocked, unavailable in this
// region, or simply slow, the piece still plays with no music and says so on
// the button rather than failing.
//
// Two behaviours matter more than the rest:
//   - it never starts on its own. It is armed by the same click that starts the
//     mixdown, because that click is the browser gesture the player needs.
//   - it ducks. When a species goes extinct the sting needs the air, so the bed
//     drops under it and climbs back over a couple of seconds.

const VIDEO_ID = 'QdqsCX2mXIo';

// 0-100, YouTube's scale. The bed is not a fixed level: in 1959 it is barely
// present, a suggestion under a bay full of birds, and by 2026 it is the
// loudest thing in the room. That ramp is the piece's argument in the one
// channel nobody can look away from. It still never reaches a level that
// would bury a recording - the birds are the evidence.
const BED_MIN = 4;
const BED_MAX = 25;
const SCULPTURE_BED = 0.62;   // quieter still once the piece is over

export class Ambience {
  constructor() {
    this.player = null;
    this.ready = false;
    this.failed = false;
    this.enabled = true;
    this.wanted = false;      // the mixdown is playing, so the bed should be too
    this.level = 0;           // what we have actually told the player
    this.target = 0;          // what we want it to be
    this.duckUntil = 0;
    this.duckDepth = 1;
    this.scale = 1;           // sculpture mode pulls this down
    this.pressure = 0;        // 0 = 1959 wetland, 1 = the city won
    this.onStatus = null;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  /** Called from a real click. Loads the API on first use, then plays. */
  start() {
    this.wanted = true;
    if (!this.enabled || this.failed) return;
    if (!this.player) { this._create(); return; }
    if (this.ready) this._play();
  }

  // Not an immediate pauseVideo: cutting a sustained chord dead mid-note is a
  // click and a jolt. Volume goes first, the transport stops once it is down -
  // which also gives the end of the piece a fade into the silence it is named
  // for, rather than a switch being thrown.
  pause() {
    this.wanted = false;
  }

  /** Drop the bed under something louder, then climb back. */
  duck(depth = 0.22, ms = 2200) {
    this.duckDepth = depth;
    this.duckUntil = performance.now() + ms;
  }

  setSculpture(on) { this.scale = on ? SCULPTURE_BED : 1; }

  /** How far the habitat has gone. Drives how hard the music leans. */
  setPressure(p) { this.pressure = Math.max(0, Math.min(1, p)); }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && this.wanted) this.start();
    this._status();
    return this.enabled;
  }

  get status() {
    if (this.failed) return 'unavailable';
    if (!this.enabled) return 'off';
    if (!this.player) return 'idle';
    return this.ready ? 'on' : 'loading';
  }

  // ------------------------------------------------------------- internals
  _status() { this.onStatus?.(this.status); }

  _create() {
    this._status();
    const host = document.createElement('div');
    // Not display:none - some browsers refuse to play media in a hidden
    // subtree. Parked offscreen instead, inert and invisible.
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;width:320px;height:180px;'
      + 'opacity:0;pointer-events:none';
    document.body.appendChild(host);

    loadAPI().then((YT) => {
      if (!YT) { this._fail(); return; }
      this.player = new YT.Player(host, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0,
          modestbranding: 1, playsinline: 1, iv_load_policy: 3,
          // a single-video playlist is how the embed loops one track
          loop: 1, playlist: VIDEO_ID,
        },
        events: {
          onReady: () => {
            this.ready = true;
            // Volume first, always. Arriving at 100 and ramping down is a
            // blast of music over the opening of the piece.
            try { this.player.setVolume(0); } catch {}
            this.level = 0;
            this._status();
            if (this.wanted && this.enabled) this._play();
          },
          onStateChange: (e) => {
            // belt and braces: the playlist loop occasionally does not take
            if (e.data === 0) { try { this.player.seekTo(0); this.player.playVideo(); } catch {} }
          },
          onError: () => this._fail(),
        },
      });
    }).catch(() => this._fail());
    // A blocked or very slow embed should not leave the button saying
    // "loading" forever.
    setTimeout(() => { if (!this.ready) this._fail(); }, 12000);
  }

  _fail() {
    if (this.ready) return;
    this.failed = true;
    this._status();
  }

  _play() {
    try { this.player.setVolume(Math.round(this.level)); this.player.playVideo(); } catch {}
  }

  _tick() {
    requestAnimationFrame(this._tick);
    if (!this.ready || this.failed) return;
    const ducking = performance.now() < this.duckUntil;
    const bed = BED_MIN + (BED_MAX - BED_MIN) * this.pressure;
    this.target = (this.wanted && this.enabled)
      ? bed * this.scale * (ducking ? this.duckDepth : 1)
      : 0;
    // Asymmetric ramp: fall fast so the sting lands in clear air, return slow
    // so the music creeps back rather than snapping on.
    const k = this.target < this.level ? 0.14 : 0.022;
    const next = this.level + (this.target - this.level) * k;
    const settled = Math.abs(next - this.level) < 0.05
      && Math.abs(this.target - this.level) < 0.1;
    if (!settled) {
      this.level = next;
      try { this.player.setVolume(Math.max(0, Math.round(this.level))); } catch {}
    }
    // faded out and not wanted any more: stop the transport so the embed is
    // not quietly streaming under a paused piece
    if (!this.wanted || !this.enabled) {
      if (this.level < 0.4) {
        try {
          if (this.player.getPlayerState?.() === 1) this.player.pauseVideo();
        } catch {}
      }
    }
  }
}

let apiPromise = null;
function loadAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('iframe_api blocked'));
    document.head.appendChild(s);
  });
  return apiPromise;
}
