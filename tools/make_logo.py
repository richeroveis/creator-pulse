"""Generate the CreatorPulse 512x512 logo with pure PIL drawing.

The mark is a heartbeat pulse that curls into three engagement rings: magenta
for the vault, violet for viral velocity, emerald for organic authenticity.
Everything is drawn at 4x and downsampled so edges stay crisp at icon size.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
SCALE = 4
CANVAS = SIZE * SCALE

MAGENTA = (255, 61, 206)
VIOLET = (139, 92, 246)
EMERALD = (52, 245, 176)
MIDNIGHT = (11, 7, 22)
MIDNIGHT_LIGHT = (26, 17, 48)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
        255,
    )


def background() -> Image.Image:
    base = Image.new("RGB", (CANVAS, CANVAS), MIDNIGHT)
    draw = ImageDraw.Draw(base)
    for y in range(CANVAS):
        t = y / CANVAS
        draw.line([(0, y), (CANVAS, y)], fill=lerp(MIDNIGHT_LIGHT, MIDNIGHT, t)[:3])

    glow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse(
        [CANVAS * 0.08, CANVAS * 0.02, CANVAS * 0.98, CANVAS * 0.92],
        fill=(255, 61, 206, 34),
    )
    gdraw.ellipse(
        [CANVAS * 0.3, CANVAS * 0.45, CANVAS * 1.02, CANVAS * 1.05],
        fill=(52, 245, 176, 26),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(CANVAS // 10))
    base = Image.alpha_composite(base.convert("RGBA"), glow)

    mask = Image.new("L", (CANVAS, CANVAS), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, CANVAS - 1, CANVAS - 1], radius=CANVAS // 5, fill=255)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def ring_layer(
    center: tuple[float, float],
    radius: float,
    width: float,
    start_color: tuple[int, int, int],
    end_color: tuple[int, int, int],
    start_angle: float,
    sweep: float,
    segments: int = 220,
) -> Image.Image:
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius]
    for index in range(segments):
        t0 = index / segments
        t1 = (index + 1.35) / segments
        color = lerp(start_color, end_color, t0)
        draw.arc(
            box,
            start=start_angle + sweep * t0,
            end=start_angle + sweep * min(1.0, t1),
            fill=color,
            width=int(width),
        )
    return layer


def pulse_layer() -> Image.Image:
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    points = [
        (0.16, 0.56),
        (0.27, 0.56),
        (0.33, 0.47),
        (0.39, 0.66),
        (0.47, 0.26),
        (0.55, 0.62),
        (0.62, 0.52),
        (0.70, 0.52),
        (0.79, 0.40),
    ]
    scaled = [(x * CANVAS, y * CANVAS) for x, y in points]
    total = len(scaled) - 1
    for index in range(total):
        a = scaled[index]
        b = scaled[index + 1]
        color = lerp(MAGENTA, EMERALD, index / total)
        draw.line([a, b], fill=color, width=int(CANVAS * 0.028), joint="curve")
        draw.ellipse(
            [b[0] - CANVAS * 0.014, b[1] - CANVAS * 0.014, b[0] + CANVAS * 0.014, b[1] + CANVAS * 0.014],
            fill=color,
        )

    head = scaled[-1]
    arrow = [
        (head[0] - CANVAS * 0.055, head[1] - CANVAS * 0.005),
        (head[0], head[1] - CANVAS * 0.056),
        (head[0] + CANVAS * 0.006, head[1] + CANVAS * 0.028),
    ]
    draw.polygon(arrow, fill=EMERALD)
    return layer


def build() -> Image.Image:
    canvas = background()
    center = (CANVAS * 0.5, CANVAS * 0.5)

    rings = [
        (CANVAS * 0.335, CANVAS * 0.021, MAGENTA, VIOLET, -100.0, 300.0),
        (CANVAS * 0.262, CANVAS * 0.018, VIOLET, EMERALD, 35.0, 250.0),
        (CANVAS * 0.192, CANVAS * 0.014, EMERALD, MAGENTA, 150.0, 210.0),
    ]
    for radius, width, start_color, end_color, angle, sweep in rings:
        ring = ring_layer(center, radius, width, start_color, end_color, angle, sweep)
        glow = ring.filter(ImageFilter.GaussianBlur(CANVAS // 90))
        canvas = Image.alpha_composite(canvas, glow)
        canvas = Image.alpha_composite(canvas, ring)

    pulse = pulse_layer()
    glow = pulse.filter(ImageFilter.GaussianBlur(CANVAS // 60))
    canvas = Image.alpha_composite(canvas, glow)
    canvas = Image.alpha_composite(canvas, pulse)

    dot = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ddraw = ImageDraw.Draw(dot)
    ddraw.ellipse(
        [
            center[0] + CANVAS * 0.30,
            center[1] - CANVAS * 0.36,
            center[0] + CANVAS * 0.345,
            center[1] - CANVAS * 0.315,
        ],
        fill=EMERALD,
    )
    canvas = Image.alpha_composite(canvas, dot.filter(ImageFilter.GaussianBlur(CANVAS // 120)))
    canvas = Image.alpha_composite(canvas, dot)

    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    logo = build().convert("RGB")
    for target in (root / "frontend/public/logo.png", root / "docs/logo.png"):
        target.parent.mkdir(parents=True, exist_ok=True)
        logo.save(target, format="PNG", optimize=True)
        print(f"wrote {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
