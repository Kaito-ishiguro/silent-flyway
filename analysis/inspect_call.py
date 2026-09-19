"""
Silent Flyway - recording diagnostic.

Usage:
    .venv\\Scripts\\python analysis/inspect_call.py <slug>

Look at a field recording before it goes into the piece. This writes nothing
except a picture; compose.py is the only thing that builds anything.

Worth running on every new recording, because a wetland recording can contain
almost anything: the bird, another bird, an insect, wind, traffic, a narrator,
or the video's background music. The spectrogram answers that in one glance -
a call is a harmonic stack that moves, a cicada is a rigidly regular band, and
music has steady pitched tones that hold.

Reports:
    how much of the clip is actually loud (continuous call vs isolated bursts)
    candidate call bursts, scored by level and tonality
    trill rate, if the call is a pulse train
    pitch, and whether pYIN could track it or the spectral peak was needed
    data/<slug>__inspect.png - spectrogram + envelope
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import librosa

ROOT = Path(__file__).resolve().parent.parent
CALLS = ROOT / "calls"
DATA = ROOT / "data"

SR = 44100
NATIVE_HOP = 512
FRAME_LEN = 2048


def find_bursts(y, floor_pct=70.0, min_ms=80, gap_ms=120, pad_ms=40):
    """Contiguous runs above the clip's own noise floor."""
    rms = librosa.feature.rms(y=y, frame_length=FRAME_LEN, hop_length=NATIVE_HOP)[0]
    floor = np.percentile(rms, floor_pct)
    hot = rms > floor + 0.35 * (rms.max() - floor)

    fpm = SR / NATIVE_HOP / 1000
    min_f, gap_f, pad_f = int(min_ms * fpm), int(gap_ms * fpm), int(pad_ms * fpm)

    runs, start = [], None
    for i, on in enumerate(hot):
        if on and start is None:
            start = i
        elif not on and start is not None:
            runs.append((start, i)); start = None
    if start is not None:
        runs.append((start, len(hot)))

    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] <= gap_f:
            merged[-1][1] = b
        else:
            merged.append([a, b])

    return [(max(0, a - pad_f) * NATIVE_HOP, min(len(y), (b + pad_f) * NATIVE_HOP))
            for a, b in merged if b - a >= min_f]


def burst_score(y, s, e):
    """Level times tonality. Loud is not enough - a door slam is loud."""
    seg = y[s:e]
    if len(seg) < FRAME_LEN:
        return 0.0
    peak = float(np.abs(seg).max())
    flat = float(librosa.feature.spectral_flatness(
        y=seg, n_fft=FRAME_LEN, hop_length=NATIVE_HOP)[0].mean())
    return peak * (1.0 - flat)


def pulse_period(y):
    """Seconds per pulse if the call is a trill, else 0."""
    rms = librosa.feature.rms(y=y, frame_length=FRAME_LEN, hop_length=256)[0]
    if len(rms) < 8:
        return 0.0
    env = rms - rms.mean()
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    ac /= (ac[0] + 1e-12)
    lag = np.arange(len(ac)) * 256 / SR
    win = (lag > 0.02) & (lag < 0.5)
    if not win.any():
        return 0.0
    i = int(np.argmax(ac[win]))
    return float(lag[win][i]) if ac[win][i] > 0.35 else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="species slug; expects calls/<slug>.wav")
    args = ap.parse_args()

    src = CALLS / f"{args.slug}.wav"
    if not src.exists():
        sys.exit(f"no recording at {src}")

    y, _ = librosa.load(src, sr=SR, mono=True)
    dur = len(y) / SR
    print(f"[load] {src.name}  {dur:.2f}s")

    S = np.abs(librosa.stft(y, n_fft=FRAME_LEN, hop_length=NATIVE_HOP))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=FRAME_LEN)
    rms = librosa.feature.rms(S=S, frame_length=FRAME_LEN, hop_length=NATIVE_HOP)[0]
    loud = rms > 0.5 * rms.max()
    print(f"[level] {loud.mean()*100:.0f}% of the clip is near peak -> "
          + ("one continuous call" if loud.mean() > 0.45 else "isolated bursts"))

    flat = librosa.feature.spectral_flatness(S=S)[0]
    print(f"[tone]  flatness while loud {flat[loud].mean():.4f}  "
          f"(tonal < 0.01, noisy > 0.1)")

    band = (freqs >= 300) & (freqs <= 12000)
    dom = freqs[band][S[band].argmax(axis=0)]
    print(f"[freq]  dominant while loud: median {np.median(dom[loud]):.0f} Hz, "
          f"range {dom[loud].min():.0f}-{dom[loud].max():.0f} Hz")

    p = pulse_period(y)
    if p:
        print(f"[trill] pulse train at {1/p:.1f} pulses/s ({p*1000:.0f} ms apart)")
    else:
        print("[trill] no regular pulse train")

    bursts = find_bursts(y)
    for i, (s, e) in enumerate(bursts, 1):
        print(f"  burst {i}: {s/SR:6.2f}s - {e/SR:6.2f}s  ({(e-s)/SR:.2f}s)  "
              f"score {burst_score(y, s, e):.4f}")

    f0, voiced, _ = librosa.pyin(y, sr=SR, fmin=700, fmax=8000,
                                 frame_length=FRAME_LEN, hop_length=NATIVE_HOP,
                                 fill_na=0.0)
    vfrac = float((np.nan_to_num(voiced) > 0.4).mean())
    peak_hz = float(np.median(dom[loud]))
    f0 = np.nan_to_num(f0)
    pyin_hz = float(np.median(f0[f0 > 0])) if (f0 > 0).any() else 0.0

    if vfrac < 0.15:
        print(f"[pitch] pYIN tracked only {vfrac*100:.0f}% of frames - compose.py "
              f"will use the spectral peak, {peak_hz:.0f} Hz")
    else:
        print(f"[pitch] pYIN tracked {vfrac*100:.0f}% of frames, "
              f"median {pyin_hz:.0f} Hz; spectral peak {peak_hz:.0f} Hz")
        # A pYIN estimate an octave above the spectral peak means it locked
        # onto a harmonic instead of the fundamental - common on a short,
        # sparsely-voiced clip. compose.py analyzes the whole composed track,
        # where there is far more of the call to lock onto, so it usually
        # settles on the true fundamental; this is a heads-up, not a fault.
        if peak_hz > 0 and abs(np.log2(pyin_hz / peak_hz)) > 0.7:
            print(f"        ^ that is ~{np.log2(pyin_hz/peak_hz):+.1f} octaves off the "
                  f"spectral peak - pYIN is probably locked to a harmonic here")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(2, 1, figsize=(12, 7), constrained_layout=True,
                              height_ratios=[3, 1])
        D = librosa.amplitude_to_db(
            np.abs(librosa.stft(y, n_fft=2048, hop_length=256)), ref=np.max)
        librosa.display.specshow(D, sr=SR, hop_length=256, x_axis="time",
                                 y_axis="log", ax=ax[0])
        for s, e in bursts:
            ax[0].axvspan(s / SR, e / SR, color="#ff3b3b", alpha=0.12)
        ax[0].set_title(f"{args.slug} - whole recording "
                        f"(compose.py uses ALL {dur:.2f}s of it)")
        t = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=NATIVE_HOP)
        ax[1].plot(t, rms / rms.max(), lw=0.7, color="#1f77b4")
        ax[1].set_ylabel("level")
        ax[1].set_xlabel("time (s)")
        out = DATA / f"{args.slug}__inspect.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(out, dpi=110)
        plt.close(fig)
        print(f"[write] {out}")
    except ImportError:
        print("[plot] matplotlib not installed - skipping the picture")


if __name__ == "__main__":
    main()
