#!/usr/bin/env python3
"""
Generate PWA icon set from public/mirror-logo-sakura.png.

Outputs (written to client/public/):
  pwa-192x192.png            standard "any" purpose icon
  pwa-512x512.png            standard "any" purpose icon (high-res)
  pwa-maskable-512x512.png   maskable variant (logo scaled to 80% safe zone)
  apple-touch-icon.png       180x180, no mask (iOS adds rounded corners itself)
  favicon-32x32.png          browser tab favicon
  favicon-16x16.png          browser tab favicon (small)

Re-run any time you update the source asset:
  python3 scripts/generate-pwa-icons.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "mirror-logo-sakura.png"
OUT = ROOT / "public"

# Background color for the maskable icon's safe-zone bleed.
# Sampled from the source: top ~#15142b, bottom ~#090b1a, average ~#0d0c1f.
BG = (13, 12, 31, 255)


def square_crop(img: Image.Image) -> Image.Image:
    """Center-crop to a square. Source is 1024x1536 portrait; logo sits centered."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def make_maskable(square: Image.Image, size: int = 512, safe_zone: float = 0.8) -> Image.Image:
    """
    Maskable icons must stay readable when Android applies a circular/rounded mask.
    Spec: the inner 80% (centered) is guaranteed visible. We scale the logo to that
    safe zone and fill the outer bleed with the brand background.
    """
    canvas = Image.new("RGBA", (size, size), BG)
    inner = int(size * safe_zone)
    logo = square.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(logo, (offset, offset), logo if logo.mode == "RGBA" else None)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source not found: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    sq = square_crop(src)

    targets = [
        ("pwa-192x192.png", sq.resize((192, 192), Image.LANCZOS)),
        ("pwa-512x512.png", sq.resize((512, 512), Image.LANCZOS)),
        ("pwa-maskable-512x512.png", make_maskable(sq, 512)),
        ("apple-touch-icon.png", sq.resize((180, 180), Image.LANCZOS)),
        ("favicon-32x32.png", sq.resize((32, 32), Image.LANCZOS)),
        ("favicon-16x16.png", sq.resize((16, 16), Image.LANCZOS)),
    ]

    for name, img in targets:
        path = OUT / name
        img.save(path, "PNG", optimize=True)
        print(f"  wrote {path.relative_to(ROOT)}  ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()