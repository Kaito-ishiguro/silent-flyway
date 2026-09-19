"""
Silent Flyway - composition pipeline.

Usage:
    .venv\\Scripts\\python analysis/compose.py [--plot]

This is the bird equivalent of the jazz sculpture's analyze.py, and it
produces exactly the same shape of output, so the viewer is the jazz viewer:

    jazz                            silent flyway
    ----------------------------    ----------------------------------
    one song                        the whole timeline, 1960 -> 2026
    Demucs splits it into stems     one stem per BIRD SPECIES
    stems are what Demucs found     stems are COMPOSED here from the
                                    species' own call recording
    time = seconds into the song    time = years across the flyway

Where analyze.py separates a recording it was given, this separates nothing:
it BUILDS the recording. Each species' field recording is re-triggered across
the timeline at a rate and a level set by that species' population, the
per-species tracks are summed into the mixdown the viewer plays, and each
track is then analyzed exactly as analyze.py analyzes a Demucs stem. Because
the stems are synthesized rather than separated there is no bleed, so a voice
is silent when and only when that species is silent.

The call recording is used at its FULL length, untouched apart from peak
normalization. Nothing is trimmed to a "best burst".

Outputs to data/silent-flyway/:
    audio.wav      the mixdown - what you hear
    features.json  meta + per-species stems, in analyze.py's schema
    check.png      per-species sanity strips (with --plot)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import librosa
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
CALLS = ROOT / "calls"
DATA = ROOT / "data"
SPECIES = ROOT / "species" / "species.json"

SLUG = "silent-flyway"
SR = 44100
FPS = 60                 # Arese's grid, same as the jazz sculpture
NATIVE_HOP = 512
FRAME_LEN = 2048

BAND_EDGES = np.array([40, 160, 400, 800, 1600, 3200, 6400, 12000, 16000], dtype=float)

# How many calls may be sounding at once when a species is at its historical
# peak. This is the single knob that decides whether a full flyway reads as a
# chorus or as mush, and it is expressed in overlap rather than calls-per-second
# because the recordings differ wildly in length - a 5 second trill and a 0.3
# second chirp cannot share a rate.
PEAK_OVERLAP = 3.2
MIN_RATE = 0.05          # a clinging remnant still calls, just rarely

# Per-call detune, as a playback-rate range. Set to 0 to play every call back
# exactly as recorded.
#
# A small amount of it is what stops one recording re-triggered a hundred times
# from reading as a loop instead of a flock - no two birds are identical, and
# detuning by resampling also shifts duration, which is what a different
# individual actually sounds like. The cost is that it is no longer the
# recording you collected. Fidelity wins here by explicit instruction: the
# calls you hear are the file, untouched.
DETUNE = 0.0


def rnd(arr, places=4):
    return np.round(np.asarray(arr, dtype=float), places).tolist()


def mulberry32(seed: int):
    """The same tiny PRNG the viewer used, so the piece is reproducible."""
    a = seed & 0xFFFFFFFF

    def nxt() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t = (t ^ (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return nxt


# -------------------------------------------------------------- populations

class Population:
    """Anchor points from the literature, interpolated - and honest about it.

    The sources give a peak count in 1974, a last sighting in 1999, a survey
    figure in 2006. They do not give a series. Anchors stay the source of
    truth; everything between them is derived, and `basis_at` reports whether
    a year is bracketed by two documented figures or is spanning a guess.
    """

    def __init__(self, sp: dict):
        self.anchors = sorted(sp["anchors"], key=lambda a: a["year"])
        self.peak = max(a["count"] for a in self.anchors)
        self.extirpated = sp.get("extirpated_year")

    def at(self, year: float) -> float:
        if self.extirpated is not None and year > self.extirpated:
            return 0.0
        a = self.anchors
        if year <= a[0]["year"]:
            return float(a[0]["count"])
        if year >= a[-1]["year"]:
            return float(a[-1]["count"])
        for i in range(1, len(a)):
            if year <= a[i]["year"]:
                p, q = a[i - 1], a[i]
                u = (year - p["year"]) / (q["year"] - p["year"])
                # smoothstep: populations do not fall in straight ramps with a
                # kink at every survey year, and the ear hears those kinks
                s = u * u * (3 - 2 * u)
                return p["count"] + (q["count"] - p["count"]) * s
        return 0.0

    def norm_at(self, year: float) -> float:
        return max(0.0, min(1.0, self.at(year) / (self.peak or 1)))

    def basis_at(self, year: float) -> str:
        """Weakest basis of the two anchors bracketing this year.

        A span is only as trustworthy as its weaker end, so a documented
        figure interpolated toward a placeholder does not launder the
        placeholder.
        """
        a = self.anchors
        for i in range(1, len(a)):
            if year <= a[i]["year"]:
                pair = {a[i - 1]["basis"], a[i]["basis"]}
                if "estimated" in pair:
                    return "estimated"
                if "secondary" in pair:
                    return "secondary"
                return "documented"
        return a[-1]["basis"]


# ------------------------------------------------------------------ scoring

def score(pop: Population, call_dur: float, timeline: dict, seed: int) -> list[dict]:
    """When this species calls, and how loudly, across the whole timeline.

    Population drives two things at once:
        how OFTEN it calls  (density)  - the variable that makes a collapse
                                         audible as thinning rather than as a
                                         fader being pulled
        how LOUD it calls   (gain)
    """
    y0, y1, dur = timeline["start_year"], timeline["end_year"], timeline["duration"]
    rand = mulberry32(0x5EED + seed * 7919)
    max_rate = PEAK_OVERLAP / max(0.25, call_dur)
    events: list[dict] = []

    t = rand() * 1.5
    while t < dur:
        year = y0 + (t / dur) * (y1 - y0)
        norm = pop.norm_at(year)
        if norm <= 0:
            break                                  # locally extinct, for good

        # sublinear: the last few birds must stay audible, or the ending reads
        # as a mixing decision instead of an extinction
        rate = MIN_RATE + (max_rate - MIN_RATE) * (norm ** 0.7)
        gain = 0.16 + 0.84 * (norm ** 0.8)

        events.append({
            "t": round(t, 3),
            "year": round(year, 2),
            "gain": round(gain, 4),
            "norm": round(norm, 4),
            "rate_shift": 1.0 + (rand() * 2 - 1) * DETUNE,
            "pan": round((rand() * 2 - 1) * 0.7, 3),
        })

        gap = (1.0 / rate) * (0.55 + rand() * 1.1)
        if rand() < 0.22 * norm:
            gap *= 0.25                            # birds answer each other
        t += max(0.08, gap)

    if events:
        events[-1]["last"] = True
    return events


def render(call: np.ndarray, events: list[dict], n: int) -> tuple[np.ndarray, np.ndarray]:
    """Lay the call down at every event. Returns (mono track, stereo track)."""
    mono = np.zeros(n, dtype=np.float32)
    stereo = np.zeros((n, 2), dtype=np.float32)

    for ev in events:
        r = ev["rate_shift"]
        if r == 1.0:
            shifted = call                     # the recording, sample for sample
            m = len(call)
        else:
            # resampling for detune also shifts duration slightly, which is
            # what a different individual actually sounds like
            m = max(2, int(len(call) / r))
            shifted = np.interp(np.linspace(0, len(call) - 1, m),
                                np.arange(len(call)), call).astype(np.float32)

        i0 = int(ev["t"] * SR)
        i1 = min(n, i0 + m)
        if i1 <= i0:
            continue
        seg = shifted[: i1 - i0] * ev["gain"]
        mono[i0:i1] += seg
        # equal-power pan keeps the flock spread across the stereo field
        p = (ev["pan"] + 1) * 0.25 * np.pi
        stereo[i0:i1, 0] += seg * np.cos(p)
        stereo[i0:i1, 1] += seg * np.sin(p)

    return mono, stereo


# ----------------------------------------------------------- stem features

def stem_features(y: np.ndarray, grid: np.ndarray) -> dict:
    """Identical grammar to analyze.py's stem_features, tuned for bird bands."""
    S = np.abs(librosa.stft(y, n_fft=FRAME_LEN, hop_length=NATIVE_HOP)) ** 2
    freqs = librosa.fft_frequencies(sr=SR, n_fft=FRAME_LEN)
    native_t = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=NATIVE_HOP)

    rms = librosa.feature.rms(S=np.sqrt(S), frame_length=FRAME_LEN, hop_length=NATIVE_HOP)[0]
    centroid = librosa.feature.spectral_centroid(S=np.sqrt(S), sr=SR)[0]

    band_energy = np.zeros((len(BAND_EDGES) - 1, S.shape[1]))
    for b in range(len(BAND_EDGES) - 1):
        mask = (freqs >= BAND_EDGES[b]) & (freqs < BAND_EDGES[b + 1])
        band_energy[b] = S[mask].sum(axis=0)
    dominant = band_energy.argmax(axis=0).astype(float)
    silent = rms < max(1e-5, 0.02 * (rms.max() + 1e-12))
    dominant[silent] = -1

    def to_grid(v, places=4):
        v = np.asarray(v, dtype=float)
        return rnd(np.interp(grid, native_t[: len(v)], v), places)

    peak = rms.max() + 1e-12
    feats = {
        "rms": to_grid(rms / peak),
        "centroid": to_grid(centroid, 1),
        "dominant_band": np.round(
            np.interp(grid, native_t[: len(dominant)], dominant)).astype(int).tolist(),
        "energy_share": float(np.mean(rms ** 2)),
    }

    # Pitch, which drives altitude in the viewer, so getting the octave wrong
    # visibly lifts a whole species off its proper height.
    #
    # Two ways pYIN goes wrong on wetland recordings:
    #   - a trill defeats it. A rattle at fifteen pulses a second reads as
    #     unvoiced throughout, and the species gets pinned at one altitude.
    #   - a steady background tone captures it. Field recordings often carry a
    #     continuous whine - encoder artifact, mic hiss, electrical hum - that
    #     is present in every frame INCLUDING the silences, so pYIN happily
    #     tracks it for most of the clip and reports the artifact as the bird.
    #
    # The defence against both is to measure pitch only where the bird is
    # actually calling, and to cross-check pYIN against it. The spectral peak
    # over loud frames is what "pitch" means for a tonal call anyway.
    loud = rms > 0.45 * rms.max()
    band = (freqs >= 700) & (freqs <= 8000)
    peak_track = freqs[band][S[band].argmax(axis=0)]
    peak_med = float(np.median(peak_track[loud])) if loud.any() else 0.0

    f0, voiced, _ = librosa.pyin(y, sr=SR, fmin=700, fmax=8000,
                                 frame_length=FRAME_LEN, hop_length=NATIVE_HOP,
                                 fill_na=0.0)
    f0 = np.nan_to_num(f0)
    voiced = np.nan_to_num(np.asarray(voiced, dtype=float))

    pyin_loud = f0[loud & (f0 > 0)]
    pyin_med = float(np.median(pyin_loud)) if pyin_loud.size else 0.0
    untracked = (voiced > 0.4).mean() < 0.15
    off_octave = (peak_med > 0 and pyin_med > 0
                  and abs(np.log2(pyin_med / peak_med)) > 0.7)

    if untracked or off_octave:
        f0 = peak_track * (~silent)
        voiced = (~silent).astype(float)
        feats["pitch_source"] = "spectral-peak"
        why = "pYIN could not track it" if untracked else (
            f"pYIN sat {np.log2(pyin_med / peak_med):+.1f} octaves off "
            f"({pyin_med:.0f} Hz vs {peak_med:.0f} Hz) - a background tone or "
            f"a harmonic, not the bird")
        print(f"    pitch: using the spectral peak, {peak_med:.0f} Hz ({why})")
    else:
        feats["pitch_source"] = "pyin"

    feats["f0"] = to_grid(f0, 1)
    feats["voiced"] = to_grid(voiced, 2)

    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=NATIVE_HOP)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=SR,
                                        hop_length=NATIVE_HOP, backtrack=False)
    times = librosa.frames_to_time(frames, sr=SR, hop_length=NATIVE_HOP)
    envn = env / (env.max() + 1e-12)
    feats["onsets"] = [
        {"t": round(float(t), 3), "s": round(float(envn[f]), 3),
         "c": round(float(centroid[min(f, len(centroid) - 1)]), 1),
         "a": round(float(rms[min(f, len(rms) - 1)] / peak), 3)}
        for t, f in zip(times, frames)
    ]
    voiced_f0 = f0[f0 > 0]
    feats["median_hz"] = round(float(np.median(voiced_f0)) if voiced_f0.size else 0.0, 1)
    return feats


# ---------------------------------------------------------------------- run

def compose(plot: bool) -> None:
    cfg = json.loads(SPECIES.read_text(encoding="utf-8"))
    metrics = cfg.get("_metrics", {})
    tl = cfg["timeline"]
    y0, y1 = tl["start_year"], tl["end_year"]
    tl["duration"] = ((y1 - y0) / 10) * tl["seconds_per_decade"]
    dur = tl["duration"]
    n = int(dur * SR)
    grid = np.arange(0, dur, 1.0 / FPS)

    print(f"[timeline] {y0}-{y1} over {dur:.1f}s "
          f"({tl['seconds_per_decade']}s per decade)")

    out = DATA / SLUG
    out.mkdir(parents=True, exist_ok=True)

    mixdown = np.zeros((n, 2), dtype=np.float32)
    stems: dict[str, dict] = {}
    species_meta: list[dict] = []
    tracks: dict[str, np.ndarray] = {}

    for i, sp in enumerate(cfg["species"]):
        slug = sp["slug"]
        src = CALLS / f"{slug}.wav"
        pop = Population(sp)

        # A species with no recording yet is still part of the piece. It keeps
        # its lane, its colour, its decline ring, its row on the scoreboard and
        # its mark on the year clock - it simply has no voice. Some of these
        # birds are silent in Hong Kong anyway (the pelican and the ibis were
        # never heard here), so silence is not always a gap waiting to be
        # filled; for those it is the truth.
        has_audio = src.exists()
        events: list[dict] = []
        call_dur = 0.0

        if has_audio:
            # the recording, whole. Peak-normalized so species sit at
            # comparable levels, and NOT trimmed - its length is part of its
            # voice.
            call, _ = librosa.load(src, sr=SR, mono=True)
            call = (call / (np.abs(call).max() + 1e-12) * 0.9).astype(np.float32)
            call_dur = len(call) / SR
            events = score(pop, call_dur, tl, i)
            mono, stereo = render(call, events, n)
            mixdown += stereo
            tracks[slug] = mono

        ext_t = None
        if sp.get("extirpated_year") is not None:
            ext_t = round((sp["extirpated_year"] - y0) / (y1 - y0) * dur, 2)

        curve = [round(pop.at(y), 2) for y in range(y0, y1 + 1)]
        basis = [pop.basis_at(y) for y in range(y0, y1 + 1)]

        metric = sp.get("metric", "peak_winter_count")
        species_meta.append({
            "slug": slug,
            "common_name": sp["common_name"],
            "scientific_name": sp.get("scientific_name", ""),
            "color": sp.get("color", "#8fd8ff"),
            "iucn": sp.get("iucn", ""),
            "habitat": sp.get("habitat", ""),
            "metric": metric,
            "metric_label": metrics.get(metric, {}).get("label", metric),
            "metric_unit": metrics.get(metric, {}).get("unit", "individuals"),
            # Only species measured the same way may share an absolute axis.
            # An atlas occupancy percentage and a duck count are both "numbers"
            # and mean nothing side by side.
            "comparable": bool(metrics.get(metric, {}).get("comparable", False)),
            "threats": sp.get("threats", []),
            "extirpated_year": sp.get("extirpated_year"),
            "extirpated_t": ext_t,
            "peak": pop.peak,
            "now": round(pop.at(y1), 1),
            "decline": round(1 - pop.at(y1) / (pop.peak or 1), 4),
            "has_audio": has_audio,
            "calls": len(events),
            "call_duration": round(call_dur, 3),
            "curve": curve,
            "basis": basis,
            "anchors": sp["anchors"],
        })
        n_est = sum(1 for a in sp["anchors"] if a["basis"] == "estimated")
        flag = f"  [!] {n_est}/{len(sp['anchors'])} anchors are PLACEHOLDERS" if n_est else ""
        voice = (f"call {call_dur:.2f}s  {len(events):>4} calls"
                 if has_audio else "SILENT - no recording yet ")
        print(f"  [{slug[:26]:<26}] {voice}  "
              f"{metrics.get(metric, {}).get('label', metric)} "
              f"{pop.peak} -> {pop.at(y1):.0f}{flag}")

    if not tracks:
        sys.exit("no species had a recording in calls/ - nothing to compose")

    # one shared headroom scale, so relative loudness between species survives
    peak = np.abs(mixdown).max()
    if peak > 0:
        mixdown = mixdown / peak * 0.89
    sf.write(out / "audio.wav", mixdown, SR)
    print(f"[write] {out/'audio.wav'}  {dur:.1f}s stereo")

    for slug, mono in tracks.items():
        print(f"  [analyze] {slug}")
        stems[slug] = stem_features(mono, grid)

    total_energy = sum(s["energy_share"] for s in stems.values()) or 1.0
    for sm in species_meta:
        st = stems.get(sm["slug"])
        if st:
            sm["median_hz"] = st["median_hz"]
            sm["share"] = round(st["energy_share"] / total_energy, 4)

    years = [round((y - y0) / (y1 - y0) * dur, 3) for y in range(y0, y1 + 1)]
    extinct = [s for s in species_meta if s["extirpated_year"] is not None]

    meta = {
        "title": "Silent Flyway",
        "slug": SLUG,
        "duration": round(dur, 2),
        "fps": FPS,
        "audio": "audio.wav",
        "start_year": y0,
        "end_year": y1,
        "seconds_per_decade": tl["seconds_per_decade"],
        "species_count": len(species_meta),
        "extinct_count": len(extinct),
        "calls_total": sum(s["calls"] for s in species_meta),
        "peak_total": sum(s["peak"] for s in species_meta),
        "now_total": round(sum(s["now"] for s in species_meta), 1),
    }
    meta["decline_total"] = round(1 - meta["now_total"] / (meta["peak_total"] or 1), 4)

    result = {"meta": meta, "years": years, "species": species_meta, "stems": stems}
    (out / "features.json").write_text(json.dumps(result, separators=(",", ":")),
                                       encoding="utf-8")
    size = (out / "features.json").stat().st_size / 1e6
    print(f"[write] {out/'features.json'}  ({size:.1f} MB)")

    (DATA / "index.json").write_text(json.dumps(
        [{"slug": SLUG, "title": meta["title"], "duration": meta["duration"]}],
        indent=1), encoding="utf-8")

    silent = [s for s in species_meta if not s["has_audio"]]
    print(f"[done] {meta['species_count']} species "
          f"({meta['species_count'] - len(silent)} with a voice, {len(silent)} silent), "
          f"{meta['calls_total']} calls, {meta['extinct_count']} locally extinct")
    if silent:
        print(f"  awaiting recordings in calls/: "
              f"{', '.join(s['slug'] + '.wav' for s in silent)}")

    # Say it every single build. The whole argument of this piece is that the
    # sound is the data, which is worth nothing if the data is invented.
    placeholders = [s for s in species_meta
                    if any(a["basis"] == "estimated" for a in s["anchors"])]
    if placeholders:
        print()
        print("  " + "!" * 68)
        print("  PLACEHOLDER DATA IN THIS BUILD - do not present it as fact:")
        for s in placeholders:
            n = sum(1 for a in s["anchors"] if a["basis"] == "estimated")
            print(f"    {s['common_name']}: {n} of {len(s['anchors'])} anchors estimated")
        print("  See docs/data-research-prompt.md for sourcing the real figures.")
        print("  " + "!" * 68)

    mixed = {s["metric"] for s in species_meta}
    if len(mixed) > 1:
        print(f"\n  [metrics] this build mixes {len(mixed)} metrics: "
              f"{', '.join(sorted(mixed))}")
        print("            species are scaled within their own metric, never across")

    if plot:
        sanity_plot(result, out)


def sanity_plot(result: dict, out_dir: Path) -> None:
    """Per-species strips: eyeball the decline before trusting the 3D."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    stems = result["stems"]
    sp_by_slug = {s["slug"]: s for s in result["species"]}
    fps = result["meta"]["fps"]
    fig, axes = plt.subplots(len(stems), 1, figsize=(14, 2.4 * len(stems)), sharex=True)
    for ax, (slug, s) in zip(np.atleast_1d(axes), stems.items()):
        sp = sp_by_slug[slug]
        t = np.arange(len(s["rms"])) / fps
        ax.plot(t, s["rms"], lw=0.5, color=sp["color"], label="call level")
        # the population curve the level is supposed to be following
        yy = np.linspace(0, t[-1] if len(t) else 1, len(sp["curve"]))
        ax.plot(yy, np.array(sp["curve"]) / (sp["peak"] or 1), lw=1.6,
                color="#ffffff", alpha=0.65, label="population (norm)")
        if sp["extirpated_t"] is not None:
            ax.axvline(sp["extirpated_t"], color="#ff3b3b", lw=1.4)
        ax.set_ylabel(f"{sp['common_name']}\n{sp['peak']} -> {sp['now']:.0f}", fontsize=7)
        # headroom, or the population curve rides the top frame and vanishes
        ax.set_ylim(-0.03, 1.18)
        ax.legend(loc="upper right", fontsize=6)
    np.atleast_1d(axes)[-1].set_xlabel("time (s)   /   1960 - 2026")
    fig.suptitle(f"{result['meta']['title']} - {result['meta']['calls_total']} calls, "
                 f"{result['meta']['extinct_count']} locally extinct")
    fig.tight_layout()
    fig.savefig(out_dir / "check.png", dpi=110)
    print(f"  sanity plot -> {out_dir/'check.png'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--plot", action="store_true", help="save per-species sanity strips")
    compose(ap.parse_args().plot)
