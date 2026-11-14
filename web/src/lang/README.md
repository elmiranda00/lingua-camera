# lang

## Purpose

Everything that differs between French and Mandarin sits here, behind one interface. Components
ask for a module with `getLang(lang)` and never branch on the language.

## How it works

1. OCR gives one polygon and one text string per **line**.
2. `segment(text)` cuts the text into tokens (French: elisions split, hyphenated words kept whole; Chinese: `Intl.Segmenter`).
3. `splitLineBoxes(line)` turns each word-like token into a quad. The line's quad is shared out by
   estimated character widths (`lineBoxes.ts`), so a word's box is a slice of the line's box.
4. The tier rules (`../tiers/`) call `isKeyWord` and `normalizeForMatch` to decide Saved, Key or Normal.
5. **Sentence for a tap** (`createSentenceFinder` in `context.ts`): `groupBlocks` sorts the lines into blocks
   (paragraphs, columns, signs). A block's lines are joined in reading order (`joinLines`), the text is cut at
   the sentence ends around the tapped word (`isSentenceEnd`), and anything over 300 characters is clipped to a
   window around the word, on word boundaries. If the text has no sentence end on either side of the word
   (menu, label, sign), only the tapped line and the lines directly above and below it are used.

## Key files

| File | Role |
| --- | --- |
| `types.ts` | `LangModule` interface, `Quad`, `OcrLine`, `Word`, `WordBox` |
| `lineBoxes.ts` | Line quad → word quads: width sharing, tilted lines, vertical lines (height > 2× width, top to bottom) |
| `blocks.ts` | `groupBlocks`: lines → blocks in reading order, horizontal and vertical |
| `context.ts` | `createSentenceFinder`: the sentence sent with a tapped word |
| `sentences.ts` | Sentence-end test shared by both languages |
| `fr.ts` | French module |
| `zh.ts` | Mandarin module |
| `index.ts` | `getLang(lang)` |

## Interfaces

`LangModule`: `segment`, `splitLineBoxes`, `joinLines`, `isSentenceEnd`, `normalizeForMatch`, `isKeyWord`, `collator`, `speechLang`.
`createSentenceFinder(lines, lang, max?)` returns `(word: { line, start, end }) => string`; `line` and the offsets are those of a `WordBox` / `TieredBox`.
Quads are `[top-left, top-right, bottom-right, bottom-left]` in photo pixels, as PaddleOCR returns them.

## Running and testing

```
npx vitest run --project web web/test/lang
```

Tests use real OCR output from `web/test/ocr/__fixtures__/` (through `web/test/tiers/`), plus small constructed layouts (columns, vertical text, hyphenation) in `web/test/lang/`.

## Design choices

- **Box widths come from per-character width estimates, not equal shares.** Book fonts are
  proportional (an *i* is much narrower than an *m*), and Chinese lines mix Han characters with digits. Equal shares drifted visibly.
- **French key-word list is lemma-based:** every form of the 2,000 most frequent lemmas counts as common, so *mangeaient* is common because *manger* is.
- **A capitalised word inside a sentence is treated as a name** (not key); at a sentence start, or in ALL CAPS, it is judged as a normal word.
- **Chinese: only words containing Han characters can be key.** Latin text, numbers and punctuation never are.
- **Hyphenated French compounds stay whole,** including `dit-il`; a compound counts as common when every part is.

- **Blocks come from geometry only:** lines of similar size (within 1.5×) that sit directly below each other (gap under 0.8 line heights) and overlap sideways by 30% of the shorter line. Vertical text uses the same rules turned a quarter: columns go right to left. Thresholds are constants at the top of `blocks.ts`.
- **Sentence cuts do the real work, blocks only keep columns apart.** A paragraph break with no gap still lands in one block; the full stop ends the sentence.
- **A full stop only ends a French sentence at a word break** (not in `3.5` or `www.site.fr`) and not after a lone capital (`M. Dupont`). `»` stays with its sentence.

## Gotchas

- `Intl.Segmenter` uses a general dictionary. Menu and shop words are often cut into single characters or short pieces (外婆菜炒鸡蛋 → 外婆 / 菜 / 炒 / 鸡蛋). The sentence sent for lookup (M2) supplies the context.
- French boxes are approximate: they can overlap a neighbour by part of a letter on narrow words.
- HSK 3.0 lists words such as 你 and 好 but not 你好, so 你好 shows as Key.
- Elision prefixes (`l'`, `qu'`) get their own box and are never Key.
- End-of-line hyphenation is rejoined in the sentence (`extra-` + `ordinaire` → `extraordinaire`) when the next line starts lowercase, but the tapped half is still what is sent as the word.
- Where there is no sentence end on either side of the word (menus, labels, signs), the context is the tapped line plus the line above and below it, not the whole block. A sign split over three lines is still sent whole.
