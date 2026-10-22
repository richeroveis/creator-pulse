"""Build the demo video from the real Playwright screen recordings of the UI run.

Each browser session in tools/drive_ui_flow.py records a webm under artifacts/video.
This stitches them in session creation order, speeds the long consensus waits down,
scales to 1280x720 and encodes a single libx264 mp4 with the ffmpeg binary bundled in
imageio-ffmpeg (so no system ffmpeg is needed). The result is written to docs and
mirrored into frontend/public for the Pages deploy.

Run: python tools/build_demo_video.py
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
VIDEO_DIR = ROOT / "artifacts" / "video"
SEG_DIR = ROOT / "artifacts" / "video_segments"
EVIDENCE = ROOT / "evidence" / "ui_flow_verification.json"
DOCS_OUT = ROOT / "docs" / "demo-video-subtitled.mp4"
PUBLIC_OUT = ROOT / "frontend" / "public" / "demo-video-subtitled.mp4"

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SPEED = 10            # consensus waiting is fast forwarded
MAX_REAL_SECONDS = 260  # cap each session so the final clip stays short

CAPTIONS = [
    "Brand funds a campaign with real inputs",
    "Creator submits a public proof URL",
    "Curator stakes CPT behind the deliverable",
    "Verify runs the consensus audit, then claim settlement",
    "Brand opens a second campaign for recovery",
    "Creator submits an unreachable proof page",
    "Neutral recovery returns every stake and bond",
]


def collect_sources() -> list[Path]:
    # Order the real recordings by the time each browser session opened, so the
    # stitched clip reads as a narrative: create, submit, curate, verify, claim, then
    # the recovery campaign setup, submit of the dead proof, curate and recover.
    webms = [p for p in VIDEO_DIR.glob("*.webm") if p.stat().st_size > 0]
    return sorted(webms, key=lambda p: p.stat().st_ctime)


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd[:6])}")


def encode_segment(source: Path, index: int, with_caption: bool) -> Path:
    SEG_DIR.mkdir(parents=True, exist_ok=True)
    out = SEG_DIR / f"seg{index:02d}.mp4"
    caption = CAPTIONS[index] if index < len(CAPTIONS) else "CreatorPulse live studionet flow"
    filters = f"setpts=PTS/{SPEED},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24"
    if with_caption:
        safe = caption.replace(":", " ").replace("'", "")
        filters += (
            f",drawtext=fontfile=C\\:/Windows/Fonts/tahoma.ttf:text='{safe}'"
            ":x=40:y=h-70:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12"
        )
    cmd = [
        FFMPEG, "-y", "-loglevel", "error", "-i", str(source), "-t", str(MAX_REAL_SECONDS),
        "-vf", filters, "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
        str(out),
    ]
    run(cmd)
    return out


def encode_segment_safe(source: Path, index: int) -> Path:
    try:
        return encode_segment(source, index, with_caption=True)
    except SystemExit:
        # tahoma or drawtext unavailable: retry without the caption overlay
        SEG_DIR.mkdir(parents=True, exist_ok=True)
        out = SEG_DIR / f"seg{index:02d}.mp4"
        filters = f"setpts=PTS/{SPEED},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24"
        run([
            FFMPEG, "-y", "-loglevel", "error", "-i", str(source), "-t", str(MAX_REAL_SECONDS),
            "-vf", filters, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
            "-pix_fmt", "yuv420p", str(out),
        ])
        return out


def main() -> int:
    sources = collect_sources()
    if not sources:
        print("no webm recordings found under artifacts/video, run the browser driver first", file=sys.stderr)
        return 2
    print(f"sources: {len(sources)} sessions")
    segments = [encode_segment_safe(src, i) for i, src in enumerate(sources)]

    list_file = SEG_DIR / "concat.txt"
    list_file.write_text("".join(f"file '{seg.as_posix()}'\n" for seg in segments), encoding="utf-8")
    DOCS_OUT.parent.mkdir(parents=True, exist_ok=True)
    run([
        FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(list_file), "-c", "copy", "-movflags", "+faststart", str(DOCS_OUT),
    ])

    digest = hashlib.sha256(DOCS_OUT.read_bytes()).hexdigest()
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_bytes(DOCS_OUT.read_bytes())
    size_mb = DOCS_OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {DOCS_OUT} ({size_mb:.2f} MB) sha256 {digest}")
    print(f"mirrored {PUBLIC_OUT}")
    print(digest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
