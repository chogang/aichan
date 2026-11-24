# Arcaea Ai-chan Recommendations

**English** · [한국어](README.ko.md)

An offline tool that reproduces the three daily song recommendations from `skill_aichan`, the skill of Arcaea partner Ai-chan (ID 75), in version 7.3.0. The same effective date and song catalog yield the same songs in the same order.

## Use the browser viewer

[Open the Ai-chan recommendation viewer](https://chogang.github.io/aichan/)

Choose Korean, English, Japanese, or Simplified Chinese from the menu below the version number. The **EN** and **JP** checkboxes under the filters control which song titles appear in the results and exports.

The viewer shows reset times in Korean Standard Time, US Eastern Time, Japan Standard Time, or China Standard Time, depending on the interface language. The selected date and its recommendations stay the same when you change the language.

1. Enter a start date. Leave both the end date and the number of days blank to look up just the start date, or fill in one field for a range. Filling one field disables the other. **Reset** (**초기화**) clears both fields and keeps the start date. The start date counts as day 1. **Today** (**오늘**) opens a single day, and the **7-day**, **30-day**, and **365-day** buttons query ranges starting today.
2. Click **Find recommendations** (**추천곡 조회**). The viewer shows three songs per date. Ranges include both endpoints and are split into pages of up to 365 days. Use the pagination buttons to view the rest of the range.
3. Under **Text export** (**텍스트 내보내기**), choose **Copy all** (**전체 복사**) or **Save as TXT** (**TXT 저장**) to export the current page. Pack and chart details are enabled by default. The browser remembers each of these two options when local storage is available.

Use **Song search** (**곡 검색**) to find titles, artists, or song IDs in the results. Set a difficulty (**난이도**) and an inclusive level range to filter the current page. A song qualifies when one chart meets both selections. For example, `9+` falls between `9` and `10`.

Use **+** to add the current search, difficulty, and level choices as a filter group. Choose **OR** to show songs that match any group, or **AND** to show songs that match every group. A song may match different groups through different charts. The current fields can also add a temporary group while you edit them. To remove a group, select it above the song-title language settings and press **−**. **Reset** clears the groups and fields and restores **OR**.

Use the per-day **Copy** (**복사**) button to copy that date’s filtered songs and jacket links. The **Share** (**공유**) button and the last line of the copy use a link to that day’s full recommendations. The preview places three vertical cards side by side. Each card shows the pack name and Free or Paid label above the jacket, with the song title, artist, and FTR, ETR, BYD, or INS levels below. The link uses the selected viewer language for the preview and when opened in the viewer. Links without a date select today. Jacket images in pasted content display when the destination app supports pasted HTML and loads external images. [English dated share link](https://arcaea-aichan.pages.dev/share?date=2026-11-18&lang=en) · [Today's share link in English](https://arcaea-aichan.pages.dev/share?lang=en)

The viewer and its link previews label songs **Paid** when the Arcaea catalog lists a purchase item, and **Free** when the purchase field is empty. Account ownership and World Mode unlocks still determine access in the game.

The recommendation date changes at 05:00 KST. Selecting **Today** before 05:00 KST shows the previous date's recommendations. For offline use, download the [viewer HTML](docs/index.html) and open it in a browser.

The viewer accepts dates from 2025-11-08 through 2099-12-31.

## Use the command line

Install Node.js and run one of these commands from the repository. The tool outputs song IDs, titles, artists, pack IDs, and the effective time range as JSON.

```sh
node aichan-recommend.js
node aichan-recommend.js --date '2026-11-18T05:00:00+09:00'
node aichan-recommend.js --seed 20775
```

Without arguments, the tool uses the current time. The `--date` value must be an ISO 8601 timestamp with a time zone. The included `songlist.json` contains song indices, IDs, and display metadata. To use another catalog with the same structure, pass its path with `--catalog`.

## Use the JSON API

Send a `GET` request to the [recommendations endpoint](https://arcaea-aichan-api.pages.dev/api/recommendations). Use either `date` or `seed`.

| Request path | Result |
|---|---|
| `/api/recommendations` | Today's recommendations. The day changes at 05:00 KST. |
| `/api/recommendations?date=2026-11-18` | Recommendations for the specified `YYYY-MM-DD` date, beginning at 05:00 KST. |
| `/api/recommendations?seed=20775` | Recommendations for an integer seed from `20400` through `10000000`. |

The JSON includes `day_index`, `effective_period_utc`, and `songs`. Each song includes a `difficulties` array using the same chart labels and display levels as the viewer, for example `[{"difficulty":"FTR","level":"9+"}]`. Levels are strings so the `+` is preserved. Songs without chart data have an empty array. The API returns HTTP `400` with a JSON `error` for invalid arguments, duplicates, or a combination of `date` and `seed`.

The `/share-card` endpoint returns a PNG. Use `v=1` for the original list layout or `v=2` for three side-by-side cards. The endpoint defaults to `v=2`, and share links use that layout for their previews. Either layout accepts `date` and `lang`. [List layout](https://arcaea-aichan.pages.dev/share-card?v=1&date=2026-11-18&lang=en) · [Card layout](https://arcaea-aichan.pages.dev/share-card?v=2&date=2026-11-18&lang=en)

Run `npm ci` from the repository root, then use `npx wrangler pages dev api-public` for the JSON API or `npx wrangler pages dev share-public` for the share links and images. With Node.js 22 or later, run `node verify-api.mjs` to compare the API against the CLI and `node verify-share.mjs` to check the card layouts, share metadata, and viewer link.

Deploy `api-public` to the `arcaea-aichan-api` Pages project and `share-public` to `arcaea-aichan`. Older share links redirect to the new project and retain their date and language.

## Update the song catalog

Pass a complete Arcaea `songlist.json` to the update script. You may also supply `packlist.json` for display names. Skip the pack list to reuse known names and display IDs for new packs.

```sh
node scripts/update-catalog.cjs --dry-run FULL_SONGLIST.json PACKLIST.json
node scripts/update-catalog.cjs FULL_SONGLIST.json PACKLIST.json
node verify-api.mjs
node verify.js
```

The script validates the input and regenerates the CLI catalog, API difficulties, and the viewer's encrypted data block. Review the generated changes and commit those files. The viewer still works offline as a single HTML file. Publish the updated API separately from the GitHub Pages viewer when the public API should use the new catalog.

To update jacket thumbnails, add song IDs and their 32-character lowercase hexadecimal hashes to `song-jackets.json`, then run the same catalog update command. The viewer builds the official URL as `https://webassets.lowiro.com/<hash>.jpg?v=323` when rendering the list. Songs without a known or available jacket are displayed without a thumbnail.

The recommendation algorithm is based on Arcaea 7.3.0. A catalog update can change results for earlier dates, and a game update may require checking the algorithm again.

After adding text with new characters to the catalog or share card translations, install FontTools with `python -m pip install fonttools==4.60.1` and rebuild the font subsets with `python scripts/build-share-font.py 'NotoSansJP[wght].ttf' 'NotoSansKR[wght].ttf' 'NotoSansSC[wght].ttf'`. Commit the updated subsets in `share-assets/` with the text changes. The source fonts are distributed under the SIL Open Font License in `share-assets/OFL.txt`. [Noto Sans JP](https://github.com/google/fonts/tree/main/ofl/notosansjp) · [Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr) · [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)

## How the recommendations are selected

1. **Convert the date to a seed.** The game applies a runtime clock correction and checks login and clock validity. With the effective time expressed in Unix milliseconds, the seed is `floor((effectiveTime + 14_400_000) / 86_400_000)`. Adding four hours puts the daily boundary at 20:00 UTC, or 05:00 KST. The game reuses recommendations for the same seed. The tool treats the supplied timestamp as the effective time.
2. **Shuffle the candidate indices.** Initialize an array from `0` to `4999` and set all three random number states to the date seed. Generate one random value per swap, starting at the end of the array.

   ```text
   x = (171 × x) mod 30269
   y = (172 × y) mod 30307
   z = (170 × z) mod 30323
   r = ((x / 30269 + y / 30307) + z / 30323) mod 1

   for i from 4999 down to 1
       r = next random value
       j = trunc(float32(r × i))
       swap(array[i], array[j])
   ```

   The divisions, additions, and multiplication used to find the swap index use single precision (`float32`). The multiplier is `i`, so the swap partner lies between `0` and `i−1`. The JavaScript implementation uses `Math.fround` to reproduce the rounding.
3. **Scan the shuffled array until three songs are selected.** Look up each value by the song's `idx` field. Skip unregistered indices and the song ID `lasteternity`. Take the first song for which `set == "base"` or `id == "innocence"`, and the first two songs from the remaining group. The selection preserves encounter order and operates at the song level. Chart difficulties are display information.

With seed `20775` (from 2026-11-18 at 05:00 KST up to but excluding 05:00 KST the next day), the second, seventh, and twelfth entries in the shuffled array supply the recommendations.

| Position | `idx` | Song | Group |
|---:|---:|---|---|
| 2 | 521 | +1(UNKNOWN)-NUMBER | First song from the remaining group |
| 7 | 263 | DDD | Base group |
| 12 | 468 | Syriana | Second song from the remaining group |

## Verify the implementation

The ARM64 code in Arcaea 7.3.0 connects `skill_aichan` to `CharacterAbilityPreferredSongDaily`. Tracing the function the game calls for an active partner of this type revealed the date calculation, shuffle, and song selection rules.

To run the verification, install Node.js and JDK 11 or later with Java source-file execution support.

```sh
node verify.js
```

This compares the complete shuffle order produced by Java's `float` implementation and JavaScript's `Math.fround` implementation across **43 seeds × 5,000 indices**. It also checks that catalog indices are unique and that the CLI returns the expected seed and song IDs on either side of the 05:00 KST boundary.

| Korean time | Seed | Expected song IDs |
|---|---:|---|
| 2026-11-18 04:59:59.999 | 20774 | `mantis`, `callmyname`, `diode` |
| 2026-11-18 05:00:00.000 | 20775 | `unknownnum`, `ddd`, `syriana` |

To check the order in the browser, query 2026-11-18 with song IDs enabled. The result should read `unknownnum`, `ddd`, `syriana`. A range from 2026-11-17 through 2026-11-18 should show six songs across the two dates. Compare the on-screen IDs with the text export or save a TXT file to check the downloaded result.

The verification covers the implementation based on static analysis. Comparison against the running game, reproduction of runtime clock corrections and login state, and a complete check of song registration filters remain outside its scope. The game version and song catalog can affect the results.
