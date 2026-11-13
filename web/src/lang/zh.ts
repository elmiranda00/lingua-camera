// Mandarin (Simplified): word splitting, box widths, key-word rule
import hsk from "../tiers/data/zh-hsk12.json";
import { boxesForWords } from "./lineBoxes.ts";
import type { LangModule, OcrLine, Word } from "./types.ts";

const HSK = new Set<string>(hsk);
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const HAN = /\p{Script=Han}/u;

// Han and full-width characters fill their cell; Latin text and digits are narrower
function charWidth(ch: string): number {
  if (/\s/.test(ch)) return 0.3;
  if (/[0-9]/.test(ch)) return 0.55;
  if (/[ilI.,;:'!|]/.test(ch)) return 0.28;
  if (/[A-Z]/.test(ch)) return 0.65;
  if (/[a-z]/.test(ch)) return 0.5;
  if (/[!-~]/.test(ch)) return 0.35; // other ASCII punctuation
  return 1;
}

function segment(text: string): Word[] {
  return [...segmenter.segment(text)].map((s) => ({
    text: s.segment,
    start: s.index,
    end: s.index + s.segment.length,
    wordLike: s.isWordLike === true,
  }));
}

// Exact match on the written word
const normalizeForMatch = (word: string) => word.normalize("NFC").trim();

// Only words with Han characters can be key (Latin text, digits and punctuation never are)
function isKeyWord(word: string): boolean {
  const w = normalizeForMatch(word);
  return HAN.test(w) && !HSK.has(w);
}

export const zh: LangModule = {
  lang: "zh",
  segment,
  splitLineBoxes: (line: OcrLine) =>
    boxesForWords(
      segment(line.text).filter((w) => w.wordLike),
      line,
      charWidth,
    ),
  normalizeForMatch,
  isKeyWord,
  collator: new Intl.Collator("zh-u-co-pinyin"),
  speechLang: "zh-CN",
};
