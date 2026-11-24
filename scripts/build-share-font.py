"""Build the share card font from a Google Fonts Noto Sans JP variable TTF."""

import argparse
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path, help="Path to NotoSansJP[wght].ttf")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    catalog = json.loads((root / "songlist.json").read_text(encoding="utf-8"))
    text = "".join(title for song in catalog["songs"] for title in strings(song.get("title_localized") or song["id"]))
    text += "".join(strings(catalog.get("packNames", {})))

    font = instantiateVariableFont(TTFont(args.font), {"wght": 600}, inplace=True)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 4, 6, 13, 14, 16, 17]
    options.hinting = False
    font_subset = subset.Subsetter(options=options)
    # Retain future Latin, Greek, Cyrillic, punctuation and kana titles too.
    ranges = [(0x20, 0x24F), (0x370, 0x52F), (0x2000, 0x206F), (0x3000, 0x30FF), (0xFF01, 0xFFEF)]
    characters = {ord(character) for character in text}
    characters.update(code for start, end in ranges for code in range(start, end + 1))
    font_subset.populate(unicodes=characters)
    font_subset.subset(font)

    names = {1: "AiChan Preview", 2: "Regular", 4: "AiChan Preview", 6: "AiChanPreview", 16: "AiChan Preview", 17: "Regular"}
    for record in list(font["name"].names):
        if record.nameID in names:
            font["name"].setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
    font.save(root / "share-assets" / "ai-chan-preview.bin")


if __name__ == "__main__":
    main()
