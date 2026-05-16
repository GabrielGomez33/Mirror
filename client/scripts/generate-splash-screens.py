#!/usr/bin/env python3
"""
Generate iOS apple-touch-startup-image splash screens for Mirror.

iOS Safari standalone PWAs use apple-touch-startup-image meta tags to
pick a splash image matching the exact device viewport. There is no
single-size fallback that works for every device — the image MUST be
the exact pixel dimensions of the device's screen or iOS shows a
plain background.

Outputs (written to client/public/splash/):
  apple-splash-1290-2796.png    iPhone 14/15/16 Pro Max
  apple-splash-1284-2778.png    iPhone 12/13/14 Pro Max
  apple-splash-1179-2556.png    iPhone 14/15/16 Pro
  apple-splash-1170-2532.png    iPhone 12/13/14
  apple-splash-1125-2436.png    iPhone X / XS / 11 Pro
  apple-splash-828-1792.png     iPhone XR / 11
  apple-splash-750-1334.png     iPhone 6/7/8 / SE 2nd gen
  apple-splash-2048-2732.png    iPad Pro 12.9"

The HTML in index.html declares these via apple-touch-startup-image
links with matching media queries. If a file is missing, iOS falls
back gracefully to icon + background-color from the manifest.

Re-run after updating the source logo:
  python3 scripts/generate-splash-screens.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "mirror-logo-sakura.png"
OUT = ROOT / "public" / "splash"

# Brand background — must match manifest.background_color so the splash
# blends seamlessly into the cold-launch app shell.
BG = (13, 12, 31, 255)  # #0d0c1f

# Logo occupies the inner 40% of the shorter axis. Conservative so the
# device's status bar / notch never overlaps the artwork.
LOGO_FRACTION = 0.40

# (width, height) tuples — every entry must match an
# apple-touch-startup-image media query in index.html.
SIZES: list[tuple[int, int]] = [
    (1290, 2796),
    (1284, 2778),
    (1179, 2556),
    (1170, 2532),
    (1125, 2436),
    (828, 1792),
    (750, 1334),
    (2048, 2732),
]


def make_splash(logo: Image.Image, width: int, height: int) -> Image.Image:
    """Render a single splash image: solid background + centered logo."""
    canvas = Image.new("RGBA", (width, height), BG)

    # Scale the logo to fit LOGO_FRACTION of the shorter axis, preserving
    # aspect ratio.
    short_axis = min(width, height)
    target = int(short_axis * LOGO_FRACTION)
    lw, lh = logo.size
    scale = min(target / lw, target / lh)
    new_size = (max(1, int(lw * scale)), max(1, int(lh * scale)))
    resized = logo.resize(new_size, Image.LANCZOS)

    # Center horizontally; offset slightly above center vertically so the
    # logo doesn't fight with the home indicator visually.
    x = (width - new_size[0]) // 2
    y = (height - new_size[1]) // 2 - int(height * 0.04)
    canvas.paste(resized, (x, y), resized if resized.mode == "RGBA" else None)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source logo not found: {SRC}")

    OUT.mkdir(parents=True, exist_ok=True)

    logo = Image.open(SRC).convert("RGBA")

    for w, h in SIZES:
        out_path = OUT / f"apple-splash-{w}-{h}.png"
        img = make_splash(logo, w, h)
        # PNG-32 with optimization — typical 300-800 KB per splash.
        # Acceptable: these aren't precached and only load during the
        # iOS standalone-launch flash, not on every page view.
        img.save(out_path, format="PNG", optimize=True)
        print(f"wrote {out_path.relative_to(ROOT)} ({w}x{h})")


if __name__ == "__main__":
    main()
