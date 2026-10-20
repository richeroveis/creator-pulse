"""Render the 48 second subtitled demo video with a burned-in soundtrack.

Frames are drawn with PIL at 1280x720 and piped to ffmpeg together with the
synthesized WAV. If artifacts/shots/home.png exists (a real screenshot of the
deployed page) it is composited into the closing scene instead of a mock.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
EVIDENCE = ROOT / "evidence" / "studionet_deployment.json"
OUT = ROOT / "docs" / "demo-video-subtitled.mp4"
SOUNDTRACK = ARTIFACTS / "soundtrack.wav"

W, H = 1280, 720
FPS = 25
SCENE_SECONDS = 6.0
SCENES = 8
TOTAL = int(SCENE_SECONDS * SCENES)

BG = (11, 7, 22)
BG_LIGHT = (24, 15, 46)
MAGENTA = (255, 61, 206)
VIOLET = (139, 92, 246)
EMERALD = (52, 245, 176)
AMBER = (255, 181, 71)
ICE = (125, 211, 252)
WHITE = (244, 241, 255)
MUTED = (150, 143, 175)

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        name = "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"
    else:
        name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)


def gradient() -> Image.Image:
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    for y in range(H):
        t = y / H
        color = (
            int(BG_LIGHT[0] + (BG[0] - BG_LIGHT[0]) * t),
            int(BG_LIGHT[1] + (BG[1] - BG_LIGHT[1]) * t),
            int(BG_LIGHT[2] + (BG[2] - BG_LIGHT[2]) * t),
        )
        draw.line([(0, y), (W, y)], fill=color)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([-260, -240, 620, 420], fill=(255, 61, 206, 70))
    gdraw.ellipse([820, -180, 1500, 380], fill=(139, 92, 246, 74))
    gdraw.ellipse([300, 520, 1100, 900], fill=(52, 245, 176, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    return Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")


def wrap(text: str, fnt: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if fnt.getlength(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    fnt: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    width: int,
    line_gap: int = 10,
) -> int:
    x, y = xy
    lines = wrap(text, fnt, width)
    ascent, descent = fnt.getmetrics()
    step = ascent + descent + line_gap
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += step
    return y


def card(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    accent: tuple[int, int, int],
    alpha: int = 26,
) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=18, fill=(255, 255, 255, 10), outline=(255, 255, 255, 26), width=1)
    draw.rounded_rectangle((x0, y0, x0 + 5, y1), radius=3, fill=accent + (alpha + 200,))


def header(draw: ImageDraw.ImageDraw, index: int) -> None:
    draw.text((56, 34), "CREATORPULSE", font=font(15, bold=True), fill=WHITE)
    draw.text((56, 55), "STUDIONET 61999", font=font(11, mono=True), fill=MUTED)
    draw.text((W - 56 - 90, 36), f"{index + 1:02d} / {SCENES:02d}", font=font(13, mono=True), fill=MUTED)
    draw.line([(56, 84), (W - 56, 84)], fill=(255, 255, 255, 24), width=1)


def subtitle(draw: ImageDraw.ImageDraw, lines: list[str]) -> None:
    fnt = font(23)
    wrapped: list[str] = []
    for line in lines:
        wrapped.extend(wrap(line, fnt, W - 240))
    height = 26 + len(wrapped) * 34
    y0 = H - height - 26
    draw.rounded_rectangle((80, y0, W - 80, H - 26), radius=14, fill=(5, 3, 12, 222), outline=(255, 255, 255, 26))
    y = y0 + 14
    for line in wrapped:
        width = fnt.getlength(line)
        draw.text(((W - width) / 2, y), line, font=fnt, fill=(255, 255, 255))
        y += 34


def paste_screenshot(base: Image.Image, path: Path, box: tuple[int, int]) -> None:
    shot = Image.open(path).convert("RGB")
    target_w = 520
    ratio = target_w / shot.width
    shot = shot.resize((target_w, int(shot.height * ratio)), Image.LANCZOS)
    target_h = 380
    if shot.height > target_h:
        shot = shot.crop((0, 0, target_w, target_h))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), radius=16, fill=255)
    base.paste(shot, box, mask)
    ImageDraw.Draw(base).rounded_rectangle(
        (box[0], box[1], box[0] + shot.width, box[1] + shot.height),
        radius=16,
        outline=(255, 255, 255, 60),
        width=1,
    )


def load_evidence() -> dict:
    if EVIDENCE.exists():
        return json.loads(EVIDENCE.read_text(encoding="utf-8"))
    return {}


def scene_one(draw: ImageDraw.ImageDraw, frame: Image.Image, t: float) -> None:
    logo = Image.open(ROOT / "docs" / "logo.png").convert("RGB")
    size = 150 + int(6 * math.sin(t * 1.4))
    logo = logo.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.2), fill=255)
    frame.paste(logo, (100, 180), mask)
    draw.text((300, 196), "CreatorPulse", font=font(64, bold=True), fill=WHITE)
    draw.text((302, 282), "AI verified sponsorship settlement", font=font(24), fill=MUTED)
    draw.text((302, 330), "GenLayer Intelligent Contract", font=font(16, mono=True), fill=MAGENTA)
    draw.text((100, 400), "Sponsorship money that settles on proof, not promises.", font=font(30, bold=True), fill=WHITE)
    for index, (label, color) in enumerate(
        [("FUNDED VAULT", MAGENTA), ("CONSENSUS AUDIT", VIOLET), ("BAND PAYOUT", EMERALD)]
    ):
        x = 100 + index * 330
        card(draw, (x, 470, x + 300, 570), color)
        draw.text((x + 22, 492), label, font=font(13, bold=True, mono=True), fill=color)
        draw.text((x + 22, 520), ["CPT custody", "5 validators", "exact split"][index], font=font(17), fill=WHITE)


def scene_two(draw: ImageDraw.ImageDraw) -> None:
    draw.text((56, 130), "The settlement gap", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 195), "Three questions nobody can audit today.", font=font(22), fill=MUTED)
    rows = [
        ("Did the creator deliver the brief?", "Claimed in a caption, checked in a spreadsheet.", AMBER),
        ("Was the disclosure actually shown?", "Screenshots disappear, posts get edited.", MAGENTA),
        ("Is the engagement organic?", "Bots inflate reach, budgets pay for it.", VIOLET),
    ]
    for index, (question, detail, color) in enumerate(rows):
        y = 270 + index * 100
        card(draw, (56, y, 1080, y + 78), color)
        draw.text((84, y + 16), question, font=font(22, bold=True), fill=WHITE)
        draw.text((84, y + 46), detail, font=font(16), fill=MUTED)
    draw.text((56, 600), "Result: creators wait, brands overpay, and no one can replay the decision.", font=font(18), fill=ICE)


def scene_three(draw: ImageDraw.ImageDraw, evidence: dict) -> None:
    draw.text((56, 130), "Funded campaign vault", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 195), "The brand pre-funds the maximum liability in CPT.", font=font(22), fill=MUTED)
    address = evidence.get("contract", {}).get("address", "0x...")
    rows = [
        ("create_campaign", "base reward + viral bonus pool", MAGENTA),
        ("vault_custody_balance", "locked before anyone submits", VIOLET),
        ("max liability rule", "100 percent of base plus bonus", EMERALD),
    ]
    for index, (title, detail, color) in enumerate(rows):
        y = 265 + index * 92
        card(draw, (56, y, 700, y + 72), color)
        draw.text((84, y + 12), title, font=font(17, bold=True, mono=True), fill=color)
        draw.text((84, y + 38), detail, font=font(16), fill=WHITE)
    panel_x = 760
    card(draw, (panel_x, 255, 1224, 520), EMERALD)
    draw.text((panel_x + 26, 275), "LIVE CONTRACT", font=font(12, bold=True, mono=True), fill=EMERALD)
    draw.text((panel_x + 26, 300), address[:22], font=font(15, mono=True), fill=WHITE)
    draw.text((panel_x + 26, 322), address[22:], font=font(15, mono=True), fill=WHITE)
    draw.text((panel_x + 26, 370), "vault = escrow + curation", font=font(15, mono=True), fill=MUTED)
    draw.text((panel_x + 26, 396), "check_vault_invariants", font=font(15, mono=True), fill=EMERALD)
    draw.text((panel_x + 26, 440), "No owner key.", font=font(20, bold=True), fill=WHITE)
    draw.text((panel_x + 26, 468), "No admin override.", font=font(20, bold=True), fill=WHITE)
    draw.text((56, 600), "The vault is real CPT custody, not an IOU in a database.", font=font(18), fill=ICE)


def scene_four(draw: ImageDraw.ImageDraw) -> None:
    draw.text((56, 130), "Creator acceptance", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 195), "Skin in the game before the audit starts.", font=font(22), fill=MUTED)
    steps = [
        ("01", "accept_and_submit_deliverable", "creator bond debited into custody", AMBER),
        ("02", "content_proof_url", "public https page the validators can re-render", ICE),
        ("03", "curate_deliverable", "community stakes CPT behind the deliverable", VIOLET),
    ]
    for index, (num, title, detail, color) in enumerate(steps):
        y = 270 + index * 100
        draw.ellipse((56, y + 12, 104, y + 60), outline=color, width=2)
        draw.text((70, y + 24), num, font=font(16, bold=True, mono=True), fill=color)
        draw.text((124, y + 12), title, font=font(21, bold=True, mono=True), fill=WHITE)
        draw.text((124, y + 42), detail, font=font(16), fill=MUTED)
    draw.text((56, 600), "Brands and creators cannot curate their own campaign.", font=font(18), fill=EMERALD)


def scene_five(draw: ImageDraw.ImageDraw, evidence: dict) -> None:
    draw.text((56, 130), "Live validator audit", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 195), "gl.nondet.web.render plus gl.eq_principle.prompt_comparative.", font=font(22), fill=MUTED)
    steps = [
        ("RENDER", "fetch the proof page in text mode", MAGENTA),
        ("DISCLOSE", "require the authenticated brand tag", AMBER),
        ("SCORE", "one of four anchors, fail closed JSON", VIOLET),
        ("COMPARE", "exact agreement on three fields", EMERALD),
    ]
    for index, (title, detail, color) in enumerate(steps):
        x = 56 + index * 300
        card(draw, (x, 270, x + 276, 430), color)
        draw.text((x + 20, 292), f"0{index + 1}", font=font(13, bold=True, mono=True), fill=color)
        draw.text((x + 20, 320), title, font=font(19, bold=True, mono=True), fill=WHITE)
        text_block(draw, detail, (x + 20, 352), font(15), MUTED, 238, 6)
    audits = [tx for tx in evidence.get("transactions", []) if tx.get("step", "").startswith("audit:")]
    if audits:
        last = audits[-1]
        draw.text((56, 470), "last consensus", font=font(12, bold=True, mono=True), fill=MUTED)
        draw.text((56, 492), f"{last.get('status')} / {last.get('result')} / {last.get('execution')}", font=font(16, mono=True), fill=EMERALD)
        draw.text((56, 520), str(last.get("tx", ""))[:46], font=font(13, mono=True), fill=ICE)
    draw.text((56, 600), "The leader cannot decide alone. Validators re-run the same audit.", font=font(18), fill=ICE)


def scene_six(draw: ImageDraw.ImageDraw) -> None:
    draw.text((56, 120), "Four settlement bands", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 182), "B base reward, V viral pool, D creator bond. Every row conserves B + V + D.", font=font(19), fill=MUTED)
    header_y = 240
    cols = [(56, 430, "BAND"), (440, 760, "TRIGGER"), (770, 1040, "CREATOR"), (1050, 1224, "BRAND")]
    for x0, x1, label in cols:
        draw.text((x0, header_y), label, font=font(12, bold=True, mono=True), fill=MUTED)
    draw.line([(56, header_y + 24), (1224, header_y + 24)], fill=(255, 255, 255, 28), width=1)
    rows = [
        ("VIRAL_BONUS_TIER", "anchor 100 + tag", "B + V + D", "0", EMERALD),
        ("TARGET_MET_TIER", "anchor 80 + tag", "B + D", "V", ICE),
        ("PARTIAL_DELIVERY", "anchor 50 + tag", "B/2 + D", "B/2 + V", AMBER),
        ("SLASH", "anchor 0 or no tag", "0", "B + V + D", MAGENTA),
    ]
    for index, (band, trigger, creator, brand, color) in enumerate(rows):
        y = header_y + 44 + index * 70
        draw.rounded_rectangle((56, y, 1224, y + 58), radius=12, fill=(255, 255, 255, 8))
        draw.text((70, y + 18), band, font=font(15, bold=True, mono=True), fill=color)
        draw.text((440, y + 18), trigger, font=font(15), fill=WHITE)
        draw.text((770, y + 18), creator, font=font(15, mono=True), fill=EMERALD)
        draw.text((1050, y + 18), brand, font=font(15, mono=True), fill=VIOLET)
    draw.text((56, 600), "One pure helper computes every split. The same helper backs the simulator.", font=font(18), fill=ICE)


def scene_seven(draw: ImageDraw.ImageDraw) -> None:
    draw.text((56, 130), "Security guard lab", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 195), "Adversarial probes run against the deployed contract.", font=font(22), fill=MUTED)
    guards = [
        ("PAPITO LOCK", "brand clawback while awaiting audit reverts", MAGENTA),
        ("POST SETTLEMENT", "curation after settlement reverts", VIOLET),
        ("MISSING TAG", "no disclosure forces the slash band", AMBER),
    ]
    for index, (title, detail, color) in enumerate(guards):
        x = 56 + index * 396
        card(draw, (x, 270, x + 372, 452), color)
        draw.text((x + 22, 296), title, font=font(15, bold=True, mono=True), fill=color)
        text_block(draw, detail, (x + 22, 330), font(19), WHITE, 330, 8)
        draw.text((x + 22, 410), "probe -> tx -> payload", font=font(13, mono=True), fill=MUTED)
    draw.text((56, 500), "Reverted probes still finalize with FINISHED_WITH_ERROR, so the guard itself is evidence.", font=font(17), fill=MUTED)
    draw.text((56, 600), "No admin path exists to bypass any of these checks.", font=font(18), fill=EMERALD)


def scene_eight(draw: ImageDraw.ImageDraw, frame: Image.Image, evidence: dict) -> None:
    draw.text((56, 120), "Live on studionet", font=font(44, bold=True), fill=WHITE)
    draw.text((56, 184), "richeroveis.github.io/creator-pulse", font=font(24, bold=True, mono=True), fill=EMERALD)
    contract = evidence.get("contract", {})
    draw.text((56, 240), "contract", font=font(12, bold=True, mono=True), fill=MUTED)
    draw.text((56, 260), contract.get("address", "0x..."), font=font(15, mono=True), fill=WHITE)
    draw.text((56, 292), "sha256", font=font(12, bold=True, mono=True), fill=MUTED)
    digest = contract.get("file_sha256", "")
    draw.text((56, 312), digest[:40], font=font(14, mono=True), fill=WHITE)
    draw.text((56, 334), digest[40:], font=font(14, mono=True), fill=WHITE)
    draw.text((56, 380), "106 direct tests, genvm-lint clean, live consensus evidence.", font=font(17), fill=MUTED)
    draw.text((56, 420), "github.com/richeroveis/creator-pulse", font=font(19, bold=True, mono=True), fill=ICE)
    shot = ARTIFACTS / "shots" / "home.png"
    if shot.exists():
        paste_screenshot(frame, shot, (740, 230))
    else:
        card(draw, (760, 240, 1224, 520), VIOLET)
        draw.text((790, 268), "OPEN THE APP", font=font(13, bold=True, mono=True), fill=VIOLET)
        draw.text((790, 304), "what if simulator", font=font(20), fill=WHITE)
        draw.text((790, 340), "guard lab probes", font=font(20), fill=WHITE)
        draw.text((790, 376), "consensus inspector", font=font(20), fill=WHITE)
        draw.text((790, 430), "1-click burner wallet", font=font(16, mono=True), fill=EMERALD)
    draw.text((56, 500), "CPT is a test asset. Studionet only.", font=font(15), fill=MUTED)


SUBTITLES = [
    [(0.3, 3.0, "CreatorPulse settles brand sponsorships with validator consensus."),
     (3.0, 5.9, "A funded vault, a creator bond, and a band nobody can override.")],
    [(0.3, 3.0, "Sponsorship decisions today are private and unauditable."),
     (3.0, 5.9, "Creators wait. Brands overpay for bots. Nobody can replay the call.")],
    [(0.3, 3.0, "The brand pre-funds base reward plus viral pool into custody."),
     (3.0, 5.9, "Maximum liability is locked on chain before any deliverable exists.")],
    [(0.3, 3.0, "The creator locks an anti-bot bond and submits a public proof page."),
     (3.0, 5.9, "Curators stake CPT behind the deliverable they want surfaced.")],
    [(0.3, 3.0, "Validators re-render the page and verify the sponsor tag themselves."),
     (3.0, 5.9, "The model must return one of four anchors, or the transaction reverts.")],
    [(0.3, 3.0, "Four bands, exact splits, one shared invariant helper."),
     (3.0, 5.9, "A missing tag or a bot signal burns the bond and refunds the brand.")],
    [(0.3, 3.0, "The brand cannot claw the viral pool back during an audit."),
     (3.0, 5.9, "Settled campaigns leave the feed, and late curation reverts.")],
    [(0.3, 3.0, "Live on studionet with a published transaction evidence file."),
     (3.0, 5.9, "Open the app, run a probe, and inspect the exact prompt.")],
]


def build_frame(index: int, local_time: float, evidence: dict) -> Image.Image:
    frame = gradient()
    draw = ImageDraw.Draw(frame, "RGBA")
    header(draw, index)
    if index == 0:
        scene_one(draw, frame, local_time)
    elif index == 1:
        scene_two(draw)
    elif index == 2:
        scene_three(draw, evidence)
    elif index == 3:
        scene_four(draw)
    elif index == 4:
        scene_five(draw, evidence)
    elif index == 5:
        scene_six(draw)
    elif index == 6:
        scene_seven(draw)
    else:
        scene_eight(draw, frame, evidence)

    draw = ImageDraw.Draw(frame, "RGBA")
    active = [text for start, end, text in SUBTITLES[index] if start <= local_time < end]
    subtitle(draw, active if active else [SUBTITLES[index][-1][2]])

    progress = (index + local_time / SCENE_SECONDS) / SCENES
    draw.rectangle((0, H - 6, W, H), fill=(255, 255, 255, 18))
    draw.rectangle((0, H - 6, int(W * progress), H), fill=MAGENTA + (255,))
    return frame  # type: ignore[return-value]


def main() -> None:
    if not SOUNDTRACK.exists():
        raise SystemExit("run tools/generate_soundtrack.py first")
    evidence = load_evidence()
    OUT.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(SOUNDTRACK),
        "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
        str(OUT),
    ]
    proc = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    total_frames = TOTAL * FPS
    for frame_index in range(total_frames):
        second = frame_index / FPS
        scene = min(SCENES - 1, int(second // SCENE_SECONDS))
        local = second - scene * SCENE_SECONDS
        frame = build_frame(scene, local, evidence)
        proc.stdin.write(frame.convert("RGB").tobytes())
        if frame_index % 100 == 0:
            print(f"frame {frame_index}/{total_frames}", file=sys.stderr, flush=True)
    proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise SystemExit(f"ffmpeg exited with {code}")
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {OUT} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
