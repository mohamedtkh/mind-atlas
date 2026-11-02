"""Prepares the concept cards for the app.

Reads scripts/concept-map.json, which maps each picture's file name to the id of the
page it belongs to. For each picture it:

  1. finds the file in the source folder (or inside a .zip there),
  2. trims any black border and resizes it to fit in 1400 px,
  3. saves it as assets/concepts/<id>.webp (the picture the 3D relief is painted with),
  4. if the depth model is present (models/depth-anything-v2-small.onnx), estimates how
     far each part of the picture is from the viewer and saves it as
     assets/concepts/<id>-depth.png. The 3D view uses this to lift the picture into a relief.

It then writes assets/concepts/manifest.json, which the app reads.

Usage (from the mind-atlas folder):
    python scripts/prepare-concepts.py [source-folder]

The default source folder is ..\\Suits\\Mind Atlas concepts. Needs Pillow, numpy and onnxruntime:
    python -m pip install pillow numpy onnxruntime
"""

import json
import sys
import zipfile
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "Suits" / "Mind Atlas concepts"
TARGET = ROOT / "assets" / "concepts"
DEPTH_MODEL = ROOT / "models" / "depth-anything-v2-small.onnx"
MAX_COLOR_SIDE = 1400
MAX_DEPTH_SIDE = 800
PICTURE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}


def load_map():
    return json.loads((ROOT / "scripts" / "concept-map.json").read_text(encoding="utf-8"))


def find_pictures(source):
    """Returns {file name: opener}, where opener() gives the picture as a file-like object."""
    found = {}
    for path in sorted(source.rglob("*")):
        if path.is_file() and path.suffix.lower() in PICTURE_TYPES:
            found[path.name] = lambda p=path: open(p, "rb")
        elif path.is_file() and path.suffix.lower() == ".zip":
            with zipfile.ZipFile(path) as archive:
                for info in archive.infolist():
                    name = Path(info.filename).name
                    if Path(name).suffix.lower() in PICTURE_TYPES and name not in found:
                        found[name] = lambda a=path, n=info.filename: BytesIO(zipfile.ZipFile(a).read(n))
    return found


def trim_black_border(image):
    """Crops away a uniform black border (screenshots of the cards have one)."""
    mask = image.convert("L").point(lambda p: 255 if p > 16 else 0)
    box = mask.getbbox()
    return image.crop(box) if box else image


def load_depth_session():
    if not DEPTH_MODEL.exists():
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


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    manifest_path = TARGET / "manifest.json"

    if not SOURCE.exists():
        manifest_path.write_text("{}\n", encoding="utf-8")
        print(f"No folder at {SOURCE}. Create it, add the pictures or a .zip of them, then run this again.")
        return

    mapping = load_map()
    ids = set(mapping.values())
    found = find_pictures(SOURCE)

    # A picture named exactly like a page id (for example panic.png) also works.
    for name in list(found):
        stem = Path(name).stem.lower()
        if stem in ids and name not in mapping:
            mapping[name] = stem

    for stale in list(TARGET.glob("*.webp")) + list(TARGET.glob("*-depth.png")):
        stale.unlink()

    session = load_depth_session()
    print("depth model:", "on" if session else "not found (cards will be flat)")

    manifest = {}
    for name, entry_id in mapping.items():
        if name not in found:
            print(f"Not found: {name} (for {entry_id})")
            continue
        with Image.open(found[name]()) as raw:
            image = trim_black_border(ImageOps.exif_transpose(raw).convert("RGB"))
        image.thumbnail((MAX_COLOR_SIDE, MAX_COLOR_SIDE))
        image.save(TARGET / f"{entry_id}.webp", "WEBP", quality=85)

        depth_name = None
        if session is not None:
            depth = estimate_depth(session, image).filter(ImageFilter.GaussianBlur(3))
            depth.thumbnail((MAX_DEPTH_SIDE, MAX_DEPTH_SIDE))
            depth.save(TARGET / f"{entry_id}-depth.png", "PNG")
            depth_name = f"{entry_id}-depth.png"

        manifest[entry_id] = {"color": f"{entry_id}.webp", "depth": depth_name}
        print(f"{entry_id} <- {name}")

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(manifest)} picture(s) to {TARGET}")


if __name__ == "__main__":
    main()
