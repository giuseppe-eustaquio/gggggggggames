#!/usr/bin/env python3
"""Prepare images/phee/ for the site.

  1. Writes images/phee/manifest.json (the list of photos).
  2. Makes small thumbnails in images/phee/thumbs/ for the games, so they
     load fast and don't use lots of memory on phones. This step needs
     Pillow (pip install pillow); without it, thumbnails are skipped and
     the games simply use the full-size photos.

Run this after adding or removing photos:
    python3 generate_phee_manifest.py
(serve.py and the git pre-commit hook also call it automatically.)
"""
import json
import sys
from pathlib import Path

PHEE_DIR = Path(__file__).parent / "images" / "phee"
THUMBS_DIR = PHEE_DIR / "thumbs"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
THUMB_SIZE = 640  # longest side, in pixels


def make_thumbnails(sources):
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print(
            "Pillow isn't installed, so thumbnails were skipped "
            "(install with: pip install pillow).",
            file=sys.stderr,
        )
        return

    THUMBS_DIR.mkdir(exist_ok=True)
    wanted = set()
    for src in sources:
        dest = THUMBS_DIR / (src.stem + ".jpg")
        wanted.add(dest.name)
        if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
            continue  # already up to date
        try:
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im)  # respect phone rotation
                im.thumbnail((THUMB_SIZE, THUMB_SIZE))
                im.convert("RGB").save(
                    dest, "JPEG", quality=80, optimize=True, progressive=True
                )
        except Exception as err:  # a bad file shouldn't stop the rest
            print(f"Couldn't make a thumbnail for {src.name}: {err}", file=sys.stderr)

    # Remove thumbnails whose photo no longer exists
    for old in THUMBS_DIR.glob("*.jpg"):
        if old.name not in wanted:
            old.unlink()


def generate():
    sources = sorted(
        f
        for f in PHEE_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in EXTENSIONS
    )
    files = [f.name for f in sources]
    (PHEE_DIR / "manifest.json").write_text(json.dumps(files, indent=2) + "\n")
    make_thumbnails(sources)
    return files


if __name__ == "__main__":
    files = generate()
    print(f"Wrote {len(files)} images to {PHEE_DIR / 'manifest.json'}")
