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

Layout (Facebook-style):
  - App icon (pwa-512x512.png) masked with a rounded square (iOS-style
    squircle radius), centered roughly in the upper-middle.
  - Bottom of the splash: brand attribution block —
        From
        The Anima Project
        Powered by DINA
  - Sakura-on-plum gradient background that matches the manifest
    background_color so the splash blends into the cold-launch shell.

Re-run after updating the source icon, logo, or brand strings:
  python3 scripts/generate-splash-screens.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent

# We use the SQUARE app icon (pwa-512x512.png) for the splash, not the
# portrait brand logo — the rounded-rectangle treatment only looks right
# on a square source. This matches Facebook / Instagram / etc. splash
# convention: app icon up top, brand attribution at the bottom.
SRC_ICON = ROOT / "public" / "pwa-512x512.png"
OUT = ROOT / "public" / "splash"

# Brand background — must match manifest.background_color so the splash
# blends seamlessly into the cold-launch app shell. Single solid color
# (no gradient) for sharpest visual on cold launch.
BG = (13, 12, 31, 255)  # #0d0c1f

# Logo occupies ~28% of the shorter axis. Tighter than before to make
# room for the bottom attribution block and to feel more like a polished
# native app splash (Facebook / Instagram use ~25-30%).
LOGO_FRACTION = 0.28

# Rounded-corner radius as a fraction of icon size. iOS app icons use a
# "squircle" shape with radius ≈ 22.5% of the side; we approximate with
# a CSS-style rounded rectangle which is close enough at typical sizes
# and far simpler to render in PIL than a true superellipse.
CORNER_RADIUS_FRACTION = 0.225

# Vertical placement of the logo: how far ABOVE geometric center to
# anchor its center. Pushed up so the bottom attribution block has
# breathing room and the home indicator doesn't crowd it.
LOGO_ABOVE_CENTER_FRACTION = 0.10

# Bottom attribution block — text strings, colors, and fractional sizing.
# Sized as a fraction of the splash height so they scale across devices.
ATTRIBUTION_FROM = "From"
ATTRIBUTION_BRAND = "The Anima Project"
ATTRIBUTION_TAGLINE = "Powered by DINA"

# Colors — soft sakura-tinted tokens so the text feels native to Mirror's
# palette rather than generic white on dark.
COLOR_LABEL = (200, 180, 200, 220)   # muted lavender — "From", "Powered by DINA"
COLOR_BRAND = (255, 240, 245, 255)   # near-white sakura — "The Anima Project"

# Font candidates in preference order. The script picks the first that
# loads. We avoid PIL's bitmap default — it's chunky at large sizes and
# looks unprofessional on a splash screen.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

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


def load_font(size_px: int) -> ImageFont.ImageFont:
    """Return the first TTF that loads from FONT_CANDIDATES at `size_px`.
    Falls back to PIL's bitmap default so the script never hard-fails,
    even though the bitmap font looks crude.
    """
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size_px)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def make_rounded_icon(icon: Image.Image, target_size: int) -> Image.Image:
    """Resize `icon` to `target_size` × `target_size` and apply a rounded
    rectangle alpha mask. The corner radius mimics the iOS squircle.

    Source is expected to be a square RGBA PNG; if not, we center-crop
    to a square first as a defensive measure.
    """
    # Defensive: if a non-square source slips in, center-crop to square.
    w, h = icon.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        icon = icon.crop((left, top, left + side, top + side))

    # Scale to target size.
    icon = icon.resize((target_size, target_size), Image.LANCZOS).convert("RGBA")

    # Build a rounded-rect mask the same size as the icon.
    mask = Image.new("L", (target_size, target_size), 0)
    radius = int(target_size * CORNER_RADIUS_FRACTION)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (target_size - 1, target_size - 1)],
        radius=radius,
        fill=255,
    )

    # Paste the icon onto a transparent canvas using the rounded-rect
    # mask as the alpha channel. PIL's `paste` with a mask uses the
    # mask values directly — corners outside the rounded rect become
    # fully transparent.
    out = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask=mask)
    return out


def draw_attribution(
    canvas: Image.Image,
    width: int,
    height: int,
) -> None:
    """Render the bottom attribution block:

        From
        The Anima Project
        Powered by DINA

    Positioned in the lower ~15% of the splash, centered horizontally.
    Type scale is derived from the splash height so the same script
    produces sensible results from a 1334-tall iPhone SE to a
    2796-tall Pro Max.
    """
    draw = ImageDraw.Draw(canvas)

    # Type scale (px) — capped at sensible minimums so a small splash
    # doesn't go sub-readable.
    label_px = max(18, int(height * 0.018))   # "From", "Powered by DINA"
    brand_px = max(28, int(height * 0.028))   # "The Anima Project"

    label_font = load_font(label_px)
    brand_font = load_font(brand_px)

    # Vertical layout from the bottom edge up.
    # Bottom safe margin ~6% of height — keeps text clear of the home
    # indicator and matches Facebook's similar pattern visually.
    bottom_margin = int(height * 0.06)

    # Vertical gaps between rows. Brand row gets more breathing room
    # because it's the largest.
    gap_between_label_and_brand = int(brand_px * 0.35)
    gap_between_brand_and_tagline = int(brand_px * 0.5)

    # Measure each row.
    def measure(text: str, font) -> tuple[int, int]:
        bbox = draw.textbbox((0, 0), text, font=font)
        return (bbox[2] - bbox[0], bbox[3] - bbox[1])

    from_w, from_h = measure(ATTRIBUTION_FROM, label_font)
    brand_w, brand_h = measure(ATTRIBUTION_BRAND, brand_font)
    tag_w, tag_h = measure(ATTRIBUTION_TAGLINE, label_font)

    # Compute Y for the BOTTOM-most row first (tagline), then work up.
    tagline_y = height - bottom_margin - tag_h
    brand_y = tagline_y - gap_between_brand_and_tagline - brand_h
    from_y = brand_y - gap_between_label_and_brand - from_h

    def draw_centered(text: str, font, y: int, color: tuple[int, int, int, int], text_width: int) -> None:
        x = (width - text_width) // 2
        draw.text((x, y), text, fill=color, font=font)

    draw_centered(ATTRIBUTION_FROM,    label_font, from_y,    COLOR_LABEL, from_w)
    draw_centered(ATTRIBUTION_BRAND,   brand_font, brand_y,   COLOR_BRAND, brand_w)
    draw_centered(ATTRIBUTION_TAGLINE, label_font, tagline_y, COLOR_LABEL, tag_w)


def make_splash(icon: Image.Image, width: int, height: int) -> Image.Image:
    """Render a single splash image: solid background + rounded icon +
    bottom attribution block."""
    canvas = Image.new("RGBA", (width, height), BG)

    # Scale icon to LOGO_FRACTION of the shorter axis.
    short_axis = min(width, height)
    icon_size = int(short_axis * LOGO_FRACTION)

    # Round its corners.
    rounded = make_rounded_icon(icon, icon_size)

    # Center horizontally; offset above center vertically to make room
    # for the attribution block.
    x = (width - icon_size) // 2
    y = (height - icon_size) // 2 - int(height * LOGO_ABOVE_CENTER_FRACTION)

    canvas.paste(rounded, (x, y), rounded)

    # Bottom attribution.
    draw_attribution(canvas, width, height)

    return canvas


def main() -> None:
    if not SRC_ICON.exists():
        raise SystemExit(f"Source icon not found: {SRC_ICON}")

    OUT.mkdir(parents=True, exist_ok=True)

    icon = Image.open(SRC_ICON).convert("RGBA")

    for w, h in SIZES:
        out_path = OUT / f"apple-splash-{w}-{h}.png"
        img = make_splash(icon, w, h)
        # PNG-32 with optimization — these aren't precached and only
        # load during the iOS standalone-launch flash, so a slightly
        # larger file is acceptable.
        img.save(out_path, format="PNG", optimize=True)
        print(f"wrote {out_path.relative_to(ROOT)} ({w}x{h})")


if __name__ == "__main__":
    main()
