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
population of a species in year Y
        |
        +--> how OFTEN it calls   (call density)
        +--> how LOUD each call is (gain)

local extinction --> the voice stops, and its colour leaves the bay for good
```

Density is the load-bearing decision. A drone that fades out is a fader being
pulled; a chorus that thins is a population collapsing. Real wetlands are
overlapping bursts with gaps between them, so driving call *rate* from
population means a 1960 marsh sounds busy and a 2020 one sounds like two lonely
notes &mdash; and it stops a full flyway turning to mush, because only a few
species are ever abundant at once.

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
1. Load each species' recording WHOLE - peak-normalized, never trimmed
2. Score the timeline: population -> call density + gain, seeded RNG
3. Re-trigger the recording across 1960-2026, each call with its own
   detune, level and stereo position, and sum to the mixdown
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

**The recordings play untouched.** `DETUNE = 0` in `compose.py`, so every call
is the source file sample for sample. The only things applied are peak
normalization (so species sit at comparable levels), the population gain, and
stereo placement &mdash; composition, not alteration.

Variation between repeats therefore comes only from irregular spacing,
level, position, and occasional tight answer-calls. Raising `DETUNE` to about
`0.045` would add &plusmn;4.5% per-call pitch-and-duration jitter, which reads
more like many individuals and less like one file replayed &mdash; at the cost
of no longer being the recording you collected. Fidelity is the default here
by choice.

**Background tones survive too.** Field recordings often carry a continuous
whine (encoder artifact, mic hiss, hum) that sits in every frame including the
silences. Since nothing is filtered, it comes along &mdash; but because it only
sounds while a call is playing, it thins out with the birds rather than
droning under the ending. In the current bunting recording it is about five
times quieter than the calls, and its share of the timeline falls from ~79% in
the 1960s to ~21% by the 2020s.

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

- **Density, not just volume.** Volume alone reads as a mixing choice; a
  falling call rate reads as fewer birds. Both come off the same curve.
- **Peak overlap, not calls-per-second.** The knob that decides chorus-vs-mush
  is expressed as how many calls may sound at once at a species' peak, because
  a 5-second trill and a 0.3-second chirp cannot share a rate.
- **Sublinear rate, floored gain.** `rate` scales as `norm^0.7` and gain bottoms
  out at 0.16, so a collapsed population stays audible. The silence at the end
  has to land as an extinction, not as a fade-out.
- **Decline rings scaled against the biggest species, not each against its own
  peak.** Per-species normalisation would draw a 34-bird wader and a
  6,000-strong duck flock at the same height and quietly erase the subject.
- **One lane per species, rather than one shared space.** The jazz piece put
  every instrument in a single circle so the voices tangle and argue, which was
  right for a quartet. A dozen species doing that is an unreadable knot, and
  the one thing this piece must communicate is *how many different birds are
  still here*. Lanes trade the conversation for a headcount. A lane whose
  species is gone stays in place, dimmed, so the empty wedge still reads as
  something that used to be occupied.
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
