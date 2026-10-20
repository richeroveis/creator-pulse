"""Synthesize the 48 second ambient electronic soundtrack for the demo video.

Pure numpy synthesis: four chord pads, a slow sub bass pulse, a delayed
arpeggio and a soft heartbeat kick. Output is 16 bit stereo PCM.
"""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 44100
DURATION = 48.0
BPM = 80.0
BEAT = 60.0 / BPM

# A minor colour: Am9, Fmaj7, Cmaj9, G6, one bar each, four bars of 12 seconds.
CHORDS = [
    [110.00, 261.63, 329.63, 493.88],
    [87.31, 220.00, 261.63, 329.63],
    [130.81, 261.63, 329.63, 392.00],
    [98.00, 246.94, 293.66, 392.00],
]


def adsr(length: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    env = np.zeros(length)
    a = int(attack * SAMPLE_RATE)
    d = int(decay * SAMPLE_RATE)
    r = int(release * SAMPLE_RATE)
    a = min(a, length)
    d = min(d, max(0, length - a))
    r = min(r, max(0, length - a - d))
    s = max(0, length - a - d - r)
    if a:
        env[:a] = np.linspace(0, 1, a, endpoint=False)
    if d:
        env[a : a + d] = np.linspace(1, sustain, d, endpoint=False)
    if s:
        env[a + d : a + d + s] = sustain
    if r:
        env[a + d + s :] = np.linspace(sustain, 0, r, endpoint=False)
    return env


def pad_track(t: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    bar = DURATION / len(CHORDS)
    for index, chord in enumerate(CHORDS):
        start = index * bar
        end = start + bar
        mask = (t >= start) & (t < end)
        local = t[mask] - start
        env = adsr(len(local), attack=1.6, decay=1.2, sustain=0.62, release=2.2)
        voice = np.zeros_like(local)
        for freq in chord:
            voice += np.sin(2 * math.pi * freq * local) * 0.55
            voice += np.sin(2 * math.pi * freq * 2.002 * local + 0.3) * 0.08
            voice += np.sin(2 * math.pi * freq * 0.5 * local) * 0.16
        out[mask] += voice * env
    return out


def bass_track(t: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    bar = DURATION / len(CHORDS)
    for index, chord in enumerate(CHORDS):
        root = chord[0] / 2
        start = index * bar
        for pulse in range(6):
            at = start + pulse * 2.0
            length = 1.4
            mask = (t >= at) & (t < at + length)
            local = t[mask] - at
            env = adsr(len(local), attack=0.02, decay=0.4, sustain=0.35, release=0.9)
            out[mask] += np.sin(2 * math.pi * root * local) * env * 0.5
    return out


def arp_track(t: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    step = BEAT / 2
    total_steps = int(DURATION / step)
    for step_index in range(total_steps):
        at = step_index * step
        chord = CHORDS[int(at // (DURATION / len(CHORDS))) % len(CHORDS)]
        freq = chord[(step_index % 3) + 1] * 2
        length = 0.5
        mask = (t >= at) & (t < at + length)
        local = t[mask] - at
        env = adsr(len(local), attack=0.005, decay=0.12, sustain=0.18, release=0.3)
        tone = np.sin(2 * math.pi * freq * local) + 0.3 * np.sin(2 * math.pi * freq * 2 * local)
        out[mask] += tone * env * 0.12
    return out


def echo(signal: np.ndarray, delay: float, feedback: float) -> np.ndarray:
    out = signal.copy()
    shift = int(delay * SAMPLE_RATE)
    for repeat in range(1, 4):
        offset = shift * repeat
        if offset >= len(signal):
            break
        out[offset:] += signal[:-offset] * (feedback ** repeat)
    return out


def kick_track(t: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    for index in range(int(DURATION / 2.0)):
        at = index * 2.0
        length = 0.7
        mask = (t >= at) & (t < at + length)
        local = t[mask] - at
        env = adsr(len(local), attack=0.004, decay=0.25, sustain=0.0, release=0.4)
        sweep = 52 + 40 * np.exp(-local * 9)
        out[mask] += np.sin(2 * math.pi * sweep * local) * env * 0.55
    return out


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    alpha = 1 - math.exp(-2 * math.pi * cutoff / SAMPLE_RATE)
    out = np.zeros_like(signal)
    acc = 0.0
    for index in range(len(signal)):
        acc += alpha * (signal[index] - acc)
        out[index] = acc
    return out


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    artifacts = root / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)

    t = np.arange(int(SAMPLE_RATE * DURATION)) / SAMPLE_RATE
    pad = lowpass(pad_track(t), 1800.0) * 0.32
    bass = bass_track(t) * 0.28
    arp = echo(arp_track(t), 0.36, 0.32) * 0.7
    kick = kick_track(t) * 0.32
    noise = np.random.default_rng(7).normal(0, 1, len(t))
    hiss = lowpass(noise, 600.0) * 0.015

    mix = pad + bass + arp + kick + hiss
    fade = np.ones_like(mix)
    fade_in = int(2.0 * SAMPLE_RATE)
    fade_out = int(3.0 * SAMPLE_RATE)
    fade[:fade_in] = np.linspace(0, 1, fade_in)
    fade[-fade_out:] = np.linspace(1, 0, fade_out)
    mix *= fade

    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix / peak * 0.82
    left = mix
    right = np.roll(mix, int(0.012 * SAMPLE_RATE)) * 0.96
    stereo = np.stack([left, right], axis=1)
    pcm = np.clip(stereo, -1.0, 1.0)
    pcm = (pcm * 32767).astype(np.int16)

    target = artifacts / "soundtrack.wav"
    with wave.open(str(target), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())
    print(f"wrote {target} ({target.stat().st_size / 1024:.0f} KB, {DURATION:.0f}s)")


if __name__ == "__main__":
    main()
