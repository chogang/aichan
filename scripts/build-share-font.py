"""Build the share card fonts from Google Fonts Noto Sans JP, KR, and SC."""

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
    font.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jp_font", type=Path, help="Path to NotoSansJP[wght].ttf")
    parser.add_argument("kr_font", type=Path, help="Path to NotoSansKR[wght].ttf")
    parser.add_argument("sc_font", type=Path, help="Path to NotoSansSC[wght].ttf")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    catalog = json.loads((root / "songlist.json").read_text(encoding="utf-8"))
    labels = json.loads((root / "share-locales.json").read_text(encoding="utf-8"))
    text = "".join(title for song in catalog["songs"] for title in strings(song.get("title_localized") or song["id"]))
    text += "".join(strings(catalog.get("packNames", {}))) + "".join(strings(labels))

    # Retain future Latin, Greek, Cyrillic, punctuation and kana titles too.
    ranges = [(0x20, 0x24F), (0x370, 0x52F), (0x2000, 0x206F), (0x3000, 0x30FF), (0xFF01, 0xFFEF)]
    characters = {ord(character) for character in text}
    characters.update(code for start, end in ranges for code in range(start, end + 1))
    jp_font = TTFont(args.jp_font)
    kr_font = TTFont(args.kr_font)
    sc_font = TTFont(args.sc_font)
    jp_characters = characters.intersection(jp_font.getBestCmap())
    kr_characters = characters.difference(jp_characters).intersection(kr_font.getBestCmap())
    sc_characters = characters.difference(jp_characters, kr_characters).intersection(sc_font.getBestCmap())
    assets = root / "share-assets"
    save_subset(jp_font, jp_characters, "AiChan Preview", assets / "ai-chan-preview.bin")
    save_subset(kr_font, kr_characters, "AiChan Hangul", assets / "ai-chan-preview-ko.bin")
    save_subset(sc_font, sc_characters, "AiChan Han", assets / "ai-chan-preview-zh.bin")


if __name__ == "__main__":
    main()
