// Species card - who the bird actually is, on demand, when the panels are off.
//
// With the panels on, the scoreboard answers "how many, right now" for all
// fifteen species at once. That is the instrument view, and it is deliberately
// impersonal: fifteen rows of numbers, none of which tell you what a Dalmatian
// Pelican looks like or why Deep Bay is where you would have seen one.
//
// Bare mode used to answer nothing at all - it cleared the frame and left the
// bay to speak for itself. This puts the other half of the information within
// reach without putting it back on screen permanently: fifteen small portraits
// in a narrow block against the left edge, and a full card for whichever one
// you point at. Nothing covers the bay unless somebody asked it to.
//
// Four rules it keeps:
//
//   1. Every word on the card comes from species.json, which is sourced. The
//      card composes and formats; it does not narrate. A species with a thin
//      entry gets a short card, not an invented one.
//   2. The count shown is the count AT THE YEAR ON SCREEN, and it keeps
//      counting while the card is open. The card is a window into the run,
//      not a fact sheet printed before it started.
//   3. Every figure carries its own metric label, for the reason the
//      scoreboard does: a passage count and a winter census are not the same
//      measurement and must not be made to look like one.
//   4. A missing photograph shows as a plain coloured plate, never a broken
//      image, and never an empty card.

const IUCN_SHORT = {
  'Least Concern': 'LC',
  'Near Threatened': 'NT',
  Vulnerable: 'VU',
  Endangered: 'EN',
  'Critically Endangered': 'CR',
  'Extinct in the Wild': 'EW',
  Extinct: 'EX',
  'Data Deficient': 'DD',
};

// Only the genuinely threatened categories get colour. Painting all eight
// turns the chip into decoration; leaving the safe ones grey means the red
// ones are doing work.
const IUCN_TONE = {
  'Near Threatened': '#d8c46a',
  Vulnerable: '#e8a85c',
  Endangered: '#ff8a5c',
  'Critically Endangered': '#ff5a4d',
};

export class SpeciesCard {
  constructor(root, species, meta) {
    this.root = root;
    this.meta = meta;
    this.species = species;
    this.photos = {};
    this.open = -1;     // which species is being pointed at, -1 for none
    this.year = meta.start_year;

    root.innerHTML = `
      <div class="sc-picker" role="listbox" aria-label="species"></div>
      <div class="sc-card" aria-live="polite">
        <div class="sc-photo">
          <div class="sc-blur"></div>
          <img class="sc-img" alt="" />
          <div class="sc-plate"></div>
          <svg class="sc-slash" viewBox="0 0 100 100" preserveAspectRatio="none"
               aria-hidden="true">
            <line x1="0" y1="0" x2="100" y2="100" />
            <line x1="100" y1="0" x2="0" y2="100" />
          </svg>
          <div class="sc-stamp"></div>
        </div>
        <div class="sc-body">
          <div class="sc-chips"></div>
          <div class="sc-name"></div>
          <div class="sc-sci"></div>
          <div class="sc-count">
            <span class="sc-num"></span>
            <span class="sc-metric"></span>
          </div>
          <div class="sc-trend"></div>
          <div class="sc-note"></div>
        </div>
      </div>`;

    this.q = {};
    for (const k of ['picker', 'card', 'photo', 'blur', 'img', 'plate', 'stamp',
      'chips', 'name', 'sci', 'num', 'metric', 'trend', 'note']) {
      this.q[k] = root.querySelector(`.sc-${k}`);
    }

    // One button per species, in species.json order. Each is the bird's own
    // photograph, because a grid of fifteen coloured dots is a legend and a
    // grid of fifteen faces is an invitation - and the whole point of this
    // panel is that the audience can see what the bird looks like.
    this.buttons = species.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'sc-btn';
      b.type = 'button';
      b.style.setProperty('--sc-c', s.color);
      b.title = s.common_name;
      b.setAttribute('aria-label', s.common_name);
      b.innerHTML = '<span class="sc-btn-img"></span><span class="sc-btn-dot"></span>';

      // Hover opens it, leaving closes it. Focus does the same thing so the
      // panel is reachable from a keyboard, and a tap does the same on a
      // touchscreen, where there is no hover to work with at all.
      b.addEventListener('mouseenter', () => this.show(i));
      b.addEventListener('focus', () => this.show(i));
      b.addEventListener('mouseleave', () => this.hide(i));
      b.addEventListener('blur', () => this.hide(i));
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.open === i) this.hide(i); else this.show(i);
      });
      this.q.picker.appendChild(b);
      return b;
    });

    // The manifest may not exist yet - an empty photo folder is a normal state
    // for this project - so a failure here is silent and the buttons simply
    // run as coloured plates.
    fetch('/species-photos/index.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => { this.photos = m || {}; this.paintButtons(); })
      .catch(() => {});
  }

  paintButtons() {
    this.species.forEach((s, i) => {
      const file = this.photos[s.slug];
      const img = this.buttons[i].querySelector('.sc-btn-img');
      if (file) {
        img.style.backgroundImage = `url("/species-photos/${encodeURIComponent(file)}")`;
        this.buttons[i].classList.remove('empty');
      } else {
        this.buttons[i].classList.add('empty');
      }
    });
  }

  show(i) {
    this.open = i;
    this.buttons.forEach((b, k) => b.classList.toggle('on', k === i));
    this.render(i);
    this.root.classList.add('sc-open');
    this.placeCard(i);
  }

  // The card opens beside the button being pointed at rather than at a fixed
  // height, so the eye does not have to travel: whatever you are touching,
  // the answer appears next to your cursor. Clamped into the viewport so the
  // bottom few species do not open a card that runs off the screen.
  placeCard(i) {
    const btn = this.buttons[i].getBoundingClientRect();
    const card = this.q.card;
    // measured after render(), so the height is this species' actual height
    const h = card.offsetHeight;
    // The ceiling is the block's own top, which already sits below the
    // toolbar - so the card clears the HUD without this needing to know how
    // tall the HUD is. The floor is the viewport, not the block, because the
    // block is now much shorter than the card and clamping to it would drag
    // every card back up to the same place.
    const ceil = this.q.picker.getBoundingClientRect().top;
    const floor = window.innerHeight - h - 18;
    const wanted = btn.top + btn.height / 2 - h / 2;       // centred on the button
    card.style.top = `${Math.round(Math.max(ceil, Math.min(floor, wanted)))}px`;
  }

  hide(i) {
    // Guard against the leave of a button that is no longer the open one,
    // which is what a fast drag across the grid produces: enter(B) fires
    // before leave(A), and an unguarded leave would close B immediately.
    if (i != null && this.open !== i) return;
    this.open = -1;
    this.buttons.forEach((b) => b.classList.remove('on'));
    this.root.classList.remove('sc-open');
  }

  // Called every frame with the year currently on screen. The card only
  // redraws while it is open, so a closed panel costs nothing.
  update(_t, year) {
    this.year = year;
    if (this.open >= 0) this.renderCount(this.open);

    // The buttons carry the extinctions too, so the losses are visible without
    // pointing at anything: a bird that has gone crosses out where it sits in
    // the grid and stays crossed out. Only recomputed when the year actually
    // ticks over, not every frame.
    const y = Math.round(year);
    if (y !== this._shownYear) {
      this._shownYear = y;
      this.species.forEach((s, i) => {
        const out = s.extirpated_year != null && y >= s.extirpated_year;
        this.buttons[i].classList.toggle('gone', out);
      });
    }
  }

  // The IUCN category as of the year on screen.
  //
  // Most species have no dated history - the sources give today's category and
  // nothing else - and for those this returns the current category with no
  // date, exactly as before. Where a sourced history DOES exist, the card
  // shows the category that was in force at the year being played, because
  // captioning 1959 with a listing made in 2017 would be backwards.
  statusAt(s, year) {
    const hist = s.iucn_history;
    if (!hist || !hist.length) return { status: s.iucn, year: null, scope: null };
    let cur = null;
    for (const e of hist) if (year >= e.year) cur = e;
    // Before the first assessment there is no dated status to show; the
    // earliest recorded category stands in, undated, rather than back-dating
    // an assessment that had not happened yet.
    if (!cur) return { status: hist[0].status, year: null, scope: hist[0].scope };
    return { status: cur.status, year: cur.year, scope: cur.scope, changed: cur !== hist[0] };
  }

  // Where this species sits in its own curve at the year on screen.
  countAt(s, year) {
    const i = Math.max(0, Math.min(
      this.meta.end_year - this.meta.start_year,
      Math.round(year - this.meta.start_year)));
    return s.curve[i] ?? 0;
  }

  // The parts that change as the piece runs. Split from render() so the
  // per-frame path touches four nodes instead of rebuilding the whole card.
  renderCount(i) {
    const s = this.species[i];
    const q = this.q;
    const n = this.countAt(s, this.year);
    const gone = n <= 0;

    const text = gone ? 'none' : Math.round(n).toLocaleString();
    if (this._shownNum !== text) {
      q.num.textContent = text;
      this._shownNum = text;
    }
    q.num.classList.toggle('none', gone);

    // An extirpated species says when it went rather than showing a zero, but
    // only once the year on screen has actually passed that date - before it,
    // the bird is still there and the card must not spoil its own timeline.
    const out = s.extirpated_year != null && this.year >= s.extirpated_year;
    q.metric.textContent = out
      ? `last recorded ${s.extirpated_year}`
      : `${s.metric_label}, ${Math.round(this.year)}`;

    const peak = Math.round(s.peak).toLocaleString();
    const pct = Math.round((1 - n / (s.peak || 1)) * 100);
    if (gone) {
      q.trend.innerHTML = `<b>${peak}</b> at peak <i>&rarr;</i> <b class="drop">gone</b>`;
    } else if (pct > 0) {
      q.trend.innerHTML = `<b>${peak}</b> at peak <i>&rarr;</i> `
        + `<b class="drop">${pct}% down</b>`;
    } else {
      // A species at or above its earlier level must not be drawn in the
      // falling colour. Bending every card towards decline is exactly the
      // dishonesty this piece cannot afford.
      q.trend.innerHTML = `<b>${peak}</b> at peak <i>&rarr;</i> `
        + '<b class="hold">holding</b>';
    }

    this.renderStatus(i);
  }

  // Status and extinction, both of which depend on the year on screen rather
  // than on the species, so they live here and not in render(). Guarded by a
  // cache key because this is on the per-frame path and rebuilding chips
  // sixty times a second to produce identical markup would be wasteful.
  renderStatus(i) {
    const s = this.species[i];
    const q = this.q;
    const st = this.statusAt(s, this.year);
    const out = s.extirpated_year != null && this.year >= s.extirpated_year;

    const key = `${i}|${st.status}|${st.year}|${out}`;
    if (this._statusKey === key) return;
    this._statusKey = key;

    // The photograph is struck through and stamped once the bird is gone from
    // Hong Kong. A red cross over a face is blunt, and it is meant to be: the
    // whole piece is about absence, and absence is the one thing a portrait
    // gallery is otherwise bad at showing.
    q.card.classList.toggle('out', out);
    q.stamp.textContent = out ? `locally extinct ${s.extirpated_year}` : '';

    const code = IUCN_SHORT[st.status] || st.status || '';
    const chips = [];
    if (code) {
      const tone = IUCN_TONE[st.status];
      const style = tone ? ` style="--chip:${tone}"` : '';
      const when = st.year ? ` <b>${st.year}</b>` : '';
      const scope = st.scope ? `${st.scope} ` : '';
      chips.push(`<span class="sc-chip${tone ? ' hot' : ''}"${style}`
        + ` title="IUCN Red List${st.year ? `, assessed ${st.year}` : ''}: `
        + `${st.status}${st.scope ? ` (${st.scope})` : ''}">`
        + `${code}${when}</span>`);
      // Only say "uplisted" when there is a dated change to point at. For the
      // fourteen species with no sourced history this never fires, and the
      // chip reads exactly as it did before.
      if (st.changed) {
        chips.push(`<span class="sc-chip move" title="${scope}IUCN category`
          + ` changed in ${st.year}">uplisted ${st.year}</span>`);
      }
    }
    if (s.guild) chips.push(`<span class="sc-chip soft">${s.guild}</span>`);
    if (out) {
      chips.push('<span class="sc-chip dead">lost from Hong Kong '
        + `${s.extirpated_year}</span>`);
    }
    q.chips.innerHTML = chips.join('');
  }

  render(i) {
    const s = this.species[i];
    const q = this.q;

    this.root.style.setProperty('--sc-c', s.color);

    const file = this.photos[s.slug];
    if (file) {
      const url = `/species-photos/${encodeURIComponent(file)}`;
      q.img.src = url;
      q.img.alt = `${s.common_name} (${s.scientific_name})`;
      // The same image, blown up and blurred, fills whatever the contained
      // photograph does not. It reads as depth of field rather than as a
      // letterbox, and it is keyed to the actual picture rather than to a
      // guessed background colour.
      q.blur.style.backgroundImage = `url("${url}")`;
      q.photo.classList.remove('empty');
      q.img.onerror = () => q.photo.classList.add('empty');
    } else {
      q.img.removeAttribute('src');
      q.blur.style.backgroundImage = '';
      q.photo.classList.add('empty');
    }

    q.name.textContent = s.common_name;
    q.sci.textContent = s.scientific_name || '';

    // Preference order is most-specific-to-Hong-Kong first: a hand-written
    // note if the entry has one, otherwise where it lives in this territory,
    // otherwise the leading threat. Never all three - this is read standing up.
    const note = s.hk_note || s.habitat || (s.threats && s.threats[0]) || '';
    q.note.textContent = note;
    q.note.style.display = note ? '' : 'none';

    // force both cached paths to redraw for the species just switched to
    this._shownNum = null;
    this._statusKey = null;
    this.renderCount(i);
  }
}

export const SPECIES_CARD_CSS = `
  /* Hidden by default and shown only in bare mode - the exact inverse of the
     scoreboard, which bare mode hides. One switch, two complete views. */
  #speciesCard { display: none; }
  body.bare #speciesCard { display: block; }

  #speciesCard {
    /* A narrow block against the left edge rather than a wide panel in the
       corner or a rail stretched down the whole side. Two columns is the
       compromise that holds both things the piece needs: the buttons stay
       big enough to read as birds, and the block still only occupies a
       sliver of the frame, well short of top-to-bottom, so the sculpture
       keeps the middle of the screen. */
    position: fixed; left: 16px; top: 84px;
    z-index: 11;
    /* the container is inert; only the buttons take the pointer, so the bay
       stays draggable everywhere else down this edge */
    pointer-events: none;
    --sc-gap: 8px;
    --sc-btn: 64px;
    --sc-w: min(360px, 26vw);
    width: max-content;
  }

  /* ---- the fifteen buttons: two columns, eight rows, content height ---- */
  .sc-picker {
    pointer-events: auto;
    display: grid;
    grid-template-columns: repeat(2, var(--sc-btn));
    gap: var(--sc-gap);
    padding: 11px; border-radius: 20px;
    background: linear-gradient(180deg, rgba(5,7,11,.74), rgba(5,7,11,.54));
    border: 1px solid rgba(255,255,255,.06);
    backdrop-filter: blur(3px);
  }
  .sc-btn {
    position: relative; display: block;
    width: var(--sc-btn); height: var(--sc-btn);
    padding: 0; border-radius: 50%; cursor: pointer;
    border: 1.5px solid rgba(255,255,255,.16);
    background: #0b0f15; overflow: hidden;
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
  }
  .sc-btn-img {
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
  }
  .sc-btn.empty .sc-btn-img {
    background: radial-gradient(120% 120% at 50% 20%,
      color-mix(in srgb, var(--sc-c) 45%, transparent), transparent 70%);
  }
  /* the species colour, as a ring rather than a tint, so the button still
     reads as a photograph and still ties to its stream in the bay */
  .sc-btn-dot {
    position: absolute; inset: 0; border-radius: 50%;
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sc-c) 60%, transparent);
  }
  /* A species that has gone is crossed out where it sits in the grid, and
     drained of colour, so the losses accumulate visibly as the piece runs
     without anybody having to point at anything. */
  .sc-btn.gone .sc-btn-img { filter: grayscale(1) brightness(.5); }
  .sc-btn.gone .sc-btn-dot {
    box-shadow: inset 0 0 0 2px rgba(255,90,77,.55);
  }
  .sc-btn.gone::after {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background:
      linear-gradient(to bottom right, transparent calc(50% - 1.5px),
        rgba(255,90,77,.92) calc(50% - 1.5px), rgba(255,90,77,.92) calc(50% + 1.5px),
        transparent calc(50% + 1.5px)),
      linear-gradient(to bottom left, transparent calc(50% - 1.5px),
        rgba(255,90,77,.92) calc(50% - 1.5px), rgba(255,90,77,.92) calc(50% + 1.5px),
        transparent calc(50% + 1.5px));
  }

  .sc-btn:hover, .sc-btn:focus-visible, .sc-btn.on {
    transform: scale(1.12);
    border-color: var(--sc-c);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sc-c) 35%, transparent),
                0 6px 18px rgba(0,0,0,.6);
    outline: none; z-index: 2;
  }

  /* ---- the card, opening beside the button being pointed at ---- */
  .sc-card {
    position: fixed;
    /* clear of the block: two buttons, the gap between them, the padding
       and border on each side, then a margin */
    left: calc(16px + (var(--sc-btn) * 2) + var(--sc-gap) + 24px + 14px);
    top: 84px;                     /* replaced per-open by placeCard() */
    width: var(--sc-w);
    border-radius: 16px; overflow: hidden;
    background: linear-gradient(180deg, rgba(5,7,11,.94), rgba(5,7,11,.82));
    border: 1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(4px);
    box-shadow: inset 0 2px 0 0 var(--sc-c, #8fd8ff),
                0 18px 48px rgba(0,0,0,.6);
    /* closed state. visibility (not display) so the card keeps its geometry
       and placeCard() can measure its height before it is shown. */
    opacity: 0; visibility: hidden;
    transform: translateX(-8px) scale(.985); transform-origin: left center;
    transition: opacity .16s ease, transform .18s ease, visibility 0s .18s;
  }
  #speciesCard.sc-open .sc-card {
    opacity: 1; visibility: visible;
    transform: none;
    transition: opacity .18s ease, transform .2s cubic-bezier(.2,.8,.3,1),
                visibility 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    .sc-btn, .sc-card { transition-duration: .01s; }
    .sc-btn:hover, .sc-btn:focus-visible, .sc-btn.on { transform: none; }
  }

  .sc-photo {
    position: relative; width: 100%; aspect-ratio: 4 / 3;
    background: #080b10; overflow: hidden;
  }
  /* the whole bird, never cropped: portraits and squares are letterboxed
     against a blurred blow-up of themselves rather than having their heads
     and feet cut off to fill a landscape frame */
  .sc-img {
    position: relative; display: block; width: 100%; height: 100%;
    object-fit: contain; object-position: center;
  }
  .sc-blur {
    position: absolute; inset: -8%;
    background-size: cover; background-position: center;
    filter: blur(18px) saturate(.75) brightness(.5);
    transform: scale(1.06);
  }
  .sc-photo.empty .sc-img, .sc-photo.empty .sc-blur { display: none; }
  .sc-plate { display: none; }
  .sc-photo.empty .sc-plate {
    display: flex; align-items: center; justify-content: center;
    position: absolute; inset: 0;
    background:
      radial-gradient(120% 100% at 50% 0%,
        color-mix(in srgb, var(--sc-c, #8fd8ff) 22%, transparent),
        transparent 70%),
      repeating-linear-gradient(135deg,
        rgba(255,255,255,.022) 0 9px, transparent 9px 18px);
    font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
    color: #5d6672;
  }
  .sc-photo.empty .sc-plate::after { content: 'photograph pending'; }

  /* ---- struck through: the bird is gone from Hong Kong ---- */
  .sc-slash { display: none; }
  .sc-card.out .sc-slash {
    display: block; position: absolute; inset: 0;
    width: 100%; height: 100%; pointer-events: none;
  }
  .sc-card.out .sc-slash line {
    stroke: rgba(255,90,77,.85); stroke-width: 1.1;
    vector-effect: non-scaling-stroke;
  }
  /* the photograph itself goes grey and dim under the cross - a full-colour
     portrait behind a red X reads as a annotation on a living bird, which is
     the opposite of what this is saying */
  .sc-card.out .sc-img { filter: grayscale(1) brightness(.55) contrast(1.05); }
  .sc-card.out .sc-blur { filter: blur(18px) grayscale(1) brightness(.3); }
  .sc-stamp { display: none; }
  .sc-card.out .sc-stamp {
    display: block; position: absolute; left: 0; right: 0; bottom: 10px;
    text-align: center;
    font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
    color: #ff7a6e; text-shadow: 0 2px 10px rgba(0,0,0,.9);
    pointer-events: none;
  }

  .sc-body { padding: 16px 19px 18px; }
  .sc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
  .sc-chip {
    font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
    padding: 4px 9px; border-radius: 6px;
    color: #8b95a2; background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.07);
  }
  .sc-chip.soft { letter-spacing: .1em; text-transform: none; font-size: 11px; }
  .sc-chip.hot {
    color: var(--chip);
    border-color: color-mix(in srgb, var(--chip) 45%, transparent);
    background: color-mix(in srgb, var(--chip) 13%, transparent);
    font-weight: 600;
  }
  /* a dated category change, shown only where a sourced date exists */
  .sc-chip.move {
    color: #e8a85c; border-color: rgba(232,168,92,.4);
    background: rgba(232,168,92,.1);
    letter-spacing: .1em; text-transform: none; font-size: 11px;
  }
  .sc-chip.dead {
    color: #8c3d36; border-color: rgba(140,61,54,.5);
    background: rgba(140,61,54,.12);
    letter-spacing: .1em; text-transform: none; font-size: 11px;
  }

  .sc-name {
    font-size: 25px; letter-spacing: .01em; color: #f2f0ed; line-height: 1.12;
  }
  .sc-sci { font-size: 13px; font-style: italic; color: #6f7885; margin-top: 3px; }

  .sc-count {
    display: flex; align-items: baseline; gap: 10px; margin-top: 17px;
    font-variant-numeric: tabular-nums;
  }
  .sc-num { font-size: 40px; font-weight: 200; color: #fff; line-height: 1; }
  .sc-num.none { color: #8c3d36; font-size: 30px; letter-spacing: .04em; }
  .sc-metric {
    font-size: 11px; letter-spacing: .05em; color: #6f7885; line-height: 1.35;
  }

  .sc-trend {
    margin-top: 9px; font-size: 13px; color: #6f7885; letter-spacing: .03em;
    font-variant-numeric: tabular-nums;
  }
  .sc-trend b { color: #c3cbd4; font-weight: 500; }
  .sc-trend i { font-style: normal; color: #4d5661; padding: 0 3px; }
  .sc-trend b.drop { color: #ff7a6e; }
  .sc-trend b.hold { color: #7fd6a8; }

  .sc-note {
    margin-top: 14px; font-size: 13px; line-height: 1.62; color: #98a2ae;
    letter-spacing: .015em;
  }

  /* Shorter windows take the buttons down a step before touching the card.
     The photograph gives up height first; the note goes last but goes
     entirely, because half a sentence is worse than none. */
  @media (max-height: 1000px) {
    #speciesCard { --sc-btn: 58px; --sc-w: min(330px, 25vw); }
    .sc-name { font-size: 23px; }
    .sc-num { font-size: 36px; }
  }
  @media (max-height: 880px) {
    #speciesCard { --sc-btn: 52px; --sc-gap: 7px; --sc-w: min(310px, 24vw); top: 74px; }
    .sc-picker { padding: 9px; }
    .sc-photo { aspect-ratio: 3 / 2; }
    .sc-name { font-size: 20px; }
    .sc-sci { font-size: 12px; }
    .sc-num { font-size: 30px; }
    .sc-note { font-size: 12px; margin-top: 11px; }
    .sc-body { padding: 13px 16px 15px; }
  }
  @media (max-height: 740px) {
    #speciesCard { --sc-btn: 44px; --sc-gap: 6px; --sc-w: min(290px, 23vw); }
    .sc-photo { aspect-ratio: 16 / 9; }
    .sc-name { font-size: 18px; }
    .sc-num { font-size: 26px; }
    .sc-note { display: none !important; }
    .sc-count { margin-top: 12px; }
  }
`;
