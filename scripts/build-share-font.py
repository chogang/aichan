"""Build the share card fonts from Google Fonts Noto Sans JP, KR, and SC."""

import argparse
from contextlib import ExitStack
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unicodedata import category
from urllib.request import urlopen

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


# Pin each official Google Fonts file to the commit that introduced its bytes.
FONT_SOURCES = (
    ("JP", "295d98a7a0c17c68f1341eaeea354e7960ea70d3",
     "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
     "AiChan Preview", "ai-chan-preview.bin"),
    ("KR", "4efc2774c63917927efe769ca845def6bd6debae",
     "194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252",
     "AiChan Hangul", "ai-chan-preview-ko.bin"),
    ("SC", "2894aab31764f10f29c421bdfd2340d3b382d384",
     "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da",
     "AiChan Han", "ai-chan-preview-zh.bin"),
)
# These existing catalog characters have no glyph in the pinned Noto fonts.
EXISTING_GLYPH_GAPS = {0x0315, 0x035D, 0x035E, 0x035F, 0x03AD, 0x03CC, 0x2080, 0x22AC}


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def save_subset(font, characters, family, destination):
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 4, 6, 13, 14, 16, 17]
    options.hinting = False
    font_subset = subset.Subsetter(options=options)
    font_subset.populate(unicodes=characters)
    font_subset.subset(font)
    instantiateVariableFont(font, {"wght": 600}, inplace=True)
    names = {1: family, 2: "Regular", 4: family, 6: family.replace(" ", ""), 16: family, 17: "Regular"}
    for record in list(font["name"].names):
        if record.nameID in names:
            font["name"].setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
    font.recalcTimestamp = False
    font.save(destination)


def required_characters(root):
    catalog = json.loads((root / "songlist.json").read_text(encoding="utf-8"))
    labels = json.loads((root / "share-locales.json").read_text(encoding="utf-8"))
    text = "".join(title for song in catalog["songs"] for title in strings(song.get("title_localized") or song["id"]))
    text += "".join(song.get("artist") or "" for song in catalog["songs"])
    text += "".join(strings(catalog.get("packNames", {}))) + "".join(strings(labels))
    # Formatting controls and variation selectors do not have standalone glyphs.
    return {
        ord(char) for char in text
        if not char.isspace() and category(char) not in {"Cc", "Cf"}
        and not (0xFE00 <= ord(char) <= 0xFE0F or 0xE0100 <= ord(char) <= 0xE01EF)
    }


def codepoints(characters):
    return ", ".join(f"U+{char:04X}" for char in sorted(characters))


def download_fonts(directory):
    paths = []
    for code, commit, checksum, _, _ in FONT_SOURCES:
        url = f"https://raw.githubusercontent.com/google/fonts/{commit}/ofl/notosans{code.lower()}/NotoSans{code}%5Bwght%5D.ttf"
        with urlopen(url, timeout=30) as response:
            data = response.read()
        if sha256(data).hexdigest() != checksum:
            raise ValueError(f"Noto Sans {code} download did not match its SHA-256 checksum")
        path = directory / f"NotoSans{code}.ttf"
        path.write_bytes(data)
        paths.append(path)
    return paths


def cmap(path):
    with TTFont(path) as font:
        return set(font.getBestCmap())


def build_fonts(root, raw_fonts=None):
    required = required_characters(root)
    destinations = [root / "share-assets" / source[-1] for source in FONT_SOURCES]
    existing = [cmap(path) if path.is_file() else set() for path in destinations]
    covered = set().union(*existing)
    automatic = raw_fonts is None
    known_gaps = required.intersection(EXISTING_GLYPH_GAPS).difference(covered)
    if automatic and all(path.is_file() for path in destinations) and required <= covered | known_gaps:
        if known_gaps:
            print(f"Existing share font gaps: {codepoints(known_gaps)}")
        print("Share fonts already cover the catalog apart from any reported gaps.")
        return

    # Retain future Latin, Greek, Cyrillic, punctuation and kana titles too.
    ranges = [(0x20, 0x24F), (0x370, 0x52F), (0x2000, 0x206F), (0x3000, 0x30FF), (0xFF01, 0xFFEF)]
    characters = required | {code for start, end in ranges for code in range(start, end + 1)}
    if automatic:
        characters.update(covered)
    with TemporaryDirectory() as temporary, ExitStack() as stack:
        directory = Path(temporary)
        fonts = [stack.enter_context(TTFont(path)) for path in (raw_fonts or download_fonts(directory))]
        available = [set(font.getBestCmap()) for font in fonts]
        missing = required.difference(set().union(*available))
        if missing - EXISTING_GLYPH_GAPS:
            codepoints_missing = codepoints(missing - EXISTING_GLYPH_GAPS)
            raise ValueError(f"Source fonts do not cover new catalog characters: {codepoints_missing}")
        if missing:
            print(f"Existing share font gaps: {codepoints(missing)}")

        outputs = []
        for font, glyphs, prior, destination, source in zip(fonts, available, existing, destinations, FONT_SOURCES):
            chosen = characters.intersection(glyphs)
            characters.difference_update(chosen)
            if automatic and destination.is_file() and chosen <= prior:
                continue
            output = directory / destination.name
            save_subset(font, chosen, source[-2], output)
            outputs.append((output, destination))
        for output, destination in outputs:
            data = output.read_bytes()
            if not destination.is_file() or data != destination.read_bytes():
                destination.write_bytes(data)
                print(f"Updated {destination.name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Download pinned source fonts only when the catalog needs them")
    parser.add_argument("fonts", nargs="*", type=Path, metavar="FONT", help="Local JP, KR, and SC variable TTFs")
    args = parser.parse_args()
    if len(args.fonts) != (0 if args.refresh else 3):
        parser.error("Provide --refresh or exactly three local fonts in JP, KR, SC order")
    try:
        build_fonts(Path(__file__).resolve().parents[1], args.fonts or None)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Share font update failed: {error}\n")


if __name__ == "__main__":
    main()
