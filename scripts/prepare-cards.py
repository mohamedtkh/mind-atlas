"""Prepares every card picture for the 3D gallery.

Reads all pictures in the source folder (including any .zip there), in name order, and for each:

  1. trims any black border and resizes it to fit in 1000 px,
  2. saves it as assets/cards/<number>.webp,
  3. estimates its depth (how far each part is from the viewer) with the depth model and saves
     assets/cards/<number>-depth.png. The 3D view lifts the picture into a relief with it,
  4. reads a color palette from the picture, so the 3D scene matches it.

It writes assets/cards/index.json, which the app reads. Numbers follow the order of the file names,
so they stay the same from one run to the next.

Usage (from the mind-atlas folder):
    python scripts/prepare-cards.py [source-folder] [--no-depth]

The default source folder is ..\\Suits\\Mind Atlas concepts. Needs Pillow, numpy and onnxruntime:
    python -m pip install pillow numpy onnxruntime
"""

import json
import sys
import time
import zipfile
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SOURCE = Path(ARGS[0]) if ARGS else ROOT.parent / "Suits" / "Mind Atlas concepts"
WITH_DEPTH = "--no-depth" not in sys.argv
TARGET = ROOT / "assets" / "cards"
DEPTH_MODEL = ROOT / "models" / "depth-anything-v2-small.onnx"
MAX_COLOR_SIDE = 1000
MAX_DEPTH_SIDE = 512
PICTURE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}


def find_pictures(source):
    """Returns a sorted list of (file name, opener) for every picture in the folder or its zips."""
    found = {}
    for path in sorted(source.rglob("*")):
        if path.is_file() and path.suffix.lower() in PICTURE_TYPES:
            found.setdefault(path.name, lambda p=path: open(p, "rb"))
        elif path.is_file() and path.suffix.lower() == ".zip":
            with zipfile.ZipFile(path) as archive:
                for info in archive.infolist():
                    name = Path(info.filename).name
                    if Path(name).suffix.lower() in PICTURE_TYPES and name not in found:
                        found[name] = lambda a=path, n=info.filename: BytesIO(zipfile.ZipFile(a).read(n))
    return sorted(found.items(), key=lambda item: item[0])


def trim_black_border(image):
    mask = image.convert("L").point(lambda p: 255 if p > 16 else 0)
    box = mask.getbbox()
    return image.crop(box) if box else image


def load_depth_session():
    if not WITH_DEPTH or not DEPTH_MODEL.exists():
        return None
    import onnxruntime as ort

    return ort.InferenceSession(str(DEPTH_MODEL), providers=["CPUExecutionProvider"])


def estimate_depth(session, image):
    """Returns a grayscale image the same size as `image`. White is near, black is far."""
    size = 518
    x = np.asarray(image.resize((size, size), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    raw = session.run(None, {session.get_inputs()[0].name: x})[0]
    depth = np.squeeze(raw).astype(np.float32)
    low, high = np.percentile(depth, 2), np.percentile(depth, 98)
    depth = np.clip((depth - low) / max(high - low, 1e-6), 0.0, 1.0)
    picture = Image.fromarray((depth * 255).astype(np.uint8), mode="L")
    return picture.resize(image.size, Image.BILINEAR)


def hexcolor(rgb):
    return "#%02x%02x%02x" % tuple(int(max(0, min(255, round(c)))) for c in rgb)


def palette_for(image):
    """Reads a color palette from the picture, so each 3D scene matches its card."""
    small = np.asarray(image.resize((96, 96), Image.BILINEAR), dtype=np.float32)
    pixels = small.reshape(-1, 3)
    luma = pixels @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    order = np.argsort(luma)
    dark = pixels[order[: len(order) // 5]]
    light = pixels[order[-len(order) // 5 :]]
    background = np.median(dark, axis=0) * 0.55
    fog = np.median(dark, axis=0) * 0.8
    figure = np.median(pixels[(luma > np.percentile(luma, 40)) & (luma < np.percentile(luma, 75))], axis=0)
    # The accent is the most vivid bright color: high saturation and brightness.
    maxc = pixels.max(axis=1)
    minc = pixels.min(axis=1)
    vivid = (maxc - minc) * (luma / 255.0)
    accent = pixels[int(np.argmax(vivid))]
    ground = np.median(dark, axis=0) * 0.7
    return {
        "background": hexcolor(background),
        "fog": hexcolor(fog),
        "figure": hexcolor(figure),
        "ground": hexcolor(ground),
        "accent": hexcolor(accent),
    }


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        print(f"No folder at {SOURCE}. Create it, add the pictures or a .zip of them, then run this again.")
        return

    pictures = find_pictures(SOURCE)
    session = load_depth_session()
    print(f"{len(pictures)} picture(s); depth model: {'on' if session else 'off'}", flush=True)

    for stale in TARGET.glob("*"):
        if stale.is_file():
            stale.unlink()

    index = []
    started = time.time()
    for number, (name, opener) in enumerate(pictures, start=1):
        stem = f"{number:04d}"
        try:
            with Image.open(opener()) as raw:
                image = trim_black_border(ImageOps.exif_transpose(raw).convert("RGB"))
        except Exception as error:  # a picture that will not open is skipped, and reported
            print(f"skipped {name}: {error}", flush=True)
            continue

        image.thumbnail((MAX_COLOR_SIDE, MAX_COLOR_SIDE))
        image.save(TARGET / f"{stem}.webp", "WEBP", quality=82)

        depth_name = None
        if session is not None:
            depth = estimate_depth(session, image).filter(ImageFilter.GaussianBlur(3))
            depth.thumbnail((MAX_DEPTH_SIDE, MAX_DEPTH_SIDE))
            depth.save(TARGET / f"{stem}-depth.png", "PNG")
            depth_name = f"{stem}-depth.png"

        index.append(
            {
                "number": number,
                "source": name,
                "color": f"{stem}.webp",
                "depth": depth_name,
                "width": image.width,
                "height": image.height,
                "palette": palette_for(image),
            }
        )
        if number % 50 == 0:
            elapsed = time.time() - started
            print(f"{number}/{len(pictures)} done, {elapsed / number:.2f} s each", flush=True)

    (TARGET / "index.json").write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(index)} card(s) to {TARGET}", flush=True)


if __name__ == "__main__":
    main()
