# Arcaea Ai-chan Recommendations

**English** · [한국어](README.ko.md)

An offline tool that reproduces the three daily song recommendations from `skill_aichan`, the skill of Arcaea partner Ai-chan (ID 75), in version 7.3.0. The same effective date and song catalog yield the same songs in the same order.

## Use the browser viewer

[Open the Ai-chan recommendation viewer](https://chogang.github.io/arcaea-aichan-recommendations/)

1. The viewer interface is in Korean. Choose **Single day** (**하루 조회**) and pick a date, or choose **Date range** (**기간 조회**) and pick a start and end date. **Today** (**오늘**), **7 days** (**7일**), and **30 days** (**30일**) fill in the dates for you.
2. Click **Find recommendations** (**추천곡 조회**). The viewer shows three songs per date. Date ranges include both endpoints and can span up to 366 days.
3. Under **Text export** (**텍스트 내보내기**), optionally include song IDs (**곡 ID 포함**), packs (**곡 팩 포함**), or chart difficulties (**곡 난이도 포함**). Choose **Copy all** (**전체 복사**) or **Save as TXT** (**TXT 저장**).

The recommendation date changes at 05:00 KST. Selecting **Today** before 05:00 KST shows the previous date's recommendations. For offline use, download the [viewer HTML](docs/index.html) and open it in a browser.

## Use the command line

Install Node.js and run one of these commands from the repository. The tool outputs song IDs, titles, artists, pack IDs, and the effective time range as JSON.

```sh
node aichan-recommend.js
node aichan-recommend.js --date '2026-11-18T05:00:00+09:00'
node aichan-recommend.js --seed 20775
```

Without arguments, the tool uses the current time. The `--date` value must be an ISO 8601 timestamp with a time zone. The included `songlist.json` contains 570 song entries from version 7.3.0 with indices, IDs, and display metadata. To use another catalog with the same structure, pass its path with `--catalog`.

## Use the JSON API

Send a `GET` request to the [recommendations endpoint](https://arcaea-aichan-api.pages.dev/api/recommendations). Use either `date` or `seed`.

| Request path | Result |
|---|---|
| `/api/recommendations` | Today's recommendations. The day changes at 05:00 KST. |
| `/api/recommendations?date=2026-11-18` | Recommendations for the specified `YYYY-MM-DD` date, beginning at 05:00 KST. |
| `/api/recommendations?seed=20775` | Recommendations for an integer seed from `20400` through `10000000`. |

The JSON matches the CLI output and includes `day_index`, `effective_period_utc`, and `songs`. The API returns HTTP `400` with a JSON `error` for invalid arguments, duplicates, or a combination of `date` and `seed`.

Run `npx wrangler pages dev` from the repository root to try the endpoint at `http://localhost:8788/api/recommendations`. To verify the API response and date boundary against the CLI, run `node verify-api.mjs` with Node.js 22 or later.

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
