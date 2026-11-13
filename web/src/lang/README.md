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

## Key files

| File | Role |
| --- | --- |
| `types.ts` | `LangModule` interface, `Quad`, `OcrLine`, `Word`, `WordBox` |
| `lineBoxes.ts` | Line quad → word quads: width sharing, tilted lines, vertical lines (height > 2× width, top to bottom) |
| `fr.ts` | French module |
| `zh.ts` | Mandarin module |
| `index.ts` | `getLang(lang)` |

## Interfaces

`LangModule`: `segment`, `splitLineBoxes`, `normalizeForMatch`, `isKeyWord`, `collator`, `speechLang`.
Quads are `[top-left, top-right, bottom-right, bottom-left]` in photo pixels, as PaddleOCR returns them.

## Running and testing

```
npx vitest run --project web web/test/lang
```

Tests use real OCR output from `web/test/ocr/__fixtures__/` (through `web/test/tiers/`).

## Design choices

- **Box widths come from per-character width estimates, not equal shares.** Book fonts are
  proportional (an *i* is much narrower than an *m*), and Chinese lines mix Han characters with digits. Equal shares drifted visibly.
- **French key-word list is lemma-based:** every form of the 2,000 most frequent lemmas counts as common, so *mangeaient* is common because *manger* is.
- **A capitalised word inside a sentence is treated as a name** (not key); at a sentence start, or in ALL CAPS, it is judged as a normal word.
- **Chinese: only words containing Han characters can be key.** Latin text, numbers and punctuation never are.
- **Hyphenated French compounds stay whole,** including `dit-il`; a compound counts as common when every part is.

## Gotchas

- `Intl.Segmenter` uses a general dictionary. Menu and shop words are often cut into single characters or short pieces (外婆菜炒鸡蛋 → 外婆 / 菜 / 炒 / 鸡蛋). The sentence sent for lookup (M2) supplies the context.
- French boxes are approximate: they can overlap a neighbour by part of a letter on narrow words.
- HSK 3.0 lists words such as 你 and 好 but not 你好, so 你好 shows as Key.
- Elision prefixes (`l'`, `qu'`) get their own box and are never Key.
- End-of-line hyphenation (`extra-` / `ordinaire`) is not rejoined here; M2 does it when it builds the lookup sentence.
