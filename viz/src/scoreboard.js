// Scoreboard - the numbers, big enough to read from across a room.
//
// The piece asks an audience to hear a population collapse. That only lands if
// they can also see the count it is tracking, so this is deliberately the
// second-loudest thing on screen after the year.
//
// Two rules it follows that a prettier scoreboard would break:
//
//   1. Each species shows its OWN metric next to its number. Hong Kong does
//      not count every bird the same way - waterbirds get counted in Deep Bay,
//      passerines are known from passage counts or atlas occupancy - and a
//      bare number implies a comparability that does not exist.
//   2. The total only sums species whose metric is actually additive, and says
//      how many it covers. Adding an occupancy percentage to a duck count
//      would produce a headline figure that means nothing.

const BAR_W = 128;

export class Scoreboard {
  constructor(root, species, meta) {
    this.root = root;
    this.species = species;
    this.meta = meta;
    this.shown = new Map();

    const comparable = species.filter((s) => s.comparable);
    this.comparable = comparable;

    // Fifteen species do not fit at the type size that suits five. Past ten,
    // the board tightens rather than running off the bottom of the screen -
    // losing the last rows would defeat the point of having them.
    root.classList.toggle('compact', species.length > 10);

    root.innerHTML = `
      <div class="sb-head">Population</div>
      <div class="sb-rows"></div>
      <div class="sb-total">
        <span class="sb-total-num">0</span>
        <span class="sb-total-lab"></span>
      </div>`;

    const rows = root.querySelector('.sb-rows');
    this.rows = species.map((s) => {
      const el = document.createElement('div');
      el.className = 'sb-row';
      // an unvoiced species gets a hollow dot, matching its outlined lane label
      const dot = s.has_audio === false
        ? `border:1.5px solid ${s.color};background:transparent`
        : `background:${s.color};box-shadow:0 0 12px ${s.color}`;
      el.innerHTML = `
        <span class="sb-dot" style="${dot}"></span>
        <span class="sb-name">${s.common_name}</span>
        <span class="sb-num">0</span>
        <span class="sb-metric">${s.metric_label}</span>
        <span class="sb-bar"><span class="sb-fill" style="background:${s.color}"></span></span>`;
      rows.appendChild(el);
      return {
        el,
        num: el.querySelector('.sb-num'),
        fill: el.querySelector('.sb-fill'),
        metric: el.querySelector('.sb-metric'),
      };
    });

    this.totalNum = root.querySelector('.sb-total-num');
    this.totalLab = root.querySelector('.sb-total-lab');
    // With nothing additive to add, a big "0" reads as "no birds left" rather
    // than "this figure does not apply" - so there is simply no total.
    if (!comparable.length) {
      root.querySelector('.sb-total').style.display = 'none';
    } else {
      this.totalLab.textContent = comparable.length === species.length
        ? 'individuals in the bay'
        : `individuals · ${comparable.length} of ${species.length} species counted the same way`;
    }
  }

  update(year) {
    const i = Math.max(0, Math.min(
      this.meta.end_year - this.meta.start_year,
      Math.round(year - this.meta.start_year)));

    // Rank by HOW MUCH HAS BEEN LOST, worst first, and re-rank live as the
    // piece runs. A list sorted by raw count would just put the commonest bird
    // on top and never move; sorted by depletion, a species visibly climbs the
    // board as it declines, the extirpated ones pile at the top, and the row
    // in red is always whoever is in most trouble at that moment.
    const rank = this.species.map((s, k) => {
      const n = s.curve[i] ?? 0;
      return { k, lost: 1 - n / (s.peak || 1), gone: n <= 0 };
    });
    // Living birds first, worst-hit at the top; the extirpated settle to the
    // bottom. Red marks the living species in most trouble, so it keeps moving
    // and keeps meaning something - pinned to an extinct row it would never
    // change and would be reporting a death rather than a warning. The board
    // drains from the top and silts up at the bottom as the piece runs.
    rank.sort((a, b) => (a.gone - b.gone) || (b.lost - a.lost));
    rank.forEach((r, order) => {
      this.rows[r.k].el.style.order = String(order);
      this.rows[r.k].el.classList.toggle('urgent', order === 0 && !r.gone);
    });

    let total = 0;
    this.species.forEach((s, k) => {
      const n = s.curve[i] ?? 0;
      const r = this.rows[k];
      const gone = n <= 0;

      // only touch the DOM when the displayed value actually changes; this
      // runs every frame
      const text = gone ? '—' : Math.round(n).toLocaleString();
      if (this.shown.get(s.slug) !== text) {
        r.num.textContent = text;
        this.shown.set(s.slug, text);
      }
      r.fill.style.width = `${(n / (s.peak || 1)) * 100}%`;
      r.el.classList.toggle('gone', gone);
      if (gone && s.extirpated_year != null) {
        r.metric.textContent = `extirpated ${s.extirpated_year}`;
      }
      // A row can be silent for two quite different reasons and the board
      // should not blur them: either no recording has been supplied yet, or
      // the bird genuinely has no voice in this bay.
      r.el.classList.toggle('mute', s.has_audio === false && !gone);
      if (s.comparable) total += n;
    });

    const t = Math.round(total).toLocaleString();
    if (this.shown.get('__total') !== t) {
      this.totalNum.textContent = t;
      this.shown.set('__total', t);
    }
  }
}

export const SCOREBOARD_CSS = `
  #scoreboard {
    position: fixed; left: 18px; top: 92px;
    z-index: 10; pointer-events: none;
    font-variant-numeric: tabular-nums;
    width: 310px;
    /* The streams pass behind this panel and the lane labels are drawn in
       saturated colour, so without a backdrop the numbers become unreadable
       exactly when the scene is busiest - which is the start, when the
       audience is still working out what they are looking at. */
    padding: 14px 16px 16px;
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(5,7,11,.88), rgba(5,7,11,.72));
    border: 1px solid rgba(255,255,255,.07);
    backdrop-filter: blur(3px);
  }
  .sb-head {
    font-size: 10px; letter-spacing: .26em; text-transform: uppercase;
    color: #6f7885; margin-bottom: 10px;
  }
  /* ordered by loss, so rows move; flex lets CSS order do it without
     touching the DOM every frame */
  .sb-rows { display: flex; flex-direction: column; }
  .sb-row { transition: order 0s; }

  /* the species in most trouble right now */
  .sb-row.urgent .sb-name {
    color: #ff5a4d; font-weight: 600; letter-spacing: .04em;
  }
  .sb-row.urgent .sb-num { color: #ff7a6e; }
  .sb-row.urgent .sb-metric { color: #b8564c; }
  .sb-row.urgent .sb-fill { background: #ff5a4d !important; }
  .sb-row.urgent .sb-dot {
    background: #ff5a4d !important;
    box-shadow: 0 0 12px #ff5a4d !important;
    animation: sb-pulse 1.9s ease-in-out infinite;
  }
  @keyframes sb-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .35; }
  }
  /* an extirpated row is beyond urgent - it is over, so it does not pulse */
  .sb-row.urgent.gone .sb-name { color: #8c3d36; font-weight: 400; }
  .sb-row.urgent.gone .sb-num { color: #8c3d36; }
  .sb-row.urgent.gone .sb-dot { animation: none; background: #3a2422 !important; box-shadow: none !important; }
  .sb-row {
    display: grid;
    grid-template-columns: 11px minmax(0, 1fr) auto;
    grid-template-areas: "dot name num" ".  metric bar";
    align-items: center; column-gap: 9px; row-gap: 2px;
    margin-bottom: 11px;
  }
  .sb-dot { grid-area: dot; width: 11px; height: 11px; border-radius: 50%; }
  .sb-name {
    grid-area: name; font-size: 13px; letter-spacing: .03em; color: #e8e6e3;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sb-num {
    grid-area: num; font-size: 23px; font-weight: 300; color: #fff;
    line-height: 1; text-align: right; min-width: 62px;
  }
  .sb-metric {
    grid-area: metric; font-size: 9.5px; letter-spacing: .04em; color: #6f7885;
  }
  .sb-bar {
    grid-area: bar; display: block; width: ${BAR_W}px; height: 3px; max-width: 40%;
    background: #161d26; border-radius: 2px; overflow: hidden; justify-self: end;
  }
  .sb-fill { display: block; height: 100%; width: 0%; transition: width .2s linear; }
  .sb-row.gone .sb-name { text-decoration: line-through; color: #55606b; }
  .sb-row.gone .sb-num { color: #55606b; font-weight: 200; }
  .sb-row.gone .sb-dot { background: #263039 !important; box-shadow: none !important; }
  .sb-row.gone .sb-metric { color: #7a5560; }
  .sb-row.mute .sb-name { color: #9aa4b0; }
  .sb-row.mute .sb-num { color: #c3cbd4; font-weight: 200; }
  .sb-row.mute .sb-fill { opacity: .45; }
  .sb-total {
    margin-top: 16px; padding-top: 11px;
    border-top: 1px solid rgba(255,255,255,.1);
  }
  .sb-total-num { font-size: 30px; font-weight: 200; color: #fff; }
  .sb-total-lab {
    display: block; font-size: 9.5px; letter-spacing: .05em; color: #6f7885;
    margin-top: 3px;
  }

  /* ---- compact: many species, same information, less height ---- */
  #scoreboard.compact { top: 74px; width: 286px; padding: 11px 13px 12px; }
  #scoreboard.compact .sb-head { margin-bottom: 7px; }
  #scoreboard.compact .sb-row {
    grid-template-columns: 9px minmax(0, 1fr) auto;
    column-gap: 7px; row-gap: 0; margin-bottom: 5px;
  }
  #scoreboard.compact .sb-dot { width: 9px; height: 9px; }
  #scoreboard.compact .sb-name { font-size: 11px; }
  #scoreboard.compact .sb-num { font-size: 16px; min-width: 50px; }
  #scoreboard.compact .sb-metric { font-size: 8px; }
  #scoreboard.compact .sb-bar { height: 2px; width: 84px; }
  #scoreboard.compact .sb-total { margin-top: 10px; padding-top: 8px; }
  #scoreboard.compact .sb-total-num { font-size: 22px; }
  #scoreboard.compact .sb-total-lab { font-size: 8.5px; }

  /* very short windows: drop the per-row metric caption, keep the numbers */
  @media (max-height: 760px) {
    #scoreboard.compact .sb-metric { display: none; }
    #scoreboard.compact .sb-row { margin-bottom: 4px; }
  }
`;
