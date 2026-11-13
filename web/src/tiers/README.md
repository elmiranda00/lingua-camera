# tiers

## Purpose

Decides how each word box looks: **Saved** (already in the user's bank), **Key** (less common
content word) or **Normal**. Holds the word lists the Key rule uses.

## How it works

1. `tierBoxes(lines, lang, saved)` walks the OCR lines in the order given.
2. For each word box it tracks whether a sentence has just ended (`. ! ? …`, across line breaks), because that decides whether a capital letter marks a name.
3. A box is Saved if its normalised text is in the saved set, else Key if `lang.isKeyWord` says so, else Normal. Saved wins over Key.

## Key files

| File | Role |
| --- | --- |
| `tiers.ts` | `tierBoxes`, the `Tier` and `TieredBox` types |
| `data/fr-common.json` | French forms counted as common (≈18,800 forms of the top 2,000 lemmas) |
| `data/zh-hsk12.json` | HSK 3.0 levels 1–2 words (1,256) |
| `data/NOTICE.md` | Credits and licences for both lists |

## Interfaces

`tierBoxes(lines: OcrLine[], lang: LangModule, saved?: ReadonlySet<string>): TieredBox[]`.
`saved` holds words already passed through `lang.normalizeForMatch`.

## Running and testing

```
npm run wordlists                       # rebuild data/*.json from the pinned sources (needs internet)
npx vitest run --project web web/test/tiers
```

## Design choices

- **Word lists are committed small JSON files** (about 230 KB), built by a script from hash-pinned sources, so the app and CI need no download.
- **French list is CC BY-SA 4.0 (Lexique 3.83); Chinese is HSK 3.0 levels 1–2.** Credits and the share-alike note are in `data/NOTICE.md`.
- **Saved words match single tokens for now.** Shading every box a saved Chinese phrase spans comes with the word bank (M3).

## Gotchas

- Changing a list changes which words are Key. Update the data test if the size changes.
- The French list is large because it holds every inflected form; it loads with the camera page.
