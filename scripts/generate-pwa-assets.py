#!/usr/bin/env python3
"""Generate PWA icons and iOS splash screens from WalletIcon.png."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "assets" / "WalletIcon.png"
STATIC = ROOT / "static"
SPLASH = STATIC / "splash"

BRAND_BLUE = (62, 146, 235)  # #3e92eb
WHITE = (255, 255, 255)

# ~70% do canvas: maior que antes, ainda com margem nas bordas
ICON_SCALE = 0.70

SPLASH_SIZES = {
    "iphone-se": (750, 1334),
    "iphone-8": (750, 1334),
    "iphone-xr": (828, 1792),
    "iphone-xs": (1125, 2436),
    "iphone-12": (1170, 2532),
    "iphone-12-pro-max": (1284, 2778),
    "iphone-14-pro": (1179, 2556),
    "iphone-15-pro-max": (1290, 2796),
}


def create_icon_with_padding(
    size: int,
    output: Path,
    background: tuple[int, int, int] | tuple[int, int, int, int] = WHITE,
    icon_scale: float = ICON_SCALE,
) -> None:
    """Render icon with padding. Pass RGBA background for transparency."""
    if len(background) == 4:
        canvas = Image.new("RGBA", (size, size), background)
    else:
        canvas = Image.new("RGB", (size, size), background)
    icon = Image.open(SOURCE).convert("RGBA")
    icon_size = int(size * icon_scale)
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = (size - icon_size) // 2
    if canvas.mode != "RGBA":
        canvas = canvas.convert("RGBA")
    canvas.paste(icon, (offset, offset), icon)
    if len(background) == 3:
        canvas = canvas.convert("RGB")
    canvas.save(output, "PNG", optimize=True)


def create_maskable_icon(size: int, output: Path) -> None:
    canvas = Image.new("RGBA", (size, size), WHITE + (255,))
    icon = Image.open(SOURCE).convert("RGBA")
    icon_size = int(size * ICON_SCALE)
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = (size - icon_size) // 2
    canvas.paste(icon, (offset, offset), icon)
    canvas.save(output, "PNG", optimize=True)


def create_transparent_favicon(size: int, output: Path, inset: int = 8) -> None:
    """Browser favicon: trim source padding, fill canvas, keep transparency."""
    icon = Image.open(SOURCE).convert("RGBA")
    bbox = icon.getbbox()
    if bbox:
        icon = icon.crop(bbox)
    target = size - inset * 2
    icon.thumbnail((target, target), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - icon.width) // 2, (size - icon.height) // 2)
    canvas.paste(icon, offset, icon)
    canvas.save(output, "PNG", optimize=True)


def create_splash(width: int, height: int, output: Path) -> None:
    canvas = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(canvas)

    icon = Image.open(SOURCE).convert("RGBA")
    icon_size = int(min(width, height) * 0.22)
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    x = (width - icon_size) // 2
    y = (height - icon_size) // 2 - int(height * 0.05)
    canvas.paste(icon, (x, y), icon)

    text_y = y + icon_size + int(height * 0.03)
    draw.text((width // 2, text_y), "MyWallet", fill=BRAND_BLUE, anchor="mm")

    canvas.save(output, "PNG", optimize=True)


def main() -> None:
    STATIC.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    # iOS / PWA icons stay opaque (white) — required for home-screen icons.
    create_icon_with_padding(180, STATIC / "apple-touch-icon-180.png")
    create_icon_with_padding(512, STATIC / "apple-touch-icon.png")
    # Browser tab favicon: wallet only, transparent, max canvas fill.
    create_transparent_favicon(512, STATIC / "favicon.png")
    create_maskable_icon(512, STATIC / "maskable-icon-512.png")

    for name, (width, height) in SPLASH_SIZES.items():
        create_splash(width, height, SPLASH / f"{name}.png")

    print("PWA assets generated successfully.")


if __name__ == "__main__":
    main()
