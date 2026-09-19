# Silent Flyway

Hong Kong's wetland birds, 1960&ndash;2026, as a listenable 3D sculpture.

This is my earlier `jazz-sound-sculpture` project with its subject changed, not
a different project. Same two-stage architecture (Python does all the DSP, the
viewer never touches audio), same Lucio Arese point-network model, same viewer
chrome, same finale. Arese built that model on birdsong in the first place;
this hands it back to the birds.

> **This repo ships without audio.** Field recordings are collected from third
> parties and are not mine to redistribute, so `calls/` and the generated
> `data/` are gitignored. Everything rebuilds from a recording you supply
> yourself &mdash; see *Adding a species* below.

```
jazz                              silent flyway
------------------------------    -------------------------------------
one song                          the whole timeline, 1960 -> 2026
Demucs splits it into stems       one stem per BIRD SPECIES
stems are what Demucs found       stems are COMPOSED from each species'
                                  own field recording
time = seconds into the song      time = years across the flyway
shared circle = melodic stems     shared bay = every species, own colour
rim = harmony clock, per chord    rim = the YEAR clock, per decade
ripple per beat = tempo           ripple per year, weakening as the bay
                                  empties
12 harmony rings = pitch classes  one decline ring per species
lead instrument = shooting star   most abundant species = shooting star
sculpture mode at the end         the same, and here it is the record of
                                  everything this bay used to hear
```

**The translation that makes it work:**

```
population of a species in year Y   --->   how LOUD that species is, right now

local extinction --> the voice stops dead, and its colour leaves the bay
```

Every species' recording plays continuously from 1959 to 2026, repeating from
its own start whenever it runs out. The **only** thing that changes across the
timeline is amplitude, and amplitude is directly proportional to population:
halve the birds and you halve the level, which is &minus;6 dB and plainly
audible. A species down to 1% of its peak is 40 dB down and all but gone. At
local extinction the gain is not faded, it is zero.

That mapping is what lets a listener pick out *which* bird is going. The whole
mix falls from about &minus;21 dBFS in the 1960s to &minus;34 dBFS by the
2010s, but inside it each voice falls at its own rate: the Yellow-breasted
Bunting drops 26 dB, the Eurasian Teal 19 dB, the White-throated Kingfisher
only 8 dB, and the Black-faced Spoonbill &mdash; the one recovering species
&mdash; climbs 11 dB.

Fifteen continuous tracks need separating in space or they smear, so each
species holds a fixed stereo seat matching its lane in the viewer: what you see
on the left is what you hear on the left.

## How it works

```
calls/<slug>.wav                    <- a field recording you collected
   |
   v  python analysis/inspect_call.py <slug>       (optional, writes nothing)
Is this actually the bird? Reports continuous-call vs isolated bursts,
tonality, trill rate, pitch, and a spectrogram. A call is a harmonic stack
that moves; a cicada is a rigid band; music holds steady pitched tones.
   |
   v  python analysis/compose.py --plot
1. Load each species' recording WHOLE - peak-normalised, never trimmed.
   Silences inside it are kept: a bird that pauses is a bird that pauses
2. Tile it end to end across 1959-2026, restarting from its own first
   sample each time it runs out. No crossfade, no stretching, no gap
3. Multiply by that species' population curve, sampled per year and
   interpolated to audio rate, then pan to its fixed seat and sum
4. Analyze each species' own track exactly as analyze.py analyzes a Demucs
   stem: 60 fps rms, dominant band (-> colour), centroid, pitch, onsets
   |
   v
data/silent-flyway/{audio.wav, features.json, check.png}
   |
   v  npm run dev --prefix viz     -> http://localhost:5176
The jazz viewer: flock voices in one shared bay, the year clock on the rim
with its decade ticks and extinction marks, a ripple per year that weakens
as the bay empties, one decline ring per species, the live signal graph with
the population curve drawn under it, and sculpture mode at the end.
```

**Why the composed stems are better than separated ones.** Demucs bleeds &mdash;
the jazz viewer needs per-stem gates so a silent piano does not dance to
leakage. Here nothing is separated, because nothing needs to be: each species'
track is built from its own recording, so a voice is silent exactly when that
species is silent. There is no bleed to gate against.

**The recordings play untouched.** No trimming, no resampling, no detune, no
compression, no noise reduction, no crossfade. The only things applied are peak
normalisation (so every species starts at a comparable level), the population
gain, and a stereo seat &mdash; composition, not alteration. An mp3 download is
decoded to wav, which is lossless with respect to what the mp3 already holds
and is done only because the pipeline reads wav.

**Silences and background noise survive too.** Field recordings carry pauses,
wind, traffic and encoder whine. Nothing is filtered, so it all comes along.
A recording that is silent for ten seconds is silent for ten seconds here.

**Recordings are third-party work.** `calls/CREDITS.json` records the
Xeno-canto catalogue number and page for every file. Check each licence and
credit the recordist before any public showing &mdash; see `NOTICE.md`.

## Setup

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv librosa soundfile numpy matplotlib
npm install --prefix viz
```

## Adding a species

1. Collect a recording, save it as `calls/<slug>.wav`. From YouTube:

   ```powershell
   yt-dlp -x --audio-format wav --no-playlist -o "calls/<slug>.%(ext)s" "<url>"
   ```

2. Check what is actually in it:

   ```powershell
   .venv\Scripts\python analysis\inspect_call.py <slug>
   ```

3. Add the species to `species/species.json` &mdash; colour, IUCN status,
   `extirpated_year` if it is locally extinct, and its population anchors.

4. Recompose the whole piece:

   ```powershell
   .venv\Scripts\python analysis\compose.py --plot
   ```

Look at `data/silent-flyway/check.png` before trusting the 3D: each species
gets a strip showing its call level against the population curve it is meant
to be following, with a red line at any local extinction.

## The scoreboard

Ranked by **how much has been lost**, worst first, and re-ranked live as the
piece runs. Sorted by raw count it would simply put the commonest bird on top
and never move; sorted by depletion, a species visibly climbs the board as it
declines. The top living row burns red &mdash; the species in most trouble at
that moment &mdash; and that marker moves: it is the Black-faced Spoonbill in
1979 and the Eurasian Coot by 2025. Extirpated species settle to the bottom,
struck through with their last-recorded year, so the board drains from the top
and silts up at the bottom.

The running total sums only the species whose metric is additive, and says how
many that covers.

## Species without a recording

A species with no file in `calls/` is still part of the piece. It keeps its
colour, its decline ring, its row on the scoreboard and its mark on the year
clock &mdash; it simply has no voice. Its rim label is drawn in outline rather
than solid, and its scoreboard dot is hollow, so the scene says *present in the
data, absent in sound* without needing a legend.

That is not only a placeholder state. Several of these birds have no voice in
Hong Kong at all: the Dalmatian Pelican and Black-headed Ibis were never
recorded calling here, and the Black-faced Spoonbill is effectively silent on
its wintering grounds. For those, an empty lane is the honest rendering, and
any recording used instead would have to come from breeding grounds an ocean
away &mdash; true of the species, but not a sound this bay ever made.

Drop a file in `calls/<slug>.wav` and rerun `compose.py`; the lane fills in and
nothing else moves, because lane positions are assigned across the full species
list rather than across the voiced ones.

## Population data, and being honest about it

`species/species.json` stores **anchors**, not a continuous series, because
that is what the sources give: a peak count in 1974, a last sighting in 1999, a
survey figure in 2006. Each anchor carries a `basis`:

- `documented` &mdash; the figure appears in a cited survey or report
- `estimated` &mdash; an interpolation or informed guess used to span a gap

Wherever a still-present species rests on an estimate, the year clock draws
that stretch of rim **dashed** and the axes overlay says why, so a guess never
passes for a count in the artwork itself.

**Any anchor still marked `estimated` must be replaced with a sourced figure
before this is shown as fact.** Every anchor currently in the file is a
placeholder; `compose.py` prints a loud warning on every build listing exactly
which ones. Sourcing is under way &mdash; see
[`docs/data-research-prompt.md`](docs/data-research-prompt.md).

### Metrics: not every bird is counted the same way

Hong Kong does not measure all species with one instrument, and flattening that
is the easiest way to lie with this piece. Waterbirds are counted in Deep Bay;
passerines are not, and are known instead from passage counts or from atlas
occupancy. So each species declares a `metric`:

| metric | unit | additive? |
| --- | --- | --- |
| `peak_winter_count` | individuals | yes |
| `mean_winter_count` | individuals | yes |
| `passage_count` | individuals | no |
| `breeding_pairs` | pairs | no |
| `atlas_occupancy` | % of 1km squares | no |
| `index` | index | no |

The scoreboard prints each species' metric under its number, and the running
total sums **only** the additive ones and says how many species that covers.
A count of ducks and a percentage of occupied squares are both "numbers" and
mean nothing added together.

## Design decisions worth defending

- **Amplitude proportional to population, `GAIN_EXPONENT = 1.0`.** Not a
  flattering curve. A species at 1% of its peak is 40 dB down and nearly
  inaudible, because that is what 1% means. Lowering the exponent would keep
  dying species more present than they are.
- **Each species scaled against its OWN peak.** Scaling everything against the
  largest would bury a 46-bird kingfisher under 8,000 pintail, and you would
  never hear the kingfisher fade &mdash; which is the one thing it is here to
  do. The cost is that loudness no longer encodes absolute abundance; the
  scoreboard and the decline rings carry that instead.
- **Silence at extinction is zero, not a fade.** After the last confirmed
  record the gain is hard zero. A fade would read as a mixing decision.
- **No crossfade at the loop seam.** The recording repeats from its own first
  sample, untouched. If a seam clicks, that is the honest cost of not
  processing the audio, and a 10 ms crossfade is the fix if you want it.
- **Decline rings scaled against the biggest species, not each against its own
  peak.** Per-species normalisation would draw a 34-bird wader and a
  6,000-strong duck flock at the same height and quietly erase the subject.
- **One shared bay, not a lane per species.** Lanes were tried and removed.
  Giving each species its own wedge parked every colour in a fixed patch of
  sky, which read as composed rather than observed &mdash; birds do not hold
  assigned seats. Worse, a walker pinned against its wedge traces that wedge,
  and a wedge traced exactly is a straight chord; fifteen of those drew a
  literal polygon. Identity is carried by colour, by the scoreboard and by the
  rim labels, none of which need the bird to stay put.
- **Boundaries push, never place.** Every limit is a force on velocity
  proportional to overshoot. Setting position directly is what made the
  polygon: a walker that rides a limit exactly *becomes* that limit.
- **Three oscillators per axis at incommensurable ratios.** One sine draws a
  circle and two draw a lissajous; both read as machine-made. Three that never
  come back into step read as an animal. Phases come from a per-species seeded
  RNG, so the wander is organic and still identical every run.
- **Hard clamps on position and speed.** A backstop, not the design. A feedback
  loop that escapes once draws a line to infinity, and no care in the force
  model is worth a streak across the finished piece.
- **`pitchRef = 2000 Hz`.** The jazz viewer centres the stage on A3 (220 Hz).
  Birds call an octave and a half higher and would fly off the top of the
  space, so the flyway passes 2 kHz through the middle.
- **Pitch is measured only where the bird is calling, and cross-checked.**
  Pitch drives altitude, so a wrong octave lifts a whole species off its
  proper height. pYIN fails on wetland recordings two ways: a fast trill reads
  as unvoiced throughout, and a steady background tone gets tracked instead of
  the bird, because the tone is present in every frame including the silences.
  So the spectral peak is taken over loud frames only, and if pYIN's estimate
  sits more than 0.7 octaves away from it, pYIN is discarded. On the current
  recording pYIN reported 5316 Hz &mdash; the artifact whine &mdash; where the
  bird is at 2455 Hz.
- **Deterministic score.** A seeded RNG in Python means the piece sounds the
  same at every showing. That is the difference between a composition and a
  screensaver.
